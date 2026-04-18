import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ChatHeader from '../components/chat/ChatHeader'
import MessageList from '../components/chat/MessageList'
import MessageInput from '../components/chat/MessageInput'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../hooks/useSocket'
import { useLocalCache } from '../hooks/useLocalCache'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function DMScreen() {
  const { dmId } = useParams()
  const navigate = useNavigate()
  const { user, token, authFetch } = useAuth()
  const { on, emit, connected } = useSocket(token)
  const { cacheMessages, getCachedMessages, saveDraft, getDraft } = useLocalCache()
  const { online } = useOnlineStatus()

  const [messages, setMessages] = useState([])
  const [typingUsers, setTypingUsers] = useState([])
  const [replyTo, setReplyTo] = useState(null)
  const [partner, setPartner] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const isTyping = useRef(false)

  // Load from cache first for instant display
  useEffect(() => {
    getCachedMessages(`dm:${dmId}`).then(cached => {
      if (cached.length) setMessages(cached)
    })
  }, [dmId])

  // Fetch DM conversation info + messages
  useEffect(() => {
    if (!dmId || dmId === 'new') return

    authFetch(`/api/dm/${dmId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const other = data.participants?.find(p => p.id !== user?.id) || data.user
          setPartner(other)
        }
      })
      .catch(() => {})

    authFetch(`/api/dm/${dmId}/messages?limit=50`)
      .then(r => r.ok ? r.json() : { messages: [] })
      .then(data => {
        const msgs = data.messages || []
        setMessages(msgs)
        setHasMore(msgs.length === 50)
        cacheMessages(`dm:${dmId}`, msgs)
      })
      .catch(() => {})

    getDraft(`dm:${dmId}`).then(() => {})
  }, [dmId, user?.id])

  // Socket events
  useEffect(() => {
    if (!connected || !dmId) return

    emit('dm:join', dmId)

    const unsubs = [
      on(`dm:${dmId}:message`, (msg) => {
        setMessages(prev => [...prev, msg])
      }),
      on(`dm:${dmId}:typing`, ({ username, typing }) => {
        setTypingUsers(prev =>
          typing ? [...new Set([...prev, username])] : prev.filter(u => u !== username)
        )
      }),
    ]

    return () => {
      emit('dm:leave', dmId)
      unsubs.forEach(u => u?.())
    }
  }, [connected, dmId])

  const handleSend = useCallback(async (content, replyToId) => {
    if (!online) return // Offline - queue later

    const tempId = `temp-${Date.now()}`
    const optimistic = {
      id: tempId,
      content,
      author: user,
      authorId: user?.id,
      createdAt: new Date().toISOString(),
      replyToId,
      pending: true,
    }
    setMessages(prev => [...prev, optimistic])

    try {
      const r = await authFetch(`/api/dm/${dmId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, replyToId }),
      })
      if (r.ok) {
        const data = await r.json()
        setMessages(prev => prev.map(m => m.id === tempId ? { ...data.message, pending: false } : m))
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId))
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, error: true, pending: false } : m))
    }
  }, [dmId, user, authFetch, online])

  const handleTyping = useCallback((typing) => {
    if (typing === isTyping.current) return
    isTyping.current = typing
    emit('dm:typing', { dmId, typing })
  }, [dmId, emit])

  const handleLoadMore = useCallback(async () => {
    const oldest = messages[0]?.createdAt
    if (!oldest) return
    const r = await authFetch(`/api/dm/${dmId}/messages?before=${oldest}&limit=30`)
    if (r.ok) {
      const data = await r.json()
      if (data.messages?.length) {
        setMessages(prev => [...data.messages, ...prev])
        if (data.messages.length < 30) setHasMore(false)
      } else {
        setHasMore(false)
      }
    }
  }, [messages, dmId, authFetch])

  const handleDelete = useCallback(async (msgId) => {
    setMessages(prev => prev.filter(m => m.id !== msgId))
    await authFetch(`/api/messages/${msgId}`, { method: 'DELETE' }).catch(() => {})
  }, [authFetch])

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--bg-primary)',
    }}>
      <ChatHeader
        title={partner?.displayName || partner?.username || 'Direct Message'}
        subtitle={partner?.online ? '🟢 Online' : '⚫ Offline'}
        avatar={partner}
        onBack={() => navigate('/dm')}
      />

      {/* Offline banner */}
      {!online && (
        <div style={{
          background: 'rgba(243,156,18,0.15)',
          borderBottom: '1px solid rgba(243,156,18,0.3)',
          padding: '8px 16px',
          fontSize: 12,
          color: 'var(--warning)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}>
          <span>📡</span>
          You're offline. Messages will send when reconnected.
        </div>
      )}

      <MessageList
        messages={messages}
        typingUsers={typingUsers}
        onReply={setReplyTo}
        onDelete={handleDelete}
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
      />

      <MessageInput
        onSend={handleSend}
        onTyping={handleTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        placeholder={`Message ${partner?.displayName || '…'}`}
      />
    </div>
  )
}
