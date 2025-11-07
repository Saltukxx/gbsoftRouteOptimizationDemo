/**
 * React Hook for WebSocket integration
 * Handles real-time vehicle tracking and system events
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import websocketService from '../services/websocket';

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [vehicleData, setVehicleData] = useState([]);
  const [systemStatus, setSystemStatus] = useState({});
  const [optimizationProgress, setOptimizationProgress] = useState(null);
  const [aiLearningData, setAiLearningData] = useState(null);
  const [simulationEvents, setSimulationEvents] = useState([]);
  
  const handlersRef = useRef(new Map());
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Connection management
  const connect = useCallback(async () => {
    try {
      setConnectionError(null);
      await websocketService.connect();
      setIsConnected(true);
      reconnectAttempts.current = 0;
      
      // Start heartbeat
      websocketService.startHeartbeat();
      
      console.log('✅ WebSocket connected successfully');
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      setConnectionError(error.message);
      setIsConnected(false);
      
      // Attempt reconnection
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        setTimeout(() => connect(), 2000 * reconnectAttempts.current);
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    websocketService.disconnect();
    websocketService.stopHeartbeat();
    setIsConnected(false);
    setConnectionError(null);
    console.log('🔌 WebSocket disconnected');
  }, []);

  // Event handlers
  const setupEventHandlers = useCallback(() => {
    // Vehicle updates
    const vehicleHandler = websocketService.on('vehicle_update', (data) => {
      if (data.vehicles) {
        setVehicleData(data.vehicles);
      }
    });
    handlersRef.current.set('vehicle_update', vehicleHandler);

    // System status updates
    const statusHandler = websocketService.on('system_status', (data) => {
      setSystemStatus({
        simulation: data.simulation_status,
        model: data.model_insights,
        connections: data.active_connections,
        timestamp: data.timestamp
      });
    });
    handlersRef.current.set('system_status', statusHandler);

    // Optimization progress
    const progressHandler = websocketService.on('optimization_progress', (data) => {
      setOptimizationProgress(data.progress);
    });
    handlersRef.current.set('optimization_progress', progressHandler);

    // AI learning updates
    const learningHandler = websocketService.on('ai_learning', (data) => {
      setAiLearningData(data.learning_data);
    });
    handlersRef.current.set('ai_learning', learningHandler);

    // Simulation events
    const eventsHandler = websocketService.on('simulation_event', (data) => {
      setSimulationEvents(prev => [
        {
          id: Date.now(),
          event: data.event,
          data: data.data,
          timestamp: data.timestamp
        },
        ...prev.slice(0, 19) // Keep last 20 events
      ]);
    });
    handlersRef.current.set('simulation_event', eventsHandler);

    // Connection events
    const connectionHandler = websocketService.on('connection_established', (data) => {
      console.log('🎉 WebSocket connection established:', data.message);
      setIsConnected(true);
    });
    handlersRef.current.set('connection_established', connectionHandler);

    // Error handling
    const errorHandler = websocketService.on('error', (data) => {
      console.error('❌ WebSocket error:', data.message);
      setConnectionError(data.message);
    });
    handlersRef.current.set('error', errorHandler);

  }, []);

  const cleanupEventHandlers = useCallback(() => {
    handlersRef.current.forEach((unsubscribe, eventType) => {
      unsubscribe();
    });
    handlersRef.current.clear();
  }, []);

  // Initialize WebSocket connection and handlers
  useEffect(() => {
    setupEventHandlers();
    connect();

    return () => {
      cleanupEventHandlers();
      disconnect();
    };
  }, [connect, disconnect, setupEventHandlers, cleanupEventHandlers]);

  // Custom event subscription
  const subscribe = useCallback((eventType, handler) => {
    return websocketService.on(eventType, handler);
  }, []);

  // Send messages
  const sendMessage = useCallback((message) => {
    if (isConnected) {
      websocketService.send(message);
    } else {
      console.warn('⚠️ Cannot send message - WebSocket not connected');
    }
  }, [isConnected]);

  // Request system status
  const requestStatus = useCallback(() => {
    if (isConnected) {
      websocketService.requestStatus();
    }
  }, [isConnected]);

  // Ping server
  const ping = useCallback(() => {
    if (isConnected) {
      websocketService.ping();
    }
  }, [isConnected]);

  // Get latest vehicle by ID
  const getVehicleById = useCallback((vehicleId) => {
    return vehicleData.find(vehicle => vehicle.vehicle_id === vehicleId);
  }, [vehicleData]);

  // Get vehicles by status
  const getVehiclesByStatus = useCallback((status) => {
    return vehicleData.filter(vehicle => vehicle.status === status);
  }, [vehicleData]);

  // Get simulation statistics
  const getSimulationStats = useCallback(() => {
    if (vehicleData.length === 0) {
      return {
        totalVehicles: 0,
        activeVehicles: 0,
        completedVehicles: 0,
        averageProgress: 0,
        totalFuelUsed: 0
      };
    }

    const activeVehicles = vehicleData.filter(v => 
      v.status === 'moving' || v.status === 'delivering'
    ).length;
    
    const completedVehicles = vehicleData.filter(v => 
      v.status === 'completed'
    ).length;

    const averageProgress = vehicleData.reduce((sum, v) => 
      sum + (v.progress || 0), 0
    ) / vehicleData.length;

    const totalFuelUsed = vehicleData.reduce((sum, v) => 
      sum + (v.fuel_used || 0), 0
    );

    return {
      totalVehicles: vehicleData.length,
      activeVehicles,
      completedVehicles,
      averageProgress: Math.round(averageProgress * 10) / 10,
      totalFuelUsed: Math.round(totalFuelUsed * 100) / 100
    };
  }, [vehicleData]);

  // Clear simulation events
  const clearEvents = useCallback(() => {
    setSimulationEvents([]);
  }, []);

  // Connection status
  const getConnectionStatus = useCallback(() => {
    return {
      isConnected,
      error: connectionError,
      reconnectAttempts: reconnectAttempts.current,
      maxReconnectAttempts
    };
  }, [isConnected, connectionError]);

  return {
    // Connection state
    isConnected,
    connectionError,
    
    // Data
    vehicleData,
    systemStatus,
    optimizationProgress,
    aiLearningData,
    simulationEvents,
    
    // Actions
    connect,
    disconnect,
    subscribe,
    sendMessage,
    requestStatus,
    ping,
    
    // Utilities
    getVehicleById,
    getVehiclesByStatus,
    getSimulationStats,
    clearEvents,
    getConnectionStatus
  };
};

// Hook for vehicle tracking specifically
export const useVehicleTracking = () => {
  const {
    vehicleData,
    getVehicleById,
    getVehiclesByStatus,
    getSimulationStats,
    isConnected
  } = useWebSocket();

  return {
    vehicles: vehicleData,
    getVehicle: getVehicleById,
    getVehiclesByStatus,
    stats: getSimulationStats(),
    isTracking: isConnected && vehicleData.length > 0
  };
};

// Hook for optimization progress
export const useOptimizationProgress = () => {
  const { optimizationProgress, aiLearningData } = useWebSocket();

  return {
    progress: optimizationProgress,
    learningData: aiLearningData,
    isOptimizing: optimizationProgress?.status === 'started'
  };
};

// Hook for simulation events
export const useSimulationEvents = () => {
  const { simulationEvents, clearEvents } = useWebSocket();

  const getEventsByType = useCallback((eventType) => {
    return simulationEvents.filter(event => event.event === eventType);
  }, [simulationEvents]);

  const getRecentEvents = useCallback((count = 5) => {
    return simulationEvents.slice(0, count);
  }, [simulationEvents]);

  return {
    events: simulationEvents,
    getEventsByType,
    getRecentEvents,
    clearEvents
  };
};

export default useWebSocket;
