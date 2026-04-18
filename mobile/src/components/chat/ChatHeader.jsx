import { useNavigate } from 'react-router-dom'
import { useHaptic } from '../../hooks/useMobile'
import Avatar from '../shared/Avatar'

export default function ChatHeader({ title, subtitle, avatar, onMenuPress, onBack, members, isChannel }) {
  const navigate = useNavigate()
  const haptic = useHaptic()

  const handleBack = () => {
    haptic.tap()
    if (onBack) onBack()
    else navigate(-1)
  }

  return (
    <div style={{
      height: 'var(--header-height)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 8px 0 4px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      {/* Back button */}
      <button
        onClick={handleBack}
        className="touchable"
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: 'none',
          border: 'none',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>

      {/* Avatar or channel icon */}
      {avatar !== undefined ? (
        <Avatar name={title} size={34} />
      ) : isChannel ? (
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: 'var(--accent-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          color: 'var(--accent)',
          fontWeight: 700,
          flexShrink: 0,
        }}>
          #
        </div>
      ) : null}

      {/* Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }} className="truncate">{title}</div>
        {subtitle && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }} className="truncate">{subtitle}</div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {members !== undefined && (
          <button className="touchable" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            background: 'var(--bg-elevated)',
            border: 'none',
            borderRadius: 10,
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 600,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            {members}
          </button>
        )}

        {onMenuPress && (
          <button onClick={() => { haptic.tap(); onMenuPress() }} className="touchable" style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--bg-elevated)',
            border: 'none',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
