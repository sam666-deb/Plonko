import { AVATARS, MAX_NAME_LENGTH } from '@plonko/shared'
import { useSettings } from '../game/settings'
import { useGame } from '../game/store'
import { startOnline } from '../net/net'
import { BotIcon, FriendsIcon, SlidersIcon } from './icons'

function NameField() {
  const name = useSettings((s) => s.name)
  const change = useSettings((s) => s.change)
  return (
    <input
      className="name-field"
      value={name}
      maxLength={MAX_NAME_LENGTH}
      placeholder="Your name"
      aria-label="Your name"
      autoComplete="off"
      spellCheck={false}
      onChange={(e) => change({ name: e.target.value })}
    />
  )
}

function AvatarPicker() {
  const avatar = useSettings((s) => s.avatar)
  const change = useSettings((s) => s.change)
  return (
    <div className="avatars" role="radiogroup" aria-label="Choose your skeleton">
      {AVATARS.map((name) => (
        <button
          key={name}
          role="radio"
          aria-checked={name === avatar}
          className={name === avatar ? 'avatar selected' : 'avatar'}
          onClick={() => change({ avatar: name })}
        >
          <img src={`${import.meta.env.BASE_URL}models/avatar-${name}.png`} alt="" />
          <span>{name}</span>
        </button>
      ))}
    </div>
  )
}

// The start screen. Opened normally it offers solo or online play; opened from an invite link
// it offers to join that room. Either way the player picks a character first.
export function Landing() {
  const startSolo = useGame((s) => s.startSolo)
  const setMenu = useGame((s) => s.setMenu)
  const invited = new URLSearchParams(location.search).has('room')

  return (
    <div className="landing">
      <div className="brand">
        <h1>
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Plonko" />
        </h1>
        <p>
          {invited
            ? 'You have been invited to a match. Pick your skeleton and join.'
            : 'Knock your rival off the platform. First to three wins.'}
        </p>
      </div>

      <NameField />
      <AvatarPicker />

      {invited ? (
        <button className="primary join" onClick={startOnline}>
          <FriendsIcon /> Join the match
        </button>
      ) : (
        <div className="choices">
          <button className="card" onClick={startSolo}>
            <span className="card-icon solo">
              <BotIcon />
            </span>
            <strong>Play solo</strong>
            <span>Warm up against the bot</span>
          </button>
          <button className="card" onClick={startOnline}>
            <span className="card-icon duo">
              <FriendsIcon />
            </span>
            <strong>Play with a friend</strong>
            <span>Get a link, send it, fight</span>
          </button>
        </div>
      )}

      <div className="landing-foot">
        {invited && (
          <button className="ghost" onClick={() => location.assign(location.pathname)}>
            Go to the main menu instead
          </button>
        )}
        <button className="ghost" onClick={() => setMenu(true)}>
          <SlidersIcon /> Settings
        </button>
        <div className="keys">
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd>
          <span>move</span>
          <kbd>Space</kbd>
          <span>dash</span>
          <kbd>Shift</kbd>
          <span>block</span>
          <kbd>E</kbd>
          <span>jump</span>
        </div>
      </div>
    </div>
  )
}
