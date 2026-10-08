import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useSettings } from '../game/settings'
import { useGame } from '../game/store'
import { requestRematch } from '../net/net'
import { CloseIcon, SlidersIcon } from './icons'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="row">
      <span>{label}</span>
      {children}
    </label>
  )
}

function Switch({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return <input type="checkbox" className="switch" checked={value} onChange={(e) => onChange(e.target.checked)} />
}

function Slider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={value}
      // Lets the filled part of the track follow the thumb.
      style={{ backgroundSize: `${value * 100}% 100%` }}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

const TITLES = { landing: 'Settings', solo: 'Paused', online: 'Menu' }

// Settings on the landing page, a pause menu in a solo game, an overlay menu online.
export function Menu() {
  const open = useGame((s) => s.menuOpen)
  const mode = useGame((s) => s.mode)
  const setMenu = useGame((s) => s.setMenu)
  const s = useSettings()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.code === 'Escape' && setMenu(!useGame.getState().menuOpen)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setMenu])

  if (!open) {
    // The landing page has its own Settings button.
    if (mode === 'landing') return null
    return (
      <button className="menu-button" onClick={() => setMenu(true)}>
        <SlidersIcon /> Menu
      </button>
    )
  }

  const restart = () => {
    requestRematch()
    setMenu(false)
  }
  // Loading the page without a room code returns to the landing page.
  const mainMenu = () => location.assign(location.pathname)

  return (
    <div className="menu-backdrop" onClick={(e) => e.target === e.currentTarget && setMenu(false)}>
      <div className="menu" role="dialog" aria-label={TITLES[mode]}>
        <header>
          <h2>{TITLES[mode]}</h2>
          <button className="icon-button" aria-label="Close" onClick={() => setMenu(false)}>
            <CloseIcon />
          </button>
        </header>
        {mode === 'online' && <p className="note">The match keeps running while this is open. Your fighter stands still.</p>}

        <section>
          <h3>Sound</h3>
          <div className="group">
            <Row label="Sound effects">
              <Switch value={!s.muted} onChange={(on) => s.change({ muted: !on })} />
            </Row>
            <Row label="Volume">
              <Slider value={s.volume} onChange={(volume) => s.change({ volume })} />
            </Row>
            <Row label="Music">
              <Switch value={s.music} onChange={(music) => s.change({ music })} />
            </Row>
            <Row label="Music volume">
              <Slider value={s.musicVolume} onChange={(musicVolume) => s.change({ musicVolume })} />
            </Row>
          </div>
        </section>

        <section>
          <h3>Display</h3>
          <div className="group">
            <Row label="Camera shake">
              <Slider value={s.shake} onChange={(shake) => s.change({ shake })} />
            </Row>
            <Row label="Knockout flash">
              <Switch value={s.flash} onChange={(flash) => s.change({ flash })} />
            </Row>
            <Row label="Shadows">
              <Switch value={s.shadows} onChange={(shadows) => s.change({ shadows })} />
            </Row>
            <Row label="Show ping">
              <Switch value={s.showNetStats} onChange={(showNetStats) => s.change({ showNetStats })} />
            </Row>
          </div>
        </section>

        <section>
          <h3>Controls</h3>
          <div className="group controls">
            <div className="row">
              <span>Move</span>
              <span className="keys">
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd>
              </span>
            </div>
            <div className="row">
              <span>Dash</span>
              <kbd>Space</kbd>
            </div>
            <div className="row">
              <span>Jump</span>
              <kbd>E</kbd>
            </div>
            <div className="row">
              <span>Emotes</span>
              <span className="keys">
                <kbd>1</kbd>
                <kbd>2</kbd>
                <kbd>3</kbd>
              </span>
            </div>
            <div className="row">
              <span>Block (hold)</span>
              <kbd>Shift</kbd>
            </div>
            <div className="row">
              <span>Menu</span>
              <kbd>Esc</kbd>
            </div>
          </div>
        </section>

        <footer>
          <button className="primary" onClick={() => setMenu(false)}>
            {mode === 'landing' ? 'Done' : 'Resume'}
          </button>
          {mode === 'solo' && <button onClick={restart}>Restart match</button>}
          {mode !== 'landing' && (
            <button className="ghost" onClick={mainMenu}>
              Quit to main menu
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
