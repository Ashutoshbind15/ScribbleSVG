import { useEffect, useRef } from "react";

const isZoomModKey = (key: string) => key === "Control" || key === "Meta";

/**
 * Trackpad pinch sends wheel events with a synthetic ctrlKey and no keydown,
 * so a real Ctrl/Cmd keydown is how wheel zoom tells Ctrl+scroll from pinch.
 * Listens on window so it works over an unfocused canvas; it only reads.
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
