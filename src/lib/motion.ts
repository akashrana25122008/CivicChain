import type { Variants, Transition } from 'framer-motion';

/**
 * CivicChain motion system.
 *
 * A single, coherent set of easing curves and durations derived from the
 * UI/UX Pro Max + PRISM guidance. Keyed to the design tokens in globals.css
 * (--transition-*). All animation answers a purpose: hierarchy, feedback,
 * state change, explanation, or navigation. Never decoration.
 */

/** Easing curves — enter ease-out, exit ease-in, on-screen ease-in-out. */
export const EASE = {
  /** strong ease-out — enters and exits */
  out: [0.23, 1, 0.32, 1] as const,
  /** subtle settle / small overshoot reserved for playful listeners only */
  outBack: [0.175, 0.885, 0.32, 1.275] as const,
  /** standard UI motion */
  standard: [0.2, 0, 0, 1] as const,
} as const;

/** Duration bands in seconds (UI/UX Pro Max timing spec). */
export const DUR = {
  micro: 0.15,
  fast: 0.25,
  standard: 0.35,
  section: 0.6,
  story: 0.85,
} as const;

/**
 * Smooth spring profiles — soft, organic motion for live state changes
 * (hover, taps, toggles, drag feedback). Spring physics feel smoother than
 * long keyframe tweens and keep interactivity glitch-free.
 */
export const SPRING = {
  /** quick, gentle settle — buttons, small chips */
  soft: { type: 'spring', stiffness: 300, damping: 26, mass: 0.7 } as const,
  /** playful but controlled — icon tiles, badges */
  bounce: { type: 'spring', stiffness: 240, damping: 14, mass: 0.8 } as const,
  /** slow, weighty arc — large surfaces entering */
  slow: { type: 'spring', stiffness: 60, damping: 20, mass: 1.2 } as const,
} as const;

/** Fade + rise used for most entrance reveals. Starts at 0.95, never 0. */
export const fadeUp = (y = 24, delay = 0): Variants => ({
  hidden: { opacity: 0, y, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: DUR.section, delay, ease: EASE.out },
  },
});

/** Fade only — used when vertical movement would be confusing. */
export const fade = (delay = 0): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DUR.standard, delay, ease: EASE.out },
  },
});

/** Soft scale + fade for badges, chips, and compact cards. */
export const scaleIn = (delay = 0): Variants => ({
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: DUR.standard, delay, ease: EASE.out },
  },
});

/** Child variant for `staggerContainer` — smooth rise and settle. */
export const listItem = (y = 20): Variants => ({
  hidden: { opacity: 0, y },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.standard, ease: EASE.out },
  },
});

/** Stagger container for grouped card reveals. */
export const staggerContainer = (stagger = 0.08, delayChildren = 0.05): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

/**
 * Resolves a tone (motion intensity) against the user's reduced-motion
 * preference. Call this once in a component, pass the boolean down.
 */
export function reducedTransition(
  reduceMotion: boolean | null,
  transition: Transition
): Transition {
  if (reduceMotion) {
    return { ...transition, duration: 0.01, delay: 0, ease: 'linear' };
  }
  return transition;
}
