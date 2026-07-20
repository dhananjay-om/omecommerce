'use client';

import { motion } from 'framer-motion';

/** Fade + slide up once when scrolled into view — used to give the home page's sections a bit of entrance motion (plan/14 Phase 8) without adding it to every single element individually. */
export function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
