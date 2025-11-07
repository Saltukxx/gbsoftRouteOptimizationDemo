"""
Advanced FastAPI routes for AI Route Optimization Demo.
Handles interactive delivery point management, optimization, and history tracking.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import asyncio
import time
from datetime import datetime

from ..services.optimizer import vrp_optimizer, Vehicle, DeliveryOrder
from ..services.osrm_client import RoutePoint
from ..services.simulator import vehicle_simulator
from ..services.fuel_model import ai_fuel_model
from ..models.db import DatabaseManager, get_db

router = APIRouter()

# Pydantic models for API requests/responses
class LocationPoint(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lon: float = Field(..., ge=-180, le=180, description="Longitude")
    name: str = Field(default="", description="Location name")

class AddDeliveryRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    weight: float = Field(default=100.0, ge=1, le=2000, description="Package weight in kg")
    priority: int = Field(default=1, ge=1, le=5, description="Delivery priority")
    service_time: int = Field(default=10, ge=1, le=60, description="Service time in minutes")

class OptimizationRequest(BaseModel):
    objectives: List[str] = Field(default=["fuel", "distance"], description="Optimization objectives")
    max_vehicles: int = Field(default=5, ge=1, le=10)
    simulation_speed: float = Field(default=100.0, ge=1, le=1000, description="Simulation speed multiplier")

class OptimizationResponse(BaseModel):
    success: bool
    run_id: Optional[int] = None
    fuel_before: float
    fuel_after: float
    fuel_savings_percent: float
    co2_saved: float
    model_accuracy: float
    routes: List[Dict[str, Any]]
    vehicles_used: int
    orders_served: int
    optimization_time: float
    simulation_started: bool

# In-memory storage for demo session
demo_session = {
    "depot": RoutePoint(latitude=41.0082, longitude=28.9784, name="Istanbul Central Depot"),
    "delivery_points": [],
    "vehicles": [
        Vehicle(id="TR-01", capacity=1500, fuel_efficiency=8.5, current_location=(41.0082, 28.9784)),
        Vehicle(id="TR-02", capacity=1500, fuel_efficiency=9.2, current_location=(41.0082, 28.9784)),
        Vehicle(id="TR-03", capacity=1000, fuel_efficiency=7.8, current_location=(41.0082, 28.9784)),
        Vehicle(id="TR-04", capacity=1000, fuel_efficiency=8.1, current_location=(41.0082, 28.9784)),
        Vehicle(id="TR-05", capacity=2000, fuel_efficiency=12.3, current_location=(41.0082, 28.9784))
    ],
    "last_optimization": None,
    "is_optimizing": False
}

@router.get("/demo/initial-data")
async def get_initial_demo_data() -> Dict[str, Any]:
    """
    Get initial demo data including depot, vehicles, and current delivery points.
    Used to initialize the map view.
    """
    
    return {
        "depot": {
            "lat": demo_session["depot"].latitude,
            "lon": demo_session["depot"].longitude,
            "name": demo_session["depot"].name
        },
        "vehicles": [
            {
                "id": vehicle.id,
                "capacity": vehicle.capacity,
                "fuel_efficiency": vehicle.fuel_efficiency,
                "available": vehicle.available,
                "location": {
                    "lat": vehicle.current_location[0],
                    "lon": vehicle.current_location[1]
                }
            }
            for vehicle in demo_session["vehicles"]
        ],
        "delivery_points": [
            {
                "id": f"point_{i}",
                "lat": point.latitude,
                "lon": point.longitude,
                "name": point.name or f"Delivery {i+1}",
                "weight": point.weight
            }
            for i, point in enumerate(demo_session["delivery_points"])
        ],
        "model_stats": ai_fuel_model.get_model_insights(),
        "simulation_status": vehicle_simulator.get_simulation_status()
    }

@router.post("/demo/add-delivery-point")
async def add_delivery_point(request: AddDeliveryRequest) -> Dict[str, Any]:
    """
    Add a new delivery point to the current demo session.
    Points are added by clicking on the map.
    """
    
    if len(demo_session["delivery_points"]) >= 20:
        raise HTTPException(status_code=400, detail="Maximum 20 delivery points allowed")
    
    # Create new delivery point
    point_id = len(demo_session["delivery_points"]) + 1
    new_point = RoutePoint(
        latitude=request.lat,
        longitude=request.lon,
        name=f"Delivery Point {point_id}",
        weight=request.weight
    )
    
    demo_session["delivery_points"].append(new_point)
    
    return {
        "success": True,
        "point_id": f"point_{point_id}",
        "total_points": len(demo_session["delivery_points"]),
        "added_point": {
            "id": f"point_{point_id}",
            "lat": request.lat,
            "lon": request.lon,
            "name": new_point.name,
            "weight": request.weight
        }
    }

...