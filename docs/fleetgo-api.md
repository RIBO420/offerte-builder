# FleetGO API Integration Guide

## Overview

FleetGO provides a REST API for vehicle fleet management, offering real-time tracking, trip data, vehicle telemetry, and driver management capabilities.

**Base URL:** `https://app.fleetgo.com`

**API Documentation:** https://api.fleetgo.com/api/Description

**Supported Media Types:**
- `application/json`
- `application/xml`

---

## Authentication

FleetGO uses OAuth2-style token-based authentication.

### Required Credentials

To use the FleetGO API, you need to obtain the following from FleetGO (contact support@fleetgo.com):
- `client_id` - API client identifier
- `client_secret` - API client secret
- `username` - FleetGO account username
- `password` - FleetGO account password

### Login Endpoint

**POST** `/Session/Login`

#### Request Body (LoginDto)

```json
{
  "client_id": "your_client_id",
  "client_secret": "your_client_secret",
  "username": "your_username",
  "password": "your_password",
  "system_id": "optional_system_id",
  "user_token": "optional_user_token",
  "user_token_type": "optional_token_type"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client_id` | string | Yes | API client identifier |
| `client_secret` | string | Yes | API client secret |
| `username` | string | Yes | User login credential |
| `password` | string | Yes | User password |
| `system_id` | string | No | Related system identifier |
| `user_token` | string | No | Optional user token |
| `user_token_type` | enum | No | Token type; affects MFA handling |

#### Response (LoginResultDto)

```json
{
  "token_type": "Bearer",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "refresh_token_value",
  "expires_in": 3600,
  "login_result_type": "Success"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `token_type` | string | Always "Bearer" |
| `access_token` | string | Token for authenticating requests |
| `refresh_token` | string | Token for obtaining new access tokens |
| `expires_in` | decimal | Token lifetime in seconds |
| `login_result_type` | enum | Operation outcome indicator |

### Using the Access Token

Include the token in all API requests:

```
Authorization: Bearer {access_token}
```

### Token Validation

**GET** `/Session/ValidateAccessToken?accessToken={accessToken}`

Check if an access token is still valid.

---

## Key Endpoints

### Equipment (Vehicles)

#### Get Fleet

**GET** `/Equipment/GetFleet`

Retrieve fleet data with optional filters.

#### Get Single Equipment

**GET** `/Equipment/GetEquipment?equipmentId={equipmentId}`

Fetch a specific vehicle by ID.

#### Get Multiple Equipments

**GET** `/Equipment/GetEquipments?groupId={groupId}&hasDeviceOnly={hasDeviceOnly}`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `groupId` | integer | Yes | Equipment group identifier |
| `hasDeviceOnly` | boolean | Yes | Filter to show only equipment with devices |

#### Get Administrations

**GET** `/Equipment/GetAdministrations`

Retrieve administration objects (organizational units).

---

### AVL (Automatic Vehicle Location)

#### Get AVL Data

**GET** `/Avl/GetAvlData?administrationId={administrationId}&from={from}&to={to}&skip={skip}&take={take}&orderDescending={orderDescending}`

Get vehicle location and telemetry records for a specific period.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `administrationId` | integer | Yes | Administration ID |
| `from` | date (ISO 8601) | Yes | Start date (YYYY-MM-DDTHH:MM:SS) |
| `to` | date (ISO 8601) | Yes | End date |
| `skip` | integer | No | Pagination offset |
| `take` | integer | No | Number of records to retrieve |
| `orderDescending` | boolean | No | Sort direction |

#### Response (AvlDto)

```json
{
  "Timestamp": "2024-01-15T10:30:00",
  "LocalTime": "2024-01-15T11:30:00",
  "Latitude": 52.3676,
  "Longitude": 4.9041,
  "Altitude": 0.0,
  "Angle": 180,
  "Satellites": 12,
  "Speed": 65,
  "EngineRunning": true,
  "PrivateMode": false,
  "EventId": 0,
  "EquipmentId": 12345,
  "TripId": 67890,
  "DriverId": 111,
  "IOValues": {},
  "Latency": 5,
  "HighResolutionTotalVehicleDistance": 45678.5,
  "VehicleDistanceSource": {},
  "HighResolutionFuelConsumption": 1234.5,
  "FuelConsumptionSource": {}
}
```

| Field | Type | Description |
|-------|------|-------------|
| `Timestamp` | date | UTC timestamp of record |
| `LocalTime` | date | Local time of record |
| `Latitude` | decimal | GPS latitude coordinate |
| `Longitude` | decimal | GPS longitude coordinate |
| `Altitude` | decimal | Altitude in meters |
| `Angle` | integer | Heading/direction in degrees |
| `Satellites` | byte | Number of GPS satellites |
| `Speed` | integer | Speed in km/h |
| `EngineRunning` | boolean | Engine status |
| `PrivateMode` | boolean | Private/business trip indicator |
| `EventId` | integer | Event type identifier |
| `EquipmentId` | integer | Vehicle/equipment ID |
| `TripId` | integer | Associated trip ID |
| `DriverId` | integer | Driver ID |
| `IOValues` | object | Digital I/O sensor values |
| `Latency` | integer | Response delay in seconds |
| `HighResolutionTotalVehicleDistance` | decimal | Odometer reading (km) |
| `HighResolutionFuelConsumption` | decimal | Total fuel consumed (liters) |

#### Subscribe to AVL Updates

**GET** `/Avl/Subscribe?groupId={groupId}&vehicleCategoryId={vehicleCategoryId}&driverCategoryId={driverCategoryId}&accountId={accountId}`

Subscribe to real-time AVL data updates.

---

### Trips

#### Get Trips

**GET** `/Trips/GetTrips?equipmentId={equipmentId}&from={from}&to={to}&extendedInfo={extendedInfo}`

Get trips for a vehicle between two dates.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `equipmentId` | integer | Yes | Vehicle/equipment ID |
| `from` | date (ISO 8601) | Yes | Start date |
| `to` | date (ISO 8601) | Yes | End date |
| `extendedInfo` | boolean | Yes | Include polyline route data |

#### Response (RideDTO)

```json
{
  "From": {
    "Latitude": 52.3676,
    "Longitude": 4.9041,
    "Address": "Amsterdam, Netherlands"
  },
  "To": {
    "Latitude": 52.0907,
    "Longitude": 5.1214,
    "Address": "Utrecht, Netherlands"
  },
  "Distance": 45.6,
  "StationaryTimeInHours": 0.5,
  "DriverName": "John Doe",
  "DriverId": 111,
  "LicensePlate": "AB-123-CD",
  "FuelUsedInLiters": 4.2,
  "RideType": "Business",
  "EncodedTrack": "encoded_polyline_string",
  "EncodedSpeed": "encoded_speed_data",
  "EncodedTime": "encoded_time_data",
  "RouteDescription": "A2 Highway",
  "RoutePlannerDistance": 44.8,
  "Events": [],
  "Purpose": "Client meeting",
  "Reason": "",
  "Remarks": "",
  "IsCorrection": false,
  "CustomField": ""
}
```

| Field | Type | Description |
|-------|------|-------------|
| `From` | object | Start location with coordinates and address |
| `To` | object | End location with coordinates and address |
| `Distance` | decimal | Trip distance in km |
| `StationaryTimeInHours` | decimal | Idle/stopped time |
| `DriverName` | string | Driver's name |
| `DriverId` | integer | Driver ID |
| `LicensePlate` | string | Vehicle license plate |
| `FuelUsedInLiters` | decimal | Fuel consumed during trip |
| `RideType` | string | Trip classification |
| `EncodedTrack` | string | Encoded polyline of route |
| `Events` | array | Events during trip |
| `Purpose` | string | Trip purpose/reason |

#### Create/Update Trip

**POST** `/Trips`

Create or update trip records.

---

### Additional Resources

| Resource | Description |
|----------|-------------|
| **Audit** | Audit trail and change history |
| **Checklist** | Vehicle checklists |
| **Device** | Hardware device management |
| **Events** | Event management |
| **Employee** | Employee/driver management |
| **EventNotifications** | Notification subscriptions |
| **GreenDriving** | Eco-driving scores |
| **PointsOfInterest** | POI management |
| **QualityMark** | Quality certifications |
| **Reports** | Report generation |
| **Signal** | Sensor signal data |
| **TachoFile** | Tachograph file management |
| **Tags** | Tagging system |
| **TPMS** | Tire pressure monitoring |
| **UDS** | Vehicle diagnostics (DTCs, PIDs) |
| **Users** | User management |
| **Discovery** | API discovery |

---

## Vehicle Data Available

Based on Home Assistant integration and API documentation, the following vehicle data is available:

### Location & Movement
- Latitude, Longitude, Altitude
- Current speed (km/h)
- Distance from home/base
- Current address (geocoded)
- Last communication timestamp

### Vehicle Information
- Make, Model, License plate
- Odometer reading (km)
- Engine active status

### Advanced Metrics (hardware-dependent)
- Fuel level
- Coolant temperature
- Power voltage
- Malfunction indicator status
- Road speed limits
- CAN bus data

---

## Rate Limits

The API implements request throttling at the endpoint level on a per-client basis:
- Follows "fair use" principles
- Specific limits subject to change
- Excess requests will be dropped
- No specific rate limit numbers published

---

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / Invalid data |
| 401 | Invalid authentication |
| 403 | Forbidden / Insufficient permissions |
| 404 | Resource not found |
| 503 | Service unavailable |

---

## Date Format

All dates follow ISO 8601 standard: `YYYY-MM-DDTHH:MM:SS`

Example: `2024-01-15T10:30:00`

---

## Integration Notes

### Getting Started

1. **Contact FleetGO** to become a partner and obtain API credentials (client_id, client_secret)
2. **Authenticate** using the `/Session/Login` endpoint to get access token
3. **Store the refresh token** for obtaining new access tokens when expired
4. **Include Bearer token** in all subsequent API requests

### Best Practices

- Cache access tokens and refresh before expiration
- Implement retry logic with exponential backoff for rate limiting
- Use pagination parameters (`skip`, `take`) for large datasets
- Store `administrationId` and `equipmentId` values for efficient queries
- Use the `extendedInfo` parameter only when route polylines are needed (reduces response size)

### Data Availability

Not all data fields are available for all vehicles. Data availability depends on:
- Vehicle brand and model
- Year of manufacture
- Installed FleetGO hardware
- CAN bus interface availability

### Integration Resources

- API Documentation: https://api.fleetgo.com/api/Description
- Resources Reference: https://api.fleetgo.com/api/Description/Resources
- Contact: support@fleetgo.com

---

## Example Integration Flow

```
1. POST /Session/Login
   -> Receive access_token and refresh_token

2. GET /Equipment/GetEquipments?groupId=1&hasDeviceOnly=true
   -> List all vehicles with tracking devices

3. GET /Avl/GetAvlData?administrationId=123&from=2024-01-01T00:00:00&to=2024-01-15T23:59:59
   -> Get location history for specific vehicle

4. GET /Trips/GetTrips?equipmentId=456&from=2024-01-01T00:00:00&to=2024-01-15T23:59:59&extendedInfo=false
   -> Get trip history with driver and distance info
```

---

*Last updated: February 2026*

*Sources:*
- [FleetGO Developer API](https://api.fleetgo.com/api/Description)
- [FleetGO API Resources](https://api.fleetgo.com/api/Description/Resources)
- [FleetGO Home Assistant Integration](https://www.home-assistant.io/integrations/fleetgo/)
