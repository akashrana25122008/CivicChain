'use client';

import { createContext, useContext, useRef, useEffect, useState, type ReactNode } from 'react';

/**
 * WebGL Performance & Capability Provider
 *
 * Detects device GPU capability, manages DPR clamping, provides reduced-motion
 * awareness, and tracks visibility for render pause. Individual scenes consume
 * this context to adjust their complexity.
 *
 * Follows Three.js Skills: clamp DPR, detect capability, pause off-screen,
 * respect reduced-motion.
 */

interface DeviceCapability {
  tier: 'high' | 'medium' | 'low';
  maxDPR: number;
  supportsWebGL2: boolean;
  reducedMotion: boolean;
}

interface WebGLState {
  capability: DeviceCapability;
  isVisible: boolean;
  /** Clamp device pixel ratio to device-appropriate max */
  clampedDPR: () => number;
}

const WebGLContext = createContext<WebGLState | null>(null);

function detectCapability(): DeviceCapability {
  if (typeof window === 'undefined') {
    return { tier: 'medium', maxDPR: 1.5, supportsWebGL2: false, reducedMotion: false };
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = window.devicePixelRatio || 1;

  let supportsWebGL2 = false;
  try {
    const canvas = document.createElement('canvas');
    supportsWebGL2 = !!canvas.getContext('webgl2');
  } catch { /* no-op */ }

  // Rough tier detection based on DPR + hardware concurrency + memory
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;

  let tier: 'high' | 'medium' | 'low' = 'medium';
  if (reducedMotion) {
    tier = 'low';
  } else if (dpr > 2 && cores >= 8 && memory >= 8) {
    tier = 'high';
  } else if (dpr <= 1.5 && (cores <= 2 || memory <= 2)) {
    tier = 'low';
  }

  return {
    tier,
    maxDPR: tier === 'high' ? 2 : tier === 'medium' ? 1.5 : 1,
    supportsWebGL2,
    reducedMotion,
  };
}

export function WebGLProvider({ children }: { children: ReactNode }) {
  const [capability] = useState(detectCapability);
  const [isVisible, setIsVisible] = useState(true);
  const visibleRef = useRef(true);

  // Track page visibility for render pause
  useEffect(() => {
    const onVis = () => {
      const visible = !document.hidden;
      setIsVisible(visible);
      visibleRef.current = visible;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const clampedDPR = () => Math.min(window.devicePixelRatio || 1, capability.maxDPR);

  const value: WebGLState = { capability, isVisible, clampedDPR };

  return <WebGLContext.Provider value={value}>{children}</WebGLContext.Provider>;
}

export function useWebGL(): WebGLState {
  const ctx = useContext(WebGLContext);
  if (!ctx) {
    // Graceful fallback when outside provider
    return {
      capability: { tier: 'medium', maxDPR: 1.5, supportsWebGL2: false, reducedMotion: false },
      isVisible: true,
      clampedDPR: () => 1.5,
    };
  }
  return ctx;
}

export function useIsVisible() {
  const ctx = useContext(WebGLContext);
  return ctx?.isVisible ?? true;
}
