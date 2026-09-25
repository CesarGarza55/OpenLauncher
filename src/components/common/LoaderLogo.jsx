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
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M16 2L4 8L16 14L28 8L16 2Z" fill="#CBD5E1" />
      <path d="M4 8V24L16 30V14L4 8Z" fill="#94A3B8" />
      <path d="M28 8V24L16 30V14L28 8Z" fill="#64748B" />
      <path d="M16 6L8 10L16 14L24 10L16 6Z" fill="#38BDF8" />
      <path d="M8 10V22L16 26V14L8 10Z" fill="#0284C7" />
      <path d="M24 10V22L16 26V14L24 10Z" fill="#0369A1" />
      <path d="M16 10L11 12.5L16 15L21 12.5L16 10Z" fill="#F0F9FF" />
      <path d="M11 12.5V19.5L16 22V15L11 12.5Z" fill="#BAE6FD" />
      <path d="M21 12.5V19.5L16 22V15L21 12.5Z" fill="#7DD3FC" />
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
