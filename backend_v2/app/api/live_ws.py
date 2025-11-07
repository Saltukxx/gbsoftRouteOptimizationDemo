"""
WebSocket handler for real-time vehicle tracking and live updates.
Broadcasts vehicle positions, optimization progress, and system events.
"""

from fastapi import WebSocket, WebSocketDisconnect
from typing import List, Dict, Set
import asyncio
import json
import logging
import time
from datetime import datetime

# WebSocket connection manager
class ConnectionManager:
    """Manages WebSocket connections for real-time updates."""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connection_info: Dict[WebSocket, Dict] = {}
        self.logger = logging.getLogger(__name__)
        
    async def connect(self, websocket: WebSocket, client_info: Dict = None):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        
        # Store connection metadata
        self.connection_info[websocket] = {
            "connected_at": datetime.now(),
            "client_info": client_info or {},
            "last_ping": time.time()
        }
        
        self.logger.info(f"WebSocket client connected. Total connections: {len(self.active_connections)}")
        
        # Send welcome message
        await self.send_personal_message({
            "type": "connection_established",
            "timestamp": time.time(),
            "message": "Connected to AI Route Optimization Demo",
            "client_id": id(websocket)
        }, websocket)
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            
        if websocket in self.connection_info:
            del self.connection_info[websocket]
            
        self.logger.info(f"WebSocket client disconnected. Remaining connections: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: Dict, websocket: WebSocket):
        """Send a message to a specific WebSocket connection."""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            self.logger.warning(f"Failed to send personal message: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: Dict):
        """Broadcast a message to all connected clients."""
        if not self.active_connections:
            return
        
        message_json = json.dumps(message)
        disconnected_connections = []
        
        for connection in self.active_connections:
            try:
                await connection.send_text(message_json)
            except Exception as e:
                self.logger.warning(f"Failed to broadcast to client: {e}")
                disconnected_connections.append(connection)
        
        # Clean up disconnected connections
        for connection in disconnected_connections:
            self.disconnect(connection)
    
    async def broadcast_vehicle_update(self, vehicle_data: List[Dict]):
        """Broadcast vehicle position updates."""
        message = {
            "type": "vehicle_update",
            "timestamp": time.time(),
            "vehicles": vehicle_data,
            "active_count": len([v for v in vehicle_data if v.get("status") != "completed"])
        }
        await self.broadcast(message)
    
    async def broadcast_optimization_progress(self, progress_data: Dict):
        """Broadcast optimization progress updates."""
        message = {
            "type": "optimization_progress",
            "timestamp": time.time(),
            "progress": progress_data
        }
        await self.broadcast(message)
    
    async def broadcast_simulation_event(self, event_type: str, event_data: Dict):
        """Broadcast simulation events (delivery completed, route finished, etc.)."""
        message = {
            "type": "simulation_event",
            "event": event_type,
            "timestamp": time.time(),
            "data": event_data
        }
        await self.broadcast(message)
    
    async def broadcast_ai_learning_update(self, learning_data: Dict):
        """Broadcast AI model learning updates."""
        message = {
            "type": "ai_learning",
            "timestamp": time.time(),
            "learning_data": learning_data
        }
        await self.broadcast(message)
    
    async def send_system_status(self, websocket: WebSocket = None):
        """Send current system status to specific client or all clients."""
        from ..services.simulator import vehicle_simulator
        from ..services.fuel_model import ai_fuel_model
        
        status_message = {
            "type": "system_status",
            "timestamp": time.time(),
            "simulation_status": vehicle_simulator.get_simulation_status(),
            "model_insights": ai_fuel_model.get_model_insights(),
            "active_connections": len(self.active_connections)
        }
        
        if websocket:
            await self.send_personal_message(status_message, websocket)
        else:
            await self.broadcast(status_message)
    
    def get_connection_stats(self) -> Dict:
        """Get statistics about active connections."""
        now = time.time()
        
        return {
            "total_connections": len(self.active_connections),
            "connections_info": [
                {
                    "client_id": id(conn),
                    "connected_duration": now - info["last_ping"],
                    "client_info": info["client_info"]
                }
                for conn, info in self.connection_info.items()
            ]
        }

# Global connection manager instance
manager = ConnectionManager()

# WebSocket event handlers
async def handle_websocket_connection(websocket: WebSocket):
    """Main WebSocket connection handler."""
    
    await manager.connect(websocket)
    
    try:
        # Send initial system status
        await manager.send_system_status(websocket)
        
        # Listen for incoming messages
        while True:
            # Wait for client messages
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                await handle_client_message(message, websocket)
                
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await manager.send_personal_message({
                    "type": "error",
                    "message": "Invalid JSON format"
                }, websocket)
            except Exception as e:
                logging.error(f"Error handling WebSocket message: {e}")
                await manager.send_personal_message({
                    "type": "error",
                    "message": "Internal server error"
                }, websocket)
                
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)

async def handle_client_message(message: Dict, websocket: WebSocket):
    """Handle incoming messages from WebSocket clients."""
    
    message_type = message.get("type", "")
    
    if message_type == "ping":
        # Respond to ping with pong
        await manager.send_personal_message({
            "type": "pong",
            "timestamp": time.time()
        }, websocket)
        
        # Update last ping time
        if websocket in manager.connection_info:
            manager.connection_info[websocket]["last_ping"] = time.time()
    
    elif message_type == "request_status":
        # Send current system status
        await manager.send_system_status(websocket)
    
    elif message_type == "subscribe_vehicle_updates":
        # Client wants to receive vehicle updates
        client_info = manager.connection_info.get(websocket, {})
        client_info["subscriptions"] = client_info.get("subscriptions", [])
        if "vehicle_updates" not in client_info["subscriptions"]:
            client_info["subscriptions"].append("vehicle_updates")
        
        await manager.send_personal_message({
            "type": "subscription_confirmed",
            "subscription": "vehicle_updates"
        }, websocket)
    
    elif message_type == "client_info":
        # Store client information
        if websocket in manager.connection_info:
            manager.connection_info[websocket]["client_info"].update(
                message.get("data", {})
            )
    
    else:
        # Unknown message type
        await manager.send_personal_message({
            "type": "error",
            "message": f"Unknown message type: {message_type}"
        }, websocket)

# Callback function for vehicle simulator
async def broadcast_vehicle_positions(vehicle_data_json: str):
    """Callback function called by vehicle simulator to broadcast positions."""
    
    try:
        vehicle_data = json.loads(vehicle_data_json)
        
        if vehicle_data.get("type") == "vehicle_update":
            await manager.broadcast_vehicle_update(vehicle_data.get("vehicles", []))
        
    except Exception as e:
        logging.error(f"Error broadcasting vehicle positions: {e}")

# Initialize simulator callback
def setup_simulator_callbacks():
    """Set up callbacks for the vehicle simulator."""
    from ..services.simulator import vehicle_simulator
    
    vehicle_simulator.add_websocket_callback(broadcast_vehicle_positions)
    logging.info("WebSocket callbacks registered with vehicle simulator")

# Utility functions for broadcasting events
async def broadcast_optimization_started(optimization_data: Dict):
    """Broadcast that optimization has started."""
    await manager.broadcast_optimization_progress({
        "status": "started",
        "data": optimization_data
    })

async def broadcast_optimization_completed(result_data: Dict):
    """Broadcast optimization completion."""
    await manager.broadcast_optimization_progress({
        "status": "completed",
        "data": result_data
    })

async def broadcast_delivery_completed(vehicle_id: str, delivery_info: Dict):
    """Broadcast when a vehicle completes a delivery."""
    await manager.broadcast_simulation_event("delivery_completed", {
        "vehicle_id": vehicle_id,
        "delivery": delivery_info
    })

async def broadcast_route_completed(vehicle_id: str, route_stats: Dict):
    """Broadcast when a vehicle completes its entire route."""
    await manager.broadcast_simulation_event("route_completed", {
        "vehicle_id": vehicle_id,
        "stats": route_stats
    })

async def broadcast_ai_model_improved(learning_stats: Dict):
    """Broadcast AI model learning improvements."""
    await manager.broadcast_ai_learning_update(learning_stats)

# Health check and monitoring
async def websocket_health_check():
    """Periodic health check for WebSocket connections."""
    
    while True:
        try:
            # Send ping to all connections to check health
            current_time = time.time()
            
            # Remove stale connections (no ping for more than 60 seconds)
            stale_connections = []
            for websocket, info in manager.connection_info.items():
                if current_time - info["last_ping"] > 60:
                    stale_connections.append(websocket)
            
            for websocket in stale_connections:
                manager.disconnect(websocket)
            
            # Send periodic status update
            if manager.active_connections:
                await manager.broadcast({
                    "type": "heartbeat",
                    "timestamp": current_time,
                    "active_connections": len(manager.active_connections)
                })
            
            # Wait 30 seconds before next check
            await asyncio.sleep(30)
            
        except Exception as e:
            logging.error(f"WebSocket health check error: {e}")
            await asyncio.sleep(30)

# Start health check task (called during app startup)
def start_websocket_monitoring():
    """Start WebSocket monitoring task."""
    asyncio.create_task(websocket_health_check())
    logging.info("WebSocket monitoring started")