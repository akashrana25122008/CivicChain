'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useSpring, useReducedMotion } from 'framer-motion';

/**
 * CivicTheme — global ambient layer for the landing page.
 *
 * Provides three cohesive global pieces (all optional but coherent):
 *  1. A fixed, low-opacity ambient gradient wash that gently shifts hue as the
 *     user scrolls, giving light sections a blue-tinged atmospheric feel and
 *     adding depth to dark sections — no disconnected white voids.
 *  2. A minimal scroll-progress indicator (periwinkle bar on a soft track).
 *  3. A subtle dot + ring custom cursor (pointer-fine devices only; the CSS
 *     hides it on touch/hover:none).
 *
 * Reduced motion: the cursor and ambient movement freeze; the progress bar
 * still tracks scroll (it is a meaningful state indicator, not decoration).
 */
export function CivicTheme() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.4,
  });

  // --- Custom cursor (lerped) ---
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [cursorOn, setCursorOn] = useState(false);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    setCursorOn(true);
  }, []);

  useEffect(() => {
    if (!cursorOn || reduce) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let tx = -100, ty = -100, rx = -100, ry = -100;
    let raf = 0;
    const target = { x: -100, y: -100, hover: false };

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
    };
    const onOver = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      target.hover = !!t.closest('a, button, [role="button"], [data-cursor]');
    };

    const loop = () => {
      tx += (target.x - tx) * 0.5;
      ty += (target.y - ty) * 0.5;
      rx += (target.x - rx) * 0.18;
      ry += (target.y - ry) * 0.18;
      dot.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      ring.style.opacity = target.hover ? '1' : '0.55';
      ring.style.width = target.hover ? '52px' : '34px';
      ring.style.height = target.hover ? '52px' : '34px';
      ring.style.margin = target.hover ? '-26px 0 0 -26px' : '-17px 0 0 -17px';
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerover', onOver, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerover', onOver);
    };
  }, [cursorOn, reduce]);

  return (
    <>
      {/* Ambient scroll-tinting wash (fixed, behind content) */}
      <motion.div
        aria-hidden
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 120% at 50% 0%, rgba(27,44,193,0.10), rgba(9,21,64,0) 45%), radial-gradient(90% 90% at 100% 100%, rgba(118,146,255,0.12), rgba(9,21,64,0) 55%)',
        }}
        animate={reduce ? undefined : { opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Scroll progress indicator */}
      <div aria-hidden className="scroll-progress-track">
        <motion.div className="scroll-progress-bar" style={{ scaleX: progress }} />
      </div>

      {/* Custom cursor */}
      {cursorOn && (
        <>
          <div ref={dotRef} className="cursor-dot" />
          <div ref={ringRef} className="cursor-ring" />
        </>
      )}
    </>
  );
}
