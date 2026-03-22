import type { WSEvent } from './types'

type EventHandler = (event: WSEvent) => void

class HermesWebSocket {
  private ws: WebSocket | null = null
  private handlers: Map<string, Set<EventHandler>> = new Map()
  private globalHandlers: Set<EventHandler> = new Set()
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private maxReconnectDelay = 30000
  private shouldReconnect = false

  connect(token: string): void {
    this.shouldReconnect = true
    this.reconnectDelay = 1000
    this._connect(token)
  }

  disconnect(): void {
    this.shouldReconnect = false
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  on(type: string, handler: EventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
    return () => this.handlers.get(type)?.delete(handler)
  }

  onAny(handler: EventHandler): () => void {
    this.globalHandlers.add(handler)
    return () => this.globalHandlers.delete(handler)
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private _connect(token: string): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/ws`

    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.ws?.send(JSON.stringify({ type: 'auth', token }))
      this.reconnectDelay = 1000
    }

    this.ws.onmessage = (event) => {
      try {
        const data: WSEvent = JSON.parse(event.data)
        this._dispatch(data)
      } catch {
        // ignore parse errors
      }
    }

    this.ws.onclose = () => {
      if (this.shouldReconnect) {
        this.reconnectTimeout = setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
          this._connect(token)
        }, this.reconnectDelay)
      }
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  private _dispatch(event: WSEvent): void {
    const typeHandlers = this.handlers.get(event.type)
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        handler(event)
      }
    }
    for (const handler of this.globalHandlers) {
      handler(event)
    }
  }
}

export const ws = new HermesWebSocket()
