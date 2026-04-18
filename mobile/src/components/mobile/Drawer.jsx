import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useHaptic } from '../../hooks/useMobile'
import Avatar from '../shared/Avatar'

const SERVER_ITEMS = [
  { id: 'general', name: 'general', icon: '#' },
  { id: 'random', name: 'random', icon: '#' },
  { id: 'announcements', name: 'announcements', icon: '📢' },
  { id: 'dev', name: 'development', icon: '#' },
  { id: 'design', name: 'design', icon: '#' },
]

export default function Drawer({ open, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const haptic = useHaptic()

  const go = (path) => {
    haptic.tap()
    navigate(path)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', stiffness: 400, damping: 40 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: 'min(280px, 80vw)',
            background: 'var(--bg-secondary)',
            zIndex: 'var(--z-drawer)',
            display: 'flex',
            flexDirection: 'column',
            paddingTop: 'var(--sat)',
            paddingBottom: 'var(--sab)',
            boxShadow: '4px 0 40px rgba(0,0,0,0.5)',
          }}
        >
          {/* Server header */}
          <div style={{
            padding: '20px 16px 12px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, var(--accent), #c084fc)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 800,
                color: '#fff',
                flexShrink: 0,
              }}>
                D
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Descall</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Community Server</div>
              </div>
            </div>
          </div>

          {/* Channels */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }} className="scrollable">
            <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>
              Text Channels
            </div>
            {SERVER_ITEMS.map(ch => (
              <button
                key={ch.id}
                onClick={() => go(`/channels/${ch.id}`)}
                className="touchable"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                  fontWeight: 500,
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  margin: '1px 8px',
                  width: 'calc(100% - 16px)',
                }}
              >
                <span style={{ fontSize: 16, opacity: 0.7 }}>{ch.icon}</span>
                {ch.name}
              </button>
            ))}

            <div style={{ padding: '16px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>
              Navigation
            </div>
            {[
              { path: '/dm', label: 'Direct Messages', emoji: '💬' },
              { path: '/notifications', label: 'Notifications', emoji: '🔔' },
              { path: '/settings', label: 'Settings', emoji: '⚙️' },
              ...(user?.role === 'admin' ? [{ path: '/admin', label: 'Admin Panel', emoji: '👑' }] : []),
            ].map(item => (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                className="touchable"
                style={{
                  width: 'calc(100% - 16px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                  fontWeight: 500,
                  textAlign: 'left',
                  cursor: 'pointer',
                  margin: '1px 8px',
                }}
              >
                <span style={{ fontSize: 16 }}>{item.emoji}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* User profile strip */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <Avatar name={user?.displayName || user?.username} size={34} online />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }} className="truncate">
                {user?.displayName || user?.username}
              </div>
              <div style={{ fontSize: 11, color: 'var(--online)' }}>Online</div>
            </div>
            <button
              onClick={() => { logout(); onClose() }}
              className="touchable"
              style={{
                color: 'var(--text-muted)',
                background: 'none',
                border: 'none',
                padding: 6,
                borderRadius: 6,
              }}
              title="Logout"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
