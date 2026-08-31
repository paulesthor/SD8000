const PALETTE: Record<string, string> = {
  H: '#1f7a4c', // hood
  S: '#e3b083', // skin
  e: '#161a20', // eyes
  B: '#3ddc84', // hoodie body (accent)
  P: '#20242c', // pants
  W: '#cfd3da', // shoes
}

// 10 columns x 14 rows. Each character maps to PALETTE; a space is transparent.
const GRID = [
  '  HHHHHH  ',
  ' HHHHHHHH ',
  ' HSSSSSSH ',
  ' HSeSSeSH ',
  ' HSSSSSSH ',
  '  BBBBBB  ',
  ' BBBBBBBB ',
  ' BBBBBBBB ',
  ' BBBBBBBB ',
  '  PPPPPP  ',
  '  PPPPPP  ',
  '  PPPPPP  ',
  '  PP  PP  ',
  ' WWW  WWW ',
]

const COLS = 10
const ROWS = GRID.length

export function PixelCharacter({ size = 140 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={(size / COLS) * ROWS}
      viewBox={`0 0 ${COLS} ${ROWS}`}
      shapeRendering="crispEdges"
      className="pixel-character"
      aria-hidden
    >
      {GRID.flatMap((row, y) =>
        row.split('').map((cell, x) => {
          if (cell === ' ') return null
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={PALETTE[cell]} />
        }),
      )}
    </svg>
  )
}
