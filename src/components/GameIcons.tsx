import React from 'react';
import type { MineralColor } from '../game/palette';

export function TitleLockupSvg({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-4 ${className}`}>
      {/* Architectural Stone & Interwoven Conduit Crest */}
      <svg
        viewBox="0 0 96 96"
        className="w-[74px] h-[74px] sm:w-[84px] sm:h-[84px] shrink-0"
        role="img"
        aria-label="نیشانەی ڕێڕەوی ڕەنگ"
      >
        <defs>
          <filter id="emblem-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.45" />
          </filter>
        </defs>
        <g transform="translate(2, 2)" filter="url(#emblem-shadow)">
          <rect
            x="0"
            y="0"
            width="92"
            height="92"
            rx="18"
            fill="#161C26"
            stroke="rgba(229,169,60,0.48)"
            strokeWidth="2"
          />
          {/* Recessed 3x3 grid grooves */}
          <line x1="31" y1="12" x2="31" y2="80" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
          <line x1="61" y1="12" x2="61" y2="80" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
          <line x1="12" y1="31" x2="80" y2="31" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
          <line x1="12" y1="61" x2="80" y2="61" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />

          {/* Mineral Conduit 1: Gold Amber */}
          <path
            d="M 22 22 L 22 70 L 46 70"
            fill="none"
            stroke="#E5A93C"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="22" cy="22" r="7.5" fill="#F2BE5C" stroke="#11161F" strokeWidth="2.5" />
          <circle cx="46" cy="70" r="7.5" fill="#F2BE5C" stroke="#11161F" strokeWidth="2.5" />

          {/* Mineral Conduit 2: Cobalt Blue */}
          <path
            d="M 46 22 L 70 22 L 70 70"
            fill="none"
            stroke="#3B82F6"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="46" cy="22" r="7.5" fill="#60A5FA" stroke="#11161F" strokeWidth="2.5" />
          <circle cx="70" cy="70" r="7.5" fill="#60A5FA" stroke="#11161F" strokeWidth="2.5" />

          {/* Mineral Conduit 3: Emerald Center Node */}
          <circle cx="46" cy="46" r="7.5" fill="#10B981" stroke="#11161F" strokeWidth="2.5" />
        </g>
      </svg>

      {/* Crisp RTL Kurdish Display Wordmark */}
      <div className="flex flex-col items-start text-right">
        <h1
          className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#F5F3EE] leading-none"
          style={{ textShadow: '0 4px 18px rgba(0,0,0,0.55)' }}
        >
          ڕێڕەوی ڕەنگ
        </h1>
        <div className="w-full h-[2px] bg-[#E5A93C]/45 my-2.5" aria-hidden="true" />
        <span
          dir="ltr"
          className="font-mono-num text-xs sm:text-sm font-bold tracking-[0.2em] text-[#D6B16A]"
        >
          FLOW FREE ARENA
        </span>
      </div>
    </div>
  );
}

export function NodeSymbolSvg({
  symbol,
  size = 14,
}: {
  symbol: MineralColor['symbol'];
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="pointer-events-none select-none"
    >
      {symbol === 'circle' && <circle cx="8" cy="8" r="3.2" fill="rgba(14,18,24,0.68)" />}
      {symbol === 'diamond' && <polygon points="8,3 13,8 8,13 3,8" fill="rgba(14,18,24,0.68)" />}
      {symbol === 'triangle' && <polygon points="8,3.2 13,12 3,12" fill="rgba(14,18,24,0.68)" />}
      {symbol === 'square' && <rect x="4.5" y="4.5" width="7" height="7" rx="1.2" fill="rgba(14,18,24,0.68)" />}
      {symbol === 'cross' && (
        <path d="M5 5 L11 11 M11 5 L5 11" stroke="rgba(14,18,24,0.75)" strokeWidth="2.4" strokeLinecap="round" />
      )}
      {symbol === 'ring' && (
        <circle cx="8" cy="8" r="3.6" fill="none" stroke="rgba(14,18,24,0.75)" strokeWidth="2.2" />
      )}
      {symbol === 'hex' && (
        <polygon points="8,3 12.5,5.5 12.5,10.5 8,13 3.5,10.5 3.5,5.5" fill="rgba(14,18,24,0.68)" />
      )}
      {symbol === 'star' && (
        <polygon
          points="8,2.5 9.6,6.1 13.5,6.5 10.5,9 11.4,12.8 8,10.8 4.6,12.8 5.5,9 2.5,6.5 6.4,6.1"
          fill="rgba(14,18,24,0.72)"
        />
      )}
      {symbol === 'bar' && <rect x="3.5" y="6.5" width="9" height="3" rx="1.2" fill="rgba(14,18,24,0.72)" />}
      {symbol === 'dot' && (
        <>
          <circle cx="5.5" cy="8" r="1.8" fill="rgba(14,18,24,0.75)" />
          <circle cx="10.5" cy="8" r="1.8" fill="rgba(14,18,24,0.75)" />
        </>
      )}
    </svg>
  );
}

export function CrownIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M3 17.5L4.5 7.5L9.5 11.5L12 5.5L14.5 11.5L19.5 7.5L21 17.5H3Z"
        fill="#E5A93C"
        stroke="#0E1218"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <rect x="4" y="18.5" width="16" height="2.2" rx="1" fill="#F2BE5C" />
    </svg>
  );
}

export function StarIcon({
  filled = true,
  className = 'w-5 h-5',
}: {
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 3.2L14.65 8.56L20.56 9.42L16.28 13.59L17.29 19.48L12 16.7L6.71 19.48L7.72 13.59L3.44 9.42L9.35 8.56L12 3.2Z"
        fill={filled ? '#E5A93C' : 'transparent'}
        stroke={filled ? '#F2BE5C' : '#4B5563'}
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UndoIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 14L4 9L9 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 9H15C18.3137 9 21 11.6863 21 15C21 18.3137 18.3137 21 15 21H11" strokeLinecap="round" />
    </svg>
  );
}

export function HintIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        d="M9 18H15M10 21H14M12 3C8.686 3 6 5.686 6 9C6 11.22 7.206 13.157 9 14.197V15.5C9 16.052 9.448 16.5 10 16.5H14C14.552 16.5 15 16.052 15 15.5V14.197C16.794 13.157 18 11.22 18 9C18 5.686 15.314 3 12 3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ResetIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 12A9 9 0 1 0 6 5.3L3 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 3V8H8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PauseIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.2" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" />
    </svg>
  );
}

export function SoundIcon({ muted, className = 'w-4 h-4' }: { muted: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M11 5L6 9H3V15H6L11 19V5Z" strokeLinejoin="round" />
      {muted ? (
        <path d="M16 9L21 15M21 9L16 15" strokeLinecap="round" />
      ) : (
        <>
          <path d="M15.5 8.5C16.8 9.8 16.8 14.2 15.5 15.5" strokeLinecap="round" />
          <path d="M18.5 6C21 8.5 21 15.5 18.5 18" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function TrophyIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M8 21H16M12 17V21M7 4H17V10C17 12.761 14.761 15 12 15C9.239 15 7 12.761 7 10V4Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 6H4V8C4 9.657 5.343 11 7 11M17 6H20V8C20 9.657 18.657 11 17 11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GridIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1.2" />
      <rect x="14" y="4" width="6" height="6" rx="1.2" />
      <rect x="4" y="14" width="6" height="6" rx="1.2" />
      <rect x="14" y="14" width="6" height="6" rx="1.2" />
    </svg>
  );
}

export function AdminShieldIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3L19 6V11.5C19 16.2 15.9 19.9 12 21C8.1 19.9 5 16.2 5 11.5V6L12 3Z" strokeLinejoin="round" />
      <path d="M9.5 12L11.2 13.7L14.8 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UserIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20C5 16.686 8.134 14 12 14C15.866 14 19 16.686 19 20" strokeLinecap="round" />
    </svg>
  );
}

export function CheckStampIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M5 12.5L9.8 17.2L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
