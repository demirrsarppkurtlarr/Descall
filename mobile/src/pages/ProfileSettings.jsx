import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useHaptic } from '../hooks/useMobile'
import Avatar from '../components/shared/Avatar'

function Toggle({ value, onChange }) {
  const haptic = useHaptic()
  return (
    <div
      onClick={() => { haptic.tap(); onChange(!value) }}
      style={{
        width: 48,
        height: 28,
        borderRadius: 14,
        background: value ? 'var(--accent)' : 'var(--bg-elevated)',
        border: '2px solid ' + (value ? 'transparent' : 'var(--border)'),
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.2s',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: 2,
        left: value ? 20 : 2,
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s var(--ease-spring)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </div>
  )
}

function SettingRow({ icon, label, description, action, toggle, danger }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '14px 16px',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: danger ? 'rgba(231,76,60,0.15)' : 'var(--bg-elevated)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: danger ? 'var(--danger)' : 'var(--text-primary)' }}>
          {label}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{description}</div>
        )}
      </div>
      {toggle !== undefined ? (
        <Toggle value={toggle.value} onChange={toggle.onChange} />
      ) : action ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      ) : null}
    </div>
  )
}

export function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const haptic = useHaptic()

  return (
    <div style={{ height: '100%', overflow: 'auto' }} className="scrollable">
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(180deg, var(--accent-dim) 0%, transparent 100%)',
        padding: '32px 20px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}>
        <Avatar name={user?.displayName || user?.username} size={80} online />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>{user?.displayName || user?.username}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 2 }}>@{user?.username}</p>
          {user?.role === 'admin' && (
            <span style={{
              display: 'inline-block',
              marginTop: 6,
              background: 'rgba(124,92,252,0.2)',
              color: 'var(--accent)',
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 8,
            }}>
              👑 Admin
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '0 16px 16px', display: 'flex', gap: 10 }}>
        <button onClick={() => navigate('/settings')} style={{
          flex: 1,
          padding: '12px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}>
          ⚙️ Settings
        </button>
        <button onClick={() => { haptic.tap(); logout() }} style={{
          flex: 1,
          padding: '12px',
          background: 'rgba(231,76,60,0.1)',
          border: '1px solid rgba(231,76,60,0.2)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--danger)',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}>
          Sign Out
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--border)', margin: '0 16px', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {[
          { label: 'Messages', value: '—' },
          { label: 'Joined', value: '—' },
          { label: 'Channels', value: '—' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-secondary)', padding: '16px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const haptic = useHaptic()
  const [notifs, setNotifs] = useState(true)
  const [sounds, setSounds] = useState(true)
  const [haptics, setHaptics] = useState(true)
  const [compact, setCompact] = useState(false)

  return (
    <div style={{ height: '100%', overflow: 'auto' }} className="scrollable">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '20px 16px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Settings</h1>
      </div>

      <div style={{ padding: '8px 0' }}>
        <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>
          Notifications
        </div>
        <SettingRow icon="🔔" label="Push Notifications" description="Receive push notifications" toggle={{ value: notifs, onChange: setNotifs }} />
        <SettingRow icon="🔊" label="Sound" description="Play notification sounds" toggle={{ value: sounds, onChange: setSounds }} />
        <SettingRow icon="📳" label="Haptic Feedback" description="Vibrate on interactions" toggle={{ value: haptics, onChange: setHaptics }} />

        <div style={{ padding: '16px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>
          Appearance
        </div>
        <SettingRow icon="📐" label="Compact Mode" description="Denser message layout" toggle={{ value: compact, onChange: setCompact }} />
        <SettingRow icon="🎨" label="Theme" description="Dark (default)" action={() => {}} />

        <div style={{ padding: '16px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>
          Account
        </div>
        <SettingRow icon="✏️" label="Edit Profile" action={() => {}} />
        <SettingRow icon="🔒" label="Change Password" action={() => {}} />
        <SettingRow icon="📲" label="Install App" description="Add to home screen" action={() => {}} />
        <SettingRow icon="🗑️" label="Delete Account" danger action={() => {}} />
      </div>

      <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        Descall v1.0.0 · Mobile Edition
      </div>
    </div>
  )
}
