// WebSocket client for real-time updates
import {
  WebSocketMessage,
  TokenUpdate,
  Alert,
  ConnectionState,
  WS_EVENTS,
  WSEventType
} from './types';

export type WebSocketEventHandler = (data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private eventHandlers: Map<WSEventType, Set<WebSocketEventHandler>> = new Map();
  private connectionState: ConnectionState = {
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0,
  };
  private reconnectInterval: number = 5000; // 5 seconds
  private maxReconnectAttempts: number = 10;
  private reconnectTimeoutId: number | null = null;
  private heartbeatInterval: number | null = null;
  private isManualClose: boolean = false;

  constructor(baseURL = 'localhost:3000') {
    // Convert HTTP URL to WebSocket URL
    this.url = baseURL.startsWith('ws')
      ? `${baseURL}/ws`
      : `ws://${baseURL.replace(/^https?:\/\//, '')}/ws`;
  }

  // Connection management
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connectionState.isConnected || this.connectionState.isConnecting) {
        resolve();
        return;
      }

      this.connectionState.isConnecting = true;
      this.isManualClose = false;
      this.updateConnectionState();

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected to', this.url);
          this.connectionState = {
            isConnected: true,
            isConnecting: false,
            lastConnected: new Date(),
            reconnectAttempts: 0,
          };
          this.updateConnectionState();
          this.startHeartbeat();
          this.emit(WS_EVENTS.CONNECT, { timestamp: new Date().toISOString() });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('[WebSocket] Connection closed:', event.code, event.reason);
          this.cleanup();

          if (!this.isManualClose && this.shouldReconnect()) {
            this.scheduleReconnect();
          }

          this.emit(WS_EVENTS.DISCONNECT, {
            code: event.code,
            reason: event.reason,
            timestamp: new Date().toISOString()
          });
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          this.connectionState.error = 'Connection error';
          this.updateConnectionState();

          if (this.connectionState.isConnecting) {
            reject(new Error('Failed to connect to WebSocket'));
          }
        };

      } catch (error) {
        this.connectionState.isConnecting = false;
        this.connectionState.error = (error as Error).message;
        this.updateConnectionState();
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.isManualClose = true;
    this.cleanup();

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
  }

  private cleanup(): void {
    this.connectionState.isConnected = false;
    this.connectionState.isConnecting = false;
    this.updateConnectionState();

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }

  private shouldReconnect(): boolean {
    return this.connectionState.reconnectAttempts < this.maxReconnectAttempts;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }

    const delay = Math.min(
      this.reconnectInterval * Math.pow(2, this.connectionState.reconnectAttempts),
      30000 // Max 30 seconds
    );

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.connectionState.reconnectAttempts + 1})`);

    this.reconnectTimeoutId = window.setTimeout(() => {
      this.connectionState.reconnectAttempts++;
      this.connect().catch(() => {
        if (this.shouldReconnect()) {
          this.scheduleReconnect();
        }
      });
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send('ping', {});
      }
    }, 30000); // 30 seconds
  }

  private handleMessage(message: WebSocketMessage): void {
    const { type, data } = message;

    // Handle system messages
    if (type === 'connection_status') {
      this.connectionState = { ...this.connectionState, ...data };
      this.updateConnectionState();
      return;
    }

    // Emit to registered handlers
    this.emit(type, data);
  }

  private emit(event: WSEventType, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[WebSocket] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  private updateConnectionState(): void {
    // Store connection state in memory for coordination with other agents
    const state = {
      ...this.connectionState,
      url: this.url,
      timestamp: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('ws_connection_state', JSON.stringify(state));

      // Dispatch custom event for other components
      window.dispatchEvent(new CustomEvent('ws-connection-change', {
        detail: state
      }));
    }
  }

  // Event subscription
  on(event: WSEventType, handler: WebSocketEventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  off(event: WSEventType, handler: WebSocketEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  // Send message
  send(type: string, data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = {
        type,
        data,
        timestamp: new Date().toISOString(),
      };
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send message - not connected');
    }
  }

  // Subscription helpers
  subscribeToToken(address: string): void {
    this.send(WS_EVENTS.SUBSCRIBE_TOKEN, { address });
  }

  unsubscribeFromToken(address: string): void {
    this.send(WS_EVENTS.UNSUBSCRIBE_TOKEN, { address });
  }

  subscribeToAlerts(): void {
    this.send(WS_EVENTS.SUBSCRIBE_ALERTS, {});
  }

  unsubscribeFromAlerts(): void {
    this.send(WS_EVENTS.UNSUBSCRIBE_ALERTS, {});
  }

  // Getters
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  isConnected(): boolean {
    return this.connectionState.isConnected;
  }

  getUrl(): string {
    return this.url;
  }

  setUrl(url: string): void {
    if (this.connectionState.isConnected) {
      console.warn('[WebSocket] Cannot change URL while connected');
      return;
    }

    this.url = url.startsWith('ws')
      ? `${url}/ws`
      : `ws://${url.replace(/^https?:\/\//, '')}/ws`;
  }
}

// Create singleton instance
export const wsClient = new WebSocketClient();

// Export for testing or custom instances
export { WebSocketClient };

// Utility hooks for React components
export const useWebSocketConnection = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(wsClient.getConnectionState());

  useEffect(() => {
    const handleConnectionChange = (event: CustomEvent) => {
      setConnectionState(event.detail);
    };

    window.addEventListener('ws-connection-change', handleConnectionChange as EventListener);

    return () => {
      window.removeEventListener('ws-connection-change', handleConnectionChange as EventListener);
    };
  }, []);

  return connectionState;
};

// React hook for WebSocket events
export const useWebSocketEvent = (event: WSEventType, handler: WebSocketEventHandler) => {
  useEffect(() => {
    const unsubscribe = wsClient.on(event, handler);
    return unsubscribe;
  }, [event, handler]);
};

// Import React hooks if available
let useState: any, useEffect: any;
try {
  const React = require('react');
  useState = React.useState;
  useEffect = React.useEffect;
} catch {
  // React not available, hooks will be undefined
}