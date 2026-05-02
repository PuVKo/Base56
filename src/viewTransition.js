import { flushSync } from 'react-dom';

/**
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Runs a React state update inside `document.startViewTransition` when supported,
 * with synchronous DOM flush so the transition captures old/new snapshots.
 * @param {() => void} update
 */
export function runViewTransition(update) {
  const run = () => flushSync(update);

  if (prefersReducedMotion()) {
    run();
    return;
  }

  if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
    document.startViewTransition(run);
  } else {
    run();
  }
}
