"use client"

import * as React from "react"

interface UseLongPressOptions {
  delay?: number
  onLongPress: (event: TouchEvent | MouseEvent, position: { x: number; y: number }) => void
  onPress?: () => void
  onCancel?: () => void
  threshold?: number // movement threshold to cancel in pixels
}

interface UseLongPressReturn {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onMouseDown: (e: React.MouseEvent) => void
  onMouseUp: (e: React.MouseEvent) => void
  onMouseLeave: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  isPressed: boolean
  progress: number // 0-1 for progress indicator
}

function useLongPress({
  delay = 500,
  onLongPress,
  onPress,
  onCancel,
  threshold = 10,
}: UseLongPressOptions): UseLongPressReturn {
  const [isPressed, setIsPressed] = React.useState(false)
  const [progress, setProgress] = React.useState(0)

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const startPositionRef = React.useRef<{ x: number; y: number } | null>(null)
  const isLongPressTriggeredRef = React.useRef(false)
  const touchPositionRef = React.useRef<{ x: number; y: number } | null>(null)

  const clearTimers = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }, [])

  const startPress = React.useCallback(
    (x: number, y: number, event: TouchEvent | MouseEvent) => {
      isLongPressTriggeredRef.current = false
      startPositionRef.current = { x, y }
      touchPositionRef.current = { x, y }
      setIsPressed(true)
      setProgress(0)

      // Start progress animation
      const startTime = Date.now()
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime
        const newProgress = Math.min(elapsed / delay, 1)
        setProgress(newProgress)
      }, 16) // ~60fps

      // Set timer for long press trigger
      timerRef.current = setTimeout(() => {
        isLongPressTriggeredRef.current = true
        clearTimers()
        setProgress(1)

        // Haptic feedback if available
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(50)
          } catch {
            // Vibration not supported or failed
          }
        }

        onLongPress(event, touchPositionRef.current || { x, y })
      }, delay)
    },
    [delay, onLongPress, clearTimers]
  )

  const endPress = React.useCallback(
    (cancelled: boolean = false) => {
      clearTimers()
      setIsPressed(false)
      setProgress(0)

      if (!isLongPressTriggeredRef.current) {
        if (cancelled) {
          onCancel?.()
        } else {
          onPress?.()
        }
      }

      startPositionRef.current = null
      touchPositionRef.current = null
    },
    [clearTimers, onPress, onCancel]
  )

  const checkMovement = React.useCallback(
    (x: number, y: number) => {
      if (!startPositionRef.current) return false

      const deltaX = Math.abs(x - startPositionRef.current.x)
      const deltaY = Math.abs(y - startPositionRef.current.y)

      // Cancel if movement exceeds threshold (user is scrolling)
      if (deltaX > threshold || deltaY > threshold) {
        endPress(true)
        return true
      }
      return false
    },
    [threshold, endPress]
  )

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  const handleTouchStart = React.useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0]
      startPress(touch.clientX, touch.clientY, e.nativeEvent)
    },
    [startPress]
  )

  const handleTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0]
      touchPositionRef.current = { x: touch.clientX, y: touch.clientY }
      checkMovement(touch.clientX, touch.clientY)
    },
    [checkMovement]
  )

  const handleTouchEnd = React.useCallback(
    () => {
      endPress(false)
    },
    [endPress]
  )

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      // Only handle left mouse button
      if (e.button !== 0) return
      startPress(e.clientX, e.clientY, e.nativeEvent)
    },
    [startPress]
  )

  const handleMouseUp = React.useCallback(
    () => {
      endPress(false)
    },
    [endPress]
  )

  const handleMouseLeave = React.useCallback(
    () => {
      if (isPressed) {
        endPress(true)
      }
    },
    [isPressed, endPress]
  )

  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent) => {
      // Prevent default context menu if we're using long press
      // This allows right-click as a fallback on desktop
      e.preventDefault()
      onLongPress(e.nativeEvent, { x: e.clientX, y: e.clientY })
    },
    [onLongPress]
  )

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchMove: handleTouchMove,
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
    onContextMenu: handleContextMenu,
    isPressed,
    progress,
  }
}

export { useLongPress }
export type { UseLongPressOptions, UseLongPressReturn }
