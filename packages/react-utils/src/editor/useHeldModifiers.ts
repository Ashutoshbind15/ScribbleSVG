import { useEffect, useRef } from "react";

const isZoomModKey = (key: string) => key === "Control" || key === "Meta";

/**
 * Whether a physical Ctrl/Cmd key is held, as a ref for the wheel listener.
 *
 * Trackpad pinch arrives as wheel events with a synthetic ctrlKey and no
 * keydown, so this is how wheel zoom tells pinch from Ctrl+scroll.
 *
 * Unlike shortcuts, this listens on `window`: it only reads modifier state and
 * never calls preventDefault, so Ctrl+scroll over an unfocused canvas still
 * gets the Ctrl-zoom sensitivity rather than the pinch sensitivity.
 */
export function useHeldModifiers(): React.RefObject<boolean> {
  const modKeyHeld = useRef(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isZoomModKey(e.key)) modKeyHeld.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isZoomModKey(e.key)) modKeyHeld.current = false;
    };
    const onBlur = () => {
      modKeyHeld.current = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return modKeyHeld;
}
