'use client';

import React from 'react';

interface TheBoredMonkeyCompactLogoProps {
  className?: string;
  size?: number;
  textColor?: string;
  bgColor?: string;
}

/**
 * TheBoredMonkey Official Compact Brand Icon (for 70px collapsed rail)
 * - 1:1 Square aspect ratio (viewBox="0 0 100 100")
 * - Signature animated yellow-to-orange conduit wire with continuous electric pulse
 * - TheBoredMonkey dual energy nodes (#f59e0b & #ea580c)
 * - Crisp, bold 'TBM' brand mark that dynamically responds to Light / Dark themes
 * - Subtitle 'INTEL' grounded with high-legibility tracking
 */
export default function TheBoredMonkeyCompactLogo({
  className = '',
  size = 38,
  textColor,
  bgColor,
}: TheBoredMonkeyCompactLogoProps) {
  const effectiveTextColor = textColor || 'var(--tbm-logo-text, #E2E8F0)';
  const effectiveBgColor = bgColor || 'var(--bg-surface, #11141B)';

  return (
    <div
      className={`tbm-compact-logo-wrapper ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: effectiveBgColor,
        borderRadius: '8px',
        overflow: 'hidden',
        transition: 'background-color 0.2s ease',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        className="tbm-compact-svg"
        role="img"
        aria-label="TBM Intelligence Icon"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      >
        <defs>
          <linearGradient id="tbmWireGradCompact" x1="26" y1="16" x2="74" y2="16" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDC727" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <style>{`
            @keyframes tbmCompactPulse {
              0% { stroke-dashoffset: 32; }
              100% { stroke-dashoffset: 0; }
            }
            .tbm-compact-wire-pulse {
              stroke-dasharray: 8 6;
              animation: tbmCompactPulse 1.4s linear infinite;
            }
          `}</style>
        </defs>

        {/* Adaptive background tile */}
        <rect width="100" height="100" fill={effectiveBgColor} rx="16" />

        {/* 1. Conduit Guide Path Underlay */}
        <path
          d="M 28 36 L 28 22 Q 28 16 34 16 L 66 16 Q 72 16 72 22 L 72 36"
          fill="none"
          stroke="#fed7aa"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.35"
        />

        {/* 2. Flowing Animated Electric Conduit */}
        <path
          d="M 28 36 L 28 22 Q 28 16 34 16 L 66 16 Q 72 16 72 22 L 72 36"
          fill="none"
          stroke="url(#tbmWireGradCompact)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="tbm-compact-wire-pulse"
        />

        {/* 3. Left Yellow Energy Node Ring */}
        <circle
          cx="28"
          cy="38"
          r="8"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="4"
        />

        {/* 4. Right Orange Energy Node Ring */}
        <circle
          cx="72"
          cy="38"
          r="8"
          fill="none"
          stroke="#ea580c"
          strokeWidth="4"
        />

        {/* 5. Bold TBM Monogram */}
        <text
          x="50"
          y="72"
          textAnchor="middle"
          fill={effectiveTextColor}
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif"
          fontWeight="900"
          fontSize="24"
          letterSpacing="0.04em"
        >
          TBM
        </text>

        {/* 6. Subtle Micro Subtitle */}
        <text
          x="50"
          y="87"
          textAnchor="middle"
          fill="#f59e0b"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif"
          fontWeight="800"
          fontSize="8.5"
          letterSpacing="0.18em"
        >
          INTEL
        </text>
      </svg>
    </div>
  );
}
