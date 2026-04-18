// DMList.jsx - Direct Messages list screen
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { useHaptic } from '../hooks/useMobile'
import Avatar from '../components/shared/Avatar'

export default function DMList() {
  const navigate = useNavigate()
  const { user, authFetch } = useAuth()
  const haptic = useHaptic()
  const [dms, setDms] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authFetch('/api/dm')
      .then(r => r.ok ? r.json() : { conversations: [] })
      .then(data => setDms(data.conversations || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '20px 16px 14px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Messages</h1>
          <button onClick={() => { haptic.tap(); navigate('/dm/new') }} style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'var(--accent-dim)',
            border: 'none',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="scrollable" style={{ flex: 1 }}>
        {loading && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        )}

        {!loading && dms.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✉️</div>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No messages yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Start a conversation
            </div>
          </div>
        )}

        {dms.map((dm, i) => {
          const other = dm.participants?.find(p => p.id !== user?.id) || dm.user
          return (
            <motion.button
              key={dm.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => { haptic.tap(); navigate(`/dm/${dm.id}`) }}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Avatar name={other?.displayName || other?.username} size={48} online={other?.online} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                  <span style={{ fontWeight: dm.unread ? 700 : 600, fontSize: 15 }} className="truncate">
                    {other?.displayName || other?.username}
                  </span>
                  {dm.lastMessage?.createdAt && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                      {formatDistanceToNow(new Date(dm.lastMessage.createdAt), { addSuffix: false })}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 13,
                  color: dm.unread ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: dm.unread ? 500 : 400,
                }} className="truncate">
                  {dm.lastMessage?.content || 'Start chatting'}
                </div>
              </div>

              {dm.unread > 0 && (
                <div style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: 'var(--radius-full)',
                  minWidth: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '0 6px',
                  flexShrink: 0,
                }}>
                  {dm.unread}
                </div>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
