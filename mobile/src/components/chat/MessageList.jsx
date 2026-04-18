import { useEffect, useRef, useState, useCallback, memo } from 'react'
import MessageBubble from '../shared/MessageBubble'
import TypingIndicator from '../shared/TypingIndicator'
import { useAuth } from '../../contexts/AuthContext'

const VIRTUAL_CHUNK = 50 // Render this many messages at a time

const DateDivider = memo(({ date }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 16px',
    margin: '4px 0',
  }}>
    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
      {date}
    </span>
    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
  </div>
))

function getDateLabel(date) {
  const d = new Date(date)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function MessageList({ messages = [], typingUsers = [], onReply, onDelete, onReact, onLoadMore, hasMore }) {
  const { user } = useAuth()
  const bottomRef = useRef(null)
  const containerRef = useRef(null)
  const [atBottom, setAtBottom] = useState(true)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [loading, setLoading] = useState(false)
  const prevScrollHeight = useRef(0)
  const prevMessageCount = useRef(0)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (atBottom && messages.length !== prevMessageCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMessageCount.current = messages.length
  }, [messages, atBottom])

  // Detect if user is at bottom
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const threshold = 100
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    setAtBottom(isAtBottom)
    setShowScrollBtn(!isAtBottom && el.scrollHeight - el.scrollTop > 600)

    // Load more when near top
    if (el.scrollTop < 100 && hasMore && !loading) {
      prevScrollHeight.current = el.scrollHeight
      setLoading(true)
      onLoadMore?.().finally(() => {
        setLoading(false)
        // Restore scroll position
        requestAnimationFrame(() => {
          const newScrollHeight = el.scrollHeight
          el.scrollTop = newScrollHeight - prevScrollHeight.current
        })
      })
    }
  }, [hasMore, loading, onLoadMore])

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setAtBottom(true)
  }

  // Group messages by date and consecutive authors
  const grouped = []
  let lastDate = null
  let lastAuthorId = null

  messages.forEach((msg, i) => {
    const date = getDateLabel(msg.createdAt || Date.now())
    if (date !== lastDate) {
      grouped.push({ type: 'date', date })
      lastDate = date
    }
    const showAvatar = msg.author?.id !== lastAuthorId ||
      (i > 0 && getDateLabel(messages[i-1]?.createdAt) !== date)
    grouped.push({ type: 'message', msg, showAvatar })
    lastAuthorId = msg.author?.id
  })

  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="scrollable"
        style={{
          height: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        {/* Load more indicator */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 12 }}>
            <div style={{
              display: 'inline-block',
              width: 20,
              height: 20,
              border: '2px solid var(--border)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }} />
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: 'var(--text-muted)',
            padding: 32,
          }}>
            <div style={{ fontSize: 48 }}>💬</div>
            <div style={{ fontWeight: 600 }}>No messages yet</div>
            <div style={{ fontSize: 13 }}>Be the first to say something!</div>
          </div>
        )}

        {/* Messages */}
        {grouped.map((item, i) => {
          if (item.type === 'date') {
            return <DateDivider key={`date-${i}`} date={item.date} />
          }
          return (
            <MessageBubble
              key={item.msg.id || i}
              message={item.msg}
              isOwn={item.msg.author?.id === user?.id || item.msg.authorId === user?.id}
              showAvatar={item.showAvatar}
              onReply={onReply}
              onDelete={onDelete}
              onReact={onReact}
            />
          )
        })}

        {/* Typing indicator */}
        <TypingIndicator users={typingUsers} />

        <div ref={bottomRef} style={{ height: 1 }} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--accent)',
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
            zIndex: 5,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      )}
    </div>
  )
}
