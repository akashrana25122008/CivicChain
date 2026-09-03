'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Html, ContactShadows, Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useMemo, useRef, Suspense } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from 'framer-motion';
import { useWebGL } from './WebGLProvider';

/**
 * Health Network — 3D service topology for the System Health page.
 *
 * A layered hub-and-spoke topology that communicates live system state:
 *   - The DATABASE is the central core (the system's foundation)
 *   - Core services (postgis, auth, redis, storage, ai) sit on an inner ring
 *   - Leaf services (email, notifications, queue, websocket) orbit the outer ring
 *   - Node color: green/emerald = healthy · amber = degraded · slate = unconfigured · red = down
 *   - Node emissive glow pulses only for healthy services; broken nodes sit flat (no pulse)
 *   - Connection lines animate a travelling data pulse to show live flow
 *   - ContactShadows ground the scene; selective bloom lifts healthy nodes
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface ServiceNode {
  key: string;
  label: string;
  ok: boolean;
  status: 'OPERATIONAL' | 'DEGRADED' | 'WARNING' | 'DOWN' | 'NOT_CONFIGURED' | 'UNKNOWN';
  x: number;
  y: number;
  z: number;
  size: number;
  kind: 'core' | 'sphere' | 'ring';
}

interface ServiceConnection {
  from: string;
  to: string;
}

interface HealthNetworkProps {
  services: Array<{
    key: string;
    label: string;
    ok: boolean;
    status?: string;
  }>;
  className?: string;
}

// ─── Configuration ───────────────────────────────────────────────────────────

const SERVICE_ROLE: Record<string, { size: number; kind: 'core' | 'sphere' | 'ring' }> = {
  database: { size: 1.25, kind: 'core' },
  postgis: { size: 1.1, kind: 'sphere' },
  auth: { size: 1.15, kind: 'sphere' },
  redis: { size: 1.05, kind: 'sphere' },
  storage: { size: 0.9, kind: 'sphere' },
  ai: { size: 1.0, kind: 'sphere' },
  email: { size: 0.75, kind: 'ring' },
  notifications: { size: 0.8, kind: 'ring' },
  queue: { size: 0.85, kind: 'ring' },
  websocket: { size: 0.7, kind: 'ring' },
};

const CONNECTIONS: ServiceConnection[] = [
  { from: 'database', to: 'postgis' },
  { from: 'database', to: 'auth' },
  { from: 'database', to: 'redis' },
  { from: 'database', to: 'storage' },
  { from: 'database', to: 'ai' },
  { from: 'redis', to: 'queue' },
  { from: 'auth', to: 'email' },
  { from: 'queue', to: 'notifications' },
  { from: 'queue', to: 'websocket' },
];

const STATE_COLOR: Record<ServiceNode['status'], { base: string; emissive: string }> = {
  OPERATIONAL: { base: '#34d399', emissive: '#059669' },
  DEGRADED: { base: '#fbbf24', emissive: '#d97706' },
  WARNING: { base: '#fbbf24', emissive: '#d97706' },
  DOWN: { base: '#f87171', emissive: '#ef4444' },
  NOT_CONFIGURED: { base: '#6b7280', emissive: '#4b5563' },
  UNKNOWN: { base: '#94a3b8', emissive: '#64748b' },
};

// ─── Layout — layered 3D shell ───────────────────────────────────────────────

function layoutServices(services: Array<{ key: string; label: string; ok: boolean; status?: string }>): {
  nodes: ServiceNode[];
  connections: ServiceConnection[];
} {
  const byKey = new Map(services.map((s) => [s.key, s]));

  const innerRing = ['postgis', 'auth', 'redis', 'storage', 'ai'].filter((k) => byKey.has(k));
  const outerRing = ['email', 'notifications', 'queue', 'websocket'].filter((k) => byKey.has(k));
  const configured = [...innerRing, ...outerRing];

  const nodes: ServiceNode[] = [];

  // Central core
  if (byKey.has('database')) {
    const db = byKey.get('database')!;
    nodes.push({
      key: db.key,
      label: db.label,
      ok: db.ok,
      status: (db.status as ServiceNode['status']) ?? (db.ok ? 'OPERATIONAL' : 'WARNING'),
      x: 0,
      y: 0,
      z: 0,
      size: SERVICE_ROLE.database.size,
      kind: 'core',
    });
  }

  // Inner ring (core services) — flat-ish, slight jitter for a natural cluster
  const innerRadius = 2.4;
  innerRing.forEach((key, i) => {
    const s = byKey.get(key)!;
    const angle = (i / Math.max(innerRing.length, 1)) * Math.PI * 2;
    nodes.push({
      key,
      label: s.label,
      ok: s.ok,
      status: (s.status as ServiceNode['status']) ?? (s.ok ? 'OPERATIONAL' : 'WARNING'),
      x: Math.cos(angle) * innerRadius,
      y: Math.sin(angle) * innerRadius,
      z: 0,
      size: SERVICE_ROLE[key]?.size ?? 1,
      kind: SERVICE_ROLE[key]?.kind ?? 'sphere',
    });
  });

  // Outer ring (leaf services) — tilted 3D orbit for depth
  const outerRadius = 3.6;
  outerRing.forEach((key, i) => {
    const s = byKey.get(key)!;
    const angle = (i / Math.max(outerRing.length, 1)) * Math.PI * 2 + 0.6;
    nodes.push({
      key,
      label: s.label,
      ok: s.ok,
      status: (s.status as ServiceNode['status']) ?? (s.ok ? 'OPERATIONAL' : 'WARNING'),
      x: Math.cos(angle) * outerRadius,
      y: Math.sin(angle) * outerRadius * 0.45,
      z: Math.sin(angle) * outerRadius * 0.7,
      size: SERVICE_ROLE[key]?.size ?? 0.8,
      kind: SERVICE_ROLE[key]?.kind ?? 'ring',
    });
  });

  // Add any unlisted services to a far ring so nothing is dropped
  byKey.forEach((s, key) => {
    if (nodes.some((n) => n.key === key)) return;
    const t = nodes.length + configured.length;
    const angle = t * 0.35;
    nodes.push({
      key,
      label: s.label,
      ok: s.ok,
      status: (s.status as ServiceNode['status']) ?? (s.ok ? 'OPERATIONAL' : 'WARNING'),
      x: Math.cos(angle) * 4.6,
      y: Math.sin(angle) * 2,
      z: Math.sin(angle) * 2.4,
      size: 0.8,
      kind: 'ring',
    });
  });

  return { nodes, connections: CONNECTIONS.filter((c) => byKey.has(c.from) && byKey.has(c.to)) };
}

// ─── Node Shape ──────────────────────────────────────────────────────────────

function NodeShape({ node, index }: { node: ServiceNode; index: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(index * 0.7);
  const reduce = useReducedMotion();
  const palette = STATE_COLOR[node.status] ?? STATE_COLOR.UNKNOWN;
  const healthy = node.ok;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (reduce) return;
    timeRef.current += delta;
    // Gentle idle float on all nodes
    groupRef.current.position.y = node.y + Math.sin(timeRef.current * 1.2 + index) * 0.06;
    // Pulse only healthy nodes — broken nodes sit flat and still
    if (healthy) {
      const pulse = 1 + Math.sin(timeRef.current * 2.2) * 0.04;
      groupRef.current.scale.setScalar(node.size * pulse);
    } else {
      groupRef.current.scale.setScalar(node.size);
    }
  });

  const material = useMemo(
    () => (
      <meshStandardMaterial
        color={palette.base}
        emissive={palette.emissive}
        emissiveIntensity={healthy ? 0.55 : 0.2}
        roughness={0.35}
        metalness={0.55}
        envMapIntensity={0.9}
      />
    ),
    [palette, healthy],
  );

  return (
    <group position={[node.x, node.y, node.z]}>
      <group ref={groupRef}>
        {node.kind === 'core' ? (
          <mesh scale={node.size}>{material}
            <icosahedronGeometry args={[0.42, 1]} />
          </mesh>
        ) : node.kind === 'ring' ? (
          <mesh scale={node.size}>{material}
            <octahedronGeometry args={[0.3, 0]} />
          </mesh>
        ) : (
          <mesh scale={node.size}>{material}
            <sphereGeometry args={[0.32, 24, 24]} />
          </mesh>
        )}

        {/* Bright additive core — only healthy services exceed bloom threshold */}
        {healthy && (
          <mesh>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshBasicMaterial color={palette.base} toneMapped={false} transparent opacity={0.85} depthWrite={false} />
          </mesh>
        )}
      </group>

      {/* Status ring under core/high-importance nodes */}
      {node.kind !== 'ring' && (
        <mesh position={[0, -0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.52, 32]} />
          <meshBasicMaterial
            color={palette.base}
            transparent
            opacity={healthy ? 0.35 : 0.2}
            depthWrite={false}
          />
        </mesh>
      )}

      <Html position={[0, node.size * 0.6 + 0.24, 0]} center distanceFactor={10} zIndexRange={[10, 0]}>
        <div className="whitespace-nowrap text-center pointer-events-none select-none">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-300 bg-white/85 dark:bg-dark-bg/85 backdrop-blur-sm rounded px-1.5 py-0.5 border border-black/5 dark:border-white/10 shadow-sm">
            {node.label}
          </span>
        </div>
      </Html>
    </group>
  );
}

// ─── Connection Lines with travelling data pulse ─────────────────────────────

function NetworkFlow({ nodes, connections }: { nodes: ServiceNode[]; connections: ServiceConnection[] }) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const reduce = useReducedMotion();

  const nodeMap = useMemo(() => {
    const m = new Map<string, ServiceNode>();
    nodes.forEach((n) => m.set(n.key, n));
    return m;
  }, [nodes]);

  const segments = useMemo(() => {
    return connections
      .map((c) => {
        const from = nodeMap.get(c.from);
        const to = nodeMap.get(c.to);
        if (!from || !to) return null;
        return { from, to, ok: from.ok && to.ok };
      })
      .filter(Boolean) as Array<{ from: ServiceNode; to: ServiceNode; ok: boolean }>;
  }, [connections, nodeMap]);

  const centerLinePositions = useMemo(() => {
    const pos: number[] = [];
    segments.forEach(({ from, to }) => {
      pos.push(from.x, from.y, from.z, to.x, to.y, to.z);
    });
    return new Float32Array(pos);
  }, [segments]);

  // A brighter "flow" layer that travels (drawn as short segments advancing along each connection)
  const flowRef = useRef<THREE.Points>(null);
  const flowCount = segments.length;
  const timeRef = useRef(0);

  const flowAttribute = useMemo(() => {
    const arr = new Float32Array(flowCount * 3);
    for (let i = 0; i < flowCount; i++) arr[i * 3] = -999;
    return arr;
  }, [flowCount]);

  useFrame((_, delta) => {
    if (reduce) return;
    if (!flowRef.current) return;
    timeRef.current += delta;
    const geo = flowRef.current.geometry as THREE.BufferGeometry;
    const attr = geo.attributes.position as THREE.BufferAttribute;
    const pos = attr.array as Float32Array;

    for (let i = 0; i < segments.length; i++) {
      const { from, to, ok } = segments[i];
      if (!ok) {
        pos[i * 3] = -999; pos[i * 3 + 1] = -999; pos[i * 3 + 2] = -999;
        continue;
      }
      // t wraps 0→1 at ~0.35/s; stagger each shot by index for a natural cadence
      const t = ((timeRef.current * 0.35 + i * 0.3) % 1 + 1) % 1;
      // only show near the target so it reads as a travelling dot (short trailing window)
      if (t > 0.7) {
        const localT = (t - 0.7) / 0.3;
        pos[i * 3] = from.x + (to.x - from.x) * localT;
        pos[i * 3 + 1] = from.y + (to.y - from.y) * localT;
        pos[i * 3 + 2] = from.z + (to.z - from.z) * localT;
      } else {
        pos[i * 3] = -999; pos[i * 3 + 1] = -999; pos[i * 3 + 2] = -999;
      }
    }
    attr.needsUpdate = true;
  });

  return (
    <group>
      {/* base connection lines */}
      <lineSegments ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[centerLinePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#4b5563" transparent opacity={0.45} depthWrite={false} />
      </lineSegments>

      {/* travelling data-flow points */}
      <points ref={flowRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[flowAttribute, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#7dd3fc" size={0.09} transparent opacity={0.9} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  );
}

// ─── Seeded PRNG (deterministic layout — no Math.random in render) ─────────

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Subtle starfield backdrop ───────────────────────────────────────────────

function AmbientDust({ count, reduced }: { count: number; reduced: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const rand = mulberry32(1337);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 3 + rand() * 7;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      arr[i * 3 + 2] = r * Math.cos(phi) * 0.6;
    }
    return new Float32Array(arr);
  }, [count]);

  const timeRef = useRef(0);
  useFrame((_, delta) => {
    if (reduced) return;
    if (!pointsRef.current) return;
    timeRef.current += delta;
    pointsRef.current.rotation.y += delta * 0.02;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#334155" size={0.02} transparent opacity={0.5} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// ─── Scene ───────────────────────────────────────────────────────────────────

function NetworkScene({ nodes, connections, highTier, reduced }: {
  nodes: ServiceNode[];
  connections: ServiceConnection[];
  highTier: boolean;
  reduced: boolean;
}) {
  return (
    <>
      {/* Studio lighting */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 8, 4]} intensity={1.4} color="#ffffff" />
      <directionalLight position={[-5, -2, -4]} intensity={0.5} color="#0ea5e9" />
      <directionalLight position={[-3, 6, -5]} intensity={0.7} color="#fbbf24" />

      {/* IBL for PBR reflections */}
      <Environment resolution={64} frames={1}>
        <group rotation={[-Math.PI / 4, 0, 0]}>
          <LightDot position={[0, 4, 3]} color="#ffffff" />
          <LightDot position={[-4, 1, -3]} color="#34d399" />
          <LightDot position={[4, 1, -3]} color="#38bdf8" />
        </group>
      </Environment>

      <ContactShadows position={[0, -1.1, 0]} opacity={0.42} blur={2.8} scale={11} far={3} resolution={256} />

      <AmbientDust count={reduced ? 40 : 160} reduced={reduced} />

      <NetworkFlow nodes={nodes} connections={connections} />

      {nodes.map((n, i) => (
        <NodeShape key={n.key} node={n} index={i} />
      ))}

      {highTier && !reduced && (
        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={0.75} intensity={0.45} radius={0.75} />
        </EffectComposer>
      )}
    </>
  );
}

function LightDot({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={position}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

// ─── Exported Component ──────────────────────────────────────────────────────

export function HealthNetwork({ services, className }: HealthNetworkProps) {
  const { capability, clampedDPR, isVisible } = useWebGL();
  const reduce = useReducedMotion();
  const reduced = reduce ?? capability.reducedMotion;

  const { nodes, connections } = useMemo(() => layoutServices(services), [services]);

  if (services.length === 0) {
    return (
      <div className={`relative flex items-center justify-center ${className ?? ''}`}>
        <p className="text-sm text-neutral-400 dark:text-neutral-500">No service data available</p>
      </div>
    );
  }

  const highTier = capability.tier === 'high';
  const mediumTier = capability.tier === 'medium' || capability.tier === 'high';

  return (
    <div className={`relative ${className ?? ''}`}>
      <Canvas
        camera={{ position: [0, 2.6, 6.4], fov: 42 }}
        dpr={clampedDPR()}
        gl={{
          antialias: mediumTier,
          alpha: true,
          powerPreference: capability.tier === 'low' ? 'low-power' : 'high-performance',
        }}
        className="w-full h-full"
        frameloop={isVisible ? (reduced ? 'demand' : 'always') : 'demand'}
      >
        <Suspense fallback={null}>
          <NetworkScene nodes={nodes} connections={connections} highTier={highTier} reduced={reduced} />
        </Suspense>
      </Canvas>
    </div>
  );
}
