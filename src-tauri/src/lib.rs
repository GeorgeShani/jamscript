use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
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
            delete_folder_document, write_folder_document])
        .run(tauri::generate_context!())
        .expect("JamScript failed to start");
}
