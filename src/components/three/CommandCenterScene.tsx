'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMemo, useRef, Suspense, useEffect, type ReactNode } from 'react';
import * as THREE from 'three';
import { useWebGL } from './WebGLProvider';

/**
 * Command Center Scene — a 3D city intelligence visualization showing geographic
 * issue concentration, department activity, and critical areas.
 *
 * Used on the Command Center page as the central intelligence panel.
 *
 * Meaningful 3D usage:
 * - Height = issue density (how many reports in each area)
 * - Color = severity (blue=low, amber=high, red=critical)
 * - Glowing markers = active hotspots
 * - Flowing particles = live data flow
 *
 * Follows Three.js Skills: constrained camera, meaningful interaction,
 * GPU-conscious, responsive.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface IssuePoint {
  id: string;
  lat: number;
  lng: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  attentionLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface CommandSceneProps {
  points: IssuePoint[];
  center: { lat: number; lng: number } | null;
  className?: string;
}

// ─── Color Helpers ───────────────────────────────────────────────────────────

const ATTENTION_COLOR: Record<string, number> = {
  CRITICAL: 0xef4444,
  HIGH: 0xf59e0b,
  MEDIUM: 0x3b82f6,
  LOW: 0x22c55e,
};

// ─── Coordinate Projection ──────────────────────────────────────────────────

function latLngToGrid(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  scale: number = 50,
): [number, number] {
  const x = ((lng - centerLng) / 360) * scale * Math.cos((centerLat * Math.PI) / 180);
  const z = ((lat - centerLat) / 180) * scale;
  return [x, z];
}

// ─── City Block (instanced) ─────────────────────────────────────────────────

function IssueBlocks({ points, centerLat, centerLng }: {
  points: IssuePoint[];
  centerLat: number;
  centerLng: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const blockData = useMemo(() => {
    return points.map((p) => {
      const [x, z] = latLngToGrid(p.lat, p.lng, centerLat, centerLng);
      const color = ATTENTION_COLOR[p.attentionLevel] ?? 0x3b82f6;
      const height = p.attentionLevel === 'CRITICAL' ? 1.8 : p.attentionLevel === 'HIGH' ? 1.2 : p.attentionLevel === 'MEDIUM' ? 0.8 : 0.5;
      return { x, z, height, color, id: p.id, severity: p.severity };
    });
  }, [points, centerLat, centerLng]);

  useEffect(() => {
    if (!meshRef.current) return;
    blockData.forEach((b, i) => {
      dummy.position.set(b.x, b.height / 2, b.z);
      dummy.scale.set(0.3, b.height, 0.3);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      meshRef.current!.setColorAt(i, new THREE.Color(b.color));
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [blockData, dummy]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, blockData.length]} castShadow receiveShadow>
      <boxGeometry />
      <meshStandardMaterial roughness={0.6} metalness={0.3} />
    </instancedMesh>
  );
}

// ─── Hotspot Glow Markers ────────────────────────────────────────────────────

function HotspotMarkers({ points, centerLat, centerLng }: {
  points: IssuePoint[];
  centerLat: number;
  centerLng: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  const hotspots = useMemo(() =>
    points.filter((p) => p.attentionLevel === 'CRITICAL' || p.attentionLevel === 'HIGH'),
    [points],
  );

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const pulse = 1 + Math.sin(timeRef.current * 2 + i) * 0.3;
      mesh.scale.setScalar(pulse);
    });
  });

  return (
    <group ref={groupRef}>
      {hotspots.map((p) => {
        const [x, z] = latLngToGrid(p.lat, p.lng, centerLat, centerLng);
        const color = ATTENTION_COLOR[p.attentionLevel] ?? 0xf59e0b;
        return (
          <mesh key={p.id} position={[x, 0.1, z]}>
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── Ground Plane ────────────────────────────────────────────────────────────

function GroundPlane() {
  return (
    <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color="#0a0f1a" roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

// ─── Scene Lighting ──────────────────────────────────────────────────────────

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.3} color="#1e3a8a" />
      <directionalLight position={[10, 15, 10]} intensity={1.5} color="#ffffff" castShadow={false} />
      <pointLight position={[0, 8, 0]} intensity={0.8} color="#3b82f6" distance={30} decay={2} />
    </>
  );
}

// ─── Full Scene ──────────────────────────────────────────────────────────────

function CommandSceneInner({ points, centerLat, centerLng }: {
  points: IssuePoint[];
  centerLat: number;
  centerLng: number;
}) {
  return (
    <>
      <SceneLights />
      <GroundPlane />
      <IssueBlocks points={points} centerLat={centerLat} centerLng={centerLng} />
      <HotspotMarkers points={points} centerLat={centerLat} centerLng={centerLng} />
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={8}
        maxDistance={25}
        maxPolarAngle={Math.PI / 3}
        minPolarAngle={Math.PI / 6}
        enableDamping
        dampingFactor={0.05}
        autoRotate={points.length === 0}
        autoRotateSpeed={0.3}
      />
    </>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyOverlay(): ReactNode {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center px-6">
        <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-dark-border flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
          No incident data to visualize
        </p>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
          The intelligence layer activates as civic data accumulates.
        </p>
      </div>
    </div>
  );
}

// ─── Exported Component ──────────────────────────────────────────────────────

export function CommandCenterScene({
  points,
  center,
  className,
}: CommandSceneProps) {
  const { capability, clampedDPR, isVisible } = useWebGL();

  const centerLat = center?.lat ?? 27.4924;
  const centerLng = center?.lng ?? 78.0322;

  if (points.length === 0) {
    return (
      <div className={`relative ${className ?? ''}`}>
        <EmptyOverlay />
        <Canvas
          camera={{ position: [0, 12, 12], fov: 45 }}
          dpr={clampedDPR()}
          gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
          className="w-full h-full"
          frameloop={isVisible ? 'always' : 'demand'}
        >
          <Suspense fallback={null}>
            <SceneLights />
            <GroundPlane />
            <OrbitControls
              enablePan={false}
              enableZoom={false}
              autoRotate
              autoRotateSpeed={0.2}
              maxPolarAngle={Math.PI / 3}
              minPolarAngle={Math.PI / 6}
            />
          </Suspense>
        </Canvas>
      </div>
    );
  }

  const complexity = capability.tier === 'high' ? points : points.slice(0, 200);

  return (
    <div className={`relative ${className ?? ''}`}>
      <Canvas
        camera={{ position: [0, 12, 12], fov: 45 }}
        dpr={clampedDPR()}
        gl={{ antialias: capability.tier !== 'low', alpha: true, powerPreference: 'low-power' }}
        className="w-full h-full"
        frameloop={isVisible ? 'always' : 'demand'}
      >
        <Suspense fallback={null}>
          <CommandSceneInner
            points={complexity}
            centerLat={centerLat}
            centerLng={centerLng}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
