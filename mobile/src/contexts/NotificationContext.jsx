import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { useHaptic } from '../hooks/useMobile'

const NotifContext = createContext(null)

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState({}) // { roomId: count }
  const haptic = useHaptic()
  const idRef = useRef(0)

  const push = useCallback((notif) => {
    const id = ++idRef.current
    const n = { id, timestamp: Date.now(), duration: 4000, ...notif }
    setNotifications(prev => [n, ...prev.slice(0, 4)])
    haptic.notification()

    if (n.duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(x => x.id !== id))
      }, n.duration)
    }
  }, [haptic])

  const dismiss = useCallback((id) => {
    setNotifications(prev => prev.filter(x => x.id !== id))
  }, [])

  const markRead = useCallback((roomId) => {
    setUnread(prev => { const n = { ...prev }; delete n[roomId]; return n })
  }, [])

  const addUnread = useCallback((roomId) => {
    setUnread(prev => ({ ...prev, [roomId]: (prev[roomId] || 0) + 1 }))
  }, [])

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0)

  return (
    <NotifContext.Provider value={{ notifications, push, dismiss, unread, addUnread, markRead, totalUnread }}>
      {children}
    </NotifContext.Provider>
  )
}

export const useNotifications = () => useContext(NotifContext)
