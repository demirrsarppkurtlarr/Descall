import { useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useHaptic } from '../../hooks/useMobile'

const ACTION_WIDTH = 72
const TRIGGER_THRESHOLD = ACTION_WIDTH * 0.7

export default function SwipeableRow({ children, leftActions = [], rightActions = [], onLeftTrigger, onRightTrigger }) {
  const haptic = useHaptic()
  const x = useMotionValue(0)
  const [revealed, setRevealed] = useState(null) // 'left' | 'right' | null
  const triggered = useRef(false)

  const leftBg = useTransform(x, [0, ACTION_WIDTH], ['rgba(46,204,113,0)', 'rgba(46,204,113,1)'])
  const rightBg = useTransform(x, [-ACTION_WIDTH, 0], ['rgba(231,76,60,1)', 'rgba(231,76,60,0)'])

  const handleDragEnd = (_, info) => {
    const vx = info.velocity.x
    const offset = x.get()

    if (offset > TRIGGER_THRESHOLD || (offset > 20 && vx > 500)) {
      // Reveal left actions
      animate(x, rightActions.length * ACTION_WIDTH, { type: 'spring', stiffness: 400, damping: 30 })
      setRevealed('left')
      if (!triggered.current) {
        triggered.current = true
        haptic.success()
        onLeftTrigger?.()
        setTimeout(() => {
          triggered.current = false
          animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
          setRevealed(null)
        }, 800)
      }
    } else if (offset < -TRIGGER_THRESHOLD || (offset < -20 && vx < -500)) {
      animate(x, -(leftActions.length * ACTION_WIDTH), { type: 'spring', stiffness: 400, damping: 30 })
      setRevealed('right')
      if (!triggered.current) {
        triggered.current = true
        haptic.success()
        onRightTrigger?.()
        setTimeout(() => {
          triggered.current = false
          animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
          setRevealed(null)
        }, 800)
      }
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
      setRevealed(null)
    }
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Left action background (swipe right reveals) */}
      {leftActions.map((action, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: ACTION_WIDTH,
            background: action.color || 'var(--success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
          }}
        >
          {action.icon}
        </motion.div>
      ))}

      {/* Right action background (swipe left reveals) */}
      {rightActions.map((action, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: ACTION_WIDTH,
            background: action.color || 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
          }}
        >
          {action.icon}
        </motion.div>
      ))}

      {/* Draggable content */}
      <motion.div
        drag="x"
        dragConstraints={{
          left: -(rightActions.length * ACTION_WIDTH),
          right: leftActions.length * ACTION_WIDTH,
        }}
        dragElastic={0.1}
        style={{ x }}
        onDragEnd={handleDragEnd}
      >
        {children}
      </motion.div>
    </div>
  )
}
