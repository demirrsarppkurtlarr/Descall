import { useCallback } from 'react'

const DB_NAME = 'descall_offline'
const DB_VERSION = 1

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: 'id' })
        store.createIndex('channel', 'channelId', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'channelId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function useLocalCache() {
  const cacheMessages = useCallback(async (channelId, messages) => {
    try {
      const db = await openDB()
      const tx = db.transaction('messages', 'readwrite')
      const store = tx.objectStore('messages')
      for (const msg of messages) {
        store.put({ ...msg, channelId })
      }
    } catch {}
  }, [])

  const getCachedMessages = useCallback(async (channelId) => {
    try {
      const db = await openDB()
      const tx = db.transaction('messages', 'readonly')
      const index = tx.objectStore('messages').index('channel')
      return new Promise((resolve) => {
        const req = index.getAll(channelId)
        req.onsuccess = () => resolve(req.result || [])
        req.onerror = () => resolve([])
      })
    } catch { return [] }
  }, [])

  const saveDraft = useCallback(async (channelId, text) => {
    try {
      const db = await openDB()
      const tx = db.transaction('drafts', 'readwrite')
      tx.objectStore('drafts').put({ channelId, text, updatedAt: Date.now() })
    } catch {}
  }, [])

  const getDraft = useCallback(async (channelId) => {
    try {
      const db = await openDB()
      const tx = db.transaction('drafts', 'readonly')
      return new Promise((resolve) => {
        const req = tx.objectStore('drafts').get(channelId)
        req.onsuccess = () => resolve(req.result?.text || '')
        req.onerror = () => resolve('')
      })
    } catch { return '' }
  }, [])

  return { cacheMessages, getCachedMessages, saveDraft, getDraft }
}
