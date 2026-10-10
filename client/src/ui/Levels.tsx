import { CAMPAIGN, stageById } from '@plonko/shared'
import { useSettings } from '../game/settings'
import { useGame } from '../game/store'
import { StagePreview } from './StagePreview'

export const Stars = ({ count }: { count: number }) => (
  <span className="stars" aria-label={`${count} of 3 stars`}>
    {[1, 2, 3].map((n) => (
      <span key={n} className={n <= count ? 'on' : ''}>
        ★
      </span>
    ))}
  </span>
)

// The campaign's level select. A level opens once the one before it has been beaten.
export function Levels({ onBack }: { onBack: () => void }) {
  const stars = useSettings((s) => s.campaignStars)
  const startCampaign = useGame((s) => s.startCampaign)
  const startSolo = useGame((s) => s.startSolo)
  const beaten = CAMPAIGN.filter((id) => (stars[id] ?? 0) > 0).length

  return (
    <div className="levels">
      <header>
        <h2>Campaign</h2>
        <span>
          {beaten} of {CAMPAIGN.length} levels beaten
        </span>
      </header>

      <div className="level-grid">
        {CAMPAIGN.map((id, n) => {
          const stage = stageById(id)
          // Open once the level before it is beaten. A level already beaten stays open, so progress
          // made before levels were added in front of it is not locked away.
          const open = n === 0 || (stars[CAMPAIGN[n - 1]] ?? 0) > 0 || (stars[id] ?? 0) > 0
          return (
            <button key={id} className="level" disabled={!open} onClick={() => startCampaign(n)}>
              <span className="level-head">
                <strong>{n + 1}</strong>
                <span className={`tier ${stage.tier}`}>{stage.tier}</span>
              </span>
              <StagePreview stage={stage} />
              <span className="level-name">{stage.name}</span>
              {open ? <Stars count={stars[id] ?? 0} /> : <span className="locked">Beat level {n} to unlock</span>}
            </button>
          )
        })}
      </div>

      <div className="level-actions">
        <button className="ghost" onClick={onBack}>
          Back
        </button>
        <button onClick={startSolo}>Quick match instead</button>
      </div>
    </div>
  )
}
