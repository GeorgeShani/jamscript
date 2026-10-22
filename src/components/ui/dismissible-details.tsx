import { useEffect, useRef, type DetailsHTMLAttributes } from "react";

/**
 * A `<details>` dropdown that closes when focus moves elsewhere: a press outside it, or
 * Escape from inside it (focus returns to the summary). Native `<details>` only closes
 * from its own summary. Pass `dismissOnOutside={false}` while the content must stay up.
 */
export function DismissibleDetails({
  dismissOnOutside = true,
  ...props
}: DetailsHTMLAttributes<HTMLDetailsElement> & { dismissOnOutside?: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!dismissOnOutside) return;
    const onPointerDown = (event: PointerEvent) => {
      const element = ref.current;
      if (element?.open && event.target instanceof Node && !element.contains(event.target))
        element.open = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const element = ref.current;
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        !element?.open ||
        !element.contains(document.activeElement)
      )
        return;
      element.open = false;
      element.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dismissOnOutside]);
  return <details ref={ref} {...props} />;
}
