import { useState, useEffect, useCallback } from 'react'

const MOBILE_BREAKPOINT = 768
const TABLET_BREAKPOINT = 1024

export function useMobile() {
  const [state, setState] = useState(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 375
    return {
      isMobile: w < MOBILE_BREAKPOINT,
      isTablet: w >= MOBILE_BREAKPOINT && w < TABLET_BREAKPOINT,
      isDesktop: w >= TABLET_BREAKPOINT,
      width: w,
      height: typeof window !== 'undefined' ? window.innerHeight : 812,
      isTouch: typeof window !== 'undefined'
        ? 'ontouchstart' in window || navigator.maxTouchPoints > 0
        : false,
      isIOS: typeof navigator !== 'undefined'
        ? /iPad|iPhone|iPod/.test(navigator.userAgent)
        : false,
      isAndroid: typeof navigator !== 'undefined'
        ? /Android/.test(navigator.userAgent)
        : false,
      isPWA: typeof window !== 'undefined'
        ? window.matchMedia('(display-mode: standalone)').matches
        : false,
    }
  })

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      setState({
        isMobile: w < MOBILE_BREAKPOINT,
        isTablet: w >= MOBILE_BREAKPOINT && w < TABLET_BREAKPOINT,
        isDesktop: w >= TABLET_BREAKPOINT,
        width: w,
        height: h,
        isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
        isAndroid: /Android/.test(navigator.userAgent),
        isPWA: window.matchMedia('(display-mode: standalone)').matches,
      })
    }

    const ro = new ResizeObserver(update)
    ro.observe(document.documentElement)
    return () => ro.disconnect()
  }, [])

  return state
}

export function useHaptic() {
  const vibrate = useCallback((pattern = [10]) => {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(pattern) } catch {}
    }
  }, [])

  return {
    tap: () => vibrate([10]),
    success: () => vibrate([10, 50, 10]),
    error: () => vibrate([50, 30, 50]),
    notification: () => vibrate([20, 10, 20]),
    longPress: () => vibrate([30]),
  }
}
