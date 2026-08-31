const common = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function GeneratorsIcon() {
  return (
    <svg {...common}>
      <rect x="3" y="13" width="4" height="8" />
      <rect x="10" y="8" width="4" height="13" />
      <rect x="17" y="4" width="4" height="17" />
    </svg>
  )
}

export function AxesIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="4" r="1.6" fill="currentColor" stroke="none" />
      <path d="M12 5.5v5" />
      <path d="M12 10.5 6 17" />
      <path d="M12 10.5 18 17" />
      <circle cx="6" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18" cy="19" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function RedoublementIcon() {
  return (
    <svg {...common}>
      <path d="M4 12a8 8 0 0 1 14-5.3" />
      <path d="M18 3v4h-4" />
      <path d="M20 12a8 8 0 0 1-14 5.3" />
      <path d="M6 21v-4h4" />
    </svg>
  )
}

/** Deterministic 2-letter monogram avatar, no emoji. */
export function Monogram({ label }: { label: string }) {
  const initials = label
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
  return <span className="monogram">{initials}</span>
}
