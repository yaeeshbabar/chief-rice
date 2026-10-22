import { useEffect, useState } from "react";

const QUERY = "(max-width: 767px)";

// True on phone-sized screens. Wide tables switch to one-line-per-record lists there.
export const useIsPhone = () => {
  const [isPhone, setIsPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setIsPhone(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isPhone;
};
