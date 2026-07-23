/**
 * a11y.ts — tiny accessibility helpers (spec §10.4).
 *
 * Currently just a `prefers-reduced-motion` probe so decorative, infinitely
 * looping animations can be suppressed for users who ask for reduced motion.
 * Kept as a runtime check (not cached) so it reflects the OS setting at call
 * time; the media query is cheap.
 */

/** True when the user's OS requests reduced motion. Safe on any environment. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
