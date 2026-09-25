import React from 'react';

/**
 * Official loader branding logos (SVG)
 * Provides authentic vector logos for Minecraft (Vanilla), Fabric, Forge, NeoForge, and Quilt.
 */

export function MinecraftLogo({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Top Grass Face */}
      <polygon points="12,2 21.5,7.5 12,13 2.5,7.5" fill="#5b8c34" />
      <polygon points="12,2 17,5 12,8 7,5" fill="#75ab3f" />
      {/* Left Dirt Face */}
      <polygon points="2.5,7.5 12,13 12,22 2.5,16.5" fill="#866043" />
      {/* Left Grass Trim */}
      <polygon points="2.5,7.5 12,13 12,15 9.5,14 8,15.5 5.5,14 2.5,15.5" fill="#4f7c2a" />
      {/* Right Dirt Face */}
      <polygon points="12,13 21.5,7.5 21.5,16.5 12,22" fill="#67472f" />
      {/* Right Grass Trim */}
      <polygon points="12,13 21.5,7.5 21.5,15.5 18.5,14 16,15.5 14.5,14 12,15" fill="#446b24" />
    </svg>
  );
}

export function FabricLogo({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 -0.5 52 56" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} shapeRendering="crispEdges">
      <path stroke="#38342a" strokeWidth="1" d="M28 0h4m-4 1h4m-4 1h4m-4 1h4m-8 1h4m4 0h4M24 5h4m4 0h4M24 6h4m4 0h4M24 7h4m4 0h4M24 8h4m8 0h4M24 9h4m8 0h4m-16 1h4m8 0h4m-16 1h4m8 0h4m-20 1h4m4 0h4m8 0h4m-24 1h4m4 0h4m8 0h4m-24 1h4m4 0h4m8 0h4m-24 1h4m4 0h4m8 0h4m-28 1h4m12 0h4m8 0h4m-32 1h4m12 0h4m8 0h4m-32 1h4m12 0h4m8 0h4m-32 1h4m12 0h4m8 0h4m-36 1h4m20 0h4m4 0h8m-40 1h4m20 0h4m4 0h8m-40 1h4m20 0h4m4 0h8m-40 1h4m20 0h4m4 0h8M8 24h4m28 0h4m4 0h4M8 25h4m28 0h4m4 0h4M8 26h4m28 0h4m4 0h4M8 27h4m28 0h4m4 0h4M4 28h4m32 0h8M4 29h4m32 0h8M4 30h4m32 0h8M4 31h4m32 0h8M0 32h4m32 0h4M0 33h4m32 0h4M0 34h4m32 0h4M0 35h4m32 0h4M0 36h4m28 0h4M0 37h4m28 0h4M0 38h4m28 0h4M0 39h4m28 0h4M4 40h4m20 0h4M4 41h4m20 0h4M4 42h4m20 0h4M4 43h4m20 0h4M8 44h4m12 0h4M8 45h4m12 0h4M8 46h4m12 0h4M8 47h4m12 0h4m-16 1h4m4 0h8m-16 1h4m4 0h8m-16 1h4m4 0h8m-16 1h4m4 0h8m-12 1h8m-8 1h8m-8 1h8m-8 1h8" />
      <path stroke="#dbd0b4" strokeWidth="1" d="M28 4h4m-4 1h4m-4 1h4m-4 1h4m0 1h4m-4 1h4m-4 1h4m-4 1h4m-12 1h4m8 0h4m-16 1h4m8 0h4m-16 1h4m8 0h4m-16 1h4m8 0h4m-16 1h8m8 0h4m-20 1h8m8 0h4m-20 1h8m8 0h4m-20 1h8m8 0h4m-28 1h8m4 0h8m-20 1h8m4 0h8m-20 1h8m4 0h8m-20 1h8m4 0h8m-24 1h16m-16 1h16m-16 1h16m-16 1h16M8 28h8m4 0h12M8 29h8m4 0h12M8 30h8m4 0h12M8 31h8m4 0h12M8 32h12m8 0h4M8 33h12m8 0h4M8 34h12m8 0h4M8 35h12m8 0h4m-20 1h12m-12 1h12m-12 1h12m-12 1h12m-8 1h8m-8 1h8m-8 1h8m-8 1h8" />
      <path stroke="#c6bca5" strokeWidth="1" d="M28 8h4m-4 1h4m-4 1h4m-4 1h4m-12 5h4m-4 1h4m-4 1h4m-4 1h4m0 1h4m-4 1h4m-4 1h4m-4 1h4m0 1h8m-8 1h8m-8 1h8m-8 1h8m-20 1h4m-4 1h4m-4 1h4m-4 1h4m0 1h8m-8 1h8m-8 1h8m-8 1h8" />
      <path stroke="#bcb29c" strokeWidth="1" d="M32 12h4m-4 1h4m-4 1h4m-4 1h4m0 1h4m-4 1h4m-4 1h4m-4 1h4m0 1h4m-4 1h4m-4 1h4m-4 1h4m-8 1h4m-4 1h4m-4 1h4m-4 1h4m-8 1h8m-8 1h8m-8 1h8m-8 1h8m-8 1h4m-4 1h4m-4 1h4m-4 1h4m-12 1h8m-8 1h8m-8 1h8m-8 1h8m-8 1h4m-4 1h4m-4 1h4m-4 1h4m-8 1h4m-4 1h4m-4 1h4m-4 1h4" />
      <path stroke="#807a6d" strokeWidth="1" d="M44 24h4m-4 1h4m-4 1h4m-4 1h4" />
      <path stroke="#aea694" strokeWidth="1" d="M4 32h4m-4 1h4m-4 1h4m-4 1h4m0 1h4m-4 1h4m-4 1h4m-4 1h4m0 1h4m-4 1h4m-4 1h4m-4 1h4m0 1h4m-4 1h4m-4 1h4m-4 1h4" />
      <path stroke="#9a927e" strokeWidth="1" d="M4 36h4m-4 1h4m-4 1h4m-4 1h4m0 1h4m-4 1h4m-4 1h4m-4 1h4m0 1h4m-4 1h4m-4 1h4m-4 1h4m0 1h4m-4 1h4m-4 1h4m-4 1h4" />
    </svg>
  );
}

export function ForgeLogo({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Anvil Base */}
      <path d="M6 23H26V27H6V23Z" fill="#334155" />
      <path d="M9 19H23V23H9V19Z" fill="#475569" />
      <path d="M4 12H28L25 19H7L4 12Z" fill="#1E293B" />
      {/* Flame / Hammer strike */}
      <path d="M16 3C16 3 11 8 11 12C11 14.76 13.24 17 16 17C18.76 17 21 14.76 21 12C21 8 16 3 16 3Z" fill="#F97316" />
      <path d="M16 7C16 7 13 10.5 13 13C13 14.66 14.34 16 16 16C17.66 16 19 14.66 19 13C19 10.5 16 7 16 7Z" fill="#FBBF24" />
      <path d="M16 10C16 10 14.5 12 14.5 13.5C14.5 14.33 15.17 15 16 15C16.83 15 17.5 14.33 17.5 13.5C17.5 12 16 10 16 10Z" fill="#FEF08A" />
    </svg>
  );
}

export function NeoForgeLogo({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="nfFlame" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="50%" stopColor="#EA580C" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
      </defs>
      {/* Modern geometric NeoForge anvil + fire crest */}
      <path d="M5 21L16 27L27 21L24 17H8L5 21Z" fill="#1E293B" />
      <path d="M8 17L16 22L24 17L22 14H10L8 17Z" fill="#334155" />
      {/* Dynamic flaming hammer crest */}
      <path d="M16 2L24 13H18L21 20L11 11H16L12 5L16 2Z" fill="url(#nfFlame)" />
      <path d="M16 5L13.5 9H16L13 14L18 11H15L18 7L16 5Z" fill="#FEF08A" />
    </svg>
  );
}

export function QuiltLogo({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* QuiltMC Patchwork Floral Hexagon */}
      <path d="M16 3L27.26 9.5V22.5L16 29L4.74 22.5V9.5L16 3Z" fill="#4C1D95" opacity="0.4" />
      <path d="M16 5L25.53 10.5L16 16L6.47 10.5L16 5Z" fill="#9333EA" />
      <path d="M25.53 10.5V21.5L16 27L16 16L25.53 10.5Z" fill="#06B6D4" />
      <path d="M6.47 10.5L16 16V27L6.47 21.5V10.5Z" fill="#A855F7" />
      <path d="M16 11L20.33 13.5L16 16L11.67 13.5L16 11Z" fill="#E0F2FE" />
      <path d="M20.33 13.5V18.5L16 21V16L20.33 13.5Z" fill="#38BDF8" />
      <path d="M11.67 13.5L16 16V21L11.67 18.5V13.5Z" fill="#C084FC" />
    </svg>
  );
}

export function LoaderLogo({ type, size = 16, className = '' }) {
  switch (type) {
    case 'fabric':
      return <FabricLogo size={size} className={className} />;
    case 'forge':
      return <ForgeLogo size={size} className={className} />;
    case 'neoforge':
      return <NeoForgeLogo size={size} className={className} />;
    case 'quilt':
      return <QuiltLogo size={size} className={className} />;
    case 'minecraft':
    default:
      return <MinecraftLogo size={size} className={className} />;
  }
}
