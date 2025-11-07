/**
 * API service for communicating with the FastAPI backend
 * Handles all HTTP requests and response processing
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging and auth
api.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('❌ API Response Error:', error.response?.data || error.message);
    
    // Handle specific error cases
    if (error.response?.status === 404) {
      console.warn('🔍 Endpoint not found - check API documentation');
    } else if (error.response?.status >= 500) {
      console.error('🔥 Server error - backend may be down');
    }
    
    return Promise.reject(error);
  }
);

/**
 * Demo API endpoints
 */
export const demoApi = {
  // Get initial demo data (depot, vehicles, delivery points)
  getInitialData: async () => {
    const response = await api.get('/api/demo/initial-data');
    return response.data;
  },

  // Add a new delivery point
  addDeliveryPoint: async (pointData) => {
    const response = await api.post('/api/demo/add-delivery-point', pointData);
    return response.data;
  },

  // Remove a delivery point
  removeDeliveryPoint: async (pointIndex) => {
    const response = await api.delete(`/api/demo/delivery-point/${pointIndex}`);
    return response.data;
  },

  // Run route optimization
  optimizeRoutes: async (optimizationRequest) => {
    const response = await api.post('/api/demo/optimize', optimizationRequest);
    return response.data;
  },

  // Get optimization status
  getOptimizationStatus: async () => {
    const response = await api.get('/api/demo/optimization-status');
    return response.data;
  },

  // Get optimization history
  getHistory: async (limit = 10) => {
    const response = await api.get(`/api/demo/history?limit=${limit}`);
    return response.data;
  },

  // Control simulation
  controlSimulation: async (action, speed = null) => {
    const payload = { action };
    if (speed !== null) {
      payload.speed = speed;
    }
    const response = await api.post('/api/demo/simulation/control', payload);
    return response.data;
  },

  // Reset demo
  resetDemo: async () => {
    const response = await api.post('/api/demo/reset');
    return response.data;
  },

  // Get comprehensive insights
  getInsights: async () => {
    const response = await api.get('/api/demo/insights');
    return response.data;
  },

  // Export demo data
  exportData: async () => {
    const response = await api.get('/api/demo/export-data');
    return response.data;
  },

  // Get system stats
  getSystemStats: async () => {
    const response = await api.get('/api/demo/system-stats');
    return response.data;
  }
};

/**
 * System API endpoints
 */
export const systemApi = {
  // Health check
  healthCheck: async () => {
    const response = await api.get('/health');
    return response.data;
  },

  // Get root API info
  getApiInfo: async () => {
    const response = await api.get('/');
    return response.data;
  }
};

/**
 * Error handling utilities
 */
export const handleApiError = (error, defaultMessage = 'An error occurred') => {
  if (error.response) {
    // Server responded with error status
    const message = error.response.data?.detail || error.response.data?.message || defaultMessage;
    return {
      type: 'api_error',
      message,
      status: error.response.status,
      details: error.response.data
    };
  } else if (error.request) {
    // Network error
    return {
      type: 'network_error',
      message: 'Unable to connect to server. Please check your connection.',
      details: error.message
    };
  } else {
    // Other error
    return {
      type: 'unknown_error',
      message: error.message || defaultMessage,
      details: error
    };
  }
};

/**
 * API status utilities
 */
export const checkApiStatus = async () => {
  try {
    const health = await systemApi.healthCheck();
    return {
      status: 'online',
      details: health
    };
  } catch (error) {
    return {
      status: 'offline',
      error: handleApiError(error, 'API is not responding')
    };
  }
};

/**
 * Request timeout wrapper
 */
export const withTimeout = async (apiCall, timeoutMs = 10000) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
  });

  try {
    return await Promise.race([apiCall, timeoutPromise]);
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Retry wrapper for failed requests
 */
export const withRetry = async (apiCall, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const waitTime = delay * Math.pow(2, attempt - 1);
        console.log(`🔄 Retrying API call in ${waitTime}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError;
};

export default api;
