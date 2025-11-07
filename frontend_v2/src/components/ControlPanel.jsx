/**
 * Control Panel Component
 * Handles route optimization, simulation controls, and user interactions
 */

import React, { useState } from 'react';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Zap, 
  Settings, 
  MapPin,
  Truck,
  Gauge
} from 'lucide-react';

const ControlPanel = ({
  deliveryPointsCount = 0,
  isOptimizing = false,
  isSimulating = false,
  onOptimize,
  onReset,
  onSimulationControl,
  onSettingsChange,
  settings = {}
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [optimizationSettings, setOptimizationSettings] = useState({
    objectives: ['fuel', 'distance'],
    maxVehicles: 5,
    simulationSpeed: 100
  });

  const handleOptimize = () => {
    if (deliveryPointsCount === 0) {
      alert('Please add delivery points to the map first!');
      return;
    }
    onOptimize && onOptimize(optimizationSettings);
  };

  const handleSimulationControl = (action, speed = null) => {
    onSimulationControl && onSimulationControl(action, speed);
  };

  const updateSetting = (key, value) => {
    const newSettings = { ...optimizationSettings, [key]: value };
    setOptimizationSettings(newSettings);
    onSettingsChange && onSettingsChange(newSettings);
  };

  const toggleObjective = (objective) => {
    const objectives = optimizationSettings.objectives.includes(objective)
      ? optimizationSettings.objectives.filter(obj => obj !== objective)
      : [...optimizationSettings.objectives, objective];
    
    updateSetting('objectives', objectives);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-500" />
          AI Route Optimizer
        </h2>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-gray-500 hover:text-gray-700"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Main Controls */}
      <div className="space-y-4">
        {/* Delivery Points Status */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                Delivery Points
              </span>
            </div>
            <span className="text-lg font-bold text-blue-600">
              {deliveryPointsCount}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Click on the map to add delivery locations
          </p>
        </div>

        {/* Primary Actions */}
        <div className="space-y-3">
          <button
            onClick={handleOptimize}
            disabled={isOptimizing || deliveryPointsCount === 0}
            className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-all duration-300 flex items-center justify-center gap-3 ${
              isOptimizing 
                ? 'bg-gray-400 cursor-not-allowed' 
                : deliveryPointsCount === 0
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transform hover:scale-105 shadow-lg hover:shadow-xl'
            }`}
          >
            {isOptimizing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                AI Optimizing Routes...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Optimize with AI
              </>
            )}
          </button>

          <button
            onClick={onReset}
            className="w-full py-2 px-4 border-2 border-gray-300 text-gray-600 rounded-lg hover:border-gray-400 hover:text-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Demo
          </button>
        </div>
      </div>

      {/* Simulation Controls */}
      {isSimulating && (
        <div className="border-t pt-4">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Live Simulation
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => handleSimulationControl('stop')}
              className="flex-1 py-2 px-3 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center gap-2 text-sm"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
            <button
              onClick={() => handleSimulationControl('speed', optimizationSettings.simulationSpeed * 2)}
              className="flex-1 py-2 px-3 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center justify-center gap-2 text-sm"
            >
              <Play className="w-4 h-4" />
              Speed Up
            </button>
          </div>
        </div>
      )}

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="border-t pt-4 space-y-4">
          <h3 className="font-semibold text-gray-700">Advanced Settings</h3>
          
          {/* Optimization Objectives */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Optimization Objectives
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['fuel', 'distance', 'time', 'cost'].map(objective => (
                <button
                  key={objective}
                  onClick={() => toggleObjective(objective)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    optimizationSettings.objectives.includes(objective)
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {objective.charAt(0).toUpperCase() + objective.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Max Vehicles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Vehicles: {optimizationSettings.maxVehicles}
            </label>
            <input
              type="range"
              min="1"
              max="8"
              value={optimizationSettings.maxVehicles}
              onChange={(e) => updateSetting('maxVehicles', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Simulation Speed */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Simulation Speed: {optimizationSettings.simulationSpeed}x
            </label>
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={optimizationSettings.simulationSpeed}
              onChange={(e) => updateSetting('simulationSpeed', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">Quick Start:</h4>
        <ol className="text-sm text-blue-700 space-y-1">
          <li>1. Click "Add Delivery Points" on the map</li>
          <li>2. Add 5-10 delivery locations</li>
          <li>3. Click "Optimize with AI" to see magic!</li>
          <li>4. Watch vehicles move in real-time</li>
        </ol>
      </div>
    </div>
  );
};

export default ControlPanel;
