import { useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const THRESHOLD = 80

export default function PullToRefresh({ onRefresh, children, disabled = false }) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const containerRef = useRef(null)
  const pulling = useRef(false)

  const handleTouchStart = useCallback((e) => {
    if (disabled || refreshing) return
    const el = containerRef.current
    if (!el || el.scrollTop > 0) return
    startY.current = e.touches[0].clientY
    pulling.current = true
  }, [disabled, refreshing])

  const handleTouchMove = useCallback((e) => {
    if (!pulling.current || refreshing) return
    const dy = e.touches[0].clientY - startY.current
    if (dy < 0) { pulling.current = false; return }
    if (dy > 0) e.preventDefault()
    // Resistance formula - harder to pull the further you go
    const distance = Math.min(dy * 0.5, THRESHOLD * 1.3)
    setPullDistance(distance)
  }, [refreshing])

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return
    pulling.current = false
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true)
      setPullDistance(40) // keep indicator visible
      try {
        await onRefresh?.()
      } finally {
        setRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, onRefresh])

  const progress = Math.min(pullDistance / THRESHOLD, 1)
  const showIndicator = pullDistance > 8 || refreshing

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Pull indicator */}
      <AnimatePresence>
        {showIndicator && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: pullDistance || 40, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '2px solid var(--border)',
              borderTopColor: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: refreshing ? 'spin 0.6s linear infinite' : 'none',
              transform: `rotate(${progress * 360}deg)`,
              transition: refreshing ? 'none' : 'transform 0.1s',
            }}>
              {!refreshing && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  style={{ opacity: progress }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}
