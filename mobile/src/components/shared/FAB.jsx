import { motion, AnimatePresence } from 'framer-motion'
import { useHaptic } from '../../hooks/useMobile'

export default function FAB({ icon, label, onClick, extended = false, color }) {
  const haptic = useHaptic()

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={() => { haptic.tap(); onClick?.() }}
      style={{
        position: 'absolute',
        bottom: 'calc(16px + var(--sab))',
        right: 16,
        height: extended ? 48 : 56,
        borderRadius: extended ? 24 : 18,
        background: color || 'linear-gradient(135deg, var(--accent), #9370ff)',
        border: 'none',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: extended ? 8 : 0,
        padding: extended ? '0 20px' : '0 18px',
        fontSize: extended ? 14 : 22,
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(124,92,252,0.45)',
        zIndex: 10,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: extended ? 18 : 22 }}>{icon}</span>
      <AnimatePresence>
        {extended && label && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            style={{ overflow: 'hidden' }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
