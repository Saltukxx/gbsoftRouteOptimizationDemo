/**
 * Advanced Deck.gl Map Component with Interactive Layers
 * Handles route visualization, vehicle tracking, and user interactions
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl';
import { 
  PathLayer, 
  IconLayer, 
  ScatterplotLayer,
  HeatmapLayer,
  TextLayer
} from '@deck.gl/layers';
import { MapViewState } from '@deck.gl/core';

// Map style URL - using free MapLibre style
const MAP_STYLE = 'https://demotiles.maplibre.org/style.json';

// Default view state (Istanbul)
const INITIAL_VIEW_STATE = {
  longitude: 28.9784,
  latitude: 41.0082,
  zoom: 11,
  pitch: 45,
  bearing: 0,
  maxZoom: 18,
  minZoom: 8
};

// Vehicle icon mapping
const ICON_MAPPING = {
  truck: { x: 0, y: 0, width: 128, height: 128, anchorY: 128 },
  depot: { x: 128, y: 0, width: 128, height: 128, anchorY: 128 },
  delivery: { x: 256, y: 0, width: 128, height: 128, anchorY: 128 }
};

// Color schemes for routes
const ROUTE_COLORS = [
  [59, 130, 246],   // Blue
  [34, 197, 94],    // Green  
  [245, 158, 11],   // Amber
  [239, 68, 68],    // Red
  [139, 92, 246],   // Purple
  [236, 72, 153],   // Pink
  [14, 165, 233],   // Sky
  [34, 197, 94]     // Emerald
];

const DeckMap = ({ 
  depot,
  deliveryPoints,
  vehicles,
  routes,
  isOptimizing,
  onMapClick,
  onPointHover,
  simulationActive = false,
  showHeatmap = false
}) => {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [hoveredObject, setHoveredObject] = useState(null);
  const [clickModeActive, setClickModeActive] = useState(false);

  // Update view state to center on depot when it changes
  useEffect(() => {
    if (depot) {
      setViewState(prev => ({
        ...prev,
        longitude: depot.lon,
        latitude: depot.lat
      }));
    }
  }, [depot]);

  // Handle map clicks for adding delivery points
  const handleMapClick = useCallback((info, event) => {
    if (clickModeActive && onMapClick && info.coordinate) {
      const [lon, lat] = info.coordinate;
      onMapClick({ lat, lon });
    }
  }, [clickModeActive, onMapClick]);

  // Create depot layer
  const depotLayer = useMemo(() => {
    if (!depot) return null;

    return new IconLayer({
      id: 'depot-layer',
      data: [depot],
      pickable: true,
      iconAtlas: '/icons/vehicle-atlas.png',
      iconMapping: ICON_MAPPING,
      getIcon: () => 'depot',
      getPosition: d => [d.lon, d.lat],
      getSize: 40,
      getColor: [220, 38, 38, 255],
      onHover: (info) => {
        setHoveredObject(info.object ? {
          ...info.object,
          type: 'depot',
          x: info.x,
          y: info.y
        } : null);
        onPointHover && onPointHover(info);
      }
    });
  }, [depot, onPointHover]);

  // Create delivery points layer
  const deliveryLayer = useMemo(() => {
    if (!deliveryPoints?.length) return null;

    return new ScatterplotLayer({
      id: 'delivery-points-layer',
      data: deliveryPoints,
      pickable: true,
      opacity: 0.8,
      stroked: true,
      filled: true,
      radiusScale: 1,
      radiusMinPixels: 8,
      radiusMaxPixels: 16,
      lineWidthMinPixels: 2,
      getPosition: d => [d.lon, d.lat],
      getRadius: d => d.weight ? Math.max(8, d.weight / 20) : 12,
      getFillColor: d => {
        if (routes?.length > 0) {
          // Color by assigned route
          const routeIndex = routes.findIndex(route => 
            route.orders?.some(order => order.id === d.id)
          );
          return routeIndex >= 0 ? ROUTE_COLORS[routeIndex % ROUTE_COLORS.length] : [156, 163, 175];
        }
        return isOptimizing ? [59, 130, 246] : [107, 114, 128];
      },
      getLineColor: [255, 255, 255],
      onHover: (info) => {
        setHoveredObject(info.object ? {
          ...info.object,
          type: 'delivery',
          x: info.x,
          y: info.y
        } : null);
        onPointHover && onPointHover(info);
      }
    });
  }, [deliveryPoints, routes, isOptimizing, onPointHover]);

  // Create routes layer
  const routesLayer = useMemo(() => {
    if (!routes?.length) return null;

    const pathData = routes.map((route, index) => {
      if (!route.orders?.length) return null;

      // Build path coordinates: depot -> orders -> depot
      const coordinates = [[depot.lon, depot.lat]];
      
      route.orders.forEach(order => {
        const point = deliveryPoints.find(p => p.id === order.id);
        if (point) {
          coordinates.push([point.lon, point.lat]);
        }
      });
      
      coordinates.push([depot.lon, depot.lat]);

      return {
        path: coordinates,
        color: ROUTE_COLORS[index % ROUTE_COLORS.length],
        vehicleId: route.vehicle_id,
        fuelEstimate: route.fuel_estimate,
        distance: route.distance
      };
    }).filter(Boolean);

    return new PathLayer({
      id: 'routes-layer',
      data: pathData,
      pickable: true,
      widthScale: 1,
      widthMinPixels: 3,
      widthMaxPixels: 8,
      getPath: d => d.path,
      getColor: d => [...d.color, 200],
      getWidth: d => simulationActive ? 6 : 4,
      capRounded: true,
      jointRounded: true,
      dashJustified: true,
      getDashArray: simulationActive ? [10, 5] : [0, 0],
      dashGapPickable: true,
      onHover: (info) => {
        setHoveredObject(info.object ? {
          ...info.object,
          type: 'route',
          x: info.x,
          y: info.y
        } : null);
      }
    });
  }, [routes, depot, deliveryPoints, simulationActive]);

  // Create vehicles layer for real-time tracking
  const vehiclesLayer = useMemo(() => {
    if (!vehicles?.length || !simulationActive) return null;

    return new IconLayer({
      id: 'vehicles-layer',
      data: vehicles,
      pickable: true,
      iconAtlas: '/icons/vehicle-atlas.png',
      iconMapping: ICON_MAPPING,
      getIcon: () => 'truck',
      getPosition: d => [d.lon, d.lat],
      getSize: d => d.status === 'moving' ? 32 : 24,
      getAngle: d => d.heading || 0,
      getColor: d => {
        switch (d.status) {
          case 'moving': return [59, 130, 246, 255];
          case 'delivering': return [245, 158, 11, 255];
          case 'completed': return [34, 197, 94, 255];
          default: return [107, 114, 128, 255];
        }
      },
      onHover: (info) => {
        setHoveredObject(info.object ? {
          ...info.object,
          type: 'vehicle',
          x: info.x,
          y: info.y
        } : null);
      }
    });
  }, [vehicles, simulationActive]);

  // Create fuel consumption heatmap layer
  const heatmapLayer = useMemo(() => {
    if (!showHeatmap || !routes?.length) return null;

    const heatmapData = deliveryPoints?.map(point => ({
      position: [point.lon, point.lat],
      weight: point.weight || 100
    })) || [];

    return new HeatmapLayer({
      id: 'fuel-heatmap-layer',
      data: heatmapData,
      getPosition: d => d.position,
      getWeight: d => d.weight,
      radiusPixels: 100,
      intensity: 1,
      threshold: 0.03,
      colorRange: [
        [255, 255, 178, 25],
        [254, 204, 92, 85],
        [253, 141, 60, 127],
        [240, 59, 32, 170],
        [189, 0, 38, 255]
      ]
    });
  }, [showHeatmap, routes, deliveryPoints]);

  // Create labels layer for better UX
  const labelsLayer = useMemo(() => {
    if (!depot && !deliveryPoints?.length) return null;

    const labelData = [];
    
    if (depot) {
      labelData.push({
        position: [depot.lon, depot.lat],
        text: 'DEPOT',
        color: [220, 38, 38],
        size: 14
      });
    }

    deliveryPoints?.forEach((point, index) => {
      labelData.push({
        position: [point.lon, point.lat],
        text: `${index + 1}`,
        color: [255, 255, 255],
        size: 12
      });
    });

    return new TextLayer({
      id: 'labels-layer',
      data: labelData,
      pickable: false,
      getPosition: d => d.position,
      getText: d => d.text,
      getSize: d => d.size,
      getColor: d => d.color,
      getAngle: 0,
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'center',
      fontFamily: 'Monaco, monospace',
      fontWeight: 'bold'
    });
  }, [depot, deliveryPoints]);

  // Combine all layers
  const layers = [
    heatmapLayer,
    routesLayer,
    depotLayer,
    deliveryLayer,
    vehiclesLayer,
    labelsLayer
  ].filter(Boolean);

  // Render tooltip
  const renderTooltip = () => {
    if (!hoveredObject) return null;

    const { type, x, y } = hoveredObject;

    let content = '';
    switch (type) {
      case 'depot':
        content = `
          <div class="font-bold text-red-600">🏪 ${hoveredObject.name}</div>
          <div class="text-sm text-gray-600">Central Distribution Hub</div>
        `;
        break;
      case 'delivery':
        content = `
          <div class="font-bold text-green-600">📦 ${hoveredObject.name || `Delivery ${hoveredObject.id}`}</div>
          <div class="text-sm text-gray-600">Weight: ${hoveredObject.weight}kg</div>
          ${hoveredObject.priority ? `<div class="text-sm text-gray-600">Priority: ${hoveredObject.priority}</div>` : ''}
        `;
        break;
      case 'vehicle':
        content = `
          <div class="font-bold text-blue-600">🚛 ${hoveredObject.vehicle_id}</div>
          <div class="text-sm text-gray-600">Status: ${hoveredObject.status}</div>
          <div class="text-sm text-gray-600">Speed: ${hoveredObject.speed?.toFixed(1)} km/h</div>
          <div class="text-sm text-gray-600">Cargo: ${hoveredObject.current_cargo?.toFixed(1)} kg</div>
          <div class="text-sm text-gray-600">Progress: ${hoveredObject.progress?.toFixed(1)}%</div>
        `;
        break;
      case 'route':
        content = `
          <div class="font-bold text-purple-600">🛣️ ${hoveredObject.vehicleId}</div>
          <div class="text-sm text-gray-600">Fuel Est: ${hoveredObject.fuelEstimate?.toFixed(2)}L</div>
          <div class="text-sm text-gray-600">Distance: ${hoveredObject.distance?.toFixed(1)}km</div>
        `;
        break;
      default:
        return null;
    }

    return (
      <div
        className="absolute z-50 bg-white rounded-lg shadow-lg border p-3 pointer-events-none max-w-xs"
        style={{
          left: x + 10,
          top: y - 10
        }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  };

  return (
    <div className="relative w-full h-full">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
        controller={true}
        layers={layers}
        onClick={handleMapClick}
        getTooltip={() => null} // We handle tooltip manually
      >
        <Map
          mapStyle={MAP_STYLE}
          preventStyleDiffing={true}
          mapboxAccessToken="" // Not needed for MapLibre
        />
      </DeckGL>

      {/* Custom tooltip */}
      {renderTooltip()}

      {/* Map controls overlay */}
      <div className="absolute top-4 left-4 z-10 space-y-2">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-600 rounded-full"></div>
              <span>Depot</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <span>Delivery Points</span>
            </div>
            {routes?.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-blue-500 rounded"></div>
                <span>Optimized Routes</span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setClickModeActive(!clickModeActive)}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            clickModeActive 
              ? 'bg-blue-500 text-white shadow-lg' 
              : 'bg-white/90 text-gray-700 hover:bg-white'
          }`}
        >
          {clickModeActive ? '📍 Click to Add Point' : '➕ Add Delivery Points'}
        </button>
      </div>

      {/* Simulation status indicator */}
      {simulationActive && (
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-green-500/90 backdrop-blur-sm text-white rounded-lg shadow-lg p-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="font-medium">Live Simulation Active</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay during optimization */}
      {isOptimizing && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-20 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 flex items-center gap-4">
            <div className="loading-spinner"></div>
            <div>
              <div className=