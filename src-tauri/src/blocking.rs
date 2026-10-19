//! Native HTTP, credential-store and filesystem work must never block the window thread.
pub async fn run<T, F>(task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| format!("Native task failed: {error}"))?
}

#[cfg(test)]
mod tests {
    #[test]
    fn slow_native_work_runs_away_from_the_caller() {
        let caller = std::thread::current().id();
        tauri::async_runtime::block_on(super::run(move || {
            assert_ne!(caller, std::thread::current().id());
            std::thread::sleep(std::time::Duration::from_millis(50));
            Ok(())
        }))
        .unwrap();
    }
}
