/**
 * FleetGo API Integration Service
 *
 * This service provides integration with the FleetGo fleet management API
 * for syncing vehicle data including locations, mileage, and vehicle details.
 *
 * SECURITY: This client calls the local API proxy at /api/fleetgo instead of
 * calling FleetGo directly. The API key is kept secure on the server.
 */

// API Configuration - uses local proxy for security
const FLEETGO_PROXY_URL = '/api/fleetgo';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Vehicle status enumeration
 */
export enum VehicleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  OUT_OF_SERVICE = 'out_of_service',
}

/**
 * Ignition state enumeration
 */
export enum IgnitionState {
  ON = 'on',
  OFF = 'off',
  UNKNOWN = 'unknown',
}

/**
 * GPS coordinates
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
}

/**
 * Vehicle location data
 */
export interface VehicleLocation {
  vehicleId: string;
  location: GeoLocation;
  speed: number; // km/h
  heading: number; // degrees (0-360)
  ignition: IgnitionState;
  timestamp: string; // ISO 8601 date string
  address?: string; // Reverse geocoded address if available
}

/**
 * Vehicle mileage/odometer data
 */
export interface VehicleMileage {
  vehicleId: string;
  odometer: number; // Total kilometers
  tripOdometer?: number; // Current trip kilometers
  lastUpdated: string; // ISO 8601 date string
  dailyMileage?: number; // Kilometers driven today
  weeklyMileage?: number; // Kilometers driven this week
  monthlyMileage?: number; // Kilometers driven this month
}

/**
 * Vehicle fuel information
 */
export interface VehicleFuel {
  fuelType: 'diesel' | 'petrol' | 'electric' | 'hybrid' | 'lpg' | 'unknown';
  fuelLevel?: number; // Percentage (0-100)
  fuelCapacity?: number; // Liters
  averageConsumption?: number; // L/100km or kWh/100km for electric
}

/**
 * Vehicle maintenance information
 */
export interface VehicleMaintenance {
  lastServiceDate?: string;
  nextServiceDate?: string;
  nextServiceMileage?: number;
  apkExpiryDate?: string; // Dutch vehicle inspection (APK)
  insuranceExpiryDate?: string;
}

/**
 * Driver information
 */
export interface Driver {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  licenseNumber?: string;
}

/**
 * Complete vehicle data
 */
export interface Vehicle {
  id: string;
  licensePlate: string;
  vin?: string; // Vehicle Identification Number
  make: string;
  model: string;
  year?: number;
  color?: string;
  status: VehicleStatus;
  category?: string; // e.g., 'van', 'truck', 'car'
  department?: string;
  assignedDriver?: Driver;
  fuel?: VehicleFuel;
  maintenance?: VehicleMaintenance;
  currentLocation?: VehicleLocation;
  currentMileage?: VehicleMileage;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * API response wrapper
 */
export interface FleetGoApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    totalCount?: number;
    totalPages?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Vehicles list response
 */
export interface VehiclesListResponse {
  vehicles: Vehicle[];
  total: number;
}

/**
 * Proxy response indicating mock mode
 */
interface ProxyMockResponse {
  useMockData: true;
  message: string;
}

/**
 * Proxy error response
 */
interface ProxyErrorResponse {
  error: string;
  code?: string;
  statusCode?: number;
}

/**
 * FleetGo API error
 */
export class FleetGoError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: unknown;

  constructor(message: string, code: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'FleetGoError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// =============================================================================
// Mock Data Generator
// =============================================================================

/**
 * Mock data generator for development and testing
 */
export class FleetGoMockDataGenerator {
  private static licensePlates = [
    'V-123-AB', 'V-456-CD', 'V-789-EF', 'V-012-GH', 'V-345-IJ',
    'BN-12-XY', 'BN-34-ZA', 'BN-56-BC', 'BN-78-DE', 'BN-90-FG',
  ];

  private static makes = ['Mercedes-Benz', 'Volkswagen', 'Ford', 'Renault', 'Iveco'];
  private static models = ['Sprinter', 'Crafter', 'Transit', 'Master', 'Daily'];
  private static colors = ['White', 'Silver', 'Blue', 'Green', 'Black'];
  private static departments = ['Garden Services', 'Landscaping', 'Maintenance', 'Transport', 'Administration'];
  private static driverNames = [
    'Jan de Vries', 'Pieter Bakker', 'Klaas Jansen', 'Willem van Dijk',
    'Hendrik Visser', 'Joost Smit', 'Bas Mulder', 'Erik de Boer',
  ];

  /**
   * Generate a random vehicle
   */
  static generateVehicle(id?: string): Vehicle {
    const vehicleId = id || `vehicle_${Math.random().toString(36).substring(2, 11)}`;
    const index = Math.floor(Math.random() * this.licensePlates.length);

    return {
      id: vehicleId,
      licensePlate: this.licensePlates[index] || `XX-${Math.floor(Math.random() * 100)}-YY`,
      vin: `WDB${Math.random().toString(36).substring(2, 18).toUpperCase()}`,
      make: this.makes[Math.floor(Math.random() * this.makes.length)],
      model: this.models[Math.floor(Math.random() * this.models.length)],
      year: 2018 + Math.floor(Math.random() * 7),
      color: this.colors[Math.floor(Math.random() * this.colors.length)],
      status: VehicleStatus.ACTIVE,
      category: 'van',
      department: this.departments[Math.floor(Math.random() * this.departments.length)],
      assignedDriver: {
        id: `driver_${Math.random().toString(36).substring(2, 11)}`,
        name: this.driverNames[Math.floor(Math.random() * this.driverNames.length)],
        email: `driver${index}@toptuinen.nl`,
        phone: `+31 6 ${Math.floor(10000000 + Math.random() * 90000000)}`,
      },
      fuel: {
        fuelType: 'diesel',
        fuelLevel: 30 + Math.floor(Math.random() * 70),
        fuelCapacity: 80,
        averageConsumption: 8 + Math.random() * 4,
      },
      maintenance: {
        lastServiceDate: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
        nextServiceDate: new Date(Date.now() + Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
        nextServiceMileage: 100000 + Math.floor(Math.random() * 50000),
        apkExpiryDate: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      tags: ['Top Tuinen', 'Service Vehicle'],
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate a vehicle location
   */
  static generateVehicleLocation(vehicleId: string): VehicleLocation {
    // Generate random location around Utrecht, Netherlands area
    const baseLat = 52.0907;
    const baseLng = 5.1214;

    return {
      vehicleId,
      location: {
        latitude: baseLat + (Math.random() - 0.5) * 0.5,
        longitude: baseLng + (Math.random() - 0.5) * 0.5,
        altitude: 0 + Math.random() * 50,
        accuracy: 5 + Math.random() * 15,
      },
      speed: Math.random() > 0.3 ? Math.floor(Math.random() * 100) : 0,
      heading: Math.floor(Math.random() * 360),
      ignition: Math.random() > 0.3 ? IgnitionState.ON : IgnitionState.OFF,
      timestamp: new Date().toISOString(),
      address: 'Utrechtseweg 123, Utrecht',
    };
  }

  /**
   * Generate vehicle mileage data
   */
  static generateVehicleMileage(vehicleId: string): VehicleMileage {
    const totalMileage = 50000 + Math.floor(Math.random() * 150000);

    return {
      vehicleId,
      odometer: totalMileage,
      tripOdometer: Math.floor(Math.random() * 500),
      lastUpdated: new Date().toISOString(),
      dailyMileage: Math.floor(Math.random() * 200),
      weeklyMileage: Math.floor(Math.random() * 1000),
      monthlyMileage: Math.floor(Math.random() * 4000),
    };
  }

  /**
   * Generate a list of vehicles
   */
  static generateVehicles(count: number = 5): Vehicle[] {
    const vehicles: Vehicle[] = [];
    const usedPlates = new Set<string>();

    for (let i = 0; i < count; i++) {
      const vehicle = this.generateVehicle(`vehicle_${i + 1}`);

      // Ensure unique license plates
      while (usedPlates.has(vehicle.licensePlate)) {
        vehicle.licensePlate = `V-${Math.floor(100 + Math.random() * 900)}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
      }
      usedPlates.add(vehicle.licensePlate);

      // Add location and mileage
      vehicle.currentLocation = this.generateVehicleLocation(vehicle.id);
      vehicle.currentMileage = this.generateVehicleMileage(vehicle.id);

      vehicles.push(vehicle);
    }

    return vehicles;
  }
}

// =============================================================================
// FleetGo Client
// =============================================================================

/**
 * Client options
 */
export interface FleetGoClientOptions {
  baseUrl?: string;
  timeout?: number;
  useMockData?: boolean;
  mockVehicleCount?: number;
}

/**
 * Type guard for mock response
 */
function isProxyMockResponse(data: unknown): data is ProxyMockResponse {
  return typeof data === 'object' && data !== null && 'useMockData' in data && (data as ProxyMockResponse).useMockData === true;
}

/**
 * Type guard for error response
 */
function isProxyErrorResponse(data: unknown): data is ProxyErrorResponse {
  return typeof data === 'object' && data !== null && 'error' in data;
}

/**
 * FleetGo API Client
 *
 * SECURITY: This client uses the local API proxy at /api/fleetgo
 * instead of calling FleetGo directly. The API key is never exposed
 * to the client/browser.
 */
export class FleetGoClient {
  private readonly proxyUrl: string;
  private readonly timeout: number;
  private useMockData: boolean;
  private mockVehicles: Vehicle[] = [];
  private mockDataInitialized: boolean = false;

  constructor(options: FleetGoClientOptions = {}) {
    this.proxyUrl = options.baseUrl || FLEETGO_PROXY_URL;
    this.timeout = options.timeout || 30000;
    this.useMockData = options.useMockData ?? false;

    // Initialize mock data if explicitly using mock mode
    if (this.useMockData) {
      this.mockVehicles = FleetGoMockDataGenerator.generateVehicles(options.mockVehicleCount || 5);
      this.mockDataInitialized = true;
    }
  }

  /**
   * Check if client is using mock data
   */
  public isUsingMockData(): boolean {
    return this.useMockData;
  }

  /**
   * Initialize mock data if server indicates no API key
   */
  private initializeMockData(count: number = 5): void {
    if (!this.mockDataInitialized) {
      this.mockVehicles = FleetGoMockDataGenerator.generateVehicles(count);
      this.useMockData = true;
      this.mockDataInitialized = true;
      console.warn('[FleetGo] Running in mock mode - API key not configured on server');
    }
  }

  /**
   * Make a request through the API proxy
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint,
          method,
          body,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      // Check if server indicates mock mode should be used
      if (isProxyMockResponse(data)) {
        this.initializeMockData();
        throw new FleetGoError(
          'API key not configured - using mock data',
          'MOCK_MODE'
        );
      }

      // Check for error response
      if (isProxyErrorResponse(data)) {
        throw new FleetGoError(
          data.error,
          data.code || 'API_ERROR',
          data.statusCode
        );
      }

      // Handle non-OK responses
      if (!response.ok) {
        throw new FleetGoError(
          `HTTP error ${response.status}`,
          'HTTP_ERROR',
          response.status
        );
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof FleetGoError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new FleetGoError('Request timeout', 'TIMEOUT');
        }
        throw new FleetGoError(error.message, 'NETWORK_ERROR');
      }

      throw new FleetGoError('Unknown error occurred', 'UNKNOWN_ERROR');
    }
  }

  /**
   * Get all vehicles
   */
  async getVehicles(): Promise<Vehicle[]> {
    if (this.useMockData) {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      return this.mockVehicles;
    }

    try {
      const response = await this.request<FleetGoApiResponse<VehiclesListResponse>>('/vehicles');
      return response.data.vehicles;
    } catch (error) {
      if (error instanceof FleetGoError && error.code === 'MOCK_MODE') {
        // Mock data is now initialized, retry will use mock path
        if (this.useMockData) {
          return this.getVehicles();
        }
      }
      throw error;
    }
  }

  /**
   * Get a single vehicle by ID
   */
  async getVehicle(id: string): Promise<Vehicle> {
    if (!id) {
      throw new FleetGoError('Vehicle ID is required', 'INVALID_PARAMETER');
    }

    if (this.useMockData) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const vehicle = this.mockVehicles.find((v) => v.id === id);
      if (!vehicle) {
        throw new FleetGoError(`Vehicle with ID ${id} not found`, 'NOT_FOUND', 404);
      }
      return vehicle;
    }

    try {
      const response = await this.request<FleetGoApiResponse<Vehicle>>(`/vehicles/${encodeURIComponent(id)}`);
      return response.data;
    } catch (error) {
      if (error instanceof FleetGoError && error.code === 'MOCK_MODE') {
        if (this.useMockData) {
          return this.getVehicle(id);
        }
      }
      throw error;
    }
  }

  /**
   * Get a vehicle by license plate
   */
  async getVehicleByLicensePlate(plate: string): Promise<Vehicle> {
    if (!plate) {
      throw new FleetGoError('License plate is required', 'INVALID_PARAMETER');
    }

    // Normalize license plate (remove spaces and dashes, uppercase)
    const normalizedPlate = plate.replace(/[\s-]/g, '').toUpperCase();

    if (this.useMockData) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const vehicle = this.mockVehicles.find((v) =>
        v.licensePlate.replace(/[\s-]/g, '').toUpperCase() === normalizedPlate
      );
      if (!vehicle) {
        throw new FleetGoError(`Vehicle with license plate ${plate} not found`, 'NOT_FOUND', 404);
      }
      return vehicle;
    }

    try {
      const response = await this.request<FleetGoApiResponse<Vehicle>>(`/vehicles/license-plate/${encodeURIComponent(normalizedPlate)}`);
      return response.data;
    } catch (error) {
      if (error instanceof FleetGoError && error.code === 'MOCK_MODE') {
        if (this.useMockData) {
          return this.getVehicleByLicensePlate(plate);
        }
      }
      throw error;
    }
  }

  /**
   * Get current location of a vehicle
   */
  async getVehicleLocation(id: string): Promise<VehicleLocation> {
    if (!id) {
      throw new FleetGoError('Vehicle ID is required', 'INVALID_PARAMETER');
    }

    if (this.useMockData) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const vehicle = this.mockVehicles.find((v) => v.id === id);
      if (!vehicle) {
        throw new FleetGoError(`Vehicle with ID ${id} not found`, 'NOT_FOUND', 404);
      }
      // Generate fresh location data
      return FleetGoMockDataGenerator.generateVehicleLocation(id);
    }

    try {
      const response = await this.request<FleetGoApiResponse<VehicleLocation>>(`/vehicles/${encodeURIComponent(id)}/location`);
      return response.data;
    } catch (error) {
      if (error instanceof FleetGoError && error.code === 'MOCK_MODE') {
        if (this.useMockData) {
          return this.getVehicleLocation(id);
        }
      }
      throw error;
    }
  }

  /**
   * Get current mileage of a vehicle
   */
  async getVehicleMileage(id: string): Promise<VehicleMileage> {
    if (!id) {
      throw new FleetGoError('Vehicle ID is required', 'INVALID_PARAMETER');
    }

    if (this.useMockData) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const vehicle = this.mockVehicles.find((v) => v.id === id);
      if (!vehicle) {
        throw new FleetGoError(`Vehicle with ID ${id} not found`, 'NOT_FOUND', 404);
      }
      // Generate fresh mileage data
      return FleetGoMockDataGenerator.generateVehicleMileage(id);
    }

    try {
      const response = await this.request<FleetGoApiResponse<VehicleMileage>>(`/vehicles/${encodeURIComponent(id)}/mileage`);
      return response.data;
    } catch (error) {
      if (error instanceof FleetGoError && error.code === 'MOCK_MODE') {
        if (this.useMockData) {
          return this.getVehicleMileage(id);
        }
      }
      throw error;
    }
  }

  /**
   * Get all vehicle locations (batch operation)
   */
  async getAllVehicleLocations(): Promise<VehicleLocation[]> {
    if (this.useMockData) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return this.mockVehicles.map((v) =>
        FleetGoMockDataGenerator.generateVehicleLocation(v.id)
      );
    }

    try {
      const response = await this.request<FleetGoApiResponse<VehicleLocation[]>>('/vehicles/locations');
      return response.data;
    } catch (error) {
      if (error instanceof FleetGoError && error.code === 'MOCK_MODE') {
        if (this.useMockData) {
          return this.getAllVehicleLocations();
        }
      }
      throw error;
    }
  }

  /**
   * Refresh mock data (useful for testing)
   */
  refreshMockData(count?: number): void {
    if (this.useMockData) {
      this.mockVehicles = FleetGoMockDataGenerator.generateVehicles(count || this.mockVehicles.length);
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

// Create a singleton instance for easy import
let fleetGoClientInstance: FleetGoClient | null = null;

/**
 * Get the FleetGo client singleton instance
 */
export function getFleetGoClient(options?: FleetGoClientOptions): FleetGoClient {
  if (!fleetGoClientInstance) {
    fleetGoClientInstance = new FleetGoClient(options);
  }
  return fleetGoClientInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetFleetGoClient(): void {
  fleetGoClientInstance = null;
}

// Default export
export default FleetGoClient;
