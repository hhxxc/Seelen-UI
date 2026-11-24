mod application;
mod domain;

use std::sync::{
    Once, OnceLock,
    mpsc::{RecvTimeoutError, Sender, channel},
};
use std::time::{Duration, Instant};

use seelen_core::{
    handlers::SeelenEvent,
    system_state::{SysTrayIcon, SystrayIconAction},
};

use crate::{app::emit_to_webviews, error::Result};

pub use self::application::SystemTrayManager;
use self::domain::SystemTrayEvent;

/// Quiet period that coalesces a burst of tray changes before emitting.
const TRAY_EMIT_QUIET: Duration = Duration::from_millis(300);
/// Hard upper bound on how long continuous bursts may keep deferring the emit.
const TRAY_EMIT_MAX_DELAY: Duration = Duration::from_secs(1);

static TRAY_EMIT_TX: OnceLock<Sender<()>> = OnceLock::new();

/// Manager instance, bridging its events to the webviews on first access.
fn get_manager() -> &'static SystemTrayManager {
    static REGISTER: Once = Once::new();
    REGISTER.call_once(|| {
        let (tx, rx) = channel::<()>();
        TRAY_EMIT_TX.set(tx).ok();

        // Debounced emitter: chat apps and system monitors refresh their tray
        // icons and tooltips several times per second. Emitting on every change
        // re-renders the tray on all webviews, so bursts are coalesced into a
        // single emit of the (always full) state snapshot.
        std::thread::spawn(move || {
            loop {
                if rx.recv().is_err() {
                    return;
                }
                let burst_start = Instant::now();
                loop {
                    match rx.recv_timeout(TRAY_EMIT_QUIET) {
                        Ok(()) => {
                            if burst_start.elapsed() >= TRAY_EMIT_MAX_DELAY {
                                break;
                            }
                        }
                        Err(RecvTimeoutError::Timeout) => break,
                        Err(RecvTimeoutError::Disconnected) => return,
                    }
                }
                emit_to_webviews(
                    SeelenEvent::SystemTrayChanged,
                    SystemTrayManager::instance().icons(),
                );
            }
        });

        SystemTrayManager::subscribe(|event| match event {
            SystemTrayEvent::Changed => {
                if let Some(tx) = TRAY_EMIT_TX.get() {
                    let _ = tx.send(());
                }
            }
        });
    });
    SystemTrayManager::instance()
}

impl crate::tauri_handlers::Handlers {
    pub fn get_system_tray_icons() -> Vec<SysTrayIcon> {
        get_manager().icons()
    }

    pub fn send_system_tray_icon_action(id: String, action: SystrayIconAction) -> Result<()> {
        get_manager().send_action(&id, &action)
    }

    pub fn set_system_tray_icon_promoted(id: String, promoted: bool) -> Result<()> {
        get_manager().set_promoted(&id, promoted)
    }

    pub fn set_system_tray_icons_order(ids: Vec<String>) -> Result<()> {
        get_manager().set_order(&ids)
    }
}
