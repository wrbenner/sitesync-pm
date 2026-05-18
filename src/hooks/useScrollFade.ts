import { useRef, useState, useEffect } from 'react';

/**
 * Tracks whether a scrollable container has more content off to the right,
 * so callers can show/hide a fade-out gradient overflow affordance.
 */
export function useScrollFade<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () =>
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, []);

  return { ref, canScrollRight };
}
