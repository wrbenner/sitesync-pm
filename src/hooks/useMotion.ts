import { useReducedMotion } from 'framer-motion';
import type { Transition } from 'framer-motion';

const instantTransition: Transition = { duration: 0 };

export function useMotionSafe() {
  const shouldReduce = useReducedMotion() ?? false;
  return {
    shouldReduce,
    animate: shouldReduce ? {} : undefined,
    transition: shouldReduce ? instantTransition : undefined,
  };
}

export function useSafeVariants<T extends Record<string, unknown>>(props: T): T {
  const shouldReduce = useReducedMotion() ?? false;
  if (!shouldReduce) return props;

  const safe = { ...props } as unknown as Record<string, unknown>;
  if ('transition' in safe) safe.transition = instantTransition;
  if (safe.initial && typeof safe.initial === 'object') safe.initial = { opacity: 0 };
  if (safe.animate && typeof safe.animate === 'object') safe.animate = { opacity: 1 };
  if (safe.exit && typeof safe.exit === 'object') safe.exit = { opacity: 0 };
  if ('whileHover' in safe) safe.whileHover = {};
  if ('whileTap' in safe) safe.whileTap = {};
  return safe as T;
}
