import { useState, useEffect } from 'react'

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [connectionType, setConnectionType] = useState(null)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Network Information API (where supported)
    const nav = navigator
    if (nav.connection) {
      const updateType = () => setConnectionType(nav.connection.effectiveType)
      nav.connection.addEventListener('change', updateType)
      updateType()
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
        nav.connection.removeEventListener('change', updateType)
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { online, connectionType }
}
