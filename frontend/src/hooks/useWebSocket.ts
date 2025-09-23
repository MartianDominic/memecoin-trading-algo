'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useTokenStore } from '@/stores/useTokenStore'
import { Token, Alert } from '@/types'

interface WebSocketMessage {
  type: 'token_update' | 'new_token' | 'alert' | 'ping' | 'error'
  data?: Token | Token[] | Alert | string
  timestamp: number
}

interface UseWebSocketOptions {
  url?: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
}

export function useWebSocket({
  url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws',
  reconnectInterval = 5000,
  maxReconnectAttempts = 10,
  onOpen,
  onClose,
  onError,
}: UseWebSocketOptions = {}) {
  const websocket = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimeoutId = useRef<NodeJS.Timeout | null>(null)

  const {
    setConnected,
    updateLastUpdate,
    setTokens,
    tokens,
    setAlerts,
    alerts,
  } = useTokenStore()

  const connect = useCallback(() => {
    try {
      websocket.current = new WebSocket(url)

      websocket.current.onopen = () => {
        console.log('WebSocket connected')
        setConnected(true)
        reconnectAttempts.current = 0
        onOpen?.()
      }

      websocket.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          updateLastUpdate()

          switch (message.type) {
            case 'token_update':
              if (message.data && typeof message.data === 'object' && !Array.isArray(message.data)) {
                const updatedToken = message.data as Token
                const updatedTokens = tokens.map(token =>
                  token.id === updatedToken.id ? updatedToken : token
                )
                setTokens(updatedTokens)
              }
              break

            case 'new_token':
              if (message.data && typeof message.data === 'object' && !Array.isArray(message.data)) {
                const newToken = message.data as Token
                setTokens([newToken, ...tokens])
              }
              break

            case 'alert':
              if (message.data && typeof message.data === 'object') {
                const newAlert = message.data as Alert
                setAlerts([newAlert, ...alerts])
              }
              break

            case 'ping':
              // Respond to ping to keep connection alive
              if (websocket.current?.readyState === WebSocket.OPEN) {
                websocket.current.send(JSON.stringify({ type: 'pong' }))
              }
              break

            case 'error':
              console.error('WebSocket server error:', message.data)
              break

            default:
              console.warn('Unknown WebSocket message type:', message.type)
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      websocket.current.onclose = () => {
        console.log('WebSocket disconnected')
        setConnected(false)
        onClose?.()

        // Attempt to reconnect if we haven't exceeded max attempts
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++
          console.log(`Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})...`)

          reconnectTimeoutId.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        } else {
          console.error('Max reconnection attempts reached')
        }
      }

      websocket.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        onError?.(error)
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
    }
  }, [url, setConnected, updateLastUpdate, setTokens, tokens, setAlerts, alerts, maxReconnectAttempts, reconnectInterval, onOpen, onClose, onError])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current)
      reconnectTimeoutId.current = null
    }

    if (websocket.current) {
      websocket.current.close()
      websocket.current = null
    }

    setConnected(false)
    reconnectAttempts.current = 0
  }, [setConnected])

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (websocket.current?.readyState === WebSocket.OPEN) {
      websocket.current.send(JSON.stringify(message))
      return true
    }
    return false
  }, [])

  const isConnected = websocket.current?.readyState === WebSocket.OPEN

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    connect,
    disconnect,
    sendMessage,
    isConnected,
    reconnectAttempts: reconnectAttempts.current,
  }
}