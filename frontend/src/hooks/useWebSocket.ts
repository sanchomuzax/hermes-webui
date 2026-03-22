import { useEffect, useCallback, useState } from 'react'
import { ws } from '../api/websocket'
import type { WSEvent } from '../api/types'

export function useWebSocket(token: string | null) {
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState<WSEvent[]>([])

  useEffect(() => {
    if (!token) return

    ws.connect(token)

    const unsub = ws.onAny((event) => {
      if (event.type === 'auth:ok') {
        setConnected(true)
      }
      setEvents((prev) => [event, ...prev].slice(0, 100))
    })

    return () => {
      unsub()
      ws.disconnect()
      setConnected(false)
    }
  }, [token])

  const subscribe = useCallback(
    (type: string, handler: (event: WSEvent) => void) => {
      return ws.on(type, handler)
    },
    []
  )

  return { connected, events, subscribe }
}
