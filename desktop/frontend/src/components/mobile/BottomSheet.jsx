import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useScrollLock } from '../../hooks/useViewport'

export default function BottomSheet({ open, onClose, children, title, snapPoints = ['50%', '90%'] }) {
  const { lockScroll, unlockScroll } = useScrollLock()
  const startY = useRef(0)
  const currentY = useRef(0)
  const sheetRef = useRef(null)

  useEffect(() => {
    if (open) lockScroll()
    else unlockScroll()
    return unlockScroll
  }, [open])

  const handleDragStart = (e) => {
    startY.current = e.touches?.[0]?.clientY ?? e.clientY
  }

  const handleDragMove = (e) => {
    const y = e.touches?.[0]?.clientY ?? e.clientY
    const dy = y - startY.current
    currentY.current = dy
    if (sheetRef.current && dy > 0) {
      sheetRef.current.style.transform = `translateY(${dy}px)`
    }
  }

  const handleDragEnd = () => {
    if (currentY.current > 100) onClose()
    else if (sheetRef.current) {
      sheetRef.current.style.transform = ''
    }
    currentY.current = 0
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 'var(--z-modal)',
              backdropFilter: 'blur(4px)',
            }}
          />
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 'calc(var(--z-modal) + 1)',
              background: 'var(--bg-secondary)',
              borderRadius: '20px 20px 0 0',
              maxHeight: '90dvh',
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: 'var(--sab)',
              transition: 'transform 0s',
            }}
          >
            {/* Drag handle */}
            <div
              onTouchStart={handleDragStart}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
              style={{
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                cursor: 'grab',
                flexShrink: 0,
              }}
            >
              <div style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: 'var(--text-muted)',
                opacity: 0.5,
              }} />
              {title && (
                <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
              )}
            </div>

            {/* Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }} className="scrollable">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
