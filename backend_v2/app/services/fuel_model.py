"""
Advanced AI Fuel Efficiency Model with Learning Capabilities.
Simulates machine learning improvements in fuel consumption prediction.
"""

import random
import math
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
import json

@dataclass
class TerrainFactors:
    """Terrain and environmental factors affecting fuel consumption."""
    elevation_grade: float = 0.0      # Road gradient percentage
    road_curvature: float = 0.0       # Road curvature index
    intersection_count: int = 0       # Number of intersections
    traffic_density: float = 1.0      # Traffic density multiplier
    weather_factor: float = 1.0       # Weather impact factor

@dataclass
class VehicleProfile:
    """Vehicle specifications affecting fuel efficiency."""
    engine_efficiency: float = 8.5    # Base fuel efficiency (L/100km)
    weight_capacity: int = 1500       # Maximum cargo weight (kg)
    aerodynamic_factor: float = 1.0   # Aerodynamic efficiency
    age_factor: float = 1.0           # Vehicle age impact

class AIFuelModel:
    """
    Advanced AI fuel consumption model with learning capabilities.
    Simulates continuous improvement through machine learning.
    """
    
    def __init__(self):
        self.base_accuracy = 85.0
        self.current_accuracy = self.base_accuracy
        self.learning_iterations = 0
        
        # Neural network simulation coefficients
        self.model_weights = {
            'distance_factor': 0.118,          # Base fuel per km
            'weight_factor': 0.0082,           # Additional fuel per kg
            'grade_penalty': 0.156,            # Uphill penalty
            'curvature_penalty': 0.089,        # Winding road penalty
            'intersection_penalty': 0.034,     # Stop/start penalty
            'traffic_multiplier': 1.12,        # Traffic congestion
            'speed_efficiency': 0.95,          # Optimal speed factor
            'acceleration_penalty': 0.067      # Frequent acceleration penalty
        }
        
        # Learning parameters
        self.learning_rate = 0.02
        self.momentum = 0.85
        self.previous_gradients = {key: 0.0 for key in self.model_weights.keys()}
        
        # Performance tracking
        self.prediction_history = []
        self.actual_vs_predicted = []
    
    def calculate_base_consumption(self, distance_km: float, vehicle: VehicleProfile) -> float:
        """Calculate base fuel consumption without environmental factors."""
        base_rate = vehicle.engine_efficiency / 100.0  # Convert to L/km
        return distance_km * base_rate * vehicle.aerodynamic_factor * vehicle.age_factor
    
    def apply_terrain_factors(self, base_consumption: float, terrain: TerrainFactors) -> float:
        """Apply terrain and environmental factors to base consumption."""
        
        # Elevation grade impact (exponential for steep grades)
        grade_impact = 1.0 + (self.model_weights['grade_penalty'] * 
                             math.exp(abs(terrain.elevation_grade) / 10.0) - 1)
        
        # Road curvature impact
        curvature_impact = 1.0 + (self.model_weights['curvature_penalty'] * 
                                 terrain.road_curvature)
        
        # Intersection penalty (stop/start cycles)
        intersection_impact = 1.0 + (self.model_weights['intersection_penalty'] * 
                                   terrain.intersection_count / 10.0)
        
        # Traffic density impact
        traffic_impact = terrain.traffic_density * self.model_weights['traffic_multiplier']
        
        # Weather factor
        weather_impact = terrain.weather_factor
        
        total_multiplier = (grade_impact * curvature_impact * 
                          intersection_impact * traffic_impact * weather_impact)
        
        return base_consumption * total_multiplier
    
    def calculate_route_consumption(
        self, 
        distance_km: float, 
        cargo_weight: float, 
        vehicle: VehicleProfile,
        terrain: Optional[TerrainFactors] = None
    ) -> Dict[str, float]:
        """
        Calculate fuel consumption for a complete route with AI prediction.
        Returns detailed breakdown of fuel usage factors.
        """
        
        if terrain is None:
            terrain = self._generate_terrain_estimate(distance_km)
        
        # Base consumption
        base_fuel = self.calculate_base_consumption(distance_km, vehicle)
        
        # Weight penalty
        weight_ratio = cargo_weight / vehicle.weight_capacity
        weight_penalty = 1.0 + (self.model_weights['weight_factor'] * 
                               weight_ratio * cargo_weight / 100.0)
        
        # Apply terrain factors
        terrain_adjusted = self.apply_terrain_factors(base_fuel * weight_penalty, terrain)
        
        # AI accuracy adjustment
        accuracy_factor = self.current_accuracy / 100.0
        prediction_noise = random.gauss(0, (100 - self.current_accuracy) / 100.0 * 0.1)
        
        final_consumption = terrain_adjusted * accuracy_factor * (1 + prediction_noise)
        
        # Store prediction for learning
        self.prediction_history.append({
            'distance': distance_km,
            'weight': cargo_weight,
            'base_fuel': base_fuel,
            'final_fuel': final_consumption,
            'accuracy': self.current_accuracy
        })
        
        return {
            'total_fuel': round(final_consumption, 2),
            'base_consumption': round(base_fuel, 2),
            'weight_penalty': round(weight_penalty, 2),
            'terrain_factor': round(terrain_adjusted / (base_fuel * weight_penalty), 2),
            'accuracy_factor': round(accuracy_factor, 2),
            'confidence': round(self.current_accuracy, 1)
        }
    
    def _generate_terrain_estimate(self, distance_km: float) -> TerrainFactors:
        """Generate realistic terrain factors based on distance and randomization."""
        
        # Simulate terrain complexity based on route length
        complexity_factor = min(1.0, distance_km / 50.0)
        
        return TerrainFactors(
            elevation_grade=random.uniform(-0.05, 0.08) * complexity_factor,
            road_curvature=random.uniform(0.1, 0.6) * complexity_factor,
            intersection_count=int(distance_km * random.uniform(0.5, 2.0)),
            traffic_density=random.uniform(0.8, 1.4),
            weather_factor=random.uniform(0.95, 1.15)
        )
    
    def optimize_route_fuel(self, routes: List[Dict]) -> List[Dict]:
        """
        Apply AI optimization to minimize fuel consumption across multiple routes.
        Uses simulated gradient descent to improve route efficiency.
        """
        
        optimized_routes = []
        total_improvement = 0.0
        
        for route in routes:
            original_fuel = route.get('fuel_estimate', 0)
            
            # Simulate AI optimization (route reordering, timing optimization)
            optimization_factor = self._calculate_optimization_factor(route)
            optimized_fuel = original_fuel * optimization_factor
            
            improvement = (original_fuel - optimized_fuel) / original_fuel
            total_improvement += improvement
            
            optimized_route = route.copy()
            optimized_route.update({
                'fuel_estimate': round(optimized_fuel, 2),
                'optimization_factor': round(optimization_factor, 3),
                'fuel_saved': round(original_fuel - optimized_fuel, 2),
                'improvement_percent': round(improvement * 100, 1)
            })
            
            optimized_routes.append(optimized_route)
        
        return optimized_routes
    
    def _calculate_optimization_factor(self, route: Dict) -> float:
        """Calculate how much AI can optimize this specific route."""
        
        # Factors affecting optimization potential
        stops_count = len(route.get('stops', [])) - 2  # Exclude depot start/end
        distance = route.get('distance', 0)
        weight = route.get('weight', 0)
        
        # Base optimization (better stop ordering)
        stop_optimization = 0.05 + (stops_count * 0.02)  # More stops = more optimization potential
        
        # Distance optimization (route smoothing)
        distance_optimization = min(0.15, distance / 100.0 * 0.05)
        
        # Load optimization (better weight distribution)
        load_optimization = min(0.08, weight / 1000.0 * 0.03)
        
        # AI model accuracy contribution
        accuracy_bonus = (self.current_accuracy - 85) / 100.0 * 0.05
        
        total_optimization = stop_optimization + distance_optimization + load_optimization + accuracy_bonus
        
        # Add some randomness for realism
        noise = random.uniform(-0.02, 0.02)
        
        return max(0.75, 1.0 - total_optimization + noise)  # Never save more than 25%
    
    def simulate_learning(self, actual_fuel_data: Optional[List[float]] = None) -> Dict[str, float]:
        """
        Simulate AI model learning from new data.
        Improves accuracy and updates model weights.
        """
        
        self.learning_iterations += 1
        
        # Simulate learning improvement
        base_improvement = random.uniform(0.5, 2.8)
        
        # Learning rate decreases over time (diminishing returns)
        learning_efficiency = 1.0 / (1.0 + self.learning_iterations * 0.1)
        actual_improvement = base_improvement * learning_efficiency
        
        # Update accuracy with maximum cap
        old_accuracy = self.current_accuracy
        self.current_accuracy = min(98.5, self.current_accuracy + actual_improvement)
        
        # Update model weights using simulated gradient descent
        self._update_model_weights()
        
        # Calculate learning metrics
        learning_velocity = actual_improvement / (self.learning_iterations + 1)
        convergence_rate = (98.5 - self.current_accuracy) / 98.5
        
        return {
            'accuracy': round(self.current_accuracy, 1),
            'improvement': round(actual_improvement, 2),
            'iterations': self.learning_iterations,
            'learning_velocity': round(learning_velocity, 3),
            'convergence_rate': round(convergence_rate, 3),
            'model_confidence': round(min(95, self.current_accuracy + 
                                        (self.learning_iterations * 0.5)), 1)
        }
    
    def _update_model_weights(self):
        """Update model weights using simulated gradient descent with momentum."""
        
        for weight_name in self.model_weights:
            # Simulate gradient calculation
            gradient = random.uniform(-0.01, 0.01) * (100 - self.current_accuracy) / 100
            
            # Apply momentum
            momentum_term = self.momentum * self.previous_gradients[weight_name]
            gradient_term = self.learning_rate * gradient
            
            # Update weight
            self.model_weights[weight_name] += momentum_term + gradient_term
            
            # Store gradient for next iteration
            self.previous_gradients[weight_name] = gradient_term
            
            # Ensure weights stay within reasonable bounds
            self.model_weights[weight_name] = max(0.01, 
                                                min(2.0, self.model_weights[weight_name]))
    
    def get_model_insights(self) -> Dict[str, any]:
        """Get detailed insights about the AI model's current state."""
        
        return {
            'model_accuracy': round(self.current_accuracy, 1),
            'current_accuracy': round(self.current_accuracy, 1),  # alias for backward compatibility
            'learning_progress': round(
                max(0.0, self.current_accuracy - self.base_accuracy) /
                max(1e-6, 98.5 - self.base_accuracy) * 100,
                1
            ),
            'learning_iterations': self.learning_iterations,
            'model_weights': {k: round(v, 4) for k, v in self.model_weights.items()},
            'prediction_confidence': round(min(95, self.current_accuracy + 
                                             (self.learning_iterations * 0.3)), 1),
            'optimization_potential': round((98.5 - self.current_accuracy) / 13.5 * 100, 1),
            'training_data_points': len(self.prediction_history),
            'model_stability': round(100 - (abs(random.gauss(0, (100 - self.current_accuracy) / 50))), 1)
        }
    
    def reset_model(self):
        """Reset the AI model to initial state."""
        self.current_accuracy = self.base_accuracy
        self.learning_iterations = 0
        self.prediction_history = []
        self.actual_vs_predicted = []
        self.previous_gradients = {key: 0.0 for key in self.model_weights.keys()}
        
        # Reset weights to initial values
        self.model_weights = {
            'distance_factor': 0.118,
            'weight_factor': 0.0082,
            'grade_penalty': 0.156,
            'curvature_penalty': 0.089,
            'intersection_penalty': 0.034,
            'traffic_multiplier': 1.12,
            'speed_efficiency': 0.95,
            'acceleration_penalty': 0.067
        }
    
    def export_model_state(self) -> str:
        """Export current model state as JSON for persistence."""
        state = {
            'accuracy': self.current_accuracy,
            'iterations': self.learning_iterations,
            'weights': self.model_weights,
            'history_count': len(self.prediction_history)
        }
        return json.dumps(state, indent=2)
    
    def import_model_state(self, state_json: str):
        """Import model state from JSON."""
        try:
            state = json.loads(state_json)
            self.current_accuracy = state['accuracy']
            self.learning_iterations = state['iterations']
            self.model_weights = state['weights']
        except Exception as e:
            print(f"Failed to import model state: {e}")

# Global model instance for the application
ai_fuel_model = AIFuelModel()