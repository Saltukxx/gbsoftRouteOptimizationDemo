/**
 * WebSocket service for real-time communication with the backend
 * Handles vehicle tracking, optimization updates, and system events
 */

import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.eventHandlers = new Map();
    this.connectionPromise = null;
    
    // WebSocket URL
    this.wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/live';
  }

  /**
   * Connect to WebSocket server
   */
  async connect() {
    if (this.isConnected || this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        console.log('🔌 Connecting to WebSocket:', this.wsUrl);

        // Create WebSocket connection
        this.socket = new WebSocket(this.wsUrl);

        // Connection opened
        this.socket.onopen = () => {
          console.log('✅ WebSocket connected successfully');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Send initial client info
          this.send({
            type: 'client_info',
            data: {
              userAgent: navigator.userAgent,
              timestamp: Date.now(),
              page: 'route_optimization_demo'
            }
          });

          resolve(true);
        };

        // Message received
        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error);
          }
        };

        // Connection closed
        this.socket.onclose = (event) => {
          console.log('🔌 WebSocket connection closed:', event.code, event.reason);
          this.isConnected = false;
          this.socket = null;
          this.connectionPromise = null;

          // Attempt to reconnect if not intentionally closed
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        // Connection error
        this.socket.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.isConnected = false;
          
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        };

      } catch (error) {
        console.error('❌ Failed to create WebSocket connection:', error);
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting WebSocket...');
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
      this.isConnected = false;
      this.connectionPromise = null;
    }
  }

  /**
   * Send message to server
   */
  send(message) {
    if (this.isConnected && this.socket) {
      try {
        this.socket.send(JSON.stringify(message));
      } catch (error) {
        console.error('❌ Failed to send WebSocket message:', error);
      }
    } else {
      console.warn('⚠️ WebSocket not connected, message not sent:', message);
    }
  }

  /**
   * Handle incoming messages from server
   */
  handleMessage(data) {
    const { type } = data;

    // Emit to registered handlers
    if (this.eventHandlers.has(type)) {
      const handlers = this.eventHandlers.get(type);
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`❌ Error in ${type} handler:`, error);
        }
      });
    }

    // Handle system messages
    switch (type) {
      case 'connection_established':
        console.log('🎉 WebSocket connection established:', data.message);
        break;

      case 'pong':
        // Response to ping
        break;

      case 'vehicle_update':
        console.log('🚛 Vehicle positions updated:', data.vehicles?.length, 'vehicles');
        break;

      case 'optimization_progress':
        console.log('🤖 Optimization progress:', data.progress?.status);
        break;

      case 'simulation_event':
        console.log('📊 Simulation event:', data.event, data.data);
        break;

      case 'ai_learning':
        console.log('🧠 AI learning update:', data.learning_data);
        break;

      case 'system_status':
        console.log('📊 System status received');
        break;

      case 'heartbeat':
        // Server heartbeat - update last seen
        break;

      case 'error':
        console.error('❌ Server error:', data.message);
        break;

      default:
        console.log('📨 Unknown message type:', type, data);
    }
  }

  /**
   * Subscribe to specific event types
   */
  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);

    // Send subscription request for vehicle updates
    if (eventType === 'vehicle_update') {
      this.send({
        type: 'subscribe_vehicle_updates'
      });
    }

    return () => this.off(eventType, handler);
  }

  /**
   * Unsubscribe from event types
   */
  off(eventType, handler) {
    if (this.eventHandlers.has(eventType)) {
      const handlers = this.eventHandlers.get(eventType);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
      if (handlers.length === 0) {
        this.eventHandlers.delete(eventType);
      }
    }
  }

  /**
   * Request current system status
   */
  requestStatus() {
    this.send({
      type: 'request_status'
    });
  }

  /**
   * Send ping to server
   */
  ping() {
    this.send({
      type: 'ping',
      timestamp: Date.now()
    });
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Scheduling WebSocket reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect().catch(error => {
          console.error('❌ WebSocket reconnection failed:', error);
        });
      }
    }, delay);
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      eventHandlers: Array.from(this.eventHandlers.keys())
    };
  }

  /**
   * Start periodic ping to keep connection alive
   */
  startHeartbeat(interval = 30000) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.ping();
      }
    }, interval);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

// Auto-connect when module is imported
let autoConnectPromise = null;

export const connectWebSocket = async () => {
  if (!autoConnectPromise) {
    autoConnectPromise = websocketService.connect();
  }
  return autoConnectPromise;
};

// Export service and commonly used methods
export default websocketService;

export const {
  disconnect,
  send,
  on,
  off,
  requestStatus,
  ping,
  getStatus,
  startHeartbeat,
  stopHeartbeat
} = websocketService;

// Convenience hooks for React components
export const useWebSocket = () => {
  return {
    service: websocketService,
    connect: connectWebSocket,
    disconnect: websocketService.disconnect.bind(websocketService),
    send: websocketService.send.bind(websocketService),
    on: websocketService.on.bind(websocketService),
    off: websocketService.off.bind(websocketService),
    isConnected: websocketService.isConnected,
    status: websocketService.getStatus()
  };
};
