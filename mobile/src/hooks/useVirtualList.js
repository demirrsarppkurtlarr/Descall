import { useState, useEffect, useRef, useCallback } from 'react'

const DEFAULT_ITEM_HEIGHT = 72
const OVERSCAN = 5

export function useVirtualList({ items, containerRef, estimatedItemHeight = DEFAULT_ITEM_HEIGHT }) {
  const [range, setRange] = useState({ start: 0, end: 30 })
  const heightCache = useRef(new Map())
  const offsetCache = useRef([])
  const totalHeight = useRef(0)

  // Build offset cache
  const buildOffsets = useCallback(() => {
    let offset = 0
    const offsets = []
    for (let i = 0; i < items.length; i++) {
      offsets.push(offset)
      offset += heightCache.current.get(i) || estimatedItemHeight
    }
    offsetCache.current = offsets
    totalHeight.current = offset
  }, [items.length, estimatedItemHeight])

  useEffect(() => { buildOffsets() }, [buildOffsets])

  // Recalculate visible range on scroll
  const updateRange = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const scrollTop = el.scrollTop
    const viewHeight = el.clientHeight
    const offsets = offsetCache.current

    let start = 0
    let end = items.length

    // Binary search for start
    let lo = 0, hi = offsets.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (offsets[mid] < scrollTop - OVERSCAN * estimatedItemHeight) lo = mid + 1
      else hi = mid
    }
    start = Math.max(0, lo - OVERSCAN)

    // Find end
    let j = lo
    while (j < items.length && offsets[j] < scrollTop + viewHeight + OVERSCAN * estimatedItemHeight) j++
    end = Math.min(items.length, j + OVERSCAN)

    setRange({ start, end })
  }, [items.length, estimatedItemHeight, containerRef])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('scroll', updateRange, { passive: true })
    updateRange()
    return () => el.removeEventListener('scroll', updateRange)
  }, [updateRange])

  const measureItem = useCallback((index, height) => {
    if (heightCache.current.get(index) === height) return
    heightCache.current.set(index, height)
    buildOffsets()
  }, [buildOffsets])

  const visibleItems = items.slice(range.start, range.end).map((item, i) => ({
    item,
    index: range.start + i,
    offsetTop: offsetCache.current[range.start + i] || 0,
  }))

  return {
    visibleItems,
    totalHeight: totalHeight.current,
    measureItem,
    paddingTop: offsetCache.current[range.start] || 0,
    paddingBottom: totalHeight.current - (offsetCache.current[range.end] || totalHeight.current),
  }
}
