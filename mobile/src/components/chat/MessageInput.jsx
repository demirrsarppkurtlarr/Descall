import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useHaptic } from '../../hooks/useMobile'

export default function MessageInput({ onSend, onTyping, replyTo, onCancelReply, placeholder = 'Message…' }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef(null)
  const typingTimeout = useRef(null)
  const haptic = useHaptic()

  const handleChange = (e) => {
    setText(e.target.value)
    // Auto-resize textarea
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    // Typing indicator debounce
    onTyping?.(true)
    clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => onTyping?.(false), 1500)
  }

  const handleSend = useCallback(async () => {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    haptic.success()
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    try {
      await onSend(content, replyTo?.id)
    } finally {
      setSending(false)
      onCancelReply?.()
    }
  }, [text, sending, onSend, replyTo, haptic, onCancelReply])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Keep input visible when keyboard appears
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const handleFocus = () => {
      setTimeout(() => el.scrollIntoView({ block: 'nearest' }), 300)
    }
    el.addEventListener('focus', handleFocus)
    return () => el.removeEventListener('focus', handleFocus)
  }, [])

  const canSend = text.trim().length > 0 && !sending

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border)',
      paddingBottom: 'calc(var(--sab) + 4px)',
      flexShrink: 0,
    }}>
      {/* Reply preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{
              overflow: 'hidden',
              borderBottom: '1px solid var(--border)',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{
              width: 3,
              height: 32,
              background: 'var(--accent)',
              borderRadius: 2,
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                Reply to {replyTo.author?.displayName}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }} className="truncate">
                {replyTo.content}
              </div>
            </div>
            <button onClick={onCancelReply} style={{
              color: 'var(--text-muted)',
              background: 'none',
              border: 'none',
              fontSize: 18,
              lineHeight: 1,
              padding: 4,
              cursor: 'pointer',
            }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input row */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        padding: '8px 12px',
      }}>
        {/* Attachment button */}
        <button
          onClick={() => haptic.tap()}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--bg-elevated)',
            border: 'none',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>

        {/* Text input */}
        <div style={{
          flex: 1,
          background: 'var(--bg-elevated)',
          borderRadius: 22,
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-end',
          padding: '0 12px',
          minHeight: 42,
          transition: 'border-color 0.2s',
        }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: 15,
              lineHeight: 1.5,
              color: 'var(--text-primary)',
              padding: '10px 0',
              maxHeight: 120,
              overflow: 'auto',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        {/* Send button */}
        <motion.button
          animate={{
            scale: canSend ? 1 : 0.85,
            opacity: canSend ? 1 : 0.5,
          }}
          whileTap={{ scale: 0.9 }}
          onClick={handleSend}
          disabled={!canSend}
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: canSend
              ? 'linear-gradient(135deg, var(--accent), #9370ff)'
              : 'var(--bg-elevated)',
            border: 'none',
            color: canSend ? '#fff' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: canSend ? 'pointer' : 'default',
            boxShadow: canSend ? '0 2px 12px rgba(124,92,252,0.4)' : 'none',
            transition: 'box-shadow 0.2s, background 0.2s',
          }}
        >
          {sending ? (
            <div style={{
              width: 16,
              height: 16,
              border: '2px solid rgba(255,255,255,0.4)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          )}
        </motion.button>
      </div>
    </div>
  )
}
