import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function useSocket(token) {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const listeners = useRef(new Map())

  useEffect(() => {
    if (!token) return

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      setReconnecting(false)
    })

    socket.on('disconnect', (reason) => {
      setConnected(false)
      if (reason !== 'io client disconnect') {
        setReconnecting(true)
      }
    })

    socket.on('reconnect_attempt', () => setReconnecting(true))
    socket.on('reconnect', () => { setConnected(true); setReconnecting(false) })

    // Re-register listeners
    listeners.current.forEach((handler, event) => {
      socket.on(event, handler)
    })

    // Handle mobile background/foreground
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !socket.connected) {
        socket.connect()
      }
    }

    // Handle network change
    const handleOnline = () => {
      if (!socket.connected) socket.connect()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)

    return () => {
      socket.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
    }
  }, [token])

  const on = useCallback((event, handler) => {
    listeners.current.set(event, handler)
    socketRef.current?.on(event, handler)
    return () => {
      listeners.current.delete(event)
      socketRef.current?.off(event, handler)
    }
  }, [])

  const emit = useCallback((event, ...args) => {
    socketRef.current?.emit(event, ...args)
  }, [])

  const off = useCallback((event, handler) => {
    listeners.current.delete(event)
    socketRef.current?.off(event, handler)
  }, [])

  return { socket: socketRef.current, connected, reconnecting, on, emit, off }
}
