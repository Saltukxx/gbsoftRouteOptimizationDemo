"""
Enhanced OSRM Client for route calculation and optimization.
Handles both public OSRM service and local OSRM instances with fallback mechanisms.
"""

import requests
import asyncio
import aiohttp
import numpy as np
import math
from typing import List, Dict, Tuple, Optional, Union
import time
import logging
from dataclasses import dataclass

@dataclass
class RoutePoint:
    """Represents a point in a route with coordinates and metadata."""
    latitude: float
    longitude: float
    name: str = ""
    weight: float = 0.0
    delivery_time: int = 5  # minutes

@dataclass 
class RouteGeometry:
    """Contains detailed route geometry and metadata."""
    coordinates: List[Tuple[float, float]]
    distance: float  # meters
    duration: float  # seconds
    steps: List[Dict] = None
    geometry_string: str = ""

class EnhancedOSRMClient:
    """
    Advanced OSRM client with multiple endpoints, caching, and fallback mechanisms.
    Supports both synchronous and asynchronous operations.
    """
    
    def __init__(self, primary_url: str = "https://router.project-osrm.org", 
                 fallback_url: str = "http://localhost:5000"):
        self.primary_url = primary_url.rstrip('/')
        self.fallback_url = fallback_url.rstrip('/')
        self.current_url = self.primary_url
        
        # Caching for performance
        self.distance_cache = {}
        self.route_cache = {}
        self.cache_ttl = 3600  # 1 hour
        
        # Request configuration
        self.timeout = 30
        self.max_retries = 3
        self.retry_delay = 1.0
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
    
    async def get_distance_matrix_async(self, points: List[RoutePoint]) -> np.ndarray:
        """
        Asynchronously get distance matrix for multiple points.
        Uses batch processing for large point sets.
        """
        
        if len(points) <= 1:
            return np.array([[0.0]])
        
        # Check cache first
        cache_key = self._generate_cache_key(points)
        if cache_key in self.distance_cache:
            cache_entry = self.distance_cache[cache_key]
            if time.time() - cache_entry['timestamp'] < self.cache_ttl:
                return cache_entry['matrix']
        
        # Prepare coordinates for OSRM
        coordinates = [(point.longitude, point.latitude) for point in points]
        coord_string = ";".join([f"{lon},{lat}" for lon, lat in coordinates])
        
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                matrix = await self._fetch_distance_matrix(session, coord_string)
                
                # Cache the result
                self.distance_cache[cache_key] = {
                    'matrix': matrix,
                    'timestamp': time.time()
                }
                
                return matrix
                
        except Exception as e:
            self.logger.warning(f"OSRM request failed: {e}, falling back to haversine")
            return self._calculate_haversine_matrix(points)
    
    def get_distance_matrix(self, points: List[RoutePoint]) -> np.ndarray:
        """Synchronous wrapper for distance matrix calculation."""
        return asyncio.run(self.get_distance_matrix_async(points))
    
    async def _fetch_distance_matrix(self, session: aiohttp.ClientSession, coord_string: str) -> np.ndarray:
        """Fetch distance matrix from OSRM service."""
        
        for attempt in range(self.max_retries):
            try:
                # Try primary URL first
                url = f"{self.current_url}/table/v1/driving/{coord_string}?annotations=distance,duration"
                
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get("code") == "Ok":
                            distances = np.array(data["distances"])
                            # Convert from meters to kilometers
                            return distances / 1000.0
                    
                    # If primary fails, try fallback
                    if self.current_url == self.primary_url and attempt == 0:
                        self.current_url = self.fallback_url
                        continue
                        
            except Exception as e:
                self.logger.warning(f"Attempt {attempt + 1} failed: {e}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay * (attempt + 1))
                
        raise Exception("All OSRM endpoints failed")
    
    async def get_route_geometry_async(self, start: RoutePoint, end: RoutePoint, 
                                     waypoints: List[RoutePoint] = None) -> RouteGeometry:
        """
        Get detailed route geometry between points.
        Includes turn-by-turn instructions and precise coordinates.
        """
        
        # Build coordinate string
        all_points = [start]
        if waypoints:
            all_points.extend(waypoints)
        all_points.append(end)
        
        coordinates = [(p.longitude, p.latitude) for p in all_points]
        coord_string = ";".join([f"{lon},{lat}" for lon, lat in coordinates])
        
        # Check cache
        cache_key = f"route_{coord_string}"
        if cache_key in self.route_cache:
            cache_entry = self.route_cache[cache_key]
            if time.time() - cache_entry['timestamp'] < self.cache_ttl:
                return cache_entry['geometry']
        
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                geometry = await self._fetch_route_geometry(session, coord_string)
                
                # Cache the result
                self.route_cache[cache_key] = {
                    'geometry': geometry,
                    'timestamp': time.time()
                }
                
                return geometry
                
        except Exception as e:
            self.logger.warning(f"Route geometry request failed: {e}")
            return self._create_fallback_geometry(all_points)
    
    async def _fetch_route_geometry(self, session: aiohttp.ClientSession, coord_string: str) -> RouteGeometry:
        """Fetch detailed route geometry from OSRM."""
        
        url = f"{self.current_url}/route/v1/driving/{coord_string}?geometries=geojson&overview=full&steps=true"
        
        async with session.get(url) as response:
            if response.status == 200:
                data = await response.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    route = data["routes"][0]
                    
                    # Extract coordinates from geometry
                    coordinates = route["geometry"]["coordinates"]
                    # Convert from [lon, lat] to [lat, lon] for consistency
                    coordinates = [(lat, lon) for lon, lat in coordinates]
                    
                    # Extract route steps
                    steps = []
                    if "legs" in route:
                        for leg in route["legs"]:
                            if "steps" in leg:
                                steps.extend(leg["steps"])
                    
                    return RouteGeometry(
                        coordinates=coordinates,
                        distance=route["distance"],  # meters
                        duration=route["duration"],  # seconds
                        steps=steps,
                        geometry_string=str(route["geometry"])
                    )
            
            raise Exception(f"OSRM route request failed with status {response.status}")
    
    def _create_fallback_geometry(self, points: List[RoutePoint]) -> RouteGeometry:
        """Create simple straight-line geometry as fallback."""
        
        coordinates = [(p.latitude, p.longitude) for p in points]
        
        # Calculate total distance using Haversine
        total_distance = 0.0
        for i in range(len(coordinates) - 1):
            dist = self._haversine_distance(coordinates[i], coordinates[i + 1])
            total_distance += dist
        
        # Estimate duration (assuming 50 km/h average speed)
        duration = (total_distance / 50.0) * 3600  # seconds
        
        return RouteGeometry(
            coordinates=coordinates,
            distance=total_distance * 1000,  # convert to meters
            duration=duration,
            steps=[],
            geometry_string=""
        )
    
    def _calculate_haversine_matrix(self, points: List[RoutePoint]) -> np.ndarray:
        """Calculate distance matrix using Haversine formula as fallback."""
        
        n = len(points)
        matrix = np.zeros((n, n))
        
        for i in range(n):
            for j in range(n):
                if i != j:
                    p1 = (points[i].latitude, points[i].longitude)
                    p2 = (points[j].latitude, points[j].longitude)
                    matrix[i][j] = self._haversine_distance(p1, p2)
        
        return matrix
    
    def _haversine_distance(self, point1: Tuple[float, float], point2: Tuple[float, float]) -> float:
        """Calculate Haversine distance between two points in kilometers."""
        
        lat1, lon1 = math.radians(point1[0]), math.radians(point1[1])
        lat2, lon2 = math.radians(point2[0]), math.radians(point2[1])
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = (math.sin(dlat / 2) ** 2 + 
             math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2)
        c = 2 * math.asin(math.sqrt(a))
        
        # Earth's radius in kilometers
        r = 6371.0
        
        return c * r
    
    def _generate_cache_key(self, points: List[RoutePoint]) -> str:
        """Generate a cache key for a set of points."""
        coords = [(round(p.latitude, 4), round(p.longitude, 4)) for p in points]
        return str(hash(tuple(coords)))
    
    async def get_optimized_route_order(self, depot: RoutePoint, 
                                      delivery_points: List[RoutePoint]) -> List[int]:
        """
        Get optimized order for visiting delivery points using OSRM's trip service.
        Returns indices of delivery_points in optimized order.
        """
        
        try:
            all_points = [depot] + delivery_points
            coordinates = [(p.longitude, p.latitude) for p in all_points]
            coord_string = ";".join([f"{lon},{lat}" for lon, lat in coordinates])
            
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                url = f"{self.current_url}/trip/v1/driving/{coord_string}?source=first&destination=first&roundtrip=true"
                
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get("code") == "Ok" and data.get("trips"):
                            trip = data["trips"][0]
                            waypoint_indices = [wp["waypoint_index"] for wp in trip["legs"]]
                            # Remove depot index (0) and adjust for delivery_points
                            return [idx - 1 for idx in waypoint_indices if idx > 0]
                            
        except Exception as e:
            self.logger.warning(f"Trip optimization failed: {e}")
        
        # Fallback: return original order
        return list(range(len(delivery_points)))
    
    def clear_cache(self):
        """Clear all cached data."""
        self.distance_cache.clear()
        self.route_cache.clear()
        self.logger.info("OSRM cache cleared")
    
    def get_cache_stats(self) -> Dict[str, int]:
        """Get cache usage statistics."""
        current_time = time.time()
        
        valid_distance_entries = sum(1 for entry in self.distance_cache.values()
                                   if current_time - entry['timestamp'] < self.cache_ttl)
        
        valid_route_entries = sum(1 for entry in self.route_cache.values()
                                if current_time - entry['timestamp'] < self.cache_ttl)
        
        return {
            'distance_cache_size': len(self.distance_cache),
            'route_cache_size': len(self.route_cache),
            'valid_distance_entries': valid_distance_entries,
            'valid_route_entries': valid_route_entries,
            'cache_ttl_seconds': self.cache_ttl
        }

# Global OSRM client instance
osrm_client = EnhancedOSRMClient()