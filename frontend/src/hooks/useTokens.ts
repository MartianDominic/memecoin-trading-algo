import { useState, useEffect, useCallback } from "react"
import { Token } from "@/types"
import { apiClient } from "@/lib/api"

interface TokenFilters {
  [key: string]: string | number | boolean | undefined
}

interface WebSocketMessage {
  type: 'token_update' | 'new_token' | 'error'
  token?: Token
  message?: string
}

export function useTokens(filters?: TokenFilters) {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTokens = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiClient.getTokens(filters)
      setTokens(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tokens")
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchTokens()
  }, [fetchTokens])

  // Set up WebSocket for real-time updates
  useEffect(() => {
    const handleWebSocketMessage = (data: WebSocketMessage) => {
      if (data.type === "token_update" && data.token) {
        setTokens(prev =>
          prev.map(token =>
            token.id === data.token!.id ? { ...token, ...data.token } : token
          )
        )
      } else if (data.type === "new_token" && data.token) {
        setTokens(prev => [data.token!, ...prev])
      }
    }

    apiClient.connectWebSocket(handleWebSocketMessage)

    return () => {
      apiClient.disconnectWebSocket()
    }
  }, [])

  return {
    tokens,
    loading,
    error,
    refetch: fetchTokens,
  }
}

export function useToken(id: string) {
  const [token, setToken] = useState<Token | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    const fetchToken = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await apiClient.getToken(id)
        setToken(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch token")
      } finally {
        setLoading(false)
      }
    }

    fetchToken()
  }, [id])

  return { token, loading, error }
}