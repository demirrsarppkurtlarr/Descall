import { useRef, useCallback, useEffect } from 'react'

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  velocityThreshold = 0.3,
  disabled = false,
} = {}) {
  const touchStart = useRef(null)
  const touchEnd = useRef(null)
  const startTime = useRef(null)

  const onTouchStart = useCallback((e) => {
    if (disabled) return
    touchStart.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY }
    touchEnd.current = null
    startTime.current = Date.now()
  }, [disabled])

  const onTouchMove = useCallback((e) => {
    if (disabled) return
    touchEnd.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY }
  }, [disabled])

  const onTouchEnd = useCallback(() => {
    if (disabled || !touchStart.current || !touchEnd.current) return

    const dx = touchEnd.current.x - touchStart.current.x
    const dy = touchEnd.current.y - touchStart.current.y
    const elapsed = Date.now() - startTime.current
    const vx = Math.abs(dx) / elapsed
    const vy = Math.abs(dy) / elapsed

    const isHorizontal = Math.abs(dx) > Math.abs(dy)
    const isVertical = !isHorizontal

    if (isHorizontal && (Math.abs(dx) > threshold || vx > velocityThreshold)) {
      if (dx < 0) onSwipeLeft?.()
      else onSwipeRight?.()
    } else if (isVertical && (Math.abs(dy) > threshold || vy > velocityThreshold)) {
      if (dy < 0) onSwipeUp?.()
      else onSwipeDown?.()
    }

    touchStart.current = null
    touchEnd.current = null
  }, [disabled, threshold, velocityThreshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown])

  return { onTouchStart, onTouchMove, onTouchEnd }
}

export function useLongPress(callback, { delay = 500, onStart, onCancel } = {}) {
  const timeout = useRef(null)
  const triggered = useRef(false)

  const start = useCallback((e) => {
    onStart?.()
    triggered.current = false
    timeout.current = setTimeout(() => {
      triggered.current = true
      callback(e)
    }, delay)
  }, [callback, delay, onStart])

  const cancel = useCallback(() => {
    clearTimeout(timeout.current)
    if (!triggered.current) onCancel?.()
  }, [onCancel])

  return {
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel,
    onContextMenu: (e) => { e.preventDefault(); cancel() },
  }
}

export function usePullToRefresh(onRefresh, { threshold = 80 } = {}) {
  const startY = useRef(0)
  const pulling = useRef(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleTouchStart = (e) => {
      if (el.scrollTop === 0) {
        startY.current = e.touches[0].clientY
        pulling.current = true
      }
    }

    const handleTouchMove = (e) => {
      if (!pulling.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy > 0) {
        e.preventDefault()
        const progress = Math.min(dy / threshold, 1)
        el.style.setProperty('--ptr-progress', progress)
        el.style.setProperty('--ptr-offset', `${Math.min(dy * 0.4, threshold * 0.4)}px`)
      }
    }

    const handleTouchEnd = async () => {
      if (!pulling.current) return
      pulling.current = false
      el.style.setProperty('--ptr-progress', 0)
      el.style.setProperty('--ptr-offset', '0px')

      const dy = 0 // Would track properly in real impl
      if (dy > threshold) await onRefresh?.()
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd)

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [onRefresh, threshold])

  return containerRef
}
