import React, { useState } from 'react'
import type { AssetClass } from '../../lib/types'
import { ASSET_META } from '../../lib/calc'

interface AssetLogoProps {
  ticker?: string
  name?: string
  assetClass?: AssetClass
  logoUrl?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-10 h-10 text-[12px]',
  lg: 'w-12 h-12 text-[14px]',
  xl: 'w-14 h-14 text-[16px]',
}

const iconSizes = {
  sm: 16,
  md: 22,
  lg: 26,
  xl: 32,
}

export function AssetLogo({
  ticker = '',
  name = '',
  assetClass,
  logoUrl,
  size = 'md',
  className = '',
}: AssetLogoProps) {
  const [imgError, setImgError] = useState(false)

  const cleanTicker = (ticker || '').trim().toUpperCase()
  const cleanName = (name || '').trim().toUpperCase()
  const currentAssetClass = assetClass || (cleanTicker === 'BTC' || cleanTicker === 'ETH' ? 'crypto' : 'stock')

  const metaColor = ASSET_META[currentAssetClass]?.color ?? '#6366f1'
  const isDarkClass = currentAssetClass === 'crypto' || currentAssetClass === 'gold'

  // If user provided a valid logoUrl and it hasn't failed to load
  if (logoUrl && !imgError) {
    return (
      <div
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden bg-surface-muted border border-line shadow-xs ${sizeClasses[size]} ${className}`}
      >
        <img
          src={logoUrl}
          alt={cleanTicker || cleanName}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain p-1"
        />
      </div>
    )
  }

  // 1. Bitcoin (BTC / XBT / SAT)
  if (
    cleanTicker === 'BTC' ||
    cleanTicker === 'XBT' ||
    cleanTicker === 'SAT' ||
    cleanTicker === 'SATS' ||
    cleanName.includes('BITCOIN')
  ) {
    return (
      <div
        title={ticker || name || 'Bitcoin'}
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full shadow-sm select-none transition-transform ${sizeClasses[size]} ${className}`}
        style={{
          background: 'linear-gradient(135deg, #F7931A 0%, #FFAB40 100%)',
          boxShadow: '0 2px 8px rgba(247, 147, 26, 0.35)',
        }}
      >
        <svg
          viewBox="0 0 32 32"
          width={iconSizes[size]}
          height={iconSizes[size]}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M23.189 14.02c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.69 2.765c-.454-.114-.92-.22-1.385-.326l.695-2.783L15.596 6l-.708 2.839c-.376-.086-.745-.17-1.103-.258l.002-.007-2.384-.595-.46 1.846s1.283.294 1.256.312c.7.175.826.64.805 1.01l-.806 3.23c.048.012.11.03.179.056-.058-.014-.12-.03-.182-.045l-1.13 4.532c-.086.213-.304.533-.796.41.017.025-1.257-.314-1.257-.314l-.858 1.978 2.25.561c.418.105.828.214 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.128.93.245 1.378.357l-.705 2.828 1.728.43.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538zm-3.95 5.538c-.535 2.146-4.152.986-5.325.694l.95-3.81c1.173.293 4.929.873 4.375 3.116zm.536-5.571c-.488 1.954-3.501.962-4.478.718l.862-3.454c.977.244 4.12.7 3.616 2.736z"
            fill="#FFFFFF"
          />
        </svg>
      </div>
    )
  }

  // 2. Ethereum (ETH)
  if (cleanTicker === 'ETH' || cleanName.includes('ETHEREUM')) {
    return (
      <div
        title={ticker || name || 'Ethereum'}
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full shadow-sm select-none transition-transform ${sizeClasses[size]} ${className}`}
        style={{
          background: 'linear-gradient(135deg, #627EEA 0%, #8C9EFF 100%)',
          boxShadow: '0 2px 8px rgba(98, 126, 234, 0.35)',
        }}
      >
        <svg
          viewBox="0 0 32 32"
          width={iconSizes[size]}
          height={iconSizes[size]}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M16 4L15.8 4.7V20.4L16 20.6L23 16.5L16 4Z" fill="#FFFFFF" fillOpacity="0.8" />
          <path d="M16 4L9 16.5L16 20.6V4Z" fill="#FFFFFF" />
          <path d="M16 21.8L15.9 22V28L16 28.3L23 17.7L16 21.8Z" fill="#FFFFFF" fillOpacity="0.8" />
          <path d="M16 28.3V21.8L9 17.7L16 28.3Z" fill="#FFFFFF" />
          <path d="M16 20.6L23 16.5L16 13.3V20.6Z" fill="#FFFFFF" fillOpacity="0.5" />
          <path d="M9 16.5L16 20.6V13.3L9 16.5Z" fill="#FFFFFF" fillOpacity="0.7" />
        </svg>
      </div>
    )
  }

  // 3. Gold / Precious Metals
  if (
    currentAssetClass === 'gold' ||
    cleanTicker === 'GOLD' ||
    cleanTicker === 'XAU' ||
    cleanName.includes('GOLD') ||
    cleanName.includes('ทอง')
  ) {
    return (
      <div
        title={ticker || name || 'Gold'}
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full shadow-sm select-none transition-transform ${sizeClasses[size]} ${className}`}
        style={{
          background: 'linear-gradient(135deg, #E6A100 0%, #FFD54F 50%, #B27B00 100%)',
          boxShadow: '0 2px 8px rgba(230, 161, 0, 0.4)',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width={iconSizes[size]}
          height={iconSizes[size]}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m19 13-4-8H9L5 13l7 8 7-8z" fill="rgba(255, 255, 255, 0.25)" />
          <path d="M5 13h14" />
          <path d="m9 5 3 8 3-8" />
        </svg>
      </div>
    )
  }

  // 4. Apple (AAPL)
  if (cleanTicker === 'AAPL' || cleanName.includes('APPLE')) {
    return (
      <div
        title="Apple Inc."
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full shadow-sm select-none bg-black text-white dark:bg-zinc-800 ${sizeClasses[size]} ${className}`}
        style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)' }}
      >
        <svg
          viewBox="0 0 24 24"
          width={iconSizes[size] - 2}
          height={iconSizes[size] - 2}
          fill="currentColor"
        >
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.77 1.06-1.85.94-2.93-.91.04-2.02.61-2.67 1.38-.58.68-1.09 1.77-.95 2.83 1.02.08 2.05-.51 2.68-1.28z" />
        </svg>
      </div>
    )
  }

  // 5. NVIDIA (NVDA)
  if (cleanTicker === 'NVDA' || cleanName.includes('NVIDIA')) {
    return (
      <div
        title="NVIDIA"
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full shadow-sm select-none bg-[#76B900] text-white ${sizeClasses[size]} ${className}`}
        style={{ boxShadow: '0 2px 8px rgba(118, 185, 0, 0.4)' }}
      >
        <span className="font-extrabold tracking-tighter text-[11px] scale-95">NV</span>
      </div>
    )
  }

  // 6. Microsoft (MSFT)
  if (cleanTicker === 'MSFT' || cleanName.includes('MICROSOFT')) {
    return (
      <div
        title="Microsoft"
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full shadow-sm select-none bg-[#00A4EF] text-white ${sizeClasses[size]} ${className}`}
        style={{ boxShadow: '0 2px 8px rgba(0, 164, 239, 0.35)' }}
      >
        <div className="grid grid-cols-2 gap-0.5 w-3.5 h-3.5">
          <span className="bg-[#F25022] rounded-xs" />
          <span className="bg-[#7FBA00] rounded-xs" />
          <span className="bg-[#00A4EF] rounded-xs" />
          <span className="bg-[#FFB900] rounded-xs" />
        </div>
      </div>
    )
  }

  // 7. Tesla (TSLA)
  if (cleanTicker === 'TSLA' || cleanName.includes('TESLA')) {
    return (
      <div
        title="Tesla"
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full shadow-sm select-none bg-[#E82127] text-white ${sizeClasses[size]} ${className}`}
        style={{ boxShadow: '0 2px 8px rgba(232, 33, 39, 0.35)' }}
      >
        <span className="font-black tracking-wider text-[12px]">T</span>
      </div>
    )
  }

  // 8. Alphabet / Google (GOOG, GOOGL)
  if (cleanTicker === 'GOOG' || cleanTicker === 'GOOGL' || cleanName.includes('GOOGLE')) {
    return (
      <div
        title="Google"
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full shadow-sm select-none bg-white text-[#4285F4] border border-line ${sizeClasses[size]} ${className}`}
      >
        <span className="font-black text-[13px] bg-gradient-to-r from-[#4285F4] via-[#EA4335] to-[#FBBC05] bg-clip-text text-transparent">
          G
        </span>
      </div>
    )
  }

  // 9. Meta (META)
  if (cleanTicker === 'META' || cleanName.includes('META')) {
    return (
      <div
        title="Meta"
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full shadow-sm select-none bg-gradient-to-tr from-[#0064e0] to-[#0081fb] text-white ${sizeClasses[size]} ${className}`}
      >
        <span className="font-black text-[11px]">∞</span >
      </div>
    )
  }

  // 10. SPY / VOO / S&P500 / ETFs
  if (
    cleanTicker === 'SPY' ||
    cleanTicker === 'VOO' ||
    cleanTicker === 'IVV' ||
    cleanTicker === 'QQQ' ||
    cleanName.includes('S&P') ||
    cleanName.includes('500')
  ) {
    return (
      <div
        title={cleanTicker || 'ETF'}
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full shadow-sm select-none bg-gradient-to-br from-[#1e3a8a] to-[#3b82f6] text-white ${sizeClasses[size]} ${className}`}
      >
        <span className="font-bold text-[10px] tracking-tight">{cleanTicker.slice(0, 3)}</span>
      </div>
    )
  }

  // 11. Thai Mutual Funds Special Branding (SCB, K-Asset, BBL, ONE, KTAM, etc.)
  if (cleanTicker.startsWith('SCB') || cleanName.startsWith('SCB')) {
    return (
      <div
        title={ticker || name}
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full shadow-sm select-none bg-[#4E2A84] text-white ${sizeClasses[size]} ${className}`}
        style={{ boxShadow: '0 2px 8px rgba(78, 42, 132, 0.35)' }}
      >
        <span className="font-extrabold text-[10px] tracking-tighter">SCB</span>
      </div>
    )
  }

  if (cleanTicker.startsWith('K-') || cleanTicker.startsWith('KF') || cleanTicker.startsWith('K') && currentAssetClass === 'fund') {
    return (
      <div
        title={ticker || name}
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full shadow-sm select-none bg-[#137F46] text-white ${sizeClasses[size]} ${className}`}
        style={{ boxShadow: '0 2px 8px rgba(19, 127, 70, 0.35)' }}
      >
        <span className="font-extrabold text-[11px] tracking-tighter">K</span>
      </div>
    )
  }

  if (cleanTicker.startsWith('B-') || cleanTicker.startsWith('BBL') || cleanName.includes('B-')) {
    return (
      <div
        title={ticker || name}
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full shadow-sm select-none bg-[#1E3A8A] text-white ${sizeClasses[size]} ${className}`}
      >
        <span className="font-extrabold text-[10px] tracking-tighter">BBL</span>
      </div>
    )
  }

  if (cleanTicker.startsWith('KT') || cleanName.includes('KTAM')) {
    return (
      <div
        title={ticker || name}
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full shadow-sm select-none bg-[#00A5E5] text-white ${sizeClasses[size]} ${className}`}
      >
        <span className="font-extrabold text-[10px] tracking-tighter">KT</span>
      </div>
    )
  }

  if (cleanTicker.startsWith('ONE') || cleanName.includes('ONE-')) {
    return (
      <div
        title={ticker || name}
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full shadow-sm select-none bg-[#E53935] text-white ${sizeClasses[size]} ${className}`}
      >
        <span className="font-extrabold text-[9px] tracking-tighter">ONE</span>
      </div>
    )
  }

  if (cleanTicker.startsWith('TMB') || cleanTicker.startsWith('TTB') || cleanName.includes('TTB')) {
    return (
      <div
        title={ticker || name}
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full shadow-sm select-none bg-[#002D62] text-[#00A4E4] border border-[#00A4E4]/30 ${sizeClasses[size]} ${className}`}
      >
        <span className="font-black text-[9.5px]">ttb</span>
      </div>
    )
  }

  // 12. Fallback: Clean Dynamic Ticker Badge
  const displayText = cleanTicker.length > 0 
    ? cleanTicker.slice(0, 4) 
    : cleanName.slice(0, 3) || '?'

  const fontSizeClass =
    displayText.length <= 2 ? 'text-[12px]' : displayText.length === 3 ? 'text-[10.5px]' : 'text-[9.5px]'

  return (
    <div
      title={ticker || name}
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full font-bold shadow-xs select-none ${sizeClasses[size]} ${className}`}
      style={{
        background: `linear-gradient(135deg, ${metaColor} 0%, color-mix(in srgb, ${metaColor} 70%, #000) 100%)`,
        color: '#ffffff',
      }}
    >
      <span className={`${fontSizeClass} font-bold tracking-tight uppercase`}>
        {displayText}
      </span>
    </div>
  )
}
