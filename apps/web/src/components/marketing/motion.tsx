"use client";

import type { ReactElement, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export const easeOut = [0.22, 1, 0.36, 1] as const;

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}): ReactElement {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : delay, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}

export { motion, useReducedMotion };
