import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { useHaptic } from '../hooks/useMobile'
import Avatar from '../components/shared/Avatar'
import SwipeableRow from '../components/shared/SwipeableRow'

// Mock notifications for demo - replace with real API data
const MOCK_NOTIFS = [
  { id: 1, type: 'mention', user: 'Alice', content: 'mentioned you in #general', preview: 'Hey @you check this out!', channel: 'general', time: Date.now() - 300000, read: false },
  { id: 2, type: 'dm', user: 'Bob', content: 'sent you a message', preview: 'Are you available?', channel: null, time: Date.now() - 900000, read: false },
  { id: 3, type: 'reaction', user: 'Carol', content: 'reacted ❤️ to your message', preview: 'Nice work on the project!', channel: 'dev', time: Date.now() - 3600000, read: true },
  { id: 4, type: 'system', user: null, content: 'Welcome to Descall!', preview: 'Start by joining a channel', channel: null, time: Date.now() - 86400000, read: true },
]

const TYPE_ICONS = {
  mention: '💬',
  dm: '✉️',
  reaction: '❤️',
  system: '🔔',
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const haptic = useHaptic()
  const [notifications, setNotifications] = useState(MOCK_NOTIFS)
  const [filter, setFilter] = useState('all')

  const markAllRead = () => {
    haptic.tap()
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const dismiss = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const filtered = filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '20px 16px 14px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>Notifications</h1>
            {unreadCount > 0 && (
              <span style={{
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 7px',
              }}>
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}>
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 0, background: 'var(--bg-elevated)', borderRadius: 12, padding: 4 }}>
          {['all', 'unread'].map(f => (
            <button key={f} onClick={() => { haptic.tap(); setFilter(f) }} style={{
              flex: 1,
              padding: '8px',
              background: filter === f ? 'var(--accent)' : 'none',
              border: 'none',
              borderRadius: 8,
              color: filter === f ? '#fff' : 'var(--text-muted)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              textTransform: 'capitalize',
            }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="scrollable" style={{ flex: 1 }}>
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}
            >
              <div style={{ fontSize: 44, marginBottom: 12 }}>🔔</div>
              <div style={{ fontWeight: 600 }}>All caught up!</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>No new notifications</div>
            </motion.div>
          )}

          {filtered.map((notif, i) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20, height: 0 }}
              transition={{ delay: i * 0.04 }}
              layout
            >
              <SwipeableRow
                rightActions={[{ icon: '✕', color: 'var(--danger)' }]}
                onRightTrigger={() => dismiss(notif.id)}
              >
                <div
                  onClick={() => {
                    haptic.tap()
                    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
                    if (notif.channel) navigate(`/channels/${notif.channel}`)
                    else navigate('/dm')
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--border)',
                    background: notif.read ? 'transparent' : 'rgba(124,92,252,0.04)',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  {/* Unread dot */}
                  {!notif.read && (
                    <div style={{
                      position: 'absolute',
                      left: 6,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                    }} />
                  )}

                  {/* Icon/Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {notif.user ? (
                      <Avatar name={notif.user} size={42} />
                    ) : (
                      <div style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        background: 'var(--accent-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                      }}>
                        {TYPE_ICONS[notif.type]}
                      </div>
                    )}
                    <div style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                    }}>
                      {TYPE_ICONS[notif.type]}
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, marginBottom: 3, lineHeight: 1.3 }}>
                      <strong>{notif.user}</strong>
                      {' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{notif.content}</span>
                    </div>
                    {notif.preview && (
                      <div style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        background: 'var(--bg-elevated)',
                        borderRadius: 8,
                        padding: '4px 8px',
                        marginBottom: 4,
                      }} className="truncate">
                        {notif.preview}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {formatDistanceToNow(new Date(notif.time), { addSuffix: true })}
                      {notif.channel && ` · #${notif.channel}`}
                    </div>
                  </div>
                </div>
              </SwipeableRow>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
