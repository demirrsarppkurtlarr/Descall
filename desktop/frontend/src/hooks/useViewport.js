import { useState, useEffect, useRef } from 'react'

export function useViewport() {
  const [viewport, setViewport] = useState({
    height: window.innerHeight,
    width: window.innerWidth,
    keyboardVisible: false,
    keyboardHeight: 0,
    safeAreaTop: 0,
    safeAreaBottom: 0,
  })

  useEffect(() => {
    // Parse CSS env variables for safe areas
    const computedStyle = getComputedStyle(document.documentElement)
    const safeAreaTop = parseInt(
      computedStyle.getPropertyValue('--sat') || '0', 10
    )
    const safeAreaBottom = parseInt(
      computedStyle.getPropertyValue('--sab') || '0', 10
    )

    const baseHeight = window.innerHeight

    const handleVisualViewport = () => {
      if (!window.visualViewport) return
      const vvh = window.visualViewport.height
      const keyboardHeight = Math.max(0, baseHeight - vvh)
      const keyboardVisible = keyboardHeight > 100

      setViewport(prev => ({
        ...prev,
        keyboardVisible,
        keyboardHeight,
        safeAreaTop,
        safeAreaBottom,
      }))

      // Push content above keyboard
      document.documentElement.style.setProperty(
        '--keyboard-height', `${keyboardHeight}px`
      )
    }

    const handleResize = () => {
      setViewport(prev => ({
        ...prev,
        height: window.innerHeight,
        width: window.innerWidth,
      }))
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewport)
      window.visualViewport.addEventListener('scroll', handleVisualViewport)
    }
    window.addEventListener('resize', handleResize)

    // Set CSS custom properties for safe areas
    document.documentElement.style.setProperty('--sat', `env(safe-area-inset-top, 0px)`)
    document.documentElement.style.setProperty('--sab', `env(safe-area-inset-bottom, 0px)`)
    document.documentElement.style.setProperty('--sal', `env(safe-area-inset-left, 0px)`)
    document.documentElement.style.setProperty('--sar', `env(safe-area-inset-right, 0px)`)

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewport)
        window.visualViewport.removeEventListener('scroll', handleVisualViewport)
      }
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return viewport
}

export function useScrollLock() {
  const lockScroll = () => {
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    document.body.style.top = `-${window.scrollY}px`
  }

  const unlockScroll = () => {
    const scrollY = document.body.style.top
    document.body.style.overflow = ''
    document.body.style.position = ''
    document.body.style.width = ''
    document.body.style.top = ''
    window.scrollTo(0, parseInt(scrollY || '0') * -1)
  }

  return { lockScroll, unlockScroll }
}
