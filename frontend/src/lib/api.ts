import { Token, Alert, ChartData } from "@/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export class ApiClient {
  private baseUrl: string
  private socket: WebSocket | null = null

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  // Token API methods
  async getTokens(filters?: Record<string, any>): Promise<Token[]> {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
    }

    const url = `${this.baseUrl}/api/tokens${params.toString() ? `?${params}` : ""}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch tokens: ${response.statusText}`)
    }

    return response.json()
  }

  async getToken(id: string): Promise<Token> {
    const response = await fetch(`${this.baseUrl}/api/tokens/${id}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch token: ${response.statusText}`)
    }

    return response.json()
  }

  async getTokenChart(id: string, timeframe: string = "24h"): Promise<ChartData[]> {
    const response = await fetch(`${this.baseUrl}/api/tokens/${id}/chart?timeframe=${timeframe}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch chart data: ${response.statusText}`)
    }

    return response.json()
  }

  // Alert API methods
  async getAlerts(): Promise<Alert[]> {
    const response = await fetch(`${this.baseUrl}/api/alerts`)

    if (!response.ok) {
      throw new Error(`Failed to fetch alerts: ${response.statusText}`)
    }

    return response.json()
  }

  async createAlert(alert: Omit<Alert, "id" | "createdAt" | "triggered">): Promise<Alert> {
    const response = await fetch(`${this.baseUrl}/api/alerts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(alert),
    })

    if (!response.ok) {
      throw new Error(`Failed to create alert: ${response.statusText}`)
    }

    return response.json()
  }

  // WebSocket connection for real-time updates
  connectWebSocket(onMessage: (data: any) => void, onError?: (error: Event) => void): void {
    if (this.socket) {
      this.socket.close()
    }

    const wsUrl = this.baseUrl.replace("http", "ws") + "/ws"
    this.socket = new WebSocket(wsUrl)

    this.socket.onopen = () => {
      console.log("WebSocket connected")
    }

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage(data)
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error)
      }
    }

    this.socket.onclose = () => {
      console.log("WebSocket disconnected")
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (this.socket?.readyState === WebSocket.CLOSED) {
          this.connectWebSocket(onMessage, onError)
        }
      }, 5000)
    }

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error)
      onError?.(error)
    }
  }

  disconnectWebSocket(): void {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  // Export data
  async exportTokenData(filters?: Record<string, any>, format: "csv" | "json" = "csv"): Promise<Blob> {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
    }
    params.append("format", format)

    const response = await fetch(`${this.baseUrl}/api/export?${params}`)

    if (!response.ok) {
      throw new Error(`Failed to export data: ${response.statusText}`)
    }

    return response.blob()
  }
}

export const apiClient = new ApiClient()