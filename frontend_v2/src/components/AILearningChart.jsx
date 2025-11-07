/**
 * AI Learning Chart Component
 * Visualizes AI model accuracy improvement over time using Chart.js
 */

import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const AILearningChart = ({ accuracyHistory = [85], currentAccuracy = 85 }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (chartRef.current) {
      const ctx = chartRef.current.getContext('2d');

      // Destroy existing chart
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      // Create new chart
      chartInstance.current = new ChartJS(ctx, {
        type: 'line',
        data: {
          labels: accuracyHistory.map((_, index) => `Run ${index + 1}`),
          datasets: [
            {
              label: 'Model Accuracy (%)',
              data: accuracyHistory,
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              fill: true,
              tension: 0.4,
              pointBackgroundColor: 'rgb(59, 130, 246)',
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 6,
              pointHoverRadius: 8,
            },
            {
              label: 'Target (98.5%)',
              data: accuracyHistory.map(() => 98.5),
              borderColor: 'rgb(34, 197, 94)',
              backgroundColor: 'transparent',
              borderDash: [5, 5],
              pointRadius: 0,
              tension: 0,
            }
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                font: {
                  size: 11
                },
                usePointStyle: true,
                padding: 15
              }
            },
            title: {
              display: true,
              text: 'AI Learning Progress',
              font: {
                size: 14,
                weight: 'bold'
              },
              padding: {
                bottom: 20
              }
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                title: (context) => {
                  return context[0].label;
                },
                label: (context) => {
                  if (context.datasetIndex === 0) {
                    const improvement = context.dataIndex > 0 
                      ? (accuracyHistory[context.dataIndex] - accuracyHistory[context.dataIndex - 1]).toFixed(1)
                      : 0;
                    return `Accuracy: ${context.parsed.y}% ${improvement > 0 ? `(+${improvement}%)` : ''}`;
                  }
                  return context.dataset.label + ': ' + context.parsed.y + '%';
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: false,
              min: 80,
              max: 100,
              title: {
                display: true,
                text: 'Accuracy (%)',
                font: {
                  weight: 'bold'
                }
              },
              ticks: {
                font: {
                  size: 10
                },
                callback: function(value) {
                  return value + '%';
                }
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Optimization Runs',
                font: {
                  weight: 'bold'
                }
              },
              ticks: {
                font: {
                  size: 10
                }
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              }
            }
          },
          interaction: {
            intersect: false,
            mode: 'index'
          },
          animation: {
            duration: 1000,
            easing: 'easeInOutQuart'
          }
        }
      });
    }

    // Cleanup
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [accuracyHistory]);

  const getAccuracyTrend = () => {
    if (accuracyHistory.length < 2) return null;
    
    const latest = accuracyHistory[accuracyHistory.length - 1];
    const previous = accuracyHistory[accuracyHistory.length - 2];
    const improvement = latest - previous;
    
    return {
      improvement: improvement.toFixed(1),
      isPositive: improvement > 0
    };
  };

  const trend = getAccuracyTrend();

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-gray-800">Learning Analytics</h4>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${
            trend.isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            <span className="font-medium">
              {trend.isPositive ? '+' : ''}{trend.improvement}%
            </span>
            <span className="text-gray-500">last run</span>
          </div>
        )}
      </div>
      
      <div style={{ height: '200px', position: 'relative' }}>
        <canvas ref={chartRef}></canvas>
      </div>

      {/* Learning Stats */}
      <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-lg font-bold text-blue-600">
            {currentAccuracy}%
          </div>
          <div className="text-xs text-gray-500">Current</div>
        </div>
        
        <div>
          <div className="text-lg font-bold text-green-600">
            {accuracyHistory.length}
          </div>
          <div className="text-xs text-gray-500">Iterations</div>
        </div>
        
        <div>
          <div className="text-lg font-bold text-purple-600">
            {((currentAccuracy - 85) / (98.5 - 85) * 100).toFixed(0)}%
          </div>
          <div the rest }