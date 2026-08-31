'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Sphere, OrbitControls } from '@react-three/drei';
import { useRef, useMemo, useState, useEffect, Suspense } from 'react';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';
import { cn } from '@/lib/utils';

/** Client-safe reduced-motion preference used to gate the Globe's decorative animation loops. */
function useReduceMotionPreference() {
  const ref = useRef(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      ref.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }, []);
  return ref;
}

export interface IssueMarker {
  id: string;
  publicId: string;
  lat: number;
  lng: number;
  category: string;
  categoryLabel: string;
  displayStatus: string;
  priority: number | null;
}

/**
 * Maps a located public incident (the shape returned by /api/map/public) to the
 * globe's marker contract. Keeps the 3D globe fully data-driven — no fabricated
 * default markers.
 */
export function toIssueMarker(source: {
  id: string;
  publicId: string;
  latitude: number;
  longitude: number;
  category: string;
  categoryLabel: string;
  displayStatus: string;
  priority: number | null;
}): IssueMarker {
  return {
    id: source.id,
    publicId: source.publicId,
    lat: source.latitude,
    lng: source.longitude,
    category: source.category,
    categoryLabel: source.categoryLabel,
    displayStatus: source.displayStatus,
    priority: source.priority,
  };
}

const CATEGORY_COLORS: Record<string, number> = {
  POTHOLE: 0xef4444,
  DRAINAGE: 0x3b82f6,
  STREETLIGHT: 0xf59e0b,
  GARBAGE: 0x22c55e,
  INFRASTRUCTURE: 0x8b5cf6,
};

const STATUS_COLORS: Record<string, number> = {
  active: 0x3b82f6,
  assigned: 0x8b5cf6,
  promised: 0x06b6d4,
  onTrack: 0x22c55e,
  atRisk: 0xf59e0b,
  verificationPending: 0x8b5cf6,
  resolved: 0x16a34a,
  partiallyResolved: 0xf59e0b,
  brokenPromise: 0xef4444,
  rejected: 0x9ca3af,
};

function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function GlobeSphere({ radius = 2.5 }: { radius?: number }) {
  return (
    <Sphere
      args={[radius, 64, 64]}
      position={[0, 0, 0]}
    >
      <meshStandardMaterial
        color="#0a0f1a"
        roughness={0.9}
        metalness={0.1}
        transparent
        opacity={0.9}
      />
    </Sphere>
  );
}

function GlobeWireframe({ radius = 2.55 }: { radius?: number }) {
  const wireframeRef = useRef<THREE.LineSegments>(null);
  const timeRef = useRef(0);
  const reduceRef = useReduceMotionPreference();

  useFrame((_, delta) => {
    if (reduceRef.current) return;
    timeRef.current += delta * 0.3;
    if (wireframeRef.current) {
      wireframeRef.current.rotation.y += delta * 0.01;
      const opacity = 0.15 + Math.sin(timeRef.current) * 0.05;
      (wireframeRef.current.material as THREE.LineBasicMaterial).opacity = opacity;
    }
  });

  return (
    <lineSegments ref={wireframeRef}>
      <edgesGeometry>
        <sphereGeometry args={[radius, 32, 32]} />
      </edgesGeometry>
      <lineBasicMaterial
        color="#3b82f6"
        transparent
        opacity={0.15}
      />
    </lineSegments>
  );
}

function AtmosphereGlow({ radius = 2.8 }: { radius?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  const reduceRef = useReduceMotionPreference();

  useFrame((_, delta) => {
    if (reduceRef.current) return;
    timeRef.current += delta;
    if (meshRef.current) {
      const scale = 1 + Math.sin(timeRef.current * 0.5) * 0.02;
      meshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshBasicMaterial
        color="#1e3a8a"
        transparent
        opacity={0.08}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function IssueMarker3D({
  issue,
  radius = 2.5,
  selected,
  onClick,
}: {
  issue: IssueMarker;
  radius?: number;
  selected?: boolean;
  onClick?: (issue: IssueMarker) => void;
}) {
  const position = latLngToVector3(issue.lat, issue.lng, radius);
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const [hovered, setHovered] = useState(false);

  const reduceRef = useReduceMotionPreference();

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (groupRef.current) {
      groupRef.current.lookAt(0, 0, 0);
      groupRef.current.rotateY(Math.PI);
    }
    if (meshRef.current && (selected || hovered) && !reduceRef.current) {
      const pulse = 1 + Math.sin(timeRef.current * 3) * 0.15;
      meshRef.current.scale.setScalar(pulse);
    }
  });

  const color =
    selected || hovered
      ? STATUS_COLORS[issue.displayStatus] ?? 0x3b82f6
      : CATEGORY_COLORS[issue.category] ?? 0x6b7280;
  const size = 0.08 + ((issue.priority ?? 0) / 100) * 0.12;

  return (
    <group
      ref={groupRef}
      position={position.toArray()}
      onClick={() => onClick?.(issue)}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <mesh
        ref={meshRef}
        scale={selected || hovered ? 1.5 : 1}
      >
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected || hovered ? 1 : 0.5}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      {selected && (
        <mesh>
          <torusGeometry args={[size * 1.8, 0.01, 8, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.5}
            depthWrite={false}
          />
        </mesh>
      )}
      <Html
        position={[0, size + 0.08, 0]}
        fullscreen
        prepend
        occlude
        transform
        sprite
      >
        <div
          className={cn(
            'whitespace-nowrap text-center pointer-events-none transition-all duration-200',
            selected ? 'scale-125 opacity-100' : 'scale-75 opacity-60'
          )}
          style={{
            transform: 'translate(-50%, -100%)',
            textShadow: '0 0 10px rgba(0,0,0,0.8)',
          }}
        >
          <div className="font-mono text-[10px] font-bold text-white px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm">
            {issue.publicId}
          </div>
          <div className="font-mono text-[9px] text-amber-300/90 mt-0.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm">
            Priority: {issue.priority ?? '—'}
          </div>
        </div>
      </Html>
    </group>
  );
}

function ConnectionLines({ issues, radius = 2.5 }: { issues: IssueMarker[]; radius?: number }) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const timeRef = useRef(0);
  const reduceRef = useReduceMotionPreference();

  const positions = useMemo(() => {
    const pos = new Float32Array(issues.length * 2 * 3);
    issues.forEach((issue, i) => {
      const v = latLngToVector3(issue.lat, issue.lng, radius);
      pos[i * 6] = 0;
      pos[i * 6 + 1] = 0;
      pos[i * 6 + 2] = 0;
      pos[i * 6 + 3] = v.x;
      pos[i * 6 + 4] = v.y;
      pos[i * 6 + 5] = v.z;
    });
    return pos;
  }, [issues, radius]);

  const colors = useMemo(() => {
    const col = new Float32Array(issues.length * 2 * 3);
    issues.forEach((issue, i) => {
      const color = new THREE.Color(CATEGORY_COLORS[issue.category] ?? 0x6b7280);
      col[i * 6] = color.r;
      col[i * 6 + 1] = color.g;
      col[i * 6 + 2] = color.b;
      col[i * 6 + 3] = color.r * 0.1;
      col[i * 6 + 4] = color.g * 0.1;
      col[i * 6 + 5] = color.b * 0.1;
    });
    return col;
  }, [issues]);

  useFrame((_, delta) => {
    if (reduceRef.current) return;
    timeRef.current += delta * 0.5;
    if (lineRef.current) {
      const opacity = 0.3 + Math.sin(timeRef.current) * 0.1;
      (lineRef.current.material as THREE.LineBasicMaterial).opacity = opacity;
    }
  });

  return (
    <lineSegments ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.3}
        depthWrite={false}
      />
    </lineSegments>
  );
}

function GlobeLights() {
  return (
    <>
      <ambientLight intensity={0.5} color="#1e3a8a" />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1.5}
        color="#ffffff"
      />
      <pointLight position={[0, 0, 0]} intensity={0.5} color="#3b82f6" distance={10} decay={2} />
    </>
  );
}

interface CivicGlobeProps {
  selectedIssue?: IssueMarker | null;
  onIssueSelect?: (issue: IssueMarker) => void;
  className?: string;
  showConnections?: boolean;
  /** Located incidents to render. Empty by default; never a fabricated set. */
  issues?: IssueMarker[];
}

export function CivicGlobe({
  selectedIssue,
  onIssueSelect,
  className,
  showConnections = true,
  issues = [],
}: CivicGlobeProps) {
  const reduce = useReducedMotion();

  return (
    <div className={cn('relative w-full h-full', className)}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        className="w-full h-full"
      >
        <Suspense fallback={<GlobeLoading />}>
          <GlobeLights />
          <AtmosphereGlow />
          <GlobeSphere />
          <GlobeWireframe />
          {showConnections && <ConnectionLines issues={issues} />}
          {issues.map((issue) => (
            <IssueMarker3D
              key={issue.id}
              issue={issue}
              selected={selectedIssue?.id === issue.id}
              onClick={onIssueSelect}
            />
          ))}
        </Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={3.5}
          maxDistance={10}
          enableDamping
          dampingFactor={0.05}
          autoRotate={!selectedIssue && !reduce}
          autoRotateSpeed={0.2}
        />
      </Canvas>
    </div>
  );
}

function GlobeLoading() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-dark-bg">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm font-mono">Loading Civic Globe...</p>
        <p className="text-white/40 text-xs mt-1">Rendering geospatial intelligence</p>
      </div>
    </div>
  );
}

export function CivicGlobeWrapper({
  selectedIssue,
  onIssueSelect,
  className,
}: CivicGlobeProps) {
  return (
    <div className={cn('relative w-full aspect-square md:aspect-[4/3]', className)}>
      <CivicGlobe selectedIssue={selectedIssue} onIssueSelect={onIssueSelect} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-dark-bg/50 pointer-events-none" />
    </div>
  );
}