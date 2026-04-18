import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useOutletContext } from 'react-router-dom'
import ChatHeader from '../components/chat/ChatHeader'
import MessageList from '../components/chat/MessageList'
import MessageInput from '../components/chat/MessageInput'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../hooks/useSocket'
import { useNotifications } from '../contexts/NotificationContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function ChatScreen() {
  const { channelId } = useParams()
  const { openDrawer } = useOutletContext() || {}
  const { user, token, authFetch } = useAuth()
  const { push, markRead } = useNotifications()
  const { on, emit, connected } = useSocket(token)

  const [messages, setMessages] = useState([])
  const [typingUsers, setTypingUsers] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [replyTo, setReplyTo] = useState(null)
  const [channel, setChannel] = useState(null)
  const [members, setMembers] = useState(0)
  const isTyping = useRef(false)

  const channelName = channelId || 'general'

  // Fetch channel info + initial messages
  useEffect(() => {
    setMessages([])
    setHasMore(true)
    markRead(channelId)

    authFetch(`/api/channels/${channelName}/messages?limit=50`)
      .then(r => r.ok ? r.json() : { messages: [], total: 0 })
      .then(data => {
        setMessages(data.messages || [])
        setHasMore((data.messages?.length || 0) < (data.total || 0))
      })
      .catch(() => {})

    authFetch(`/api/channels/${channelName}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) { setChannel(data); setMembers(data.memberCount || 0) }
      })
      .catch(() => {})
  }, [channelName])

  // Socket events
  useEffect(() => {
    if (!connected) return

    emit('channel:join', channelName)

    const unsubs = [
      on(`channel:${channelName}:message`, (msg) => {
        setMessages(prev => [...prev, msg])
        if (msg.author?.id !== user?.id) {
          push({
            title: msg.author?.displayName || msg.author?.username,
            body: msg.content,
            avatar: msg.author?.displayName?.[0] || '?',
          })
        }
      }),
      on(`channel:${channelName}:typing`, ({ username, typing }) => {
        setTypingUsers(prev =>
          typing
            ? prev.includes(username) ? prev : [...prev, username]
            : prev.filter(u => u !== username)
        )
      }),
      on(`channel:${channelName}:message:delete`, ({ id }) => {
        setMessages(prev => prev.filter(m => m.id !== id))
      }),
    ]

    return () => {
      emit('channel:leave', channelName)
      unsubs.forEach(u => u?.())
    }
  }, [connected, channelName, user?.id])

  const handleSend = useCallback(async (content, replyToId) => {
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
      const r = await authFetch(`/api/channels/${channelName}/messages`, {
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
  }, [channelName, user, authFetch])

  const handleTyping = useCallback((typing) => {
    if (typing === isTyping.current) return
    isTyping.current = typing
    emit('typing', { channel: channelName, typing })
  }, [channelName, emit])

  const handleLoadMore = useCallback(async () => {
    const oldest = messages[0]?.createdAt
    if (!oldest) return
    const r = await authFetch(`/api/channels/${channelName}/messages?before=${oldest}&limit=30`)
    if (r.ok) {
      const data = await r.json()
      if (data.messages?.length) {
        setMessages(prev => [...data.messages, ...prev])
        if (data.messages.length < 30) setHasMore(false)
      } else {
        setHasMore(false)
      }
    }
  }, [messages, channelName, authFetch])

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
        title={`#${channelName}`}
        subtitle={channel?.topic || 'Channel'}
        isChannel
        members={members}
        onMenuPress={openDrawer}
      />

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
        placeholder={`Message #${channelName}`}
      />
    </div>
  )
}
