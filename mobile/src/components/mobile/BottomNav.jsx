import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useNotifications } from '../../contexts/NotificationContext'
import { useHaptic } from '../../hooks/useMobile'

const NAV_ITEMS = [
  {
    path: '/channels',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    label: 'Channels',
  },
  {
    path: '/dm',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
      </svg>
    ),
    label: 'DMs',
    badge: true,
  },
  {
    path: '/explore',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
      </svg>
    ),
    label: 'Explore',
  },
  {
    path: '/notifications',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
      </svg>
    ),
    label: 'Alerts',
    badge: true,
  },
  {
    path: '/profile',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/>
      </svg>
    ),
    label: 'Me',
  },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { totalUnread } = useNotifications()
  const haptic = useHaptic()

  const handleNav = (path) => {
    haptic.tap()
    navigate(path)
  }

  return (
    <nav style={{
      height: 'calc(var(--bottom-nav-height) + var(--sab))',
      paddingBottom: 'var(--sab)',
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'stretch',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      position: 'relative',
      zIndex: 'var(--z-raised)',
      flexShrink: 0,
    }}>
      {NAV_ITEMS.map((item) => {
        const isActive = location.pathname.startsWith(item.path)
        return (
          <button
            key={item.path}
            onClick={() => handleNav(item.path)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              position: 'relative',
              minWidth: 0,
              padding: '8px 4px',
              transition: 'color 0.15s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {/* Active indicator */}
            {isActive && (
              <motion.div
                layoutId="nav-indicator"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 32,
                  height: 2,
                  background: 'var(--accent)',
                  borderRadius: '0 0 2px 2px',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}

            {/* Badge */}
            {item.badge && totalUnread > 0 && (
              <span style={{
                position: 'absolute',
                top: 6,
                right: '50%',
                marginRight: -18,
                background: 'var(--danger)',
                color: '#fff',
                borderRadius: 'var(--radius-full)',
                fontSize: 10,
                fontWeight: 700,
                minWidth: 16,
                height: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                border: '2px solid var(--bg-secondary)',
              }}>
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}

            {/* Icon */}
            <motion.div
              animate={{ scale: isActive ? 1.1 : 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              {item.icon}
            </motion.div>

            {/* Label */}
            <span style={{
              fontSize: 10,
              fontWeight: isActive ? 600 : 400,
              letterSpacing: 0.2,
            }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
