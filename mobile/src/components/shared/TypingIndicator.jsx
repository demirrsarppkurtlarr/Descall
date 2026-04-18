import { AnimatePresence, motion } from 'framer-motion'

export default function TypingIndicator({ users = [] }) {
  if (!users.length) return null

  const label = users.length === 1
    ? `${users[0]} is typing`
    : users.length === 2
    ? `${users[0]} and ${users[1]} are typing`
    : `${users.length} people are typing`

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 16px 8px',
        }}
      >
        {/* Dots */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          background: 'var(--bg-elevated)',
          borderRadius: 12,
          padding: '6px 10px',
        }}>
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              animate={{ y: [0, -4, 0] }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--text-muted)',
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {label}
        </span>
      </motion.div>
    </AnimatePresence>
  )
}
