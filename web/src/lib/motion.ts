import type { Transition, Variants } from "motion/react"

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

export const transitions = {
  enter: { duration: 0.45, ease: EASE_OUT_EXPO },
  quick: { duration: 0.2, ease: EASE_OUT_EXPO },
  spring: { type: "spring", stiffness: 420, damping: 36 },
} satisfies Record<string, Transition>

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: transitions.enter },
}

export const stagger = (step = 0.06, delay = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: step, delayChildren: delay } },
})
