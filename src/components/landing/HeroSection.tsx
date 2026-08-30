'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { AuthActions } from './AuthActions';
import { CivicHero3DWrapper } from '@/components/3d/CivicHero3D';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { ArrowRight, Activity, Target, Eye, Shield } from 'lucide-react';
import { DUR, EASE, SPRING } from '@/lib/motion';

const METRICS = [
  { label: 'ACTIVE CIVIC ISSUES', value: 2481, icon: Activity, color: 'text-brand-400', prefix: '', suffix: '' },
  { label: 'PROMISES TRACKED', value: 1736, icon: Target, color: 'text-accent-400', prefix: '', suffix: '' },
  { label: 'AI-VERIFIED RESOLUTIONS', value: 1294, icon: Eye, color: 'text-emerald-400', prefix: '', suffix: '' },
  { label: 'BROKEN PROMISES', value: 214, icon: Shield, color: 'text-red-400', prefix: '', suffix: '' },
];

/**
 * Hero entrance sequence (§3): logo/nav handled by LandingNavigation; here we
 * cascade the eyebrow → headline → paragraph → CTAs → visualization → metrics.
 * A single GSAP-free, framer-motion timeline with staggered delays so the whole
 * introduction lands in ~1000-1400ms. Reduced-motion renders content immediately.
 */
export function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Scroll-mapped hero transformation (§9): as the user scrolls away, the hero
  // copy scales down and fades while the background recedes at a slightly
  // different rate (subtle parallax, §24). GPU transform/opacity only.
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const copyScale = useTransform(scrollYProgress, [0, 0.8], [1, 0.9]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.05, 1.25]);
  const bgOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.35]);

  // Mouse-reactive 3D target (passed to wrapper via CSS vars is overkill; we
  // instead let the 3D rig read pointer directly — see CivicHero3D).
  useEffect(() => {
    if (!heroRef.current || reduce) return;
    // light parallax on the hero copy relative to pointer for a spatial feel
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      raf = requestAnimationFrame(() => {
        const el = heroRef.current;
        if (!el) return;
        const nx = (e.clientX / window.innerWidth - 0.5) * 2;
        const ny = (e.clientY / window.innerHeight - 0.5) * 2;
        el.style.setProperty('--mx', nx.toFixed(3));
        el.style.setProperty('--my', ny.toFixed(3));
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduce]);

  const delay = (s: number) => (reduce ? 0 : s);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-dark-bg"
    >
      {/* 3D environment — becomes active during entrance (deferred via wrapper).
          Recedes gently as the user scrolls away beyond the hero. */}
      <motion.div
        className="absolute inset-0 z-0"
        style={reduce ? undefined : { scale: bgScale, opacity: bgOpacity }}
      >
        <CivicHero3DWrapper />
      </motion.div>

      {/* Continuous ambient glow — a soft breathing light that keeps the hero
          alive in the background between interactions (§: continuous motion). */}
      <motion.div
        className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[60vmin] h-[60vmin] rounded-full pointer-events-none z-[5]"
        style={{
          background:
            'radial-gradient(circle at center, rgba(99,102,241,0.18), rgba(56,189,248,0.06) 45%, transparent 68%)',
          filter: 'blur(40px)',
        }}
        animate={
          reduce
            ? undefined
            : { scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }
        }
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div className="absolute inset-0 bg-gradient-to-b from-dark-bg/60 via-dark-bg/40 to-dark-bg pointer-events-none z-10" />

      {/* Hero content — scroll-scrubbed transform */}
      <motion.div
        className="relative z-20 w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-20 md:py-32"
        style={reduce ? undefined : { scale: copyScale, y: copyY, opacity: copyOpacity }}
      >
        <div className="max-w-4xl mx-auto text-center">
          {/* Stage: eyebrow */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.standard, delay: delay(0.05), ease: EASE.out }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-mono text-white/70 tracking-widest">CIVIC ACCOUNTABILITY INFRASTRUCTURE</span>
            </div>
          </motion.div>

          {/* Stage: headline — staggered line reveal */}
          <motion.h1
            className="font-display text-[clamp(2.5rem,8vw,4.5rem)] leading-[1.1] font-bold text-white mb-6 tracking-tight text-balance"
            initial={reduce ? false : { opacity: 0, y: 26, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: DUR.story, delay: delay(0.15), ease: EASE.out }}
          >
            Every Civic Complaint Deserves an Answer.{' '}
            <motion.span
              className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-brand-300 to-accent-400"
              style={{ backgroundSize: '200% 100%' }}
              animate={
                reduce
                  ? undefined
                  : { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }
              }
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            >
              Every Promise Deserves a Record.
            </motion.span>
          </motion.h1>

          {/* Stage: paragraph */}
          <motion.p
            className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10 text-pretty"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.section, delay: delay(0.32), ease: EASE.out }}
          >
            CivicChain transforms civic complaints into measurable commitments — with AI verification, deadline tracking, and transparent accountability.
          </motion.p>

          {/* Stage: CTAs */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.section, delay: delay(0.42), ease: EASE.out }}
          >
            <AuthActions />
          </motion.div>

          {/* Stage: supporting badges */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.section, delay: delay(0.52), ease: EASE.out }}
          >
            <div className="inline-flex items-center gap-4 px-6 py-3 rounded-full bg-white/5 border border-white/10">
              <span className="text-xs text-white/50">AI-assisted</span>
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <span className="text-xs text-white/50">Evidence-based</span>
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <span className="text-xs text-white/50">Geospatial</span>
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <span className="text-xs text-white/50">Transparent</span>
            </div>
          </motion.div>
        </div>

        {/* Stage: metrics — count up on entry */}
        <motion.div
          className="mt-16 md:mt-24 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DUR.section, delay: delay(0.62), ease: EASE.out }}
        >
          {METRICS.map((metric, i) => {
            const Icon = metric.icon;
            return (
              <motion.div
                key={metric.label}
                initial={reduce ? false : { opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={reduce ? { duration: 0.01 } : { delay: 0.62 + i * 0.07, ...SPRING.bounce }}
                className="group relative p-4 md:p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 hover:border-white/20 transition-colors duration-300 overflow-hidden"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${metric.color}`} />
                  <span className="text-[10px] md:text-xs font-mono text-white/50 tracking-wider">{metric.label}</span>
                </div>
                <div className={`text-2xl md:text-3xl font-display font-bold ${metric.color}`}>
                  <AnimatedNumber value={metric.value} delay={0.7} format={(n) => `${metric.prefix}${n}${metric.suffix}`} />
                </div>
                {/* sheen that travels across on hover */}
                <div className="pointer-events-none absolute -inset-x-10 top-0 h-full -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </motion.div>
            );
          })}
        </motion.div>

        <p className="text-center text-[10px] text-white/30 mt-4 font-mono">PROTOTYPE DATA</p>
      </motion.div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white dark:from-dark-bg to-transparent pointer-events-none z-20" />
    </section>
  );
}
