"""
Real-time Vehicle Simulator for live route visualization.
Handles vehicle movement, telemetry broadcasting, and state management.
"""

import asyncio
import json
import math
import time
from typing import Dict, List, Tuple, Optional, Callable
from dataclasses import dataclass, field
import logging
from enum import Enum

from .osrm_client import RoutePoint, RouteGeometry, osrm_client

class VehicleStatus(Enum):
    IDLE = "idle"
    MOVING = "moving"
    DELIVERING = "delivering"
    RETURNING = "returning"
    COMPLETED = "completed"

@dataclass
class VehicleState:
    """Real-time vehicle state for simulation."""
    vehicle_id: str
    latitude: float
    longitude: float
    speed: float  # km/h
    heading: float  # degrees
    status: VehicleStatus
    current_cargo: float  # kg
    fuel_used: float  # liters
    progress: float  # route completion percentage (0-100)
    current_order_index: int = 0
    last_updated: float = field(default_factory=time.time)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            'vehicle_id': self.vehicle_id,
            'lat': round(self.latitude, 6),
            'lon': round(self.longitude, 6),
            'speed': round(self.speed, 1),
            'heading': round(self.heading, 1),
            'status': self.status.value,
            'current_cargo': round(self.current_cargo, 1),
            'fuel_used': round(self.fuel_used, 2),
            'progress': round(self.progress, 1),
            'current_order': self.current_order_index,
            'timestamp': self.last_updated
        }

@dataclass
class SimulationRoute:
    """Route definition for simulation."""
    vehicle_id: str
    waypoints: List[RoutePoint]
    geometry: Optional[RouteGeometry] = None
    total_distance: float = 0.0
    estimated_time: float = 0.0  # minutes
    orders: List[Dict] = field(default_factory=list)

class VehicleSimulator:
    """
    Advanced vehicle simulator with realistic movement patterns.
    Broadcasts real-time position updates via WebSocket.
    """
    
    def __init__(self):
        self.active_simulations: Dict[str, VehicleState] = {}
        self.simulation_routes: Dict[str, SimulationRoute] = {}
        self.websocket_callbacks: List[Callable] = []
        
        # Simulation parameters
        self.update_interval = 2.0  # seconds
        self.simulation_speed_multiplier = 100  # 100x real speed
        self.average_speed = 45.0  # km/h
        self.delivery_time = 3.0  # minutes per delivery
        
        # Movement parameters
        self.max_speed = 80.0  # km/h
        self.min_speed = 20.0  # km/h
        self.acceleration_rate = 10.0  # km/h per second
        self.deceleration_rate = 15.0  # km/h per second
        
        # State management
        self.is_running = False
        self.simulation_task: Optional[asyncio.Task] = None
        
        # Logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
    def add_websocket_callback(self, callback: Callable):
        """Add a callback function for WebSocket broadcasting."""
        self.websocket_callbacks.append(callback)
        self.logger.info("WebSocket callback added to simulator")
    
    async def start_simulation(self, routes: List[Dict], depot: RoutePoint) -> bool:
        """
        Start vehicle simulation for given routes.
        
        Args:
            routes: List of optimized routes from VRP solver
            depot: Depot location where all vehicles start/end
            
        Returns:
            bool: True if simulation started successfully
        """
        
        try:
            self.logger.info(f"Starting simulation for {len(routes)} routes")
            
            # Clear existing simulations
            await self.stop_simulation()
            
            # Initialize simulation routes
            for route in routes:
                await self._initialize_vehicle_route(route, depot)
            
            # Start simulation loop
            self.is_running = True
            self.simulation_task = asyncio.create_task(self._simulation_loop())
            
            self.logger.info("Vehicle simulation started successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to start simulation: {e}")
            return False
    
    async def stop_simulation(self):
        """Stop all active simulations."""
        
        self.is_running = False
        
        if self.simulation_task and not self.simulation_task.done():
            self.simulation_task.cancel()
            try:
                await self.simulation_task
            except asyncio.CancelledError:
                pass
        
        # Mark all vehicles as completed
        for vehicle_state in self.active_simulations.values():
            vehicle_state.status = VehicleStatus.COMPLETED
            vehicle_state.progress = 100.0
            
        await self._broadcast_all_vehicle_states()
        
        self.logger.info("Vehicle simulation stopped")
    
    async def _initialize_vehicle_route(self, route: Dict, depot: RoutePoint):
        """Initialize a single vehicle route for simulation."""
        
        vehicle_id = route['vehicle_id']
        
        # Build waypoint list: depot -> orders -> depot
        waypoints = [depot]
        for order in route['orders']:
            waypoint = RoutePoint(
                latitude=order['location']['lat'],
                longitude=order['location']['lon'],
                name=order['location']['name'],
                weight=order['weight']
            )
            waypoints.append(waypoint)
        waypoints.append(depot)  # Return to depot
        
        # Get detailed route geometry from OSRM
        try:
            geometry = await osrm_client.get_route_geometry_async(
                waypoints[0], waypoints[-1], waypoints[1:-1]
            )
        except Exception as e:
            self.logger.warning(f"Failed to get route geometry for {vehicle_id}: {e}")
            geometry = None
        
        # Create simulation route
        sim_route = SimulationRoute(
            vehicle_id=vehicle_id,
            waypoints=waypoints,
            geometry=geometry,
            total_distance=route.get('total_distance', 0),
            estimated_time=route.get('estimated_time', 0),
            orders=route['orders']
        )
        
        self.simulation_routes[vehicle_id] = sim_route
        
        # Initialize vehicle state at depot
        initial_cargo = sum(order['weight'] for order in route['orders'])
        
        vehicle_state = VehicleState(
            vehicle_id=vehicle_id,
            latitude=depot.latitude,
            longitude=depot.longitude,
            speed=0.0,
            heading=0.0,
            status=VehicleStatus.IDLE,
            current_cargo=initial_cargo,
            fuel_used=0.0,
            progress=0.0
        )
        
        self.active_simulations[vehicle_id] = vehicle_state
        
        self.logger.info(f"Initialized simulation for vehicle {vehicle_id} with {len(waypoints)} waypoints")
    
    async def _simulation_loop(self):
        """Main simulation loop that updates vehicle positions."""
        
        self.logger.info("Starting simulation loop")
        
        try:
            while self.is_running and self.active_simulations:
                start_time = time.time()
                
                # Update all vehicle positions
                active_vehicles = 0
                for vehicle_id, vehicle_state in self.active_simulations.items():
                    if vehicle_state.status != VehicleStatus.COMPLETED:
                        await self._update_vehicle_position(vehicle_id)
                        active_vehicles += 1
                
                # Broadcast updated states
                await self._broadcast_all_vehicle_states()
                
                # Check if simulation is complete
                if active_vehicles == 0:
                    self.logger.info("All vehicles completed their routes")
                    break
                
                # Maintain consistent update interval
                elapsed = time.time() - start_time
                sleep_time = max(0, self.update_interval - elapsed)
                await asyncio.sleep(sleep_time)
                
        except asyncio.CancelledError:
            self.logger.info("Simulation loop cancelled")
        except Exception as e:
            self.logger.error(f"Error in simulation loop: {e}")
        finally:
            self.is_running = False
    
    async def _update_vehicle_position(self, vehicle_id: str):
        """Update position for a single vehicle."""
        
        vehicle_state = self.active_simulations[vehicle_id]
        sim_route = self.simulation_routes[vehicle_id]
        
        if vehicle_state.status == VehicleStatus.COMPLETED:
            return
        
        # Determine target waypoint
        target_waypoint_index = min(
            vehicle_state.current_order_index + 1,
            len(sim_route.waypoints) - 1
        )
        
        if target_waypoint_index >= len(sim_route.waypoints):
            vehicle_state.status = VehicleStatus.COMPLETED
            vehicle_state.progress = 100.0
            return
        
        target_waypoint = sim_route.waypoints[target_waypoint_index]
        
        # Calculate movement
        await self._move_vehicle_towards_target(vehicle_state, target_waypoint)
        
        # Check if reached target
        distance_to_target = self._calculate_distance(
            vehicle_state.latitude, vehicle_state.longitude,
            target_waypoint.latitude, target_waypoint.longitude
        )
        
        if distance_to_target < 0.1:  # Within 100m
            await self._handle_waypoint_arrival(vehicle_state, sim_route, target_waypoint_index)
    
    async def _move_vehicle_towards_target(self, vehicle_state: VehicleState, target: RoutePoint):
        """Move vehicle towards target waypoint with realistic physics."""
        
        # Calculate bearing to target
        bearing = self._calculate_bearing(
            vehicle_state.latitude, vehicle_state.longitude,
            target.latitude, target.longitude
        )
        
        # Update heading gradually (realistic turning)
        heading_diff = self._normalize_angle(bearing - vehicle_state.heading)
        max_turn_rate = 30.0  # degrees per update
        
        if abs(heading_diff) > max_turn_rate:
            turn_direction = 1 if heading_diff > 0 else -1
            vehicle_state.heading += turn_direction * max_turn_rate
        else:
            vehicle_state.heading = bearing
        
        vehicle_state.heading = self._normalize_angle(vehicle_state.heading)
        
        # Adjust speed based on status and road conditions
        target_speed = self._calculate_target_speed(vehicle_state)
        
        # Apply acceleration/deceleration
        speed_diff = target_speed - vehicle_state.speed
        max_acceleration = (self.acceleration_rate if speed_diff > 0 
                          else self.deceleration_rate) * self.update_interval
        
        if abs(speed_diff) > max_acceleration:
            acceleration = max_acceleration if speed_diff > 0 else -max_acceleration
            vehicle_state.speed += acceleration
        else:
            vehicle_state.speed = target_speed
        
        # Ensure speed limits
        vehicle_state.speed = max(0, min(self.max_speed, vehicle_state.speed))
        
        # Calculate distance moved in this update
        distance_km = (vehicle_state.speed * self.simulation_speed_multiplier * 
                      self.update_interval) / 3600.0
        
        # Update position
        new_lat, new_lon = self._move_along_bearing(
            vehicle_state.latitude, vehicle_state.longitude,
            vehicle_state.heading, distance_km
        )
        
        vehicle_state.latitude = new_lat
        vehicle_state.longitude = new_lon
        vehicle_state.last_updated = time.time()
        
        # Update fuel consumption (simplified)
        fuel_rate = 0.08 + (vehicle_state.current_cargo / 1000.0 * 0.02)  # L/km
        vehicle_state.fuel_used += distance_km * fuel_rate
    
    async def _handle_waypoint_arrival(self, vehicle_state: VehicleState, 
                                     sim_route: SimulationRoute, waypoint_index: int):
        """Handle vehicle arrival at a waypoint."""
        
        if waypoint_index == 0:
            # Starting from depot
            vehicle_state.status = VehicleStatus.MOVING
            vehicle_state.current_order_index = 0
            
        elif waypoint_index == len(sim_route.waypoints) - 1:
            # Returned to depot
            vehicle_state.status = VehicleStatus.COMPLETED
            vehicle_state.progress = 100.0
            vehicle_state.current_cargo = 0.0
            vehicle_state.speed = 0.0
            
        else:
            # Delivery stop
            vehicle_state.status = VehicleStatus.DELIVERING
            order_index = waypoint_index - 1
            
            if order_index < len(sim_route.orders):
                order = sim_route.orders[order_index]
                vehicle_state.current_cargo -= order['weight']
            
            # Simulate delivery time
            await asyncio.sleep(self.delivery_time * 60 / self.simulation_speed_multiplier)
            
            vehicle_state.status = VehicleStatus.MOVING
            vehicle_state.current_order_index = waypoint_index
            
            # Update progress
            vehicle_state.progress = (waypoint_index / (len(sim_route.waypoints) - 1)) * 100
    
    def _calculate_target_speed(self, vehicle_state: VehicleState) -> float:
        """Calculate target speed based on vehicle status and conditions."""
        
        if vehicle_state.status == VehicleStatus.DELIVERING:
            return 0.0
        
        if vehicle_state.status == VehicleStatus.IDLE:
            return 0.0
        
        # Adjust speed based on cargo weight (heavier = slower)
        weight_factor = 1.0 - (vehicle_state.current_cargo / 2000.0 * 0.2)  # Up to 20% slower
        
        # Random traffic variation
        import random
        traffic_factor = random.uniform(0.8, 1.2)
        
        base_speed = self.average_speed * weight_factor * traffic_factor
        
        return max(self.min_speed, min(self.max_speed, base_speed))
    
    def _calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points in kilometers."""
        
        R = 6371.0  # Earth's radius in km
        
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = (math.sin(dlat / 2) ** 2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2)
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c
    
    def _calculate_bearing(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate bearing from point 1 to point 2 in degrees."""
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        dlon_rad = math.radians(lon2 - lon1)
        
        y = math.sin(dlon_rad) * math.cos(lat2_rad)
        x = (math.cos(lat1_rad) * math.sin(lat2_rad) - 
             math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(dlon_rad))
        
        bearing_rad = math.atan2(y, x)
        bearing_deg = math.degrees(bearing_rad)
        
        return self._normalize_angle(bearing_deg)
    
    def _move_along_bearing(self, lat: float, lon: float, bearing: float, distance_km: float) -> Tuple[float, float]:
        """Move a point along a bearing for a given distance."""
        
        R = 6371.0  # Earth's radius in km
        
        lat_rad = math.radians(lat)
        lon_rad = math.radians(lon)
        bearing_rad = math.radians(bearing)
        
        lat2_rad = math.asin(
            math.sin(lat_rad) * math.cos(distance_km / R) +
            math.cos(lat_rad) * math.sin(distance_km / R) * math.cos(bearing_rad)
        )
        
        lon2_rad = lon_rad + math.atan2(
            math.sin(bearing_rad) * math.sin(distance_km / R) * math.cos(lat_rad),
            math.cos(distance_km / R) - math.sin(lat_rad) * math.sin(lat2_rad)
        )
        
        return math.degrees(lat2_rad), math.degrees(lon2_rad)
    
    def _normalize_angle(self, angle: float) -> float:
        """Normalize angle to 0-360 degrees."""
        while angle < 0:
            angle += 360
        while angle >= 360:
            angle -= 360
        return angle
    
    async def _broadcast_all_vehicle_states(self):
        """Broadcast all vehicle states to connected WebSocket clients."""
        
        if not self.websocket_callbacks:
            return
        
        # Prepare broadcast data
        vehicle_data = {
            'type': 'vehicle_update',
            'timestamp': time.time(),
            'vehicles': [state.to_dict() for state in self.active_simulations.values()],
            'simulation_active': self.is_running
        }
        
        # Call all registered WebSocket callbacks
        for callback in self.websocket_callbacks:
            try:
                await callback(json.dumps(vehicle_data))
            except Exception as e:
                self.logger.warning(f"WebSocket callback failed: {e}")
    
    def get_simulation_status(self) -> Dict:
        """Get current simulation status and statistics."""
        
        if not self.active_simulations:
            return {'status': 'idle', 'vehicles': []}
        
        total_progress = sum(state.progress for state in self.active_simulations.values())
        avg_progress = total_progress / len(self.active_simulations)
        
        active_count = sum(1 for state in self.active_simulations.values() 
                          if state.status not in [VehicleStatus.IDLE, VehicleStatus.COMPLETED])
        
        total_fuel_used = sum(state.fuel_used for state in self.active_simulations.values())
        
        return {
            'status': 'running' if self.is_running else 'stopped',
            'total_vehicles': len(self.active_simulations),
            'active_vehicles': active_count,
            'average_progress': round(avg_progress, 1),
            'total_fuel_used': round(total_fuel_used, 2),
            'simulation_speed_multiplier': self.simulation_speed_multiplier,
            'update_interval': self.update_interval
        }
    
    async def set_simulation_speed(self, multiplier: float):
        """Adjust simulation speed multiplier."""
        self.simulation_speed_multiplier = max(1, min(1000, multiplier))
        self.logger.info(f"Simulation speed set to {self.simulation_speed_multiplier}x")

# Global simulator instance
vehicle_simulator = VehicleSimulator()