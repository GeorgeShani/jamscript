import { useEffect, useState } from "react";

const PHONE = "(max-width: 599px)";

/** True on phone-width screens; follows rotation and window resizes. */
export function useIsPhone() {
  const [phone, setPhone] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.(PHONE).matches,
  );
  useEffect(() => {
    const query = window.matchMedia?.(PHONE);
    if (!query) return;
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return phone;
}
