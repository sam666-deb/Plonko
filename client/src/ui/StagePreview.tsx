import type { CSSProperties } from 'react'
import type { Stage } from '@plonko/shared'

const HAZARD_NAMES = { sweeper: 'Sweeper', spikes: 'Spikes', bumper: 'Bumpers' }

// A small map of a stage: its floor from above, with trapped tiles and bumpers marked,
// and its hazards named underneath. Shown on the stage card during the countdown.
export function StagePreview({ stage }: { stage: Stage }) {
  const rows = stage.map
  const midRow = (rows.length - 1) / 2
  const midCol = (rows[0].length - 1) / 2
  const marks = new Map<string, string>()
  for (const hazard of stage.hazards) {
    if (hazard.type === 'spikes') for (const [i, j] of hazard.tiles) marks.set(`${i},${j}`, 'spike')
    if (hazard.type === 'bumper') marks.set(`${Math.round(hazard.at[0])},${Math.round(hazard.at[1])}`, 'bumper')
  }
  const hazards = [...new Set(stage.hazards.map((h) => HAZARD_NAMES[h.type]))]

  return (
    <span className="preview">
      <span className="map" style={{ '--cols': rows[0].length } as CSSProperties}>
        {rows.flatMap((row, r) =>
          [...row].map((cell, c) => {
            const kind = cell === '.' ? 'gap' : cell === '#' ? 'core' : 'tile'
            return <i key={`${r},${c}`} className={`${kind} ${marks.get(`${c - midCol},${r - midRow}`) ?? ''}`} />
          }),
        )}
      </span>
      {hazards.length > 0 && <span className="hazards">{hazards.join(' · ')}</span>}
    </span>
  )
}
