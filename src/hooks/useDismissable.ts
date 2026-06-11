"use client";

import { useEffect, type RefObject } from "react";

/**
 * Dismiss a popover/menu on outside click or Escape.
 *
 * Pass refs to every container that counts as "inside" (trigger + panel).
 * Listeners are only attached while `open` is true.
 */
export function useDismissable(
  open: boolean,
  onDismiss: () => void,
  refs: Array<RefObject<HTMLElement | null>>,
) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (refs.some((ref) => ref.current?.contains(target))) {
        return;
      }
      onDismiss();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // refs is typically an inline array; re-subscribing while open is cheap.
  }, [open, onDismiss, refs]);
}
