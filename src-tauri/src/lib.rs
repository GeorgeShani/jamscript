use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use git2::{build::CheckoutBuilder, IndexAddOption, Repository, RepositoryInitOptions, Status, StatusOptions};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs,
    path::{Component, Path, PathBuf},
    sync::{mpsc, Arc, Mutex},
    thread,
    time::Duration,
};
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Folder { id: String, name: String, path: PathBuf }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Document { name: String, source: String, revision: String }

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitFileStatus { name: String, status: String }

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitStatus { branch: Option<String>, files: Vec<GitFileStatus> }

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCommitFile { name: String, expected_revision: Option<String>, #[serde(default)] deleted: bool }

struct Folders {
    items: Arc<Mutex<Vec<Folder>>>,
    watcher: Mutex<Option<RecommendedWatcher>>,
}

fn watch_folders(watcher: &mut RecommendedWatcher, folders: &[Folder]) {
    for folder in folders {
        let _ = watcher.watch(&folder.path, RecursiveMode::NonRecursive);
    }
}

fn store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("recent-folders.json"))
}

fn persist(app: &tauri::AppHandle, folders: &[Folder]) -> Result<(), String> {
    let path = store_path(app)?;
    let data = serde_json::to_vec(folders).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())
}

fn folder(state: &State<'_, Folders>, id: &str) -> Result<Folder, String> {
    state.items.lock().map_err(|e| e.to_string())?
        .iter().find(|item| item.id == id).cloned()
        .ok_or_else(|| "Folder was not selected in JamScript".to_string())
}

fn file_path(root: &Folder, name: &str, must_exist: bool) -> Result<PathBuf, String> {
    let candidate = Path::new(name);
    if candidate.components().count() != 1 || !matches!(candidate.components().next(), Some(Component::Normal(_)))
        || !matches!(candidate.extension().and_then(|v| v.to_str()), Some("js" | "strudel")) {
        return Err("Only top-level .js and .strudel files are supported".into());
    }
    let root_path = fs::canonicalize(&root.path).map_err(|e| e.to_string())?;
    if !root_path.is_dir() { return Err("Selected folder is unavailable".into()); }
    let path = root_path.join(candidate);
    match fs::symlink_metadata(&path) {
        Ok(meta) if meta.file_type().is_symlink() || !meta.is_file() => Err("Symlinks and non-files are not supported".into()),
        Ok(_) => {
            let canonical = fs::canonicalize(&path).map_err(|e| e.to_string())?;
            if canonical.parent() != Some(root_path.as_path()) { return Err("File escapes selected folder".into()); }
            Ok(path)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound && !must_exist => Ok(path),
        Err(e) => Err(e.to_string()),
    }
}

fn revision(source: &str) -> String { format!("{:x}", Sha256::digest(source.as_bytes())) }

fn selected_repository(root: &Folder) -> Result<Repository, String> {
    let root_path = fs::canonicalize(&root.path).map_err(|e| e.to_string())?;
    if fs::symlink_metadata(root_path.join(".git")).map(|meta| meta.file_type().is_symlink()).unwrap_or(false) {
        return Err("Repository metadata cannot be a symlink".into());
    }
    let repo = Repository::open(&root_path).map_err(|_| "No Git repository in this selected folder".to_string())?;
    let workdir = repo.workdir().ok_or("Bare repositories are not supported")?;
    if fs::canonicalize(workdir).map_err(|e| e.to_string())? != root_path {
        return Err("The repository root must be the selected folder".into());
    }
    if repo.state() != git2::RepositoryState::Clean {
        return Err("Finish the current Git operation before using JamScript Git".into());
    }
    Ok(repo)
}

fn read_git_status(repo: &Repository) -> Result<GitStatus, String> {
    let mut options = StatusOptions::new();
    options.include_untracked(true).recurse_untracked_dirs(false);
    let statuses = repo.statuses(Some(&mut options)).map_err(|e| e.to_string())?;
    let files = statuses.iter().filter_map(|entry| {
        let name = entry.path().ok()?;
        if !name.ends_with(".js") && !name.ends_with(".strudel") { return None; }
        if name.contains('/') || name.contains('\\') { return None; }
        let state = entry.status();
        let status = if state.contains(Status::WT_NEW) { "untracked" }
            else if state.contains(Status::WT_DELETED) || state.contains(Status::INDEX_DELETED) { "deleted" }
            else if state.contains(Status::WT_MODIFIED) || state.contains(Status::INDEX_MODIFIED) { "modified" }
            else if state.contains(Status::INDEX_NEW) { "added" }
            else if state.is_conflicted() { "conflict" }
            else { "changed" };
        Some(GitFileStatus { name: name.to_string(), status: status.into() })
    }).collect();
    let branch = repo.head().ok().and_then(|head| head.shorthand().ok().map(str::to_string));
    Ok(GitStatus { branch, files })
}

#[tauri::command]
fn git_status(state: State<'_, Folders>, folder_id: String) -> Result<GitStatus, String> {
    read_git_status(&selected_repository(&folder(&state, &folder_id)?)?)
}

#[tauri::command]
fn git_init(state: State<'_, Folders>, folder_id: String) -> Result<GitStatus, String> {
    let selected = folder(&state, &folder_id)?;
    let root = fs::canonicalize(&selected.path).map_err(|e| e.to_string())?;
    if root.join(".git").exists() { return Err("This folder already contains Git metadata".into()); }
    let mut options = RepositoryInitOptions::new();
    options.no_reinit(true).mkdir(false).mkpath(false);
    Repository::init_opts(&root, &options).map_err(|e| e.to_string())?;
    read_git_status(&selected_repository(&selected)?)
}

#[tauri::command]
fn git_commit_files(state: State<'_, Folders>, folder_id: String, files: Vec<GitCommitFile>, message: String) -> Result<GitStatus, String> {
    let selected = folder(&state, &folder_id)?;
    commit_music_files(&selected, files, message)
}

fn clone_into_selected_folder(selected: &Folder, url: &str) -> Result<GitStatus, String> {
    let root = fs::canonicalize(&selected.path).map_err(|e| e.to_string())?;
    if fs::read_dir(&root).map_err(|e| e.to_string())?.next().is_some() {
        return Err("Choose an empty selected folder for Clone".into());
    }
    let repo = Repository::clone(url, &root).map_err(|e| e.to_string())?;
    read_git_status(&repo)
}

#[tauri::command]
fn git_clone(state: State<'_, Folders>, folder_id: String, url: String) -> Result<GitStatus, String> {
    if !url.starts_with("https://") || url.contains('@') || url.len() > 2048 {
        return Err("Enter an HTTPS repository URL without embedded credentials".into());
    }
    clone_into_selected_folder(&folder(&state, &folder_id)?, &url)
}

fn origin(repo: &Repository) -> Result<git2::Remote<'_>, String> {
    repo.find_remote("origin").map_err(|_| "Add an origin remote before syncing".into())
}

fn current_branch(repo: &Repository) -> Result<String, String> {
    let head = repo.head().map_err(|_| "Make a commit before syncing".to_string())?;
    if !head.is_branch() { return Err("Check out a branch before syncing".into()); }
    head.shorthand().map(str::to_string).map_err(|_| "Current branch is unavailable".into())
}

fn push_current_branch(selected: &Folder) -> Result<GitStatus, String> {
    let repo = selected_repository(selected)?;
    let branch = current_branch(&repo)?;
    let mut remote = origin(&repo)?;
    let refspec = format!("refs/heads/{branch}:refs/heads/{branch}");
    remote.push(&[refspec.as_str()], None).map_err(|e| format!("Push failed: {e}"))?;
    read_git_status(&repo)
}

#[tauri::command]
fn git_push(state: State<'_, Folders>, folder_id: String) -> Result<GitStatus, String> {
    push_current_branch(&folder(&state, &folder_id)?)
}

fn pull_fast_forward(selected: &Folder) -> Result<GitStatus, String> {
    let repo = selected_repository(selected)?;
    let mut options = StatusOptions::new();
    options.include_untracked(true).recurse_untracked_dirs(true);
    if !repo.statuses(Some(&mut options)).map_err(|e| e.to_string())?.is_empty() {
        return Err("Save or remove local changes before Pull".into());
    }
    let branch = current_branch(&repo)?;
    let mut remote = origin(&repo)?;
    remote.fetch(&[branch.as_str()], None, None).map_err(|e| format!("Fetch failed: {e}"))?;
    let target_ref = format!("refs/remotes/origin/{branch}");
    let target = repo.find_reference(&target_ref).map_err(|_| "Origin does not have this branch".to_string())?;
    let annotated = repo.reference_to_annotated_commit(&target).map_err(|e| e.to_string())?;
    let (analysis, _) = repo.merge_analysis(&[&annotated]).map_err(|e| e.to_string())?;
    if analysis.is_up_to_date() { return read_git_status(&repo); }
    if !analysis.is_fast_forward() { return Err("Branches diverged. JamScript only performs fast-forward pulls".into()); }
    let commit = repo.find_commit(annotated.id()).map_err(|e| e.to_string())?;
    let tree = commit.tree().map_err(|e| e.to_string())?;
    repo.checkout_tree(tree.as_object(), Some(CheckoutBuilder::new().safe())).map_err(|e| format!("Could not safely load fetched files: {e}"))?;
    repo.find_reference(&format!("refs/heads/{branch}"))
        .and_then(|mut reference| reference.set_target(commit.id(), "JamScript fast-forward pull"))
        .map_err(|e| e.to_string())?;
    read_git_status(&repo)
}

#[tauri::command]
fn git_pull_fast_forward(state: State<'_, Folders>, folder_id: String) -> Result<GitStatus, String> {
    pull_fast_forward(&folder(&state, &folder_id)?)
}

fn commit_music_files(selected: &Folder, files: Vec<GitCommitFile>, message: String) -> Result<GitStatus, String> {
    let repo = selected_repository(&selected)?;
    let message = message.trim();
    if message.is_empty() || message.len() > 500 { return Err("Enter a commit message under 500 characters".into()); }
    if files.is_empty() || files.len() > 32 { return Err("Select 1 to 32 saved music files".into()); }
    let mut names = HashSet::new();
    for file in &files {
        if !names.insert(file.name.clone()) { return Err("A file was selected twice".into()); }
        let path = file_path(&selected, &file.name, !file.deleted)?;
        if file.deleted {
            if path.exists() { return Err(format!("{} exists again. Refresh Git status before committing.", file.name)); }
        } else {
            let source = fs::read_to_string(path).map_err(|e| e.to_string())?;
            if file.expected_revision.as_deref() != Some(revision(&source).as_str()) {
                return Err(format!("{} changed since it was selected. Save and review it before committing.", file.name));
            }
        }
    }
    let mut options = StatusOptions::new();
    options.include_untracked(true);
    let statuses = repo.statuses(Some(&mut options)).map_err(|e| e.to_string())?;
    if statuses.iter().any(|entry| entry.status().intersects(
        Status::INDEX_NEW | Status::INDEX_MODIFIED | Status::INDEX_DELETED | Status::INDEX_RENAMED | Status::INDEX_TYPECHANGE
    )) { return Err("The Git index already has staged changes. Review them before using JamScript Commit.".into()); }
    let author = repo.signature().map_err(|_| "Set your Git name and email before committing".to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    for file in &files {
        if file.deleted {
            if index.get_path(Path::new(&file.name), 0).is_none() { return Err(format!("{} is not tracked by Git", file.name)); }
            index.remove_path(Path::new(&file.name)).map_err(|e| e.to_string())?;
        } else {
            index.add_all([file.name.as_str()], IndexAddOption::DISABLE_PATHSPEC_MATCH, None).map_err(|e| e.to_string())?;
        }
    }
    let tree_id = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_id).map_err(|e| e.to_string())?;
    let parent = repo.head().ok().and_then(|head| head.peel_to_commit().ok());
    if parent.as_ref().is_some_and(|commit| commit.tree_id() == tree_id) {
        return Err("Selected files have no saved changes to commit".into());
    }
    let parents = parent.iter().collect::<Vec<_>>();
    repo.commit(Some("HEAD"), &author, &author, message, &tree, &parents).map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    read_git_status(&repo)
}

#[cfg(test)]
mod git_tests {
    use super::*;

    #[test]
    fn selected_music_commit_preserves_unselected_files_and_rejects_stale_disk_content() {
        let path = std::env::temp_dir().join(format!("jamscript-git-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&path).unwrap();
        let selected = Folder { id: "test".into(), name: "Test".into(), path: path.clone() };
        let repo = Repository::init(&path).unwrap();
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "JamScript Test").unwrap();
        config.set_str("user.email", "test@example.invalid").unwrap();
        fs::write(path.join("song.js"), "s('bd')").unwrap();
        fs::write(path.join("private.txt"), "keep out").unwrap();
        assert!(commit_music_files(&selected, vec![GitCommitFile {
            name: "song.js".into(), expected_revision: Some(revision("old")), deleted: false
        }], "First take".into()).is_err());
        commit_music_files(&selected, vec![GitCommitFile {
            name: "song.js".into(), expected_revision: Some(revision("s('bd')")), deleted: false
        }], "First take".into()).unwrap();
        let committed = repo.head().unwrap().peel_to_commit().unwrap();
        let tree = committed.tree().unwrap();
        assert!(tree.get_name("song.js").is_some());
        assert!(tree.get_name("private.txt").is_none());
        fs::remove_file(path.join("song.js")).unwrap();
        commit_music_files(&selected, vec![GitCommitFile {
            name: "song.js".into(), expected_revision: None, deleted: true
        }], "Remove old song".into()).unwrap();
        let removed = repo.head().unwrap().peel_to_commit().unwrap();
        assert!(removed.tree().unwrap().get_name("song.js").is_none());
        assert!(path.join("private.txt").exists());
        fs::remove_dir_all(path).unwrap();
    }

    #[test]
    fn clone_push_and_pull_only_fast_forward_clean_repositories() {
        let root = std::env::temp_dir().join(format!("jamscript-git-remote-{}", uuid::Uuid::new_v4()));
        let origin_path = root.join("origin.git");
        let first_path = root.join("first");
        let second_path = root.join("second");
        fs::create_dir_all(&first_path).unwrap();
        fs::create_dir(&second_path).unwrap();
        Repository::init_bare(&origin_path).unwrap();
        let first = Folder { id: "first".into(), name: "First".into(), path: first_path.clone() };
        let second = Folder { id: "second".into(), name: "Second".into(), path: second_path.clone() };
        let repo = Repository::init(&first_path).unwrap();
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "JamScript Test").unwrap();
        config.set_str("user.email", "test@example.invalid").unwrap();
        repo.remote("origin", origin_path.to_str().unwrap()).unwrap();
        fs::write(first_path.join("song.js"), "s('bd')").unwrap();
        commit_music_files(&first, vec![GitCommitFile { name: "song.js".into(), expected_revision: Some(revision("s('bd')")), deleted: false }], "Initial song".into()).unwrap();
        push_current_branch(&first).unwrap();

        clone_into_selected_folder(&second, origin_path.to_str().unwrap()).unwrap();
        let cloned = Repository::open(&second_path).unwrap();
        let mut config = cloned.config().unwrap();
        config.set_str("user.name", "JamScript Test").unwrap();
        config.set_str("user.email", "test@example.invalid").unwrap();
        fs::write(second_path.join("song.js"), "s('bd sd')").unwrap();
        commit_music_files(&second, vec![GitCommitFile { name: "song.js".into(), expected_revision: Some(revision("s('bd sd')")), deleted: false }], "Add snare".into()).unwrap();
        push_current_branch(&second).unwrap();

        fs::write(first_path.join("song.js"), "unsaved").unwrap();
        assert!(pull_fast_forward(&first).unwrap_err().contains("local changes"));
        fs::write(first_path.join("song.js"), "s('bd')").unwrap();
        pull_fast_forward(&first).unwrap();
        assert_eq!(fs::read_to_string(first_path.join("song.js")).unwrap(), "s('bd sd')");

        fs::write(second_path.join("song.js"), "s('bd sd hh')").unwrap();
        commit_music_files(&second, vec![GitCommitFile { name: "song.js".into(), expected_revision: Some(revision("s('bd sd hh')")), deleted: false }], "Add hats".into()).unwrap();
        push_current_branch(&second).unwrap();
        fs::write(first_path.join("song.js"), "s('bd sd cp')").unwrap();
        commit_music_files(&first, vec![GitCommitFile { name: "song.js".into(), expected_revision: Some(revision("s('bd sd cp')")), deleted: false }], "Local claps".into()).unwrap();
        assert!(pull_fast_forward(&first).unwrap_err().contains("diverged"));
        assert_eq!(fs::read_to_string(first_path.join("song.js")).unwrap(), "s('bd sd cp')");
        fs::remove_dir_all(root).unwrap();
    }
}

#[tauri::command]
fn list_folders(state: State<'_, Folders>) -> Result<Vec<Folder>, String> {
    Ok(state.items.lock().map_err(|e| e.to_string())?.clone())
}

#[tauri::command]
async fn open_folder(app: tauri::AppHandle, state: State<'_, Folders>) -> Result<Option<Folder>, String> {
    let Some(chosen) = app.dialog().file().blocking_pick_folder() else { return Ok(None); };
    let canonical = fs::canonicalize(chosen.into_path().map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    if !canonical.is_dir() { return Err("Choose a folder".into()); }
    let mut folders = state.items.lock().map_err(|e| e.to_string())?;
    if let Some(existing) = folders.iter().find(|item| item.path == canonical) { return Ok(Some(existing.clone())); }
    let name = canonical.file_name().and_then(|value| value.to_str()).unwrap_or("Folder").to_string();
    let item = Folder { id: uuid::Uuid::new_v4().to_string(), name, path: canonical.clone() };
    folders.insert(0, item.clone());
    persist(&app, &folders)?;
    if let Ok(mut watcher) = state.watcher.lock() {
        if let Some(watcher) = watcher.as_mut() {
            let _ = watcher.watch(&canonical, RecursiveMode::NonRecursive);
        }
    }
    Ok(Some(item))
}

#[tauri::command]
fn list_folder_documents(state: State<'_, Folders>, folder_id: String) -> Result<Vec<Document>, String> {
    let root = folder(&state, &folder_id)?;
    let mut result = Vec::new();
    for entry in fs::read_dir(&root.path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        let Ok(path) = file_path(&root, &name, true) else { continue };
        let source = fs::read_to_string(path).map_err(|e| e.to_string())?;
        result.push(Document { name, revision: revision(&source), source });
    }
    result.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(result)
}

#[tauri::command]
fn read_folder_document(state: State<'_, Folders>, folder_id: String, name: String) -> Result<Document, String> {
    let path = file_path(&folder(&state, &folder_id)?, &name, true)?;
    let source = fs::read_to_string(path).map_err(|e| e.to_string())?;
    Ok(Document { name, revision: revision(&source), source })
}

#[tauri::command]
fn create_folder_document(state: State<'_, Folders>, folder_id: String, name: String) -> Result<Document, String> {
    let path = file_path(&folder(&state, &folder_id)?, &name, false)?;
    fs::OpenOptions::new().write(true).create_new(true).open(path).map_err(|e| e.to_string())?;
    Ok(Document { name, source: String::new(), revision: revision("") })
}

#[tauri::command]
fn rename_folder_document(state: State<'_, Folders>, folder_id: String, from: String, to: String) -> Result<(), String> {
    let root = folder(&state, &folder_id)?;
    let old_path = file_path(&root, &from, true)?;
    let new_path = file_path(&root, &to, false)?;
    if new_path.exists() { return Err("Destination already exists".into()); }
    fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_folder_document(state: State<'_, Folders>, folder_id: String, name: String) -> Result<(), String> {
    let path = file_path(&folder(&state, &folder_id)?, &name, true)?;
    fs::remove_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_folder_document(state: State<'_, Folders>, folder_id: String, name: String, source: String, expected_revision: String) -> Result<String, String> {
    let root = folder(&state, &folder_id)?;
    let path = file_path(&root, &name, true)?;
    let current = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    if revision(&current) != expected_revision { return Err("File changed on disk. Review the conflict before saving.".into()); }
    let temporary = root.path.join(format!(".jamscript-{}.tmp", uuid::Uuid::new_v4()));
    fs::write(&temporary, source.as_bytes()).map_err(|e| e.to_string())?;
    let result = fs::rename(&temporary, &path).map_err(|e| e.to_string());
    if result.is_err() { let _ = fs::remove_file(&temporary); }
    result?;
    Ok(revision(&source))
}

fn start_watcher(app: tauri::AppHandle, items: Arc<Mutex<Vec<Folder>>>) -> Option<RecommendedWatcher> {
    let (tx, rx) = mpsc::channel::<Result<Event, notify::Error>>();
    let mut watcher = notify::recommended_watcher(tx).ok()?;
    if let Ok(folders) = items.lock() {
        watch_folders(&mut watcher, &folders);
    }
    thread::spawn(move || {
        while let Ok(first) = rx.recv() {
            thread::sleep(Duration::from_millis(250));
            let mut batch = vec![first];
            while let Ok(next) = rx.try_recv() {
                batch.push(next);
            }
            let Ok(folders) = items.lock() else { continue };
            let mut touched = HashSet::new();
            for event in batch.into_iter().flatten() {
                for path in event.paths {
                    let Some(name) = path.file_name().and_then(|value| value.to_str()) else { continue };
                    if name.starts_with(".jamscript-") { continue; }
                    let supported = name.ends_with(".js") || name.ends_with(".strudel");
                    if !supported { continue; }
                    let Some(parent) = path.parent() else { continue };
                    let parent = fs::canonicalize(parent).unwrap_or_else(|_| parent.to_path_buf());
                    if let Some(folder) = folders.iter().find(|item| item.path == parent) {
                        touched.insert(folder.id.clone());
                    }
                }
            }
            for folder_id in touched {
                let _ = app.emit("jamscript-folder-changed", serde_json::json!({ "folderId": folder_id }));
            }
        }
    });
    Some(watcher)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let recent = store_path(app.handle()).ok()
                .and_then(|path| fs::read(path).ok())
                .and_then(|data| serde_json::from_slice::<Vec<Folder>>(&data).ok())
                .unwrap_or_default();
            let items = Arc::new(Mutex::new(recent));
            let watcher = start_watcher(app.handle().clone(), Arc::clone(&items));
            app.manage(Folders { items, watcher: Mutex::new(watcher) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![list_folders, open_folder, list_folder_documents,
            read_folder_document, create_folder_document, rename_folder_document,
            delete_folder_document, write_folder_document, git_status, git_init, git_commit_files,
            git_clone, git_push, git_pull_fast_forward])
        .run(tauri::generate_context!())
        .expect("JamScript failed to start");
}
