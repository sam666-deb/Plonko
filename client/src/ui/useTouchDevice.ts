import { useEffect, useState } from 'react'

// True on a device whose main pointer is a finger, or as soon as the screen is touched.
export function useTouchDevice() {
  const [isTouch, setTouch] = useState(() => matchMedia('(pointer: coarse)').matches)
  useEffect(() => {
    if (isTouch) return
    const onTouch = () => setTouch(true)
    window.addEventListener('touchstart', onTouch, { once: true })
    return () => window.removeEventListener('touchstart', onTouch)
  }, [isTouch])
  return isTouch
}
