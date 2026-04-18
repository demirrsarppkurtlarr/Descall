import { useState, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useHaptic } from '../hooks/useMobile'
import Avatar from '../components/shared/Avatar'

const STATIC_CHANNELS = [
  { id: 'general', name: 'general', topic: 'General discussion', emoji: '💬' },
  { id: 'random', name: 'random', topic: 'Off-topic chat', emoji: '🎲' },
  { id: 'announcements', name: 'announcements', topic: 'Server announcements', emoji: '📢' },
  { id: 'dev', name: 'development', topic: 'Tech talk', emoji: '💻' },
  { id: 'design', name: 'design', topic: 'Design resources', emoji: '🎨' },
]

export default function ChannelList() {
  const navigate = useNavigate()
  const { openDrawer } = useOutletContext() || {}
  const { user, authFetch } = useAuth()
  const { unread } = useNotifications()
  const haptic = useHaptic()
  const [channels, setChannels] = useState(STATIC_CHANNELS)
  const [search, setSearch] = useState('')

  useEffect(() => {
    authFetch('/api/channels')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.channels?.length) setChannels(data.channels)
      })
      .catch(() => {})
  }, [])

  const filtered = channels.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Channels</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {user?.displayName || user?.username}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { haptic.tap(); openDrawer?.() }} style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'var(--bg-elevated)',
              border: 'none',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <Avatar name={user?.displayName || user?.username} size={38} online />
          </div>
        </div>

        {/* Search */}
        <div style={{
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          border: '1px solid var(--border)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search channels"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              padding: '10px 0',
              fontSize: 15,
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Channel list */}
      <div className="scrollable" style={{ flex: 1 }}>
        <div style={{ padding: '8px 0' }}>
          {filtered.map((channel, i) => {
            const count = unread[channel.id] || 0
            return (
              <motion.button
                key={channel.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => { haptic.tap(); navigate(`/channels/${channel.id}`) }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  position: 'relative',
                  borderBottom: '1px solid var(--border)',
                }}
                whileTap={{ scale: 0.98, backgroundColor: 'var(--bg-hover)' }}
              >
                {/* Channel icon */}
                <div style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background: 'var(--accent-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  flexShrink: 0,
                }}>
                  {channel.emoji || '#'}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: count > 0 ? 700 : 600,
                    fontSize: 15,
                    marginBottom: 2,
                    color: count > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }} className="truncate">
                    #{channel.name}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                  }} className="truncate">
                    {channel.lastMessage?.content || channel.topic}
                  </div>
                </div>

                {/* Unread badge */}
                {count > 0 && (
                  <div style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 11,
                    fontWeight: 700,
                    minWidth: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 6px',
                    flexShrink: 0,
                  }}>
                    {count > 99 ? '99+' : count}
                  </div>
                )}
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
