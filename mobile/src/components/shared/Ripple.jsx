import { useRef, useCallback } from 'react'

export function useRipple() {
  const ref = useRef(null)

  const trigger = useCallback((e) => {
    const el = ref.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left
    const y = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top
    const size = Math.max(rect.width, rect.height) * 2

    const ripple = document.createElement('div')
    ripple.className = 'ripple-effect'
    ripple.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${x - size / 2}px;
      top: ${y - size / 2}px;
    `
    el.appendChild(ripple)
    setTimeout(() => ripple.remove(), 500)
  }, [])

  return { ref, trigger }
}

export default function Ripple({ children, onClick, style, className, ...props }) {
  const { ref, trigger } = useRipple()

  return (
    <div
      ref={ref}
      className={`ripple-container ${className || ''}`}
      onTouchStart={trigger}
      onClick={onClick}
      style={{ cursor: 'pointer', ...style }}
      {...props}
    >
      {children}
    </div>
  )
}
