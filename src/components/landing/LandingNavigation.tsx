'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useSession } from 'next-auth/react';
import {
  FileText,
  Gavel,
  Radar,
  BrainCircuit,
  CopyCheck,
  AlertOctagon,
  ShieldAlert,
  Landmark,
  Users,
  Search,
  Menu,
  X,
  ChevronDown,
  LogIn,
  UserPlus,
  ArrowRight,
} from 'lucide-react';
import { DUR, EASE } from '@/lib/motion';
import { homeFor } from '@/components/layout/workspaceNav';

type NavChild = {
  label: string;
  href: string;
  description: string;
  icon: typeof FileText;
};

type NavGroup = {
  key: string;
  label: string;
  href: string;
  children: NavChild[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'platform',
    label: 'Platform',
    href: '/#solution',
    children: [
      { label: 'Civic Issues', href: '/#features', description: 'From complaint to tracked civic issue.', icon: FileText },
      { label: 'Promise Tracking', href: '/#promise-ledger', description: 'Every commitment recorded and monitored.', icon: Gavel },
      { label: 'AI Verification', href: '/#ai-verification', description: 'Evidence-backed resolution checks.', icon: Search },
      { label: 'Civic Intelligence', href: '/#civic-map', description: 'Geospatial view of the whole city.', icon: Radar },
    ],
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    href: '/#features',
    children: [
      { label: 'AI Issue Analysis', href: '/#features', description: 'Understand problems from evidence.', icon: BrainCircuit },
      { label: 'Duplicate Detection', href: '/#features', description: 'Turn many reports into one issue.', icon: CopyCheck },
      { label: 'Risk Intelligence', href: '/#predictive', description: 'Move from reactive to preventive.', icon: ShieldAlert },
      { label: 'Geospatial Intelligence', href: '/#civic-map', description: 'See the city as a living system.', icon: Landmark },
    ],
  },
  {
    key: 'accountability',
    label: 'Accountability',
    href: '/#promise-ledger',
    children: [
      { label: 'Promise Ledger', href: '/#promise-ledger', description: 'Structured, time-stamped records.', icon: Gavel },
      { label: 'Escalations', href: '/#broken-promise', description: 'When deadlines pass, accountability starts.', icon: AlertOctagon },
      { label: 'Department Performance', href: '/#dashboard', description: 'Fulfillment measured transparently.', icon: Users },
      { label: 'Community Verification', href: '/#ai-verification', description: 'Citizens hold the loop in check.', icon: CopyCheck },
    ],
  },
];

const SECTION_IDS = ['solution', 'features', 'promise-ledger', 'ai-verification', 'civic-map', 'predictive', 'dashboard'];

function LandingNavActions({ mobile }: { mobile?: boolean }) {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';
  const isAuthenticated = !!session?.user;
  const role = session?.user?.role;

  if (isLoading) {
    return (
      <div className={mobile ? 'flex flex-col gap-2' : 'flex items-center gap-2'}>
        <Button size={mobile ? 'lg' : 'sm'} disabled className="opacity-50 w-full">
          <span className="w-4 h-4 mr-2 animate-spin border-2 border-current border-t-transparent rounded-full" />
          Loading…
        </Button>
        <Button variant="secondary" size={mobile ? 'lg' : 'sm'} disabled className="opacity-50 w-full">
          Loading…
        </Button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Link
        href="/login"
        className={cn(
          'group inline-flex items-center justify-center gap-2 px-4 py-2',
          'rounded-xl bg-white/80 dark:bg-dark-bg-elevated/80 backdrop-blur-lg',
          'border border-brand-200 dark:border-brand-400/50',
          'shadow-sm hover:shadow-lg transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
          'hover:-translate-y-1 active:translate-y-0.5',
          mobile ? 'w-full' : ''
        )}
      >
        <LogIn className="w-4 h-4 text-brand-600 dark:text-brand-400" />
        <span className="font-medium text-sm text-neutral-900 dark:text-white">Sign In</span>
        <ArrowRight className="w-4 h-4 text-brand-500 dark:text-brand-300 transition-transform duration-200 group-hover:translate-x-1" />
      </Link>
    );
  }

  return (
    <div className={mobile ? 'flex flex-col gap-2' : 'flex items-center gap-2'}>
      <Button size={mobile ? 'lg' : 'sm'} asChild className={mobile ? 'w-full' : ''}>
        <Link href={homeFor(role)} className="group flex items-center justify-center gap-2">
          Open Dashboard
          <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </Button>
      <Button variant="secondary" size={mobile ? 'lg' : 'sm'} asChild className={mobile ? 'w-full' : ''}>
        <Link href="/report" className="group flex items-center justify-center gap-2">
          Report an Issue
          <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </Button>
    </div>
  );
}

export function LandingNavigation() {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileAccordion, setMobileAccordion] = useState<string | null>(null);

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll elevation + active-section indicator via IntersectionObserver.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [pathname]);

  // Close menus on route change.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setOpenMenu(null);
      setMobileOpen(false);
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  // Close menus on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleEnter = (key: string | null) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu(key);
  };
  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpenMenu(null), 160);
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-[200] transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300',
        scrolled
          ? 'bg-white/85 dark:bg-dark-bg/85 backdrop-blur-xl border-b border-neutral-200/70 dark:border-dark-border shadow-sm'
          : 'bg-transparent border-b border-transparent'
      )}
    >
      <nav className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8" aria-label="Main navigation">
        <div className="flex items-center justify-between h-16 md:h-[76px]">
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2.5"
            aria-label="CivicChain Home"
          >
            <motion.div
              className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-sm overflow-hidden"
              whileHover={reduce ? undefined : { scale: 1.06, rotate: -3 }}
              whileTap={reduce ? undefined : { scale: 0.94 }}
              transition={{ duration: DUR.fast, ease: EASE.out }}
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </motion.div>
            <span className="font-display font-bold text-xl text-neutral-900 dark:text-white hidden sm:block">
              CivicChain
            </span>
          </Link>

          {/* Desktop menus */}
          <div className="hidden lg:flex items-center gap-1" onMouseLeave={handleLeave}>
            {NAV_GROUPS.map((group) => {
              const active = openMenu === group.key;
              const sectionActive = activeSection === group.key;
              return (
                <div key={group.key} className="relative group" onMouseEnter={() => handleEnter(group.key)}>
                  <button
                    type="button"
                    onClick={() => setOpenMenu(active ? null : group.key)}
                    aria-expanded={active}
                    aria-haspopup="true"
                    className={cn(
                      'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors duration-200',
                      active || sectionActive
                        ? 'text-brand-700 dark:text-brand-300'
                        : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
                    )}
                  >
                  {group.label}
                    <ChevronDown
                      className={cn('w-3.5 h-3.5 transition-transform duration-200', active && 'rotate-180')}
                      aria-hidden="true"
                    />
                  </button>
                  {/* hover underline (#27) — subtle perma-underline on the label */}
                  <span className="pointer-events-none absolute left-3 right-3 -bottom-0.5 h-px origin-left scale-x-0 rounded-full bg-brand-500/60 dark:bg-brand-400/60 transition-transform duration-300 ease-out group-hover:scale-x-100" />
                  {sectionActive && !active && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute -bottom-0.5 left-3 right-3 h-0.5 rounded-full bg-brand-600 dark:bg-brand-400"
                      transition={{ duration: DUR.standard, ease: EASE.out }}
                    />
                  )}
                </div>
              );
            })}

            <Link
              href="/#broken-promise"
              className="group relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white transition-colors duration-200"
              onMouseEnter={() => handleEnter(null)}
            >
              Broken Promises
              <span className="pointer-events-none absolute left-3 right-3 -bottom-0.5 h-px origin-left scale-x-0 rounded-full bg-red-500/60 transition-transform duration-300 ease-out group-hover:scale-x-100" />
              {activeSection === 'broken-promise' && (
                <motion.span
                  layoutId="nav-underline"
                  className="absolute -bottom-0.5 left-3 right-3 h-0.5 rounded-full bg-red-500"
                  transition={{ duration: DUR.standard, ease: EASE.out }}
                />
              )}
            </Link>
          </div>

          {/* Desktop actions */}
          <LandingNavActions />

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="landing-mobile-menu"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mega menu panels */}
        <AnimatePresence>
          {openMenu && (
            <motion.div
              key={openMenu}
              onMouseEnter={() => handleEnter(openMenu)}
              onMouseLeave={handleLeave}
              className="absolute left-0 right-0 top-full hidden lg:block"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
              transition={{ duration: DUR.standard, ease: EASE.out }}
              style={{ transformOrigin: '50% 0%' }}
            >
              <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 pt-2">
                <div className="rounded-2xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-elevated shadow-xl dark:shadow-dark-xl overflow-hidden">
                  <div className="grid grid-cols-2 gap-px bg-neutral-100 dark:bg-dark-border p-1.5">
                    {NAV_GROUPS.find((g) => g.key === openMenu)?.children.map((child) => {
                      const Icon = child.icon;
                      return (
                        <Link
                          key={child.label}
                          href={child.href}
                          onClick={() => setOpenMenu(null)}
                          className="group flex items-start gap-3 rounded-xl p-3.5 bg-white dark:bg-dark-bg-elevated hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors duration-200"
                        >
                          <span className="mt-0.5 w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
                            <Icon className="w-4.5 h-4.5 text-brand-600 dark:text-brand-300" />
                          </span>
                          <span>
                            <span className="block text-sm font-semibold text-neutral-900 dark:text-white">
                              {child.label}
                            </span>
                            <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                              {child.description}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="landing-mobile-menu"
            role="navigation"
            aria-label="Mobile navigation"
            className="lg:hidden overflow-hidden bg-white dark:bg-dark-bg-elevated border-b border-neutral-200 dark:border-dark-border"
            initial={reduce ? { opacity: 0, height: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduce ? { opacity: 0, height: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: DUR.standard, ease: EASE.out }}
          >
            <div className="px-4 py-4 space-y-1">
              {NAV_GROUPS.map((group) => {
                const open = mobileAccordion === group.key;
                const Icon = group.children[0].icon;
                return (
                  <div key={group.key} className="rounded-xl border border-neutral-200 dark:border-dark-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setMobileAccordion(open ? null : group.key)}
                      aria-expanded={open}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-neutral-900 dark:text-white text-left"
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="w-4.5 h-4.5 text-brand-600 dark:text-brand-300" aria-hidden="true" />
                        {group.label}
                      </span>
                      <ChevronDown
                        className={cn('w-4 h-4 text-neutral-400 transition-transform duration-200', open && 'rotate-180')}
                        aria-hidden="true"
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: DUR.standard, ease: EASE.out }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 space-y-1">
                            {group.children.map((child) => {
                              const ChildIcon = child.icon;
                              return (
                                <Link
                                  key={child.label}
                                  href={child.href}
                                  onClick={() => {
                                    setMobileOpen(false);
                                    setMobileAccordion(null);
                                  }}
                                  className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                                >
                                  <ChildIcon className="w-4.5 h-4.5 mt-0.5 text-brand-500 dark:text-brand-400 shrink-0" aria-hidden="true" />
                                  <span>
                                    <span className="block font-medium text-neutral-900 dark:text-white">{child.label}</span>
                                    <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{child.description}</span>
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              <Link
                href="/#broken-promise"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 px-4 py-3.5 text-sm font-medium text-neutral-700 dark:text-neutral-200"
              >
                Broken Promises
              </Link>

              <div className="pt-3 border-t border-neutral-200 dark:border-dark-border flex flex-col gap-2.5">
                <LandingNavActions mobile />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
