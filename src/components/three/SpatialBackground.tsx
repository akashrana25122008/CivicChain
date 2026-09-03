'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, Suspense, useEffect } from 'react';
import * as THREE from 'three';
import { useWebGL } from './WebGLProvider';

/**
 * Spatial Background — a subtle, GPU-efficient WebGL background layer for the
 * Admin Command Center. Renders an abstract civic grid with flowing data
 * connections. Low-opacity, never interferes with readability.
 *
 * Follows Three.js Skills: GPU-conscious, respects reduced-motion, reduces
 * complexity on weaker devices, pauses when off-screen.
 */

// ─── Seeded deterministic random (pure, no Math.random during render) ────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Civic Grid ──────────────────────────────────────────────────────────────

function CivicGrid({ tier }: { tier: 'high' | 'medium' | 'low' }) {
  const gridRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  const gridSize = tier === 'high' ? 24 : tier === 'medium' ? 16 : 10;
  const spacing = 2;

  const nodes = useMemo(() => {
    const rand = seededRandom(42);
    const arr: Array<{ x: number; z: number; delay: number; brightness: number }> = [];
    const half = gridSize / 2;
    for (let x = -half; x <= half; x += 2) {
      for (let z = -half; z <= half; z += 2) {
        if (rand() > 0.6) continue;
        arr.push({
          x: x * spacing + (rand() - 0.5) * 0.5,
          z: z * spacing + (rand() - 0.5) * 0.5,
          delay: rand() * Math.PI * 2,
          brightness: 0.3 + rand() * 0.4,
        });
      }
    }
    return arr;
  }, [gridSize]);

  const lines = useMemo(() => {
    const pos: number[] = [];
    const half = gridSize * spacing;
    // Grid lines
    for (let i = -gridSize; i <= gridSize; i += 2) {
      pos.push(i * spacing, 0, -half, i * spacing, 0, half);
      pos.push(-half, 0, i * spacing, half, 0, i * spacing);
    }
    return new Float32Array(pos);
  }, [gridSize]);

  useFrame((_, delta) => {
    timeRef.current += delta * 0.3;
  });

  return (
    <group ref={gridRef} position={[0, -2, 0]}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[lines, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#1e3a8a" transparent opacity={0.08} depthWrite={false} />
      </lineSegments>
      {nodes.map((n, i) => (
        <mesh key={i} position={[n.x, 0.05, n.z]}>
          <circleGeometry args={[0.06, 8]} />
          <meshBasicMaterial
            color="#3b82f6"
            transparent
            opacity={n.brightness * 0.15}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Data Flow Particles ─────────────────────────────────────────────────────

function DataFlowParticles({ tier }: { tier: 'high' | 'medium' | 'low' }) {
  const ref = useRef<THREE.Points>(null);
  const count = tier === 'high' ? 200 : tier === 'medium' ? 100 : 40;

  const positions = useMemo(() => {
    const rand = seededRandom(123);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rand() - 0.5) * 40;
      pos[i * 3 + 1] = rand() * 8 - 2;
      pos[i * 3 + 2] = (rand() - 0.5) * 40;
    }
    return pos;
  }, [count]);

  const speeds = useMemo(() => {
    const rand = seededRandom(456);
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      s[i] = 0.1 + rand() * 0.3;
    }
    return s;
  }, [count]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += speeds[i] * delta;
      if (pos[i * 3 + 1] > 6) {
        pos[i * 3 + 1] = -2;
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#3b82f6"
        size={0.08}
        transparent
        opacity={0.2}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ─── Scene ───────────────────────────────────────────────────────────────────

function BackgroundScene() {
  const { capability, isVisible } = useWebGL();
  const { gl } = useThree();

  // Pause rendering when not visible
  useEffect(() => {
    if (!isVisible) {
      gl.setAnimationLoop(null);
    } else {
      gl.setAnimationLoop(() => {});
    }
  }, [isVisible, gl]);

  return (
    <>
      <ambientLight intensity={0.2} color="#1e3a8a" />
      <CivicGrid tier={capability.tier} />
      <DataFlowParticles tier={capability.tier} />
    </>
  );
}

// ─── Exported Component ──────────────────────────────────────────────────────

export function SpatialBackground({ className }: { className?: string }) {
  const { capability, clampedDPR } = useWebGL();

  if (capability.reducedMotion) return null;

  return (
    <div className={`fixed inset-0 z-0 pointer-events-none ${className ?? ''}`}>
      <Canvas
        camera={{ position: [0, 8, 12], fov: 50 }}
        dpr={clampedDPR()}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <BackgroundScene />
        </Suspense>
      </Canvas>
    </div>
  );
}
