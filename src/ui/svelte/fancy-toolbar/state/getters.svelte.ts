import { invoke, PluginList, SeelenCommand, SeelenEvent, Settings, subscribe, Widget } from "@seelen-ui/lib";
import type { UserAppWindowColors } from "@seelen-ui/lib/types";
import { lazyRune } from "libs/ui/svelte/utils";

export const currentMonitorId = Widget.getCurrent().decoded.monitorId!;

export const virtualDesktop = lazyRune(async () => {
  const initialDesktops = await invoke(SeelenCommand.StateGetVirtualDesktops);
  return initialDesktops.monitors[currentMonitorId];
});
subscribe(SeelenEvent.VirtualDesktopsChanged, (e) => {
  virtualDesktop.value = e.payload.monitors[currentMonitorId];
});

export const virtualDesktops = lazyRune(() => invoke(SeelenCommand.StateGetVirtualDesktops));
subscribe(SeelenEvent.VirtualDesktopsChanged, virtualDesktops.setByPayload);

export const monitors = lazyRune(() => invoke(SeelenCommand.SystemGetMonitors));
subscribe(SeelenEvent.SystemMonitorsChanged, monitors.setByPayload);

export const mousePos = lazyRune(() => invoke(SeelenCommand.GetMousePosition));
subscribe(SeelenEvent.GlobalMouseMove, mousePos.setByPayload);

export const settings = lazyRune(() => Settings.getAsync());
Settings.onChange((s) => (settings.value = s));

export const interactables = lazyRune(() => invoke(SeelenCommand.GetUserAppWindows));
subscribe(SeelenEvent.UserAppWindowsChanged, interactables.setByPayload);

export const windowsColors = lazyRune<Record<number, UserAppWindowColors>>(
  () => invoke(SeelenCommand.GetUserAppWindowsColors),
);
subscribe(SeelenEvent.UserAppWindowsColorsChanged, windowsColors.setByPayload);

export const focused = lazyRune(() => invoke(SeelenCommand.GetFocusedApp));
// Debounce focus updates: transient windows (screenshot overlays, tool popups)
// steal the foreground for a split second and would otherwise make the
// focused-app icon/title in the toolbar flicker.
let _focusDebounce: ReturnType<typeof setTimeout> | null = null;
subscribe(SeelenEvent.GlobalFocusChanged, (args) => {
  if (_focusDebounce) {
    clearTimeout(_focusDebounce);
  }
  _focusDebounce = setTimeout(() => {
    _focusDebounce = null;
    focused.setByPayload(args);
  }, 250);
});

export const widgetStatuses = lazyRune(() => invoke(SeelenCommand.DebugGetWidgetsStatuses));
subscribe(SeelenEvent.WidgetDebugInfoChanged, widgetStatuses.setByPayload);

export const toolbarItems = lazyRune(() => invoke(SeelenCommand.StateGetToolbarItems));

export const plugins = lazyRune(async () => (await PluginList.getAsync()).forCurrentWidget());
PluginList.onChange((list) => {
  plugins.value = list.forCurrentWidget();
});

await Promise.all([
  virtualDesktop.init(),
  virtualDesktops.init(),
  monitors.init(),
  mousePos.init(),
  settings.init(),
  interactables.init(),
  windowsColors.init(),
  focused.init(),
  widgetStatuses.init(),
  toolbarItems.init(),
  plugins.init(),
]);
