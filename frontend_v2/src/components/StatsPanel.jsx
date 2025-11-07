/**
 * Stats Panel Component
 * Displays AI learning metrics, optimization results, and real-time KPIs
 */

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Leaf, 
  Gauge,
  Brain,
  Target,
  Activity
} from 'lucide-react';
import AILearningChart from './AILearningChart';

const StatsPanel = ({
  optimizationData = null,
  modelAccuracy = 85,
  isOptimizing = false,
  learningIterations = 0,
  simulationData = null
}) => {
  const [showLearning, setShowLearning] = useState(false);
  const [accuracyHistory, setAccuracyHistory] = useState([85]);

  useEffect(() => {
    if (optimizationData?.model_accuracy && optimizationData.model_accuracy !== modelAccuracy) {
      setShowLearning(true);
      setAccuracyHistory(prev => [...prev, optimizationData.model_accuracy]);
      
      const timer = setTimeout(() => {
        setShowLearning(false);
      }, 4000);
      
      return () => clearTimeout(timer);
    }
  }, [optimizationData, modelAccuracy]);

  const MetricCard = ({ icon: Icon, label, value, trend, color = 'blue', subtitle }) => (
    <div className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 text-${color}-500`} />
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="text-xs font-medium">{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="mt-2">
        <div className={`text-2xl font-bold text-${color}-600`}>
          {value}
        </div>
        {subtitle && (
          <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* AI Learning Banner */}
      {showLearning && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-l-4 border-green-500 p-4 ai-learning-glow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-green-500 rounded-full pulse-green"></div>
            <span className="font-semibold text-green-800 flex items-center gap-2">
              <Brain className="w-4 h-4" />
              AI Learning Active
            </span>
          </div>
          <p className="text-sm text-green-700">
            Model improved by +{optimizationData?.learning_improvement || 2.1}% accuracy!
            Neural network adapting to route patterns...
          </p>
        </div>
      )}

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          icon={Gauge}
          label="AI Accuracy"
          value={`${modelAccuracy}%`}
          color="blue"
          subtitle={`${learningIterations} iterations`}
        />
        
        <MetricCard
          icon={Activity}
          label="Learning Rate"
          value={learningIterations > 0 ? "Active" : "Idle"}
          color={learningIterations > 0 ? "green" : "gray"}
          subtitle={`${Math.max(0, 98.5 - modelAccuracy).toFixed(1)}% to go`}
        />
      </div>

      {/* Optimization Results */}
      {optimizationData && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Optimization Results
          </h3>
          
          {/* Fuel Savings */}
          <div className="bg-gradient-to-r from-red-50 to-green-50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-700 font-medium">Fuel Consumption</span>
              <span className="text-green-600 font-bold text-lg">
                -{optimizationData.fuel_savings_percent}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-center">
                <div className="text-red-600 font-semibold">{optimizationData.fuel_before}L</div>
                <div className="text-gray-500">Before</div>
              </div>
              <div className="text-center">
                <div className="text-green-600 font-semibold">{optimizationData.fuel_after}L</div>
                <div className="text-gray-500">After AI</div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-red-200 rounded-full h-3 mt-3">
              <div 
                className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(optimizationData.fuel_savings_percent, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Environmental Impact */}
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Leaf className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">CO₂ Saved</span>
              </div>
              <span className="text-2xl font-bold text-green-700">
                {optimizationData.co2_saved}kg
              </span>
            </div>
            <p className="text-sm text-green-600">
              Environmental impact reduced through AI optimization
            </p>
          </div>

          {/* Route Efficiency */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              icon={TrendingUp}
              label="Vehicles Used"
              value={optimizationData.vehicles_used}
              color="blue"
              subtitle={`of ${optimizationData.total_vehicles || 5} available`}
            />
            
            <MetricCard
              icon={Target}
              label="Orders Served"
              value={optimizationData.orders_served}
              color="green"
              subtitle="100% completion"
            />
          </div>
        </div>
      )}

      {/* AI Learning Chart */}
      {accuracyHistory.length > 1 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4" />
            AI Learning Progress
          </h3>
          <AILearningChart 
            accuracyHistory={accuracyHistory}
            currentAccuracy={modelAccuracy}
          />
        </div>
      )}

      {/* Simulation Status */}
      {simulationData && (
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Live Simulation
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-blue-600 font-semibold">
                {simulationData.active_vehicles || 0}
              </div>
              <div className="text-gray-600">Active Vehicles</div>
            </div>
            <div>
              <div className="text-blue-600 font-semibold">
                {simulationData.average_progress?.toFixed(1) || 0}%
              </div>
              <div className="text-gray-600">Avg Progress</div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      {optimizationData && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-700 mb-2">Performance</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Optimization Time:</span>
              <span className="font-medium">{optimizationData.optimization_time}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Algorithm:</span>
              <span className="font-medium">OR-Tools + AI</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Model Version:</span>
              <span className="font-medium">Neural-VRP v2.1</span>
            </div>
          </div>
        </div>
      )}

      {/* No Data State */}
      {!optimizationData && !isOptimizing && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600 font-medium">Ready for Optimization</p>
          <p className="text-sm text-gray-500 mt-1">
            Add delivery points and click optimize to see AI analytics
          </p>
        </div>
      )}
    </div>
  );
};

export default StatsPanel;
