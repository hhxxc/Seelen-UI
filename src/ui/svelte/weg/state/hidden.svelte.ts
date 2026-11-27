import { HideMode, WegAttentionReveal, WindowAttention } from "@seelen-ui/lib/types";
import { mousePos, refreshMousePos, virtualDesktops } from "./getters.svelte.ts";
import { settingsState } from "./settings.svelte.ts";
import { systemState } from "./system.svelte.ts";
import { windowsState } from "./windows.svelte.ts";
import { isThisWebviewFocused, isTouchPrimary } from "libs/ui/svelte/utils";

/** size of the bottom-right corner hotzone that force hides the dock */
const FORCE_HIDE_CORNER_PX = 60;

/**
 * How often the cursor is re-read while the dock is hidden. The reveal depends on the
 * `GlobalMouseMove` event, which can stop being delivered after a webview reload during a stall
 * (see `refreshMousePos`), leaving the dock hidden with no way to summon it.
 */
const HIDDEN_MOUSE_POLL_MS = 300;

const isSwitchingWorkspace = $derived(virtualDesktops.value.switching);

/** a window shown on this dock asks for attention and the user wants to see it */
const isRevealedByAttention = $derived.by(() => {
  const reveal = settingsState.value.revealOnAttention;
  if (reveal === WegAttentionReveal.Never) return false;

  return windowsState.dockWindows.some((w) =>
    reveal === WegAttentionReveal.WhileFlashing
      ? w.attention === WindowAttention.Flashing
      : w.attention === WindowAttention.Highlighted
  );
});

let _hiddenByAutohide = $state(false);
let _isDraggingItem = $state(false);

export const dockShouldBeHidden = {
  get value() {
    return _hiddenByAutohide;
  },
};

export function setDockIsDraggingItem(isDragging: boolean): void {
  _isDraggingItem = isDragging;
}

export const dockIsDragging = {
  get value() {
    return _isDraggingItem;
  },
};

// While hidden, keep the cursor position fresh even if GlobalMouseMove stopped arriving.
// Once the dock is out the cursor is over its own window, so the normal events are enough to
// hide it again and the poll is not needed.
$effect.root(() => {
  $effect(() => {
    if (!_hiddenByAutohide) {
      return;
    }
    const id = setInterval(refreshMousePos, HIDDEN_MOUSE_POLL_MS);
    return () => clearInterval(id);
  });
});

$effect.root(() => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (isSwitchingWorkspace) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      return;
    }

    const { delayToHide, delayToShow, hideMode, position } = settingsState;
    const isMouseOverEdge = systemState.mouseAtEdge === position;

    // The focus signal is event-driven, so a single missed GlobalFocusChanged
    // leaves it stuck at true and the dock never hides. document.hasFocus() is
    // the live state of this webview; it is re-evaluated on every mouse move
    // (this effect depends on mousePos), which self-heals the stuck flag.
    const isActuallyFocused = isThisWebviewFocused.value && document.hasFocus();

    // Mouse parked in the bottom-right corner forces the dock to hide,
    // regardless of focus state or attention reveals.
    const monitor = systemState.currentMonitor;
    const cursor = mousePos.value;
    const inForceHideCorner = cursor.x >= monitor.rect.right - FORCE_HIDE_CORNER_PX &&
      cursor.y >= monitor.rect.bottom - FORCE_HIDE_CORNER_PX;

    let hidden = false;
    let flush = false;

    switch (hideMode) {
      case HideMode.Never:
        hidden = false;
        flush = true;
        break;
      case HideMode.Always:
        hidden = !isTouchPrimary.value && !isActuallyFocused && !isMouseOverEdge;
        flush = isTouchPrimary.value;
        break;
      case HideMode.OnOverlap:
        hidden = !isTouchPrimary.value &&
          windowsState.isDockOverlapped &&
          !isActuallyFocused &&
          !isMouseOverEdge;
        flush = isTouchPrimary.value;
        break;
    }

    if (_isDraggingItem) {
      hidden = false;
      flush = true;
    }

    if (hidden && isRevealedByAttention) {
      hidden = false;
    }

    if (inForceHideCorner) {
      hidden = true;
      flush = true;
    }

    if (hidden) {
      timeout = setTimeout(() => {
        _hiddenByAutohide = true;
      }, delayToHide);
    } else {
      if (flush) {
        _hiddenByAutohide = false;
      } else {
        timeout = setTimeout(() => {
          _hiddenByAutohide = false;
        }, delayToShow);
      }
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    };
  });
});
