import { Obstacle } from '@/types/obstacle';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.example.com/api';

interface CreateObstacleRequest {
  position: [number, number]; // [latitude, longitude]
  type: number;
  description: string;
  dangerLevel: number;
  nodes?: [number, number];
  nearestDistance?: number;
}

interface UpdateObstacleRequest {
  position: [number, number]; // [latitude, longitude]
  type: number;
  description: string;
  dangerLevel: number;
  nodes?: [number, number];
  nearestDistance?: number;
}

interface ListObstacleResponse {
  items: Obstacle[];
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  statusCode: number;
}

async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const statusCode = response.status;
  
  if (response.ok) {
    const data = await response.json();
    return { data, statusCode };
  }
  
  try {
    const errorData = await response.json();
    return { 
      error: errorData.message || 'Something went wrong', 
      statusCode
    };
  } catch (e) {
    return { 
      error: `An error occurred (${statusCode})`, 
      statusCode
    };
  }
}

export const obstacleApi = {
  // Get all obstacles
  async getAll(): Promise<ApiResponse<Obstacle[]>> {
    try {
      const response = await fetch(`${API_BASE_URL}/obstacles`);
      const apiResponse = await handleResponse<ListObstacleResponse>(response);
      
      if (apiResponse.data) {
        return {
          data: apiResponse.data.items,
          statusCode: apiResponse.statusCode
        };
      }
      
      return {
        error: apiResponse.error,
        statusCode: apiResponse.statusCode
      };
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Failed to fetch obstacles',
        statusCode: 500
      };
    }
  },
  
  // Get obstacle by ID
  async getById(id: number): Promise<ApiResponse<Obstacle>> {
    try {
      const response = await fetch(`${API_BASE_URL}/obstacles/${id}`);
      return handleResponse<Obstacle>(response);
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Failed to fetch obstacle',
        statusCode: 500
      };
    }
  },
  
  // Create a new obstacle
  async create(obstacle: CreateObstacleRequest): Promise<ApiResponse<Obstacle>> {
    try {
      const response = await fetch(`${API_BASE_URL}/obstacles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify(obstacle),
      });
      
      return handleResponse<Obstacle>(response);
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Failed to create obstacle',
        statusCode: 500
      };
    }
  },
  
  // Update an obstacle
  async update(id: number, obstacle: UpdateObstacleRequest): Promise<ApiResponse<Obstacle>> {
    try {
      const response = await fetch(`${API_BASE_URL}/obstacles/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify(obstacle),
      });
      
      return handleResponse<Obstacle>(response);
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Failed to update obstacle',
        statusCode: 500
      };
    }
  },
  
  // Delete an obstacle
  async delete(id: number): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`${API_BASE_URL}/obstacles/${id}`, {
        method: 'DELETE',
        mode: 'cors',
      });
      
      if (response.status === 204) {
        return { statusCode: 204 };
      }
      
      return handleResponse<void>(response);
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Failed to delete obstacle',
        statusCode: 500
      };
    }
  },
}; 