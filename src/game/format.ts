const SUFFIXES = [
  '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
  'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg',
]

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '∞'
  if (Math.abs(value) < 1000) {
    return Number.isInteger(value) ? value.toString() : value.toFixed(1)
  }
  const tier = Math.min(Math.floor(Math.log10(Math.abs(value)) / 3), SUFFIXES.length - 1)
  const scaled = value / Math.pow(1000, tier)
  if (tier >= SUFFIXES.length - 1 && Math.abs(value) >= Math.pow(1000, SUFFIXES.length)) {
    return value.toExponential(2)
  }
  return `${scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0)}${SUFFIXES[tier]}`
}

export function formatRate(value: number): string {
  return `${formatNumber(value)}/s`
}
