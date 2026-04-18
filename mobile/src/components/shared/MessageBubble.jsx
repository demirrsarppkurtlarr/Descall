import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import Avatar from '../shared/Avatar'
import { useLongPress } from '../../hooks/useSwipe'
import { useHaptic } from '../../hooks/useMobile'
import BottomSheet from '../mobile/BottomSheet'

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

export default function MessageBubble({ message, isOwn, showAvatar = true, onReply, onDelete, onReact }) {
  const [showActions, setShowActions] = useState(false)
  const [swipeX, setSwipeX] = useState(0)
  const haptic = useHaptic()

  const longPress = useLongPress(
    () => { haptic.longPress(); setShowActions(true) },
    { delay: 450 }
  )

  const timestamp = message.createdAt
    ? formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })
    : ''

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        style={{
          display: 'flex',
          flexDirection: isOwn ? 'row-reverse' : 'row',
          alignItems: 'flex-end',
          gap: 8,
          padding: '2px 12px',
          maxWidth: '100%',
          transform: `translateX(${swipeX}px)`,
          transition: swipeX === 0 ? 'transform 0.3s var(--ease-spring)' : 'none',
        }}
      >
        {/* Avatar */}
        {!isOwn && showAvatar && (
          <Avatar name={message.author?.displayName || message.author?.username} size={28} />
        )}
        {!isOwn && !showAvatar && <div style={{ width: 28, flexShrink: 0 }} />}

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isOwn ? 'flex-end' : 'flex-start',
          maxWidth: 'min(75%, 320px)',
          gap: 2,
        }}>
          {/* Author + time */}
          {showAvatar && !isOwn && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, paddingLeft: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                {message.author?.displayName || message.author?.username}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timestamp}</span>
            </div>
          )}

          {/* Reply preview */}
          {message.replyTo && (
            <div style={{
              background: 'var(--bg-elevated)',
              borderLeft: '2px solid var(--accent)',
              borderRadius: '6px 6px 0 0',
              padding: '4px 8px',
              fontSize: 11,
              color: 'var(--text-secondary)',
              maxWidth: '100%',
            }}>
              <div className="truncate">{message.replyTo.content}</div>
            </div>
          )}

          {/* Bubble */}
          <div
            {...longPress}
            style={{
              background: isOwn
                ? 'linear-gradient(135deg, var(--accent), #9370ff)'
                : 'var(--bg-elevated)',
              borderRadius: isOwn
                ? '18px 18px 4px 18px'
                : '18px 18px 18px 4px',
              padding: '10px 14px',
              fontSize: 15,
              lineHeight: 1.45,
              color: isOwn ? '#fff' : 'var(--text-primary)',
              wordBreak: 'break-word',
              position: 'relative',
              cursor: 'pointer',
              boxShadow: isOwn ? '0 2px 12px rgba(124,92,252,0.3)' : 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            {message.content}

            {/* Status indicators for own messages */}
            {isOwn && (
              <span style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.6)',
                marginLeft: 6,
                verticalAlign: 'bottom',
              }}>
                {message.read ? '✓✓' : '✓'}
              </span>
            )}
          </div>

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {message.reactions.map((r, i) => (
                <button key={i} onClick={() => onReact?.(r.emoji)} style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '2px 6px',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  color: 'var(--text-secondary)',
                }}>
                  {r.emoji} <span>{r.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Timestamp for own */}
          {isOwn && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timestamp}</span>
          )}
        </div>
      </motion.div>

      {/* Message Actions Sheet */}
      <BottomSheet
        open={showActions}
        onClose={() => setShowActions(false)}
        title="Message"
      >
        {/* Reactions row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          padding: '8px 16px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          {REACTIONS.map(emoji => (
            <button key={emoji} onClick={() => {
              onReact?.(emoji)
              setShowActions(false)
              haptic.success()
            }} style={{
              fontSize: 28,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
            }}>
              {emoji}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ padding: '8px 0 8px' }}>
          {[
            { icon: '↩️', label: 'Reply', action: () => { onReply?.(message); setShowActions(false) } },
            { icon: '📋', label: 'Copy Text', action: () => {
              navigator.clipboard?.writeText(message.content)
              setShowActions(false)
              haptic.success()
            }},
            ...(isOwn ? [{ icon: '🗑️', label: 'Delete', danger: true, action: () => {
              onDelete?.(message.id)
              setShowActions(false)
            }}] : []),
          ].map(item => (
            <button key={item.label} onClick={item.action} style={{
              width: '100%',
              padding: '14px 20px',
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontSize: 15,
              color: item.danger ? 'var(--danger)' : 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
            }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  )
}
