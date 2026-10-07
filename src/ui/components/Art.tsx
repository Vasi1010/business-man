import type { ServiceTile, SimpleTileKind, TokenId } from '../../engine'

/** Original token glyphs, drawn on a 32×32 grid using currentColor. */
export function TokenGlyph({ token }: { token: TokenId }) {
  switch (token) {
    case 'auto':
      return (
        <g>
          <path d="M6 9.5C6 8.7 6.7 8 7.5 8H18c3 0 5.4 2.1 6.5 5.2L25.6 16H6z" />
          <path d="M9 10.5h4.5V15H8.5v-4c0-.3.2-.5.5-.5zM15.5 10.5H18c1.7 0 3.2 1.2 3.8 3l.5 1.5h-6.8z" opacity=".35" />
          <path d="M4.5 16.5h22.8a2 2 0 0 1 2 2v2.3a1 1 0 0 1-1 1h-2.2a3.6 3.6 0 0 0-6.8 0h-6.6a3.6 3.6 0 0 0-6.8 0H4.5a1 1 0 0 1-1-1v-3.3a1 1 0 0 1 1-1z" />
          <circle cx="9.3" cy="23" r="2.7" />
          <circle cx="22.6" cy="23" r="2.7" />
        </g>
      )
    case 'elephant':
      return (
        <g>
          <path d="M11 9.5c1.5-1.2 3.5-1.8 6-1.8h3.5c4.4 0 7.5 3 7.5 7.3v2.2c0 .9-.5 1.7-1.3 2.1V26h-3.2v-5h-6.3v5H14v-5.6c-1.5-.6-2.6-1.8-3-3.4z" />
          <circle cx="9" cy="13" r="5.2" />
          <path d="M5.2 14.5c-1.3 3.4-.6 7 1.8 9.3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M10.5 9.2c3.2-.2 4.8 1.8 4.8 4.3s-2 4.6-4.6 3.8z" opacity=".35" />
          <circle cx="7.6" cy="12" r="0.9" opacity=".25" />
        </g>
      )
    case 'peacock':
      return (
        <g>
          <path d="M3.5 24a12.5 12.5 0 0 1 25 0z" opacity=".4" />
          <g opacity=".85">
            <circle cx="6.5" cy="19.5" r="1.6" />
            <circle cx="9.5" cy="15" r="1.6" />
            <circle cx="16" cy="13" r="1.6" />
            <circle cx="22.5" cy="15" r="1.6" />
            <circle cx="25.5" cy="19.5" r="1.6" />
          </g>
          <path d="M16 13.5c2.3 0 3.4 2.2 3.4 4.6V24h-6.8v-5.9c0-2.4 1.1-4.6 3.4-4.6z" />
          <path d="M15 14.5V9.5a2.2 2.2 0 1 1 3.2 2l-1 .5v2.5z" />
          <path d="M18.2 9.3l2.5-.6-2.4 1.6z" />
          <path d="M15.5 6.6l-.8-2.4M16.6 6.4l.4-2.5M17.6 6.9l1.4-2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <rect x="11" y="24" width="10" height="2" rx="1" />
        </g>
      )
    case 'tiger':
      return (
        <g>
          <path d="M7.5 6.5l4 3.5h9l4-3.5c1 1.5 1.3 3.6.8 5.6 1.2 1.6 1.9 3.5 1.9 5.6 0 5.5-5 9.3-11.2 9.3S4.8 23.2 4.8 17.7c0-2.1.7-4 1.9-5.6-.5-2-.2-4.1.8-5.6z" />
          <g opacity=".35">
            <path d="M16 10v3.5M12.7 10.6l1.2 2.6M19.3 10.6l-1.2 2.6M6.2 16.5l3 .6M6.4 19.6l3-.4M25.8 16.5l-3 .6M25.6 19.6l-3-.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            <circle cx="12.3" cy="16.5" r="1.4" />
            <circle cx="19.7" cy="16.5" r="1.4" />
            <path d="M14.2 20.2h3.6L16 22.2z" />
          </g>
        </g>
      )
    case 'diya':
      return (
        <g>
          <path d="M16 3.5c3.3 4.2 4.6 7.2 4.6 9.4a4.6 4.6 0 0 1-9.2 0c0-2.2 1.3-5.2 4.6-9.4z" />
          <path d="M16 9c1.3 1.8 1.8 3 1.8 3.9a1.8 1.8 0 0 1-3.6 0c0-.9.5-2.1 1.8-3.9z" opacity=".35" />
          <path d="M3.5 18.5h25c-1.2 5.2-6.2 8.5-12.5 8.5S4.7 23.7 3.5 18.5z" />
          <path d="M3.5 18.5h25l1.5-1.5H2z" opacity=".6" />
          <path d="M9 21.5h14" stroke="currentColor" strokeWidth="1" opacity=".35" />
        </g>
      )
    case 'houseboat':
      return (
        <g>
          <path d="M1.5 18.5h29c-2 4.7-6.4 7-14.5 7S3.5 23.2 1.5 18.5z" />
          <path d="M6.5 17.8c.3-5.2 4.3-8.6 9.5-8.6s9.2 3.4 9.5 8.6z" />
          <path d="M9.5 17.8c.4-3.3 3-5.5 6.5-5.5s6.1 2.2 6.5 5.5z" opacity=".35" />
          <path d="M4 28c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1 2 1 4 1" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".6" strokeLinecap="round" />
        </g>
      )
  }
}

export function TokenBadge({
  token,
  color,
  size = 28,
  ring = false,
  title,
}: {
  token: TokenId
  color: string
  size?: number
  ring?: boolean
  title?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="shrink-0 drop-shadow-sm"
    >
      <circle cx="20" cy="20" r="19" fill={color} stroke={ring ? '#fff8ee' : 'rgba(0,0,0,.25)'} strokeWidth={ring ? 2.5 : 1} />
      <g transform="translate(4 4)" fill="#fff8ee" color="#fff8ee">
        <TokenGlyph token={token} />
      </g>
    </svg>
  )
}

/** Small icons for services and special tiles. */
export function TileIcon({ kind, className }: { kind: ServiceTile['icon'] | SimpleTileKind; className?: string }) {
  const common = { viewBox: '0 0 24 24', className, 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (kind) {
    case 'train':
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="14" rx="3" />
          <path d="M5 10h14M9 21l-2-4M15 21l2-4" />
          <circle cx="9" cy="13.5" r=".8" fill="currentColor" />
          <circle cx="15" cy="13.5" r=".8" fill="currentColor" />
        </svg>
      )
    case 'bus':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="13" rx="2" />
          <path d="M4 11h16M8 17v2.5M16 17v2.5M8 7.5h8" />
        </svg>
      )
    case 'plane':
      return (
        <svg {...common}>
          <path d="M21 15.5 13.5 11V5a1.5 1.5 0 0 0-3 0v6L3 15.5V17l7.5-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5l-2-1.5v-4.5L21 17z" />
        </svg>
      )
    case 'boat':
      return (
        <svg {...common}>
          <path d="M3 15h18l-2.5 4.5h-13zM12 3v12M12 4l6 8h-6" />
        </svg>
      )
    case 'bulb':
      return (
        <svg {...common}>
          <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
        </svg>
      )
    case 'tap':
      return (
        <svg {...common}>
          <path d="M4 9h9a3 3 0 0 1 3 3v1M4 6v6M8 6h2M16 16.5c0 1.5-1 2.5-1 3.5a1 1 0 0 0 2 0c0-1-1-2-1-3.5z" />
        </svg>
      )
    case 'chance':
      return (
        <svg {...common}>
          <path d="M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.6V15" />
          <circle cx="12" cy="18.5" r=".9" fill="currentColor" />
          <rect x="3" y="3" width="18" height="18" rx="4" />
        </svg>
      )
    case 'chest':
      return (
        <svg {...common}>
          <path d="M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 10l1.5-4h13L20 10M10 13h4" />
        </svg>
      )
    case 'incomeTax':
    case 'wealthTax':
      return (
        <svg {...common}>
          <path d="M7 5h10M7 9h10M10 5c3 0 4 2 4 4s-2 4-5 4l6 6" />
        </svg>
      )
    case 'club':
      return (
        <svg {...common}>
          <path d="M7 4h10l-1.5 7a3.5 3.5 0 0 1-7 0zM12 14.5V20M8.5 20h7" />
        </svg>
      )
    case 'restHouse':
      return (
        <svg {...common}>
          <path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-5h4v5" />
        </svg>
      )
    case 'jail':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="1.5" />
          <path d="M8.5 4v16M12 4v16M15.5 4v16" />
        </svg>
      )
    case 'start':
      return (
        <svg {...common}>
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      )
  }
}

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <circle cx="32" cy="32" r="30" fill="var(--brand)" />
      <g fill="none" stroke="var(--accent)" strokeWidth="2">
        <circle cx="32" cy="32" r="24.5" strokeDasharray="3.5 3" />
      </g>
      <g fill="var(--accent)" opacity=".9">
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d="M32 5.5c1.6 2 1.6 4 0 6-1.6-2-1.6-4 0-6z" transform={`rotate(${i * 45} 32 32)`} />
        ))}
      </g>
      <text x="32" y="42.5" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize="29" fill="var(--brand-ink)">
        ₹
      </text>
    </svg>
  )
}

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const mark = size === 'lg' ? 72 : size === 'md' ? 44 : 30
  const text = size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-3xl' : 'text-xl'
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={mark} />
      <span className={`font-display ${text} leading-none text-brand`}>Business-Man</span>
    </span>
  )
}
