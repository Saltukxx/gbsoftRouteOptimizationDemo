/**
 * Main Application Component
 * Integrates all components and manages application state
 */

import React, { useState, useEffect, useCallback } from 'react';
import DeckMap from './components/DeckMap';
import ControlPanel from './components/ControlPanel';
import StatsPanel from './components/StatsPanel';
import HistoryPanel from './components/HistoryPanel';
import { useWebSocket, useVehicleTracking, useOptimizationProgress } from './hooks/useWebSocket';
import { demoApi, handleApiError } from './services/api';
import { 
  Layers, 
  BarChart3, 
  History, 
  Settings,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

function App() {
  // State management
  const [activeTab, setActiveTab] = useState('control');
  const [demoData, setDemoData] = useState({
    depot: null,
    vehicles: [],
    deliveryPoints: []
  });
  const [optimizationData, setOptimizationData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [cumulativeStats, setCumulativeStats] = useState({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking');

  // WebSocket integration
  const { 
    isConnected: wsConnected, 
    connectionError: wsError,
    aiLearningData,
    getConnectionStatus
  } = useWebSocket();
  
  const { vehicles: liveVehicles, stats: simulationStats } = useVehicleTracking();
  const { progress: optimizationProgress, learningData } = useOptimizationProgress();

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setApiStatus('loading');
      const data = await demoApi.getInitialData();
      setDemoData({
        depot: data.depot,
        vehicles: data.vehicles,
        deliveryPoints: data.delivery_points
      });
      setApiStatus('connected');
      setError(null);
    } catch (err) {
      const error = handleApiError(err, 'Failed to load initial data');
      setError(error);
      setApiStatus('error');
      console.error('Failed to load initial data:', err);
    }
  };

  // Handle map clicks to add delivery points
  const handleMapClick = useCallback(async (coordinates) => {
    try {
      const response = await demoApi.addDeliveryPoint({
        lat: coordinates.lat,
        lon: coordinates.lon,
        weight: 100 + Math.random() * 200 // Random weight between 100-300kg
      });

      if (response.success) {
        setDemoData(prev => ({
          ...prev,
          deliveryPoints: [...prev.deliveryPoints, response.added_point]
        }));
      }
    } catch (err) {
      const error = handleApiError(err, 'Failed to add delivery point');
      setError(error);
    }
  }, []);

  // Handle route optimization
  const handleOptimize = useCallback(async (settings = {}) => {
    setIsOptimizing(true);
    setError(null);

    try {
      const response = await demoApi.optimizeRoutes({
        objectives: settings.objectives || ['fuel', 'distance'],
        max_vehicles: settings.maxVehicles || 5,
        simulation_speed: settings.simulationSpeed || 100
      });

      if (response.success) {
        setOptimizationData(response);
        
        // Load updated history
        await loadHistoryData();
        
        // Switch to stats tab to show results
        setActiveTab('stats');
      }
    } catch (err) {
      const error = handleApiError(err, 'Optimization failed');
      setError(error);
    } finally {
      setIsOptimizing(false);
    }
  }, []);

  // Handle demo reset
  const handleReset = useCallback(async () => {
    try {
      await demoApi.resetDemo();
      setOptimizationData(null);
      setDemoData(prev => ({
        ...prev,
        deliveryPoints: []
      }));
      setError(null);
    } catch (err) {
      const error = handleApiError(err, 'Failed to reset demo');
      setError(error);
    }
  }, []);

  // Handle simulation control
  const handleSimulationControl = useCallback(async (action, speed) => {
    try {
      await demoApi.controlSimulation(action, speed);
    } catch (err) {
      const error = handleApiError(err, 'Simulation control failed');
      setError(error);
    }
  }, []);

  // Load history data
  const loadHistoryData = useCallback(async () => {
    try {
      const response = await demoApi.getHistory(20);
      setHistoryData(response.history || []);
      setCumulativeStats(response.cumulative_stats || {});
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }, []);

  // Export data
  const handleExportData = useCallback(async () => {
    try {
      const data = await demoApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `route-optimization-demo-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const error = handleApiError(err, 'Failed to export data');
      setError(error);
    }
  }, []);

  // Tab configuration
  const tabs = [
    { id: 'control', label: 'Control', icon: Layers },
    { id: 'stats', label: 'AI Stats', icon: BarChart3 },
    { id: 'history', label: 'History', icon: History }
  ];

  // Connection status indicator
  const getConnectionStatus = () => {
    if (apiStatus === 'error') return { color: 'text-red-600 bg-red-50', icon: AlertCircle, text: 'API Error' };
    if (!wsConnected) return { color: 'text-yellow-600 bg-yellow-50', icon: WifiOff, text: 'WebSocket Offline' };
    if (apiStatus === 'connected') return { color: 'text-green-600 bg-green-50', icon: CheckCircle, text: 'Connected' };
    return { color: 'text-gray-600 bg-gray-50', icon: Wifi, text: 'Checking...' };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              🤖 AI Route Optimization Demo
            </h1>
            <p className="text-gray-600 text-sm">
              Real-time fuel-efficient routing with machine learning
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${connectionStatus.color}`}>
              <connectionStatus.icon className="w-4 h-4" />
              {connectionStatus.text}
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-700 font-medium">
                {error.message}
              </span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Map Area */}
        <div className="flex-1 relative">
          <DeckMap
            depot={demoData.depot}
            deliveryPoints={demoData.deliveryPoints}
            vehicles={liveVehicles}
            routes={optimizationData?.routes}
            isOptimizing={isOptimizing}
            onMapClick={handleMapClick}
            simulationActive={liveVehicles.length > 0}
          />
        </div>

        {/* Sidebar */}
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 p-4">
            <div className="flex space-x-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'control' && (
              <ControlPanel
                deliveryPointsCount={demoData.deliveryPoints.length}
                isOptimizing={isOptimizing}
                isSimulating={liveVehicles.length > 0}
                onOptimize={handleOptimize}
                onReset={handleReset}
                onSimulationControl={handleSimulationControl}
              />
            )}

            {activeTab === 'stats' && (
              <StatsPanel
                optimizationData={optimizationData}
                modelAccuracy={learningData?.accuracy || aiLearningData?.accuracy || 85}
                isOptimizing={isOptimizing}
                learningIterations={learningData?.iterations || 0}
                simulationData={simulationStats}
              />
            )}

            {activeTab === 'history' && (
              <HistoryPanel
                historyData={historyData}
                cumulativeStats={cumulativeStats}
                onLoadHistory={loadHistoryData}
                onExportData={handleExportData}
                onReplayRun={(run) => console.log('Replay run:', run)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Development Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 bg-black/80 text-white text-xs p-2 rounded z-50">
          <div>WS: {wsConnected ? '🟢' : '🔴'} | API: {apiStatus}</div>
          <div>Vehicles: {liveVehicles.length} | Points: {demoData.deliveryPoints.length}</div>
        </div>
      )}
    </div>
  );
}

export default App;
