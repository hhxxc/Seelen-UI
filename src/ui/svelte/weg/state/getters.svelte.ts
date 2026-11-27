import { invoke, PluginList, SeelenCommand, SeelenEvent, Settings, subscribe, Widget } from "@seelen-ui/lib";
import type { UserAppWindowColors } from "@seelen-ui/lib/types";
import { lazyRune } from "libs/ui/svelte/utils";

export const currentMonitorId = Widget.getCurrent().decoded.monitorId!;

export const virtualDesktops = lazyRune(() => invoke(SeelenCommand.StateGetVirtualDesktops));
subscribe(SeelenEvent.VirtualDesktopsChanged, virtualDesktops.setByPayload);

export const monitors = lazyRune(() => invoke(SeelenCommand.SystemGetMonitors));
subscribe(SeelenEvent.SystemMonitorsChanged, monitors.setByPayload);

export const players = lazyRune(() => invoke(SeelenCommand.GetMediaSessions));
subscribe(SeelenEvent.MediaSessions, players.setByPayload);

export const notifications = lazyRune(() => invoke(SeelenCommand.GetNotifications));
subscribe(SeelenEvent.Notifications, notifications.setByPayload);

export const mousePos = lazyRune(async () => {
  const [x, y] = await invoke(SeelenCommand.GetMousePosition);
  return { x, y };
});
subscribe(SeelenEvent.GlobalMouseMove, ({ payload: [x, y] }) => {
  mousePos.value = { x, y };
});

/**
 * Re-reads the cursor position over IPC instead of waiting for `GlobalMouseMove`.
 *
 * The dock reveal depends entirely on that event, and after a webview reload during a stall
 * the event channel can come back dead while the JS keeps running (the liveness prove still
 * passes): the position stays frozen at its old value, so the dock never reveals again until
 * the app is restarted. Setting the value also marks a never-initialized rune as initialized,
 * so this doubles as recovery from a failed initial `GetMousePosition` (broken IPC at startup).
 */
export async function refreshMousePos(): Promise<void> {
  try {
    const [x, y] = await invoke(SeelenCommand.GetMousePosition);
    mousePos.value = { x, y };
  } catch {
    // IPC still unavailable: the next tick retries.
  }
}

export const settings = lazyRune(() => Settings.getAsync());
Settings.onChange((s) => (settings.value = s));

export const selfWinId = lazyRune(() => invoke(SeelenCommand.GetSelfWindowId));

export const interactables = lazyRune(() => invoke(SeelenCommand.GetUserAppWindows));
subscribe(SeelenEvent.UserAppWindowsChanged, interactables.setByPayload);

export const previews = lazyRune(() => invoke(SeelenCommand.GetUserAppWindowsPreviews));
subscribe(SeelenEvent.UserAppWindowsPreviewsChanged, previews.setByPayload);

export const windowsColors = lazyRune<Record<number, UserAppWindowColors>>(
  () => invoke(SeelenCommand.GetUserAppWindowsColors),
);
subscribe(SeelenEvent.UserAppWindowsColorsChanged, windowsColors.setByPayload);

export const focused = lazyRune(() => invoke(SeelenCommand.GetFocusedApp));

export const widgetStatuses = lazyRune(() => invoke(SeelenCommand.DebugGetWidgetsStatuses));
subscribe(SeelenEvent.WidgetDebugInfoChanged, widgetStatuses.setByPayload);

export const wegItems = lazyRune(() => invoke(SeelenCommand.StateGetWegItems));

export const plugins = lazyRune(async () => (await PluginList.getAsync()).forCurrentWidget());
PluginList.onChange((list) => {
  plugins.value = list.forCurrentWidget();
});

await Promise.all([
  virtualDesktops.init(),
  monitors.init(),
  players.init(),
  notifications.init(),
  mousePos.init(),
  settings.init(),
  selfWinId.init(),
  interactables.init(),
  previews.init(),
  windowsColors.init(),
  focused.init(),
  widgetStatuses.init(),
  wegItems.init(),
  plugins.init(),
]);
