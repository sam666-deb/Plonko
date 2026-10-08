import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { touch } from '../input/touch'

// How far the stick's knob travels from the centre, in pixels, and the part of that which is ignored.
const STICK_RANGE = 48
const DEAD_ZONE = 0.15

function Stick() {
  const knob = useRef<HTMLDivElement>(null)

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    let x = (e.clientX - (box.left + box.width / 2)) / STICK_RANGE
    let y = (e.clientY - (box.top + box.height / 2)) / STICK_RANGE
    const length = Math.hypot(x, y)
    if (length > 1) {
      x /= length
      y /= length
    }
    if (knob.current) knob.current.style.transform = `translate(${x * STICK_RANGE}px, ${y * STICK_RANGE}px)`
    const live = length > DEAD_ZONE
    touch.stickX = live ? x : 0
    // Screen coordinates grow downwards; the stick reports up as positive.
    touch.stickY = live ? -y : 0
  }
  const release = () => {
    touch.stickX = 0
    touch.stickY = 0
    if (knob.current) knob.current.style.transform = ''
  }

  return (
    <div
      className="stick"
      onPointerDown={(e) => {
        // Capturing keeps the stick following this finger even when it slides off the pad.
        e.currentTarget.setPointerCapture(e.pointerId)
        move(e)
      }}
      onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && move(e)}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div ref={knob} className="knob" />
    </div>
  )
}

type PadProps = { className: string; label: string; children: ReactNode; onPress: () => void; onRelease?: () => void }

function Pad({ className, label, children, onPress, onRelease }: PadProps) {
  const [down, setDown] = useState(false)
  const release = () => {
    setDown(false)
    onRelease?.()
  }
  return (
    <div
      role="button"
      aria-label={label}
      className={`pad ${className} ${down ? 'down' : ''}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        setDown(true)
        onPress()
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {children}
    </div>
  )
}

// On-screen controls for phones and tablets: a stick under the left thumb, actions under the right.
export function TouchControls() {
  const nextEmote = useRef(0)
  // Leaving the game with a finger still down must not leave an input stuck on.
  useEffect(
    () => () => {
      touch.stickX = 0
      touch.stickY = 0
      touch.block = false
    },
    [],
  )

  return (
    <div className="touch">
      <Stick />
      <div className="pads">
        <Pad className="emote" label="Emote" onPress={() => (touch.emote = (nextEmote.current++ % 3) + 1)}>
          ☺
        </Pad>
        <Pad className="jump" label="Jump" onPress={() => (touch.jump = true)}>
          Jump
        </Pad>
        <Pad className="block" label="Block" onPress={() => (touch.block = true)} onRelease={() => (touch.block = false)}>
          Block
        </Pad>
        <Pad className="dash" label="Dash" onPress={() => (touch.dash = true)}>
          Dash
        </Pad>
      </div>
    </div>
  )
}
