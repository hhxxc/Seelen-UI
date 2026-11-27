use std::sync::{
    Arc, LazyLock,
    atomic::{AtomicBool, Ordering},
};

use seelen_core::{
    resource::WidgetId,
    state::{WidgetLoader, WidgetStatus},
    system_state::PowerMode,
};

use crate::{
    error::{Result, ResultLogExt},
    resources::RESOURCES,
    state::FULL_STATE,
    system_modules::{
        monitors::MonitorManager,
        power::{PowerEvent, PowerManager},
    },
    utils::lock_free::SyncHashMap,
    widgets::{WidgetWebviewLabel, loader::WidgetDeployment},
};

pub static WIDGET_MANAGER: LazyLock<WidgetManager> = LazyLock::new(WidgetManager::create);
pub static GAME_MODE_ACTIVE: AtomicBool = AtomicBool::new(false);

pub struct WidgetManager {
    /// group of widgets instances by widget resource id.
    ///
    /// Shared (`Arc`) so operations that must not run under the lock — starting or destroying
    /// webviews, which take hundreds of milliseconds each — can snapshot the deployments and do
    /// the work after releasing it.
    pub deployments: SyncHashMap<WidgetId, Arc<WidgetDeployment>>,
}

impl WidgetManager {
    fn create() -> Self {
        let sub_id = MonitorManager::subscribe(|_event| {
            WIDGET_MANAGER.reconcile().log_error();
        });
        MonitorManager::set_event_handler_priority(&sub_id, 1);

        PowerManager::subscribe(|event| {
            if let PowerEvent::ModeChanged { mode } = event
                && FULL_STATE.load().settings.suspend_on_game_mode
            {
                match mode {
                    PowerMode::GameMode => WIDGET_MANAGER.suspend_all(),
                    _ => WIDGET_MANAGER.resume_all().log_error(),
                }
            }
        });
        // events are only emitted once the manager exists
        PowerManager::instance();

        Self {
            deployments: SyncHashMap::new(),
        }
    }

    pub fn is_ready(&self, label: &WidgetWebviewLabel) -> bool {
        self.deployments
            .get(&label.widget_id, |deploy| {
                deploy.pods.any(|(key, pod)| key == label && pod.is_ready())
            })
            .unwrap_or(false)
    }

    pub fn set_status(&self, label: &WidgetWebviewLabel, status: WidgetStatus) {
        self.deployments.get(&label.widget_id, |deploy| {
            deploy.pods.get(label, |instance| {
                instance.set_status(status);
            });
        });
    }

    pub fn suspend_all(&self) {
        GAME_MODE_ACTIVE.store(true, Ordering::Release);
        // Dropping the pods destroys their webviews: snapshot first and clear outside the
        // deployments lock, otherwise every other widget operation stalls for the teardown.
        let deployments: Vec<Arc<WidgetDeployment>> =
            self.deployments.map(|(_, deployment)| deployment.clone());
        for deployment in deployments {
            deployment.pods.clear();
        }
    }

    pub fn resume_all(&self) -> Result<()> {
        GAME_MODE_ACTIVE.store(false, Ordering::Release);
        self.reconcile()
    }

    pub fn reconcile(&self) -> Result<()> {
        // remove deleted resources. `retain` would drop the removed deployments (and with them
        // their webviews) while holding the map, so collect them first and let them go after.
        let stale: Vec<WidgetId> = self
            .deployments
            .map(|(id, _)| id.clone())
            .into_iter()
            .filter(|id| !RESOURCES.widgets.contains_sync(id))
            .collect();
        let dropped: Vec<Arc<WidgetDeployment>> = stale
            .iter()
            .filter_map(|id| self.deployments.remove(id))
            .collect();
        drop(dropped);

        let mut filtered = Vec::new();
        RESOURCES.widgets.iter_sync(|k, w| {
            if w.loader != WidgetLoader::Legacy {
                filtered.push((k.clone(), w.clone()));
            }
            true
        });

        let state = FULL_STATE.load();
        for (id, widget) in filtered {
            if !state.is_widget_enabled(&id) {
                self.deployments.remove(&id);
                continue;
            }

            if !self.deployments.contains_key(&id) {
                self.deployments
                    .upsert(id.clone(), Arc::new(WidgetDeployment::new(widget)));
            }
        }

        // lazy creation of webviews to reduce startup time
        std::thread::spawn(|| {
            // Snapshot the deployments before starting anything: creating a webview takes
            // hundreds of milliseconds, and doing it under the deployments lock blocked every
            // other widget's liveness prove, trigger and status read for seconds — a single
            // monitor change used to reload all of them.
            let mut deployments: Vec<(WidgetId, Arc<WidgetDeployment>)> = WIDGET_MANAGER
                .deployments
                .map(|(id, deployment)| (id.clone(), deployment.clone()));

            // More visual widgets load first
            let rank = |id: &WidgetId| -> u8 {
                if id == &WidgetId::known_wall() {
                    0
                } else if id == &WidgetId::known_toolbar() {
                    1
                } else if id == &WidgetId::known_weg() {
                    2
                } else {
                    3
                }
            };
            deployments.sort_by_key(|(id, _)| rank(id));

            for (_, deployment) in deployments {
                deployment.reconcile();
                if !deployment.definition.lazy && !GAME_MODE_ACTIVE.load(Ordering::Acquire) {
                    deployment.start_all_webviews();
                }
            }
        });

        Ok(())
    }
}
