import { AnimatePresence, motion } from 'framer-motion'
import { useNotifications } from '../../contexts/NotificationContext'

export default function InAppNotification() {
  const { notifications, dismiss } = useNotifications()

  return (
    <div style={{
      position: 'fixed',
      top: 'var(--sat)',
      left: 0,
      right: 0,
      zIndex: 'var(--z-notification)',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      padding: '8px 12px 0',
      pointerEvents: 'none',
    }}>
      <AnimatePresence mode="sync">
        {notifications.slice(0, 3).map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ y: -80, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -80, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-lg)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: 'var(--shadow-lg)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              pointerEvents: 'all',
              cursor: 'pointer',
            }}
            onClick={() => dismiss(notif.id)}
          >
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: notif.type === 'error' ? 'rgba(231,76,60,0.2)' :
                          notif.type === 'success' ? 'rgba(46,204,113,0.2)' :
                          'var(--accent-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}>
              {notif.avatar || (notif.type === 'error' ? '⚠️' : notif.type === 'success' ? '✅' : '💬')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {notif.title && (
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 1 }} className="truncate">
                  {notif.title}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }} className="truncate">
                {notif.body}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
