import { useState, useCallback, useEffect, useRef } from 'react'

interface UseResizableOptions {
  key: string
  initialSize: number
  minSize: number
  maxSize: number
  direction?: 'horizontal' | 'vertical'
  reverse?: boolean
}

export function useResizable({
  key,
  initialSize,
  minSize,
  maxSize,
  direction = 'horizontal',
  reverse = false
}: UseResizableOptions) {
  const [size, setSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`mechon_panel_${key}`)
      if (saved !== null) {
        const parsed = Number(saved)
        if (!isNaN(parsed) && parsed >= minSize && parsed <= maxSize) {
          return parsed
        }
      }
    } catch {
      // ignore localStorage errors
    }
    return initialSize
  })

  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ startPos: number; startSize: number } | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    const currentPos = direction === 'horizontal' ? e.clientX : e.clientY
    dragStartRef.current = { startPos: currentPos, startSize: size }
  }, [direction, size])

  const handleDoubleClick = useCallback(() => {
    setSize(initialSize)
    try {
      localStorage.removeItem(`mechon_panel_${key}`)
    } catch {}
  }, [initialSize, key])

  const resetToDefault = useCallback(() => {
    setSize(initialSize)
    try {
      localStorage.removeItem(`mechon_panel_${key}`)
    } catch {}
  }, [initialSize, key])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY
      const delta = reverse
        ? dragStartRef.current.startPos - currentPos
        : currentPos - dragStartRef.current.startPos
      const newSize = Math.max(minSize, Math.min(maxSize, dragStartRef.current.startSize + delta))
      setSize(newSize)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, direction, reverse, minSize, maxSize])

  useEffect(() => {
    try {
      localStorage.setItem(`mechon_panel_${key}`, String(size))
    } catch {}
  }, [size, key])

  return {
    size,
    isDragging,
    handleMouseDown,
    handleDoubleClick,
    resetToDefault
  }
}
