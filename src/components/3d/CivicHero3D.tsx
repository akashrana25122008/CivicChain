'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useRef, useMemo, useEffect, Suspense } from 'react';
import * as THREE from 'three';

/** Client-safe reduced-motion check shared by the 3D animation loops. */
function useReduceMotionPreference() {
  const ref = useRef(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      ref.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }, []);
  return ref;
}

function CityGrid() {
  const gridRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  const cityData = useMemo(() => {
    const buildings: Array<{
      position: [number, number, number];
      scale: [number, number, number];
      color: THREE.Color;
      emissive: THREE.Color;
      delay: number;
    }> = [];
    const gridSize = 20;
    const spacing = 1.5;

    for (let x = -gridSize / 2; x < gridSize / 2; x++) {
      for (let z = -gridSize / 2; z < gridSize / 2; z++) {
        if (Math.random() > 0.3) continue;

        const height = 0.5 + Math.random() * 3;
        const width = 0.6 + Math.random() * 0.8;
        const depth = 0.6 + Math.random() * 0.8;

        buildings.push({
          position: [
            x * spacing + (Math.random() - 0.5) * 0.3,
            height / 2,
            z * spacing + (Math.random() - 0.5) * 0.3,
          ],
          scale: [width, height, depth],
          color: new THREE.Color().setHSL(0.6, 0.1, 0.15 + Math.random() * 0.15),
          emissive: new THREE.Color().setHSL(0.6, 0.5, 0.05 + Math.random() * 0.1),
          delay: Math.random() * Math.PI * 2,
        });
      }
    }
    return buildings;
  }, []);

  useFrame((_, delta) => {
    timeRef.current += delta * 0.5;
    // autonomous slow orbit so the city stays alive even without pointer input
    if (gridRef.current) {
      gridRef.current.rotation.y += delta * 0.04;
    }
  });

  return (
    <group>
      <group ref={gridRef}>
        {cityData.map((building, i) => (
          <Building key={i} {...building} time={timeRef.current} />
        ))}
      </group>
      <GroundPlane />
    </group>
  );
}

function Building({
  position,
  scale,
  color,
  emissive,
  delay,
  time,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color: THREE.Color;
  emissive: THREE.Color;
  delay: number;
  time: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const reduceRef = useReduceMotionPreference();

  useFrame(() => {
    if (reduceRef.current || !meshRef.current) return;
    const pulse = Math.sin(time + delay) * 0.02 + 1;
    meshRef.current.scale.y = scale[1] * pulse;
    meshRef.current.position.y = (scale[1] * pulse) / 2;
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      scale={scale}
      castShadow
      receiveShadow
    >
      <boxGeometry />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={0.3}
        roughness={0.7}
        metalness={0.2}
      />
    </mesh>
  );
}

function GroundPlane() {
  return (
    <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[30, 30, 50, 50]} />
      <meshStandardMaterial
        color={0x0a0f1a}
        roughness={0.9}
        metalness={0.1}
      />
    </mesh>
  );
}

function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);
  const reduceRef = useReduceMotionPreference();

  useFrame((_, delta) => {
    if (reduceRef.current) return;
    timeRef.current += delta;
    if (particlesRef.current) {
      particlesRef.current.rotation.y += delta * 0.02;
      const positions = particlesRef.current.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(timeRef.current + i) * 0.001;
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  const positions = useMemo(() => {
    const pos = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 15;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    return pos;
  }, []);

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={0xf59e0b}
        size={0.05}
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

function HeroLights() {
  return (
    <>
      <ambientLight intensity={0.4} color="#1e3a8a" />
      <directionalLight
        position={[10, 20, 10]}
        intensity={2}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.001}
      />
      <directionalLight position={[-10, 10, -10]} intensity={0.5} color="#3b82f6" />
      <pointLight position={[0, 5, 0]} intensity={1} color="#f59e0b" distance={30} decay={2} />
      <pointLight position={[5, 3, 5]} intensity={0.5} color="#06b6d4" distance={20} decay={2} />
    </>
  );
}

function CameraRig() {
  const { camera } = useThree();
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const baseZ = 8;
  const baseY = 4;

  // Reduce motion: hold a static composition, camera fixed.
  const reduce = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // Set up a passive pointer listener on the window.
  useEffect(() => {
    if (reduce) return;
    const onPointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      (window as unknown as { __ccPointer?: { nx: number; ny: number } }).__ccPointer = { nx, ny };
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [reduce]);

  // Keep the animation loop alive cheaply; under reduced-motion the camera is
  // left at its initial transform (a static frame).
  useFrame((_, delta) => {
    if (reduce) return;

    const store = (window as unknown as { __ccPointer?: { nx: number; ny: number } }).__ccPointer;
    if (store) {
      target.current.x = store.nx;
      target.current.y = store.ny;
    }

    current.current.x += (target.current.x - current.current.x) * Math.min(1, delta * 2.2);
    current.current.y += (target.current.y - current.current.y) * Math.min(1, delta * 2.2);

    camera.position.x = current.current.x * 1.4;
    camera.position.z = baseZ + Math.abs(current.current.x) * 0.3;
    camera.position.y = baseY - current.current.y * 0.8;
    camera.lookAt(0, 1, 0);
  });

  return null;
}

export function CivicHero3D() {
  return (
    <div className="relative w-full h-full min-h-[500px]">
      <Canvas
        camera={{ position: [0, 4, 8], fov: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        shadows
        className="w-full h-full"
      >
        <Suspense fallback={<LoadingFallback />}>
          <CameraRig />
          <HeroLights />
          <CityGrid />
          <FloatingParticles />
        </Suspense>
        <Html occlude fullscreen className="pointer-events-none">
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="text-center" style={{ transform: 'translateZ(100px)' }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-mono text-white/80 tracking-wider">LIVE CIVIC INTELLIGENCE</span>
              </div>
            </div>
          </div>
        </Html>
      </Canvas>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-dark-bg">
      <div className="text-center">
        <div className="w-12 h-12 border-3 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm font-mono">Initializing Civic Intelligence...</p>
      </div>
    </div>
  );
}

export function CivicHero3DWrapper() {
  return (
    <div className="relative w-full aspect-[16/9] md:aspect-[21/9] max-w-7xl mx-auto">
      <CivicHero3D />
      <div className="absolute inset-0 bg-gradient-to-t from-dark-bg/80 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}