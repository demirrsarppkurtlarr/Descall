import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useHaptic } from '../hooks/useMobile'
import Avatar from '../components/shared/Avatar'
import BottomSheet from '../components/mobile/BottomSheet'

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: 'var(--radius-lg)',
      padding: '16px',
      border: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: color || 'var(--accent-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -1 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  )
}

export default function AdminPanel() {
  const navigate = useNavigate()
  const { user, authFetch } = useAuth()
  const haptic = useHaptic()
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState({ users: 0, messages: 0, channels: 0, online: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [tab, setTab] = useState('users')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/channels'); return }

    Promise.all([
      authFetch('/api/admin/users').then(r => r.ok ? r.json() : { users: [] }),
      authFetch('/api/admin/stats').then(r => r.ok ? r.json() : {}),
    ]).then(([userData, statsData]) => {
      setUsers(userData.users || [])
      setStats(statsData)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [user])

  const handleUserAction = async (action, userId) => {
    haptic.tap()
    const endpoints = {
      ban: `/api/admin/users/${userId}/ban`,
      unban: `/api/admin/users/${userId}/unban`,
      kick: `/api/admin/users/${userId}/kick`,
      makeAdmin: `/api/admin/users/${userId}/role`,
    }
    try {
      await authFetch(endpoints[action], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'makeAdmin' ? JSON.stringify({ role: 'admin' }) : undefined,
      })
      haptic.success()
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, banned: action === 'ban' } : u
      ))
      setSelectedUser(null)
    } catch {
      haptic.error()
    }
  }

  const filteredUsers = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{
        padding: '20px 16px 14px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => navigate(-1)} style={{
            background: 'none', border: 'none', color: 'var(--text-primary)', padding: 4,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800 }}>Admin Panel</h1>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Descall Management</p>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatCard label="Total Users" value={stats.users || users.length} icon="👥" />
          <StatCard label="Online Now" value={stats.online || 0} icon="🟢" color="rgba(46,204,113,0.2)" />
          <StatCard label="Messages" value={stats.messages || '—'} icon="💬" />
          <StatCard label="Channels" value={stats.channels || '—'} icon="#️⃣" color="rgba(52,152,219,0.2)" />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginTop: 16, background: 'var(--bg-elevated)', borderRadius: 12, padding: 4 }}>
          {['users', 'reports'].map(t => (
            <button key={t} onClick={() => { haptic.tap(); setTab(t) }} style={{
              flex: 1,
              padding: '8px',
              background: tab === t ? 'var(--accent)' : 'none',
              border: 'none',
              borderRadius: 8,
              color: tab === t ? '#fff' : 'var(--text-muted)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              textTransform: 'capitalize',
            }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="scrollable" style={{ flex: 1 }}>
        {tab === 'users' && (
          <>
            {/* Search */}
            <div style={{ padding: '12px 16px' }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search users..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            {loading && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading users…</div>
            )}

            {filteredUsers.map((u, i) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
                onClick={() => { haptic.tap(); setSelectedUser(u) }}
              >
                <Avatar name={u.displayName || u.username} size={42} online={u.online} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }} className="truncate">
                    {u.displayName || u.username}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    @{u.username}
                    {u.role === 'admin' && ' · 👑 Admin'}
                    {u.banned && ' · 🚫 Banned'}
                  </div>
                </div>

                {/* Quick action pills */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUserAction(u.banned ? 'unban' : 'ban', u.id) }}
                    style={{
                      padding: '4px 10px',
                      background: u.banned ? 'rgba(46,204,113,0.15)' : 'rgba(231,76,60,0.15)',
                      border: `1px solid ${u.banned ? 'rgba(46,204,113,0.3)' : 'rgba(231,76,60,0.3)'}`,
                      borderRadius: 8,
                      color: u.banned ? 'var(--success)' : 'var(--danger)',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {u.banned ? 'Unban' : 'Ban'}
                  </button>
                </div>
              </motion.div>
            ))}
          </>
        )}

        {tab === 'reports' && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚩</div>
            <div>No reports</div>
          </div>
        )}
      </div>

      {/* User detail sheet */}
      <BottomSheet open={!!selectedUser} onClose={() => setSelectedUser(null)} title="User Actions">
        {selectedUser && (
          <div style={{ padding: '0 0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px 16px', borderBottom: '1px solid var(--border)' }}>
              <Avatar name={selectedUser.displayName || selectedUser.username} size={52} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedUser.displayName || selectedUser.username}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>@{selectedUser.username}</div>
              </div>
            </div>

            {[
              { icon: '🚫', label: selectedUser.banned ? 'Unban User' : 'Ban User', action: selectedUser.banned ? 'unban' : 'ban', danger: !selectedUser.banned },
              { icon: '👢', label: 'Kick from Server', action: 'kick', danger: true },
              { icon: '👑', label: 'Make Admin', action: 'makeAdmin' },
            ].map(item => (
              <button key={item.action} onClick={() => handleUserAction(item.action, selectedUser.id)} style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 20px',
                background: 'none',
                border: 'none',
                color: item.danger ? 'var(--danger)' : 'var(--text-primary)',
                fontSize: 15,
                cursor: 'pointer',
                textAlign: 'left',
              }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
