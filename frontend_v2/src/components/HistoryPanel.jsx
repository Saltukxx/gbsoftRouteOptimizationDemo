/**
 * History Panel Component
 * Displays optimization history, cumulative savings, and trend analysis
 */

import React, { useState, useEffect } from 'react';
import { 
  History, 
  TrendingUp, 
  Calendar, 
  BarChart3,
  Download,
  Eye,
  Trash2,
  RefreshCw
} from 'lucide-react';

const HistoryPanel = ({
  historyData = [],
  cumulativeStats = {},
  onLoadHistory,
  onExportData,
  onReplayRun
}) => {
  const [selectedRun, setSelectedRun] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  const [filterBy, setFilterBy] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadHistoryData();
  }, []);

  const loadHistoryData = async () => {
    setIsLoading(true);
    try {
      await onLoadHistory?.();
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getSavingsColor = (percentage) => {
    if (percentage >= 25) return 'text-green-600 bg-green-50';
    if (percentage >= 15) return 'text-blue-600 bg-blue-50';
    if (percentage >= 10) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getSavingsTrend = () => {
    if (historyData.length < 2) return null;
    
    const recent = historyData.slice(0, 5);
    const older = historyData.slice(5, 10);
    
    const recentAvg = recent.reduce((sum, run) => sum + run.savings_percent, 0) / recent.length;
    const olderAvg = older.length > 0 
      ? older.reduce((sum, run) => sum + run.savings_percent, 0) / older.length 
      : recentAvg;
    
    return {
      percentage: recentAvg - olderAvg,
      isImproving: recentAvg > olderAvg
    };
  };

  const sortedAndFilteredHistory = historyData
    .filter(run => {
      if (filterBy === 'all') return true;
      if (filterBy === 'high_savings') return run.savings_percent >= 20;
      if (filterBy === 'recent') {
        const runDate = new Date(run.date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return runDate >= weekAgo;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.date) - new Date(a.date);
        case 'savings':
          return b.savings_percent - a.savings_percent;
        case 'co2':
          return b.co2_saved - a.co2_saved;
        case 'accuracy':
          return b.model_accuracy - a.model_accuracy;
        default:
          return 0;
      }
    });

  const trend = getSavingsTrend();

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-500" />
            Optimization History
          </h2>
          <div className="flex gap-2">
            <button
              onClick={loadHistoryData}
              disabled={isLoading}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onExportData}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Export Data"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cumulative Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {cumulativeStats.total_runs || historyData.length}
            </div>
            <div className="text-sm text-gray-600">Total Runs</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {(cumulativeStats.total_fuel_saved || 0).toFixed(1)}L
            </div>
            <div className="text-sm text-gray-600">Fuel Saved</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">
              {(cumulativeStats.total_co2_saved || 0).toFixed(1)}kg
            </div>
            <div className="text-sm text-gray-600">CO₂ Saved</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {(cumulativeStats.avg_savings_percent || 0).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Avg Savings</div>
          </div>
        </div>

        {/* Trend Indicator */}
        {trend && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            trend.isImproving ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            <TrendingUp className={`w-4 h-4 ${trend.isImproving ? '' : 'rotate-180'}`} />
            <span className="text-sm font-medium">
              {trend.isImproving ? 'Improving' : 'Declining'} performance: 
              {trend.percentage > 0 ? '+' : ''}{trend.percentage.toFixed(1)}% vs previous runs
            </span>
          </div>
        )}
      </div>

      {/* Filters and Sorting */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">Date</option>
              <option value="savings">Fuel Savings</option>
              <option value="co2">CO₂ Saved</option>
              <option value="accuracy">AI Accuracy</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Filter:</label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Runs</option>
              <option value="high_savings">High Savings (20%+)</option>
              <option value="recent">Recent (7 days)</option>
            </select>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="loading-spinner mx-auto mb-2"></div>
            <p className="text-gray-600">Loading history...</p>
          </div>
        ) : sortedAndFilteredHistory.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg border">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No optimization history</p>
            <p className="text-sm text-gray-500 mt-1">
              Run some optimizations to see historical data and trends
            </p>
          </div>
        ) : (
          sortedAndFilteredHistory.map((run, index) => {
            const formatted = formatDate(run.date);
            return (
              <div
                key={run.id || index}
                className={`bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow cursor-pointer ${
                  selectedRun?.id === run.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedRun(selectedRun?.id === run.id ? null : run)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-900">
                        {formatted.date}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatted.time}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Fuel Savings:</span>
                        <div className={`font-semibold ${getSavingsColor(run.savings_percent)} px-2 py-1 rounded-full text-center mt-1`}>
                          {run.savings_percent.toFixed(1)}%
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-gray-600">CO₂ Saved:</span>
                        <div className="font-semibold text-green-600 mt-1">
                          {run.co2_saved.toFixed(1)}kg
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-gray-600">AI Accuracy:</span>
                        <div className="font-semibold text-blue-600 mt-1">
                          {run.model_accuracy.toFixed(1)}%
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-gray-600">Vehicles:</span>
                        <div className="font-semibold text-purple-600 mt-1">
                          {run.vehicles_used}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReplayRun?.(run);
                      }}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                      title="Replay this optimization"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedRun?.id === run.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Before:</span>
                        <span className="font-semibold text-red-600 ml-2">
                          {run.fuel_before.toFixed(1)}L
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">After:</span>
                        <span className="font-semibold text-green-600 ml-2">
                          {run.fuel_after.toFixed(1)}L
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Distance:</span>
                        <span className="font-semibold ml-2">
                          {run.distance?.toFixed(1) || 'N/A'}km
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Orders:</span>
                        <span className="font-semibold ml-2">
                          {run.orders_served}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default HistoryPanel;
