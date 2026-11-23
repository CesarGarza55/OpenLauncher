use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Default)]
pub struct AppState {
    pub running_processes: Arc<Mutex<HashMap<u32, tokio::sync::oneshot::Sender<()>>>>,
    pub active_installs: Arc<Mutex<HashMap<String, tokio::sync::broadcast::Sender<()>>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            running_processes: Arc::new(Mutex::new(HashMap::new())),
            active_installs: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}
