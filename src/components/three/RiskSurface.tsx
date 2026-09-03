'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMemo, useRef, Suspense, useEffect } from 'react';
import * as THREE from 'three';
import { useWebGL } from './WebGLProvider';

/**
 * Risk Surface — 3D geographic risk visualization for the Risk Intelligence page.
 *
 * Meaninging:
 * - Height = Risk Score (higher = more risk)
 * - Color = Risk Severity (green→amber→red→crimson)
 * - Area size = Issue Density
 *
 * Provides spatial understanding of risk distribution that 2D charts cannot.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface RiskArea {
  id: string;
  name: string;
  lat: number;
  lng: number;
  riskScore: number;   // 0–100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  activeIncidents: number;
}

interface RiskSurfaceProps {
  areas: RiskArea[];
  center: { lat: number; lng: number } | null;
  className?: string;
}

// ─── Color Helpers ───────────────────────────────────────────────────────────

function riskToColor(level: string): number {
  switch (level) {
    case 'CRITICAL': return 0xef4444;
    case 'HIGH': return 0xf59e0b;
    case 'MEDIUM': return 0x3b82f6;
    default: return 0x22c55e;
  }
}

// ─── Coordinate Projection ──────────────────────────────────────────────────

function latLngToGrid(lat: number, lng: number, cLat: number, cLng: number, scale: number = 40): [number, number] {
  const x = ((lng - cLng) / 360) * scale * Math.cos((cLat * Math.PI) / 180);
  const z = ((lat - cLat) / 180) * scale;
  return [x, z];
}

// ─── Risk Column (instanced) ────────────────────────────────────────────────

function RiskColumns({ areas, cLat, cLng }: {
  areas: RiskArea[];
  cLat: number;
  cLng: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const columnData = useMemo(() =>
    areas.map((a) => {
      const [x, z] = latLngToGrid(a.lat, a.lng, cLat, cLng);
      const height = (a.riskScore / 100) * 3 + 0.3;
      const color = riskToColor(a.riskLevel);
      return { x, z, height, color, id: a.id, level: a.riskLevel, score: a.riskScore };
    }),
    [areas, cLat, cLng],
  );

  useEffect(() => {
    if (!meshRef.current || columnData.length === 0) return;
    columnData.forEach((c, i) => {
      dummy.position.set(c.x, c.height / 2, c.z);
      dummy.scale.set(0.6, c.height, 0.6);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      meshRef.current!.setColorAt(i, new THREE.Color(c.color));
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [columnData, dummy]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, columnData.length]} castShadow>
      <boxGeometry />
      <meshStandardMaterial roughness={0.5} metalness={0.4} emissiveIntensity={0.2} />
    </instancedMesh>
  );
}

// ─── Risk Pulse Rings ────────────────────────────────────────────────────────

function RiskPulses({ areas, cLat, cLng }: {
  areas: RiskArea[];
  cLat: number;
  cLng: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  const criticals = useMemo(() =>
    areas.filter((a) => a.riskLevel === 'CRITICAL' || a.riskLevel === 'HIGH'),
    [areas],
  );

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const pulse = 1 + Math.sin(timeRef.current * 1.5 + i * 0.5) * 0.4;
      mesh.scale.setScalar(pulse);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.15 + Math.sin(timeRef.current + i) * 0.1;
    });
  });

  return (
    <group ref={groupRef}>
      {criticals.map((a) => {
        const [x, z] = latLngToGrid(a.lat, a.lng, cLat, cLng);
        const color = riskToColor(a.riskLevel);
        return (
          <mesh key={a.id} position={[x, 0.05, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.4, 0.6, 24]} />
            <meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── Ground Plane ────────────────────────────────────────────────────────────

function RiskGround() {
  return (
    <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial color="#0a0f1a" roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

// ─── Scene ───────────────────────────────────────────────────────────────────

function RiskScene({ areas, cLat, cLng }: { areas: RiskArea[]; cLat: number; cLng: number }) {
  return (
    <>
      <ambientLight intensity={0.3} color="#1e3a8a" />
      <directionalLight position={[8, 12, 8]} intensity={1.2} color="#ffffff" />
      <pointLight position={[0, 6, 0]} intensity={0.5} color="#ef4444" distance={20} decay={2} />
      <RiskGround />
      <RiskColumns areas={areas} cLat={cLat} cLng={cLng} />
      <RiskPulses areas={areas} cLat={cLat} cLng={cLng} />
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={6}
        maxDistance={20}
        maxPolarAngle={Math.PI / 3}
        minPolarAngle={Math.PI / 6}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
}

// ─── Exported Component ──────────────────────────────────────────────────────

export function RiskSurface({ areas, center, className }: RiskSurfaceProps) {
  const { capability, clampedDPR, isVisible } = useWebGL();

  const cLat = center?.lat ?? 27.4924;
  const cLng = center?.lng ?? 78.0322;

  if (areas.length === 0) {
    return (
      <div className={`relative flex items-center justify-center ${className ?? ''}`}>
        <div className="text-center px-6">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">No risk areas to visualize</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Risk intelligence activates as data accumulates.</p>
        </div>
      </div>
    );
  }

  const data = capability.tier === 'high' ? areas : areas.slice(0, 50);

  return (
    <div className={`relative ${className ?? ''}`}>
      <Canvas
        camera={{ position: [0, 10, 10], fov: 45 }}
        dpr={clampedDPR()}
        gl={{ antialias: capability.tier !== 'low', alpha: true, powerPreference: 'low-power' }}
        className="w-full h-full"
        frameloop={isVisible ? 'always' : 'demand'}
      >
        <Suspense fallback={null}>
          <RiskScene areas={data} cLat={cLat} cLng={cLng} />
        </Suspense>
      </Canvas>
    </div>
  );
}
