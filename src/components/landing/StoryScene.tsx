'use client';

import { useId } from 'react';

/**
 * ChapterScene — hand-drawn inline SVG illustration for each Accountability
 * Story chapter. Pure decoration (aria-hidden): a themed, self-contained
 * visual that always renders with the brand palette and never depends on a
 * network asset.
 */

interface SceneProps {
  step: string; // '01' | '02' | '03' | '04'
}

export function ChapterScene({ step }: SceneProps) {
  switch (step) {
    case '01':
      return <ReportsScene />;
    case '02':
      return <PromiseScene />;
    case '03':
      return <VerifiedScene />;
    case '04':
      return <MeasuredScene />;
    default:
      return null;
  }
}

function Sparkle({ x, y, size = 5 }: { x: number; y: number; size?: number }) {
  return (
    <path
      d={`M${x} ${y - size} L${x + size / 3} ${y - size / 3} L${x + size} ${y} L${x + size / 3} ${y + size / 3} L${x} ${y + size} L${x - size / 3} ${y + size / 3} L${x - size} ${y} L${x - size / 3} ${y - size / 3} Z`}
      fill="currentColor"
      opacity="0.7"
    />
  );
}

function ReportsScene() {
  const uid = useId();
  const bg = `bg-${uid}`;
  const pin = `pin-${uid}`;
  const glow = `glow-${uid}`;
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16246b" />
          <stop offset="100%" stopColor="#0d1b52" />
        </linearGradient>
        <linearGradient id={pin} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#98abff" />
          <stop offset="100%" stopColor="#3f53ec" />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7692ff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#7692ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="360" height="200" fill={`url(#${bg})`} />

      {/* faint map grid + ward blocks */}
      {[0, 40, 80, 120, 160, 200].map((y) => (
        <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="#eaf0ff" strokeOpacity="0.05" strokeWidth="1" />
      ))}
      {[0, 40, 80, 120, 160, 200, 240, 280, 320, 360].map((x) => (
        <line key={x} x1={x} y1="0" x2={x} y2="200" stroke="#eaf0ff" strokeOpacity="0.05" strokeWidth="1" />
      ))}
      <rect x="250" y="56" width="58" height="40" rx="4" fill="#eaf0ff" fillOpacity="0.03" stroke="#eaf0ff" strokeOpacity="0.14" />
      <rect x="36" y="120" width="52" height="34" rx="4" fill="#eaf0ff" fillOpacity="0.03" stroke="#eaf0ff" strokeOpacity="0.14" />

      {/* glow + location pin */}
      <circle cx="196" cy="104" r="78" fill={`url(#${glow})`} />
      <circle cx="196" cy="104" r="58" fill="none" stroke="#98abff" strokeOpacity="0.18" strokeWidth="1.5" />
      <circle cx="196" cy="104" r="44" fill="none" stroke="#98abff" strokeOpacity="0.28" strokeWidth="1.5" strokeDasharray="3 6" />
      <path
        d="M196 58c-17 0-31 14-31 31 0 24 31 55 31 55s31-31 31-55c0-17-14-31-31-31z"
        fill={`url(#${pin})`}
        stroke="#c3d2ff"
        strokeOpacity="0.5"
        strokeWidth="1"
      />
      <circle cx="196" cy="90" r="11" fill="#0d1b52" />
      <circle cx="196" cy="90" r="5.5" fill="#eaf0ff" />

      {/* tilted evidence report */}
      <g transform="rotate(-7 100 66)">
        <rect x="62" y="42" width="76" height="56" rx="6" fill="#13205e" stroke="#eaf0ff" strokeOpacity="0.25" />
        <rect x="70" y="50" width="26" height="20" rx="3" fill="#7692ff" fillOpacity="0.35" />
        <rect x="102" y="52" width="26" height="4" rx="2" fill="#eaf0ff" fillOpacity="0.5" />
        <rect x="102" y="60" width="18" height="3" rx="1.5" fill="#eaf0ff" fillOpacity="0.3" />
        <circle cx="120" cy="86" r="8" fill="#3f53ec" stroke="#eaf0ff" strokeOpacity="0.6" strokeWidth="1" />
        <path d="M116.5 86l2.5 2.5 5-5" fill="none" stroke="#eaf0ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* camera */}
      <g transform="rotate(5 286 148)">
        <rect x="256" y="132" width="54" height="34" rx="7" fill="#13205e" stroke="#eaf0ff" strokeOpacity="0.25" />
        <rect x="276" y="126" width="16" height="8" rx="2" fill="#13205e" stroke="#eaf0ff" strokeOpacity="0.25" />
        <circle cx="283" cy="149" r="9" fill="#7692ff" fillOpacity="0.4" stroke="#eaf0ff" strokeOpacity="0.45" />
        <circle cx="283" cy="149" r="4" fill="#eaf0ff" fillOpacity="0.7" />
        <circle cx="297" cy="150" r="3" fill="#eaf0ff" fillOpacity="0.5" />
      </g>

      <Sparkle x={62} y={34} size={5} />
      <Sparkle x={322} y={40} size={6} />
      <Sparkle x={318} y={176} size={5} />
    </svg>
  );
}

function PromiseScene() {
  const uid = useId();
  const bg = `bg-${uid}`;
  const seal = `seal-${uid}`;
  const glow = `glow-${uid}`;
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#12372a" />
          <stop offset="100%" stopColor="#0b1f2f" />
        </linearGradient>
        <linearGradient id={seal} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="360" height="200" fill={`url(#${bg})`} />

      {/* municipal building */}
      <g>
        <polygon points="120,74 208,74 244,106 84,106" fill="#0d2540" stroke="#eaf0ff" strokeOpacity="0.25" />
        <rect x="112" y="106" width="144" height="14" fill="#122f4f" stroke="#eaf0ff" strokeOpacity="0.18" />
        <rect x="124" y="120" width="120" height="52" fill="#0f2a46" stroke="#eaf0ff" strokeOpacity="0.18" />
        {[136, 156, 176, 196, 216].map((x) => (
          <rect key={x} x={x - 4} y="120" width="8" height="46" fill="#16355a" stroke="#eaf0ff" strokeOpacity="0.16" />
        ))}
        <rect x="172" y="132" width="24" height="34" rx="2" fill="#0b1f35" stroke="#eaf0ff" strokeOpacity="0.14" />
        <rect x="168" y="172" width="32" height="4" fill="#122f4f" stroke="#eaf0ff" strokeOpacity="0.18" />
        <path d="M140 66c0-5 5-8 10-8s10 3 10 8" fill="none" stroke="#eaf0ff" strokeOpacity="0.4" strokeWidth="1.5" />
        <circle cx="150" cy="60" r="3" fill="#fbbf24" opacity="0.9" />
      </g>

      {/* promise document + approval seal */}
      <g transform="rotate(6 286 96)">
        <circle cx="286" cy="96" r="64" fill={`url(#${glow})`} />
        <rect x="238" y="52" width="96" height="88" rx="8" fill="#132e45" stroke="#eaf0ff" strokeOpacity="0.3" />
        <rect x="250" y="64" width="30" height="12" rx="3" fill="#6ee7b7" fillOpacity="0.25" />
        <rect x="250" y="82" width="72" height="4" rx="2" fill="#eaf0ff" fillOpacity="0.5" />
        <rect x="250" y="91" width="60" height="4" rx="2" fill="#eaf0ff" fillOpacity="0.35" />
        <rect x="250" y="100" width="66" height="4" rx="2" fill="#eaf0ff" fillOpacity="0.35" />
        <circle cx="250" cy="128" r="14" fill={`url(#${seal})`} opacity="0.95" />
        <path d="M244.5 128l4 4 7.5-8" fill="none" stroke="#0b1f2f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* deadline clock */}
      <g transform="rotate(-4 80 148)">
        <circle cx="80" cy="150" r="30" fill="none" stroke="#eaf0ff" strokeOpacity="0.35" strokeWidth="2" />
        <circle cx="80" cy="150" r="30" fill="#6ee7b7" fillOpacity="0.08" />
        <circle cx="80" cy="150" r="2.5" fill="#eaf0ff" stroke="#eaf0ff" strokeOpacity="0.5" />
        <line x1="80" y1="150" x2="80" y2="132" stroke="#eaf0ff" strokeWidth="2" strokeLinecap="round" />
        <line x1="80" y1="150" x2="96" y2="156" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
      </g>

      <Sparkle x={48} y={34} size={5} />
      <Sparkle x={320} y={40} size={6} />
      <Sparkle x={332} y={180} size={5} />
    </svg>
  );
}

function VerifiedScene() {
  const uid = useId();
  const bg = `bg-${uid}`;
  const shield = `shield-${uid}`;
  const glow = `glow-${uid}`;
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a1d4d" />
          <stop offset="100%" stopColor="#1a1238" />
        </linearGradient>
        <linearGradient id={shield} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="360" height="200" fill={`url(#${bg})`} />

      {/* verification shield */}
      <circle cx="180" cy="100" r="70" fill={`url(#${glow})`} />
      <path
        d="M180 52c22 0 42 10 42 24 0 46-20 68-42 82-22-14-42-36-42-82 0-14 20-24 42-24z"
        fill={`url(#${shield})`}
        stroke="#c4b5fd"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      <path d="M164 100l11 11 22-24" fill="none" stroke="#f4f2ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

      {/* AI / community nodes */}
      {[
        { x: 96, y: 84, o: 0.65 },
        { x: 264, y: 88, o: 0.65 },
        { x: 122, y: 164, o: 0.55 },
        { x: 238, y: 160, o: 0.55 },
      ].map((n, i) => (
        <g key={i}>
          <line x1="180" y1="100" x2={n.x} y2={n.y} stroke="#c4b5fd" strokeOpacity="0.3" strokeWidth="1.2" strokeDasharray="3 5" />
          <circle cx={n.x} cy={n.y} r="9" fill="#3b2a6b" stroke="#c4b5fd" strokeOpacity={n.o} strokeWidth="1.5" />
          <circle cx={n.x} cy={n.y} r="3" fill="#a78bfa" fillOpacity="0.9" />
        </g>
      ))}

      {/* before / after evidence */}
      <g transform="rotate(-5 62 58)">
        <rect x="34" y="34" width="56" height="46" rx="6" fill="#241a44" stroke="#eaf0ff" strokeOpacity="0.3" />
        <rect x="42" y="42" width="40" height="22" rx="3" fill="#7c3aed" fillOpacity="0.28" />
        <circle cx="62" cy="75" r="7" fill="#ef4444" opacity="0.85" />
        <path d="M58 71l8 8M66 71l-8 8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </g>
      <g transform="rotate(5 298 62)">
        <rect x="270" y="38" width="56" height="46" rx="6" fill="#241a44" stroke="#eaf0ff" strokeOpacity="0.3" />
        <rect x="278" y="46" width="40" height="22" rx="3" fill="#34d399" fillOpacity="0.25" />
        <circle cx="298" cy="79" r="7" fill="#34d399" opacity="0.95" />
        <path d="M294.5 79l2.5 2.5 4.5-5" stroke="#0b1f2f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      <Sparkle x={330} y={40} size={6} />
      <Sparkle x={36} y={176} size={5} />
      <Sparkle x={318} y={180} size={5} />
    </svg>
  );
}

function MeasuredScene() {
  const uid = useId();
  const bg = `bg-${uid}`;
  const bar = `bar-${uid}`;
  const solid = `solid-${uid}`;
  const cell = `cell-${uid}`;
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16246b" />
          <stop offset="100%" stopColor="#0b163f" />
        </linearGradient>
        <linearGradient id={bar} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#1b2cc1" />
          <stop offset="100%" stopColor="#7692ff" />
        </linearGradient>
        <linearGradient id={cell} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7692ff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#7692ff" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={solid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#98abff" />
          <stop offset="100%" stopColor="#3f53ec" />
        </linearGradient>
      </defs>

      <rect width="360" height="200" fill={`url(#${bg})`} />
      {[40, 80, 120, 160].map((y) => (
        <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="#eaf0ff" strokeOpacity="0.06" strokeWidth="1" />
      ))}

      {/* performance bars + trend */}
      <g>
        {[
          { x: 62, h: 32 },
          { x: 106, h: 50 },
          { x: 150, h: 74 },
          { x: 194, h: 96 },
          { x: 238, h: 62 },
        ].map((b, i) => (
          <rect key={i} x={b.x} y={172 - b.h} width="26" height={b.h} rx="4" fill={i === 3 ? `url(#${bar})` : `url(#${bar})`} opacity={i === 3 ? 1 : 0.45} />
        ))}
        <polyline points="150,150 194,112 238,128 282,86" fill="none" stroke={`url(#${solid})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M282 86l-9-1m9 1l-3 9" stroke={`url(#${solid})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* donut + gauge */}
      <g transform="translate(292 66)">
        <circle r="30" fill="none" stroke="#eaf0ff" strokeOpacity="0.14" strokeWidth="8" />
        <circle r="30" fill="none" stroke={`url(#${solid})`} strokeWidth="8" strokeLinecap="round" strokeDasharray="132 188" transform="rotate(-90)" />
        <text x="0" y="6" textAnchor="middle" fill="#eaf0ff" fontSize="16" fontWeight="700" fontFamily="ui-monospace, monospace">
          92%
        </text>
      </g>
      <g transform="translate(82 40)">
        <path d="M-34 0 A34 34 0 0 1 34 0" fill="none" stroke="#eaf0ff" strokeOpacity="0.14" strokeWidth="6" strokeLinecap="round" />
        <path d="M-34 0 A34 34 0 0 1 12 -32" fill="none" stroke="#34d399" strokeWidth="6" strokeLinecap="round" />
      </g>

      {/* stat chip */}
      <g transform="rotate(3 296 156)">
        <rect x="268" y="142" width="56" height="34" rx="7" fill={`url(#${cell})`} stroke="#eaf0ff" strokeOpacity="0.25" />
        <rect x="278" y="150" width="24" height="4" rx="2" fill="#eaf0ff" fillOpacity="0.45" />
        <rect x="278" y="159" width="16" height="3" rx="1.5" fill="#eaf0ff" fillOpacity="0.25" />
      </g>

      <Sparkle x={40} y={28} size={5} />
      <Sparkle x={330} y={30} size={5} />
    </svg>
  );
}