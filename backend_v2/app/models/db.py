"""
Database configuration and session management for the AI Route Optimization Demo.
Uses SQLite with SQLAlchemy ORM for storing optimization history and results.
"""

from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.sql import func
import os
from typing import Optional

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./demo.db")

# Create SQLAlchemy engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False  # Set to True for SQL query logging
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all models
Base = declarative_base()

class RouteHistory(Base):
    """
    Stores optimization run results for historical tracking and comparison.
    Each record represents one complete optimization run with fuel savings data.
    """
    __tablename__ = "route_history"
    
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Optimization results
    fuel_before = Column(Float, nullable=False)  # Liters before optimization
    fuel_after = Column(Float, nullable=False)   # Liters after optimization
    saving_percent = Column(Float, nullable=False)  # Percentage saved
    co2_saved = Column(Float, nullable=False)    # CO2 reduction in kg
    
    # AI model metrics
    model_accuracy = Column(Float, nullable=False)  # AI model accuracy %
    learning_improvement = Column(Float, nullable=False)  # Improvement this run
    
    # Route metadata
    total_vehicles_used = Column(Integer, nullable=False)
    total_orders = Column(Integer, nullable=False)
    total_distance = Column(Float, nullable=False)  # Total distance in km
    
    # Relationships
    route_stops = relationship("RouteStop", back_populates="history", cascade="all, delete-orphan")

class RouteStop(Base):
    """
    Individual stops within each optimized route.
    Links to RouteHistory to track complete route sequences.
    """
    __tablename__ = "route_stops"
    
    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("route_history.id"), nullable=False)
    
    # Vehicle and route info
    vehicle_id = Column(String(50), nullable=False)  # e.g., "TR-01"
    sequence = Column(Integer, nullable=False)       # Stop order in route
    
    # Location data
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_name = Column(String(200), nullable=True)
    
    # Cargo information
    cargo_weight = Column(Float, nullable=True)     # Weight in kg
    cargo_description = Column(String(500), nullable=True)
    
    # Timing estimates
    estimated_arrival = Column(DateTime, nullable=True)
    estimated_duration = Column(Integer, nullable=True)  # Minutes at stop
    
    # Relationships
    history = relationship("RouteHistory", back_populates="route_stops")

class VehicleState(Base):
    """
    Real-time vehicle position and status for live simulation.
    Updated continuously during route simulation.
    """
    __tablename__ = "vehicle_states"
    
    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("route_history.id"), nullable=False)
    
    # Vehicle identification
    vehicle_id = Column(String(50), nullable=False)
    
    # Current position
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    # Movement data
    speed = Column(Float, nullable=False)           # km/h
    heading = Column(Float, nullable=False)         # Degrees
    progress = Column(Float, nullable=False)        # Route completion %
    
    # Status information
    status = Column(String(50), nullable=False)     # "moving", "delivering", "idle"
    current_cargo = Column(Float, nullable=False)   # Current load in kg
    fuel_used = Column(Float, nullable=False)       # Fuel used so far
    
    # Timestamps
    last_updated = Column(DateTime, server_default=func.now(), onupdate=func.now())

# Database initialization functions
def create_tables():
    """Create all database tables if they don't exist."""
    Base.metadata.create_all(bind=engine)

def get_db():
    """
    Dependency function for FastAPI to get database session.
    Ensures proper session cleanup after each request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_database():
    """Initialize database with tables and any required seed data."""
    create_tables()
    print("✅ Database initialized successfully")

# Session management helper
class DatabaseManager:
    """Helper class for database operations with context management."""
    
    @staticmethod
    def get_session():
        """Get a new database session."""
        return SessionLocal()
    
    @staticmethod
    def save_optimization_result(
        fuel_before: float,
        fuel_after: float,
        saving_percent: float,
        co2_saved: float,
        model_accuracy: float,
        learning_improvement: float,
        total_vehicles_used: int,
        total_orders: int,
        total_distance: float
    ) -> int:
        """Save optimization results to database and return the run ID."""
        with DatabaseManager.get_session() as db:
            history = RouteHistory(
                fuel_before=fuel_before,
                fuel_after=fuel_after,
                saving_percent=saving_percent,
                co2_saved=co2_saved,
                model_accuracy=model_accuracy,
                learning_improvement=learning_improvement,
                total_vehicles_used=total_vehicles_used,
                total_orders=total_orders,
                total_distance=total_distance
            )
            db.add(history)
            db.commit()
            db.refresh(history)
            return history.id
    
    @staticmethod
    def get_optimization_history(limit: int = 10):
        """Retrieve recent optimization history."""
        with DatabaseManager.get_session() as db:
            return db.query(RouteHistory)\
                     .order_by(RouteHistory.created_at.desc())\
                     .limit(limit)\
                     .all()
    
    @staticmethod
    def get_cumulative_savings():
        """Calculate cumulative fuel and CO2 savings across all runs."""
        with DatabaseManager.get_session() as db:
            results = db.query(
                func.sum(RouteHistory.fuel_before - RouteHistory.fuel_after).label('total_fuel_saved'),
                func.sum(RouteHistory.co2_saved).label('total_co2_saved'),
                func.count(RouteHistory.id).label('total_runs'),
                func.avg(RouteHistory.saving_percent).label('avg_savings_percent')
            ).first()
            
            return {
                'total_fuel_saved': float(results.total_fuel_saved or 0),
                'total_co2_saved': float(results.total_co2_saved or 0),
                'total_runs': int(results.total_runs or 0),
                'avg_savings_percent': float(results.avg_savings_percent or 0)
            }