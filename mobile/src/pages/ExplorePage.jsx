import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useHaptic } from '../hooks/useMobile'

const CATEGORIES = ['All', 'Gaming', 'Tech', 'Music', 'Art', 'Sports', 'Study']

const FEATURED = [
  { id: 'general', name: 'General', desc: 'The main hub for all conversations', members: 128, emoji: '💬', color: '#7c5cfc' },
  { id: 'dev', name: 'Development', desc: 'Code, ship, repeat', members: 64, emoji: '💻', color: '#3498db' },
  { id: 'design', name: 'Design', desc: 'UI, UX, and everything visual', members: 42, emoji: '🎨', color: '#e74c3c' },
  { id: 'random', name: 'Random', desc: 'Anything goes here', members: 97, emoji: '🎲', color: '#2ecc71' },
  { id: 'gaming', name: 'Gaming', desc: 'GGs only', members: 201, emoji: '🎮', color: '#f39c12' },
  { id: 'music', name: 'Music', desc: 'Share your playlist', members: 55, emoji: '🎵', color: '#e91e63' },
]

export default function ExplorePage() {
  const navigate = useNavigate()
  const { authFetch } = useAuth()
  const haptic = useHaptic()
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [channels, setChannels] = useState(FEATURED)

  useEffect(() => {
    authFetch('/api/channels/public')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.channels?.length) setChannels(data.channels) })
      .catch(() => {})
  }, [])

  const filtered = channels.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.desc?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '20px 16px 14px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Explore</h1>

        {/* Search */}
        <div style={{
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          marginBottom: 12,
          border: '1px solid var(--border)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search channels..."
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

        {/* Categories */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }} className="scrollable">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => { haptic.tap(); setCategory(cat) }}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: '1.5px solid',
                borderColor: category === cat ? 'var(--accent)' : 'var(--border)',
                background: category === cat ? 'var(--accent-dim)' : 'none',
                color: category === cat ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Channel grid */}
      <div className="scrollable" style={{ flex: 1 }}>
        {/* Featured section */}
        <div style={{ padding: '16px 16px 8px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>
          Popular Channels
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 16px 16px' }}>
          {filtered.map((channel, i) => (
            <motion.button
              key={channel.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { haptic.tap(); navigate(`/channels/${channel.id}`) }}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: 16,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: channel.color ? `${channel.color}22` : 'var(--accent-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}>
                {channel.emoji || '#'}
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }} className="truncate">
                  #{channel.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }} className="truncate">
                  {channel.desc || channel.topic}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--online)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {channel.members || 0} members
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}
