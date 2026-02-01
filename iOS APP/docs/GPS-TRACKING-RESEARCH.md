# GPS Tracking Research - expo-location

**Datum:** 2026-02-01
**Task:** #11 - Research expo-location GPS tracking
**Status:** Compleet

---

## Inhoudsopgave

1. [Permission Request Flow](#1-permission-request-flow)
2. [Background Tracking Setup](#2-background-tracking-setup)
3. [Geofencing Implementatie](#3-geofencing-implementatie)
4. [Battery Optimization](#4-battery-optimization)
5. [Privacy/Consent Requirements (GDPR/AVG)](#5-privacyconsent-requirements-gdpravg)
6. [Platform-specifieke Configuratie](#6-platform-specifieke-configuratie)
7. [Best Practices & Aanbevelingen](#7-best-practices--aanbevelingen)

---

## 1. Permission Request Flow

### 1.1 Twee-staps Permission Request

expo-location vereist een twee-staps permission flow:

1. **Foreground Permission** - Moet EERST worden gevraagd
2. **Background Permission** - Kan PAS worden gevraagd NA foreground approval

```typescript
import * as Location from 'expo-location';

async function requestLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  // Stap 1: Foreground permission (verplicht eerste)
  const { status: foregroundStatus } =
    await Location.requestForegroundPermissionsAsync();

  if (foregroundStatus !== 'granted') {
    return { foreground: false, background: false };
  }

  // Stap 2: Background permission (alleen na foreground approval)
  const { status: backgroundStatus } =
    await Location.requestBackgroundPermissionsAsync();

  return {
    foreground: true,
    background: backgroundStatus === 'granted'
  };
}
```

### 1.2 Permission Status Check

```typescript
import * as Location from 'expo-location';

async function checkPermissionStatus(): Promise<{
  foreground: Location.PermissionStatus;
  background: Location.PermissionStatus;
}> {
  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();

  return {
    foreground: foreground.status,
    background: background.status
  };
}

// PermissionStatus enum waarden:
// - PermissionStatus.UNDETERMINED - Nog niet gevraagd
// - PermissionStatus.GRANTED - Toegestaan
// - PermissionStatus.DENIED - Geweigerd
```

### 1.3 iOS-specifieke Permission Levels

Op iOS heeft background location drie mogelijke niveaus:

| Optie | Beschrijving | expo-location status |
|-------|--------------|---------------------|
| **Allow Once** | Eenmalige toegang | `granted` (tijdelijk) |
| **While Using** | Alleen foreground | `granted` (foreground only) |
| **Always** | Background toegang | `granted` (full) |

**Belangrijk:** Voor background tracking op iOS moet de gebruiker expliciet "Always" kiezen.

### 1.4 Aanbevolen UX Flow

```
1. Uitleg scherm tonen (VOORDAT je permission vraagt)
   - Waarom locatie nodig is
   - Wat er met de data gebeurt
   - Privacy waarborgen

2. Foreground permission vragen
   - Bij weigering: functionaliteit graceful degraden

3. Na enkele dagen gebruik: Background permission vragen
   - Timing: wanneer gebruiker waarde heeft ervaren
   - Context: "Wil je automatisch inklokken bij projectlocaties?"

4. Permission denied handling
   - Duidelijke uitleg hoe in te schakelen via Instellingen
   - Fallback naar handmatig inklokken
```

---

## 2. Background Tracking Setup

### 2.1 TaskManager Setup

Background location tracking vereist `expo-task-manager`:

```typescript
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

// BELANGRIJK: defineTask moet in top-level scope staan (buiten componenten)
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error.message);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };

    // Verwerk locaties
    for (const location of locations) {
      processLocationUpdate(location);
    }
  }
});
```

### 2.2 Start Background Tracking

```typescript
async function startBackgroundTracking(): Promise<void> {
  // Check permissions eerst
  const { background } = await checkPermissionStatus();
  if (background !== 'granted') {
    throw new Error('Background location permission required');
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    // Accuracy levels (van laag naar hoog):
    // Accuracy.Lowest, Accuracy.Low, Accuracy.Balanced,
    // Accuracy.High, Accuracy.Highest, Accuracy.BestForNavigation
    accuracy: Location.Accuracy.Balanced,

    // Minimum tijd tussen updates (milliseconden)
    timeInterval: 30000, // 30 seconden

    // Minimum afstand tussen updates (meters)
    distanceInterval: 50, // 50 meter

    // Deferred updates (battery-efficienter)
    deferredUpdatesInterval: 60000, // Batch elke minuut
    deferredUpdatesDistance: 100, // Of elke 100 meter

    // Android: Foreground service notificatie (VERPLICHT)
    foregroundService: {
      notificationTitle: "Top Tuinen",
      notificationBody: "Locatie tracking actief tijdens werkuren",
      notificationColor: "#16a34a",
    },

    // iOS: Activity type voor optimale tracking
    activityType: Location.ActivityType.Other,
    // Alternatieven: Driving, Walking, Running, Cycling, Airborne

    // iOS: Niet automatisch pauzeren
    pausesUpdatesAutomatically: false,

    // iOS: Toestaan indicator in status bar
    showsBackgroundLocationIndicator: true,
  });
}
```

### 2.3 Stop Background Tracking

```typescript
async function stopBackgroundTracking(): Promise<void> {
  const isTracking = await Location.hasStartedLocationUpdatesAsync(
    BACKGROUND_LOCATION_TASK
  );

  if (isTracking) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
```

### 2.4 Foreground Tracking (als alternatief)

Voor wanneer background permissions niet beschikbaar zijn:

```typescript
import * as Location from 'expo-location';

let locationSubscription: Location.LocationSubscription | null = null;

async function startForegroundTracking(
  callback: (location: Location.LocationObject) => void
): Promise<void> {
  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000, // 10 seconden
      distanceInterval: 10, // 10 meter
    },
    (location) => {
      callback(location);
    }
  );
}

function stopForegroundTracking(): void {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
}
```

---

## 3. Geofencing Implementatie

### 3.1 Geofencing Concepts

Geofencing monitort wanneer een apparaat een gedefinieerde regio betreedt of verlaat.

**Event Types:**
- `GeofencingEventType.Enter` - Apparaat betreedt regio
- `GeofencingEventType.Exit` - Apparaat verlaat regio

### 3.2 Geofencing Task Definitie

```typescript
import * as Location from 'expo-location';
import { GeofencingEventType } from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const GEOFENCING_TASK = 'geofencing-task';

// Top-level scope definitie
TaskManager.defineTask(GEOFENCING_TASK, ({ data, error }) => {
  if (error) {
    console.error('Geofencing error:', error.message);
    return;
  }

  const { eventType, region } = data as {
    eventType: GeofencingEventType;
    region: Location.LocationRegion;
  };

  if (eventType === GeofencingEventType.Enter) {
    console.log(`Entered region: ${region.identifier}`);
    // Trigger: auto clock-in, notificatie, etc.
    handleRegionEnter(region);
  } else if (eventType === GeofencingEventType.Exit) {
    console.log(`Exited region: ${region.identifier}`);
    // Trigger: auto clock-out reminder, etc.
    handleRegionExit(region);
  }
});
```

### 3.3 Start Geofencing

```typescript
interface JobSiteGeofence {
  identifier: string; // Unieke ID (bijv. project ID)
  latitude: number;
  longitude: number;
  radius: number; // In meters (minimum ~100m voor betrouwbaarheid)
  notifyOnEnter?: boolean;
  notifyOnExit?: boolean;
}

async function startGeofencing(regions: JobSiteGeofence[]): Promise<void> {
  // Check background permission
  const { background } = await checkPermissionStatus();
  if (background !== 'granted') {
    throw new Error('Background location permission required for geofencing');
  }

  // Converteer naar LocationRegion format
  const locationRegions: Location.LocationRegion[] = regions.map(region => ({
    identifier: region.identifier,
    latitude: region.latitude,
    longitude: region.longitude,
    radius: Math.max(region.radius, 100), // Minimum 100m
    notifyOnEnter: region.notifyOnEnter ?? true,
    notifyOnExit: region.notifyOnExit ?? true,
  }));

  await Location.startGeofencingAsync(GEOFENCING_TASK, locationRegions);
}

async function stopGeofencing(): Promise<void> {
  const isGeofencing = await Location.hasStartedGeofencingAsync(GEOFENCING_TASK);

  if (isGeofencing) {
    await Location.stopGeofencingAsync(GEOFENCING_TASK);
  }
}
```

### 3.4 Custom Geofence Logic (Software-based)

Voor meer controle of complexe geofences (polygonen):

```typescript
interface Coordinate {
  latitude: number;
  longitude: number;
}

// Haversine formula: afstand tussen twee coordinaten
function calculateDistance(
  point1: Coordinate,
  point2: Coordinate
): number {
  const R = 6371000; // Earth radius in meters
  const phi1 = (point1.latitude * Math.PI) / 180;
  const phi2 = (point2.latitude * Math.PI) / 180;
  const deltaPhi = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const deltaLambda = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Check of locatie binnen circulaire geofence is
function isInCircularGeofence(
  location: Coordinate,
  center: Coordinate,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(location, center);
  return distance <= radiusMeters;
}

// Point-in-polygon voor complexe geofences
function isInPolygonGeofence(
  point: Coordinate,
  polygon: Coordinate[]
): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    if (
      yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}
```

### 3.5 Geofencing Beperkingen

| Platform | Max Regio's | Min Radius | Nauwkeurigheid |
|----------|-------------|------------|----------------|
| **iOS** | 20 | ~100m | Hoog |
| **Android** | 100 | ~100m | Variabel |

**Aanbevelingen:**
- Gebruik radius van minimaal 100-150 meter voor betrouwbaarheid
- Beperk aantal actieve geofences
- Implementeer dwell-time logic om false positives te voorkomen

---

## 4. Battery Optimization

### 4.1 Accuracy Levels en Battery Impact

| Accuracy Level | Nauwkeurigheid | Battery Impact | Use Case |
|----------------|----------------|----------------|----------|
| `Lowest` | ~3000m | Zeer laag | Alleen regio |
| `Low` | ~1000m | Laag | Stad-niveau |
| `Balanced` | ~100m | Medium | **Aanbevolen default** |
| `High` | ~10m | Hoog | Navigatie |
| `Highest` | ~1m | Zeer hoog | Precisie vereist |
| `BestForNavigation` | <1m | Maximaal | Real-time navigatie |

### 4.2 Adaptive Tracking Strategy

```typescript
interface TrackingProfile {
  accuracy: Location.Accuracy;
  timeInterval: number;      // ms
  distanceInterval: number;  // meters
  batchSize: number;
}

const TRACKING_PROFILES = {
  // Normale tracking tijdens werk
  NORMAL: {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 60000,      // 1 minuut
    distanceInterval: 50,     // 50 meter
    batchSize: 10,
  },

  // Hoge precisie bij geofence nadering
  HIGH_PRECISION: {
    accuracy: Location.Accuracy.High,
    timeInterval: 15000,      // 15 seconden
    distanceInterval: 10,     // 10 meter
    batchSize: 20,
  },

  // Battery saver mode
  BATTERY_SAVER: {
    accuracy: Location.Accuracy.Low,
    timeInterval: 300000,     // 5 minuten
    distanceInterval: 200,    // 200 meter
    batchSize: 5,
  },

  // Kritiek lage batterij
  CRITICAL: {
    accuracy: Location.Accuracy.Lowest,
    timeInterval: 600000,     // 10 minuten
    distanceInterval: 500,    // 500 meter
    batchSize: 3,
  },
};

class AdaptiveLocationTracker {
  private currentProfile: TrackingProfile;

  async adjustForBatteryLevel(batteryLevel: number): Promise<TrackingProfile> {
    if (batteryLevel < 10) {
      return TRACKING_PROFILES.CRITICAL;
    } else if (batteryLevel < 20) {
      return TRACKING_PROFILES.BATTERY_SAVER;
    } else {
      return TRACKING_PROFILES.NORMAL;
    }
  }

  async adjustForProximityToGeofence(
    distanceToNearest: number
  ): Promise<TrackingProfile> {
    if (distanceToNearest < 500) {
      // Binnen 500m van geofence: hoge precisie
      return TRACKING_PROFILES.HIGH_PRECISION;
    } else {
      return TRACKING_PROFILES.NORMAL;
    }
  }
}
```

### 4.3 Location Data Batching

Reduceer netwerk calls door locaties te batchen:

```typescript
class LocationBatcher {
  private buffer: Location.LocationObject[] = [];
  private readonly maxBufferSize: number;
  private readonly maxBufferAge: number; // ms
  private lastFlush: number = Date.now();

  constructor(maxSize: number = 10, maxAgeMs: number = 60000) {
    this.maxBufferSize = maxSize;
    this.maxBufferAge = maxAgeMs;
  }

  add(location: Location.LocationObject): Location.LocationObject[] | null {
    this.buffer.push(location);

    const shouldFlush =
      this.buffer.length >= this.maxBufferSize ||
      Date.now() - this.lastFlush > this.maxBufferAge;

    if (shouldFlush) {
      return this.flush();
    }

    return null;
  }

  flush(): Location.LocationObject[] {
    const locations = [...this.buffer];
    this.buffer = [];
    this.lastFlush = Date.now();
    return locations;
  }
}
```

### 4.4 Deferred Updates (iOS)

iOS ondersteunt "deferred updates" voor betere battery life:

```typescript
await Location.startLocationUpdatesAsync(TASK_NAME, {
  accuracy: Location.Accuracy.Balanced,

  // Deferred updates configuratie
  deferredUpdatesInterval: 60000,  // Batch elke 60 seconden
  deferredUpdatesDistance: 100,    // Of elke 100 meter

  // Combineer met time/distance interval
  timeInterval: 30000,
  distanceInterval: 50,
});
```

**Hoe het werkt:**
- iOS buffert locatie updates intern
- Levert ze in batches op de gespecificeerde intervallen
- Significant betere battery life
- Trade-off: minder real-time data

---

## 5. Privacy/Consent Requirements (GDPR/AVG)

### 5.1 Nederlandse AVG Vereisten voor GPS Tracking

Volgens de [Autoriteit Persoonsgegevens](https://www.autoriteitpersoonsgegevens.nl/en/themes/employment-and-benefits/monitoring-employees/conditions-for-monitoring-employees) en de [GDPR](https://business.gov.nl/regulations/protection-personal-data/) gelden de volgende vereisten:

#### Voorwaarden voor GPS Tracking van Medewerkers

| Vereiste | Beschrijving |
|----------|--------------|
| **Gerechtvaardigd belang** | Werkgever moet aantoonbaar legitiem belang hebben |
| **Noodzakelijkheid** | Doel kan niet op andere manier worden bereikt |
| **Proportionaliteit** | Belang werkgever moet opwegen tegen privacy werknemer |
| **Informatieplicht** | Medewerkers moeten vooraf volledig geinformeerd worden |
| **OR-instemming** | Ondernemingsraad moet toestemming geven (indien aanwezig) |

#### DPIA Vereiste

Een Data Protection Impact Assessment (DPIA) is **verplicht** bij:
- Systematische monitoring van medewerkers
- Grootschalige verwerking van locatiegegevens

### 5.2 Consent Flow Implementatie

```typescript
interface LocationConsentData {
  consentGiven: boolean;
  consentTimestamp: number;
  consentVersion: string;
  privacyLevel: 'full' | 'aggregated' | 'minimal';
  purposes: {
    timeTracking: boolean;
    geofencing: boolean;
    routeTracking: boolean;
  };
}

const CONSENT_VERSION = '1.0.0';

async function requestLocationConsent(): Promise<LocationConsentData | null> {
  // Toon consent dialog met duidelijke uitleg
  const consent = await showConsentDialog({
    title: 'Locatie Tracking',
    description: `
      Top Tuinen vraagt toestemming om je locatie te gebruiken voor:

      - Automatisch inklokken bij projectlocaties
      - Urenregistratie koppelen aan projecten
      - Reistijd berekening

      Je locatiegegevens worden:
      - Alleen tijdens werkuren verzameld
      - Beveiligd opgeslagen (maximaal 90 dagen)
      - Nooit gedeeld met derden
      - Op verzoek volledig verwijderd
    `,
    options: [
      { id: 'full', label: 'Volledige tracking', description: 'GPS + geofencing + routes' },
      { id: 'aggregated', label: 'Alleen aanwezigheid', description: 'Alleen of je op locatie bent' },
      { id: 'minimal', label: 'Handmatig', description: 'Geen automatische tracking' },
    ],
  });

  if (!consent) return null;

  const consentData: LocationConsentData = {
    consentGiven: true,
    consentTimestamp: Date.now(),
    consentVersion: CONSENT_VERSION,
    privacyLevel: consent.selectedOption,
    purposes: {
      timeTracking: consent.selectedOption !== 'minimal',
      geofencing: consent.selectedOption === 'full',
      routeTracking: consent.selectedOption === 'full',
    },
  };

  // Sla consent op
  await storeConsent(consentData);

  // Log voor audit trail
  await logConsentEvent('consent_given', consentData);

  return consentData;
}
```

### 5.3 Privacy-by-Design Implementatie

```typescript
class PrivacyAwareLocationService {
  private consentData: LocationConsentData | null = null;

  // Aggregeer locaties in plaats van exact opslaan
  aggregateLocation(location: Location.LocationObject): {
    gridCell: string;
    timestamp: number;
  } {
    // Rond af naar 100m grid (4 decimalen = ~11m, 3 = ~111m)
    const lat = Math.round(location.coords.latitude * 1000) / 1000;
    const lng = Math.round(location.coords.longitude * 1000) / 1000;

    return {
      gridCell: `${lat},${lng}`,
      timestamp: Math.floor(location.timestamp / 60000) * 60000, // Per minuut
    };
  }

  // Verwijder oude data automatisch
  async enforceRetentionPolicy(maxDays: number = 90): Promise<number> {
    const cutoffTimestamp = Date.now() - (maxDays * 24 * 60 * 60 * 1000);

    const deletedCount = await deleteLocationDataBefore(cutoffTimestamp);

    await logAuditEvent('data_retention_cleanup', {
      deletedRecords: deletedCount,
      cutoffDate: new Date(cutoffTimestamp).toISOString(),
    });

    return deletedCount;
  }

  // Export user data (GDPR right to data portability)
  async exportUserData(userId: string): Promise<ExportedData> {
    const data = await getAllLocationData(userId);

    await logAuditEvent('data_exported', { userId });

    return {
      exportDate: new Date().toISOString(),
      format: 'JSON',
      data: data,
    };
  }

  // Delete all user data (GDPR right to erasure)
  async deleteAllUserData(userId: string): Promise<void> {
    await deleteAllLocationData(userId);
    await deleteConsent(userId);

    await logAuditEvent('data_deleted', { userId });
  }
}
```

### 5.4 Audit Logging

```typescript
interface AuditLogEntry {
  timestamp: number;
  action:
    | 'tracking_started'
    | 'tracking_stopped'
    | 'consent_given'
    | 'consent_revoked'
    | 'data_accessed'
    | 'data_exported'
    | 'data_deleted';
  userId: string;
  details?: Record<string, unknown>;
}

async function logAuditEvent(
  action: AuditLogEntry['action'],
  details?: Record<string, unknown>
): Promise<void> {
  const entry: AuditLogEntry = {
    timestamp: Date.now(),
    action,
    userId: getCurrentUserId(),
    details,
  };

  // Sla op in audit log (Convex)
  await api.mutation('locationAuditLog:create', entry);
}
```

### 5.5 Prive Gebruik Bedrijfsvoertuigen

Volgens [ABAX](https://www.abax.com/nl/blog/hoe-zit-het-met-de-privacy-als-er-een-gps-tracker-wordt-geplaatst):

> "Continue tracking is alleen toegestaan als het voertuig uitsluitend voor zakelijke doeleinden wordt gebruikt. Als de werknemer een prive gebruik verklaring heeft of het voertuig mee naar huis mag nemen, moet je zorgen voor een privacy modus waarin tracking buiten werktijden wordt uitgeschakeld."

**Implementatie:**

```typescript
class PrivacyModeService {
  async enablePrivacyMode(): Promise<void> {
    // Stop tracking
    await stopBackgroundTracking();

    // Log voor audit
    await logAuditEvent('tracking_stopped', { reason: 'privacy_mode' });

    // Update UI
    notifyUser('Privacy modus actief - tracking uitgeschakeld');
  }

  async disablePrivacyMode(): Promise<void> {
    // Check werkuren
    if (!isWithinWorkingHours()) {
      throw new Error('Tracking alleen tijdens werkuren');
    }

    // Check consent
    const consent = await getStoredConsent();
    if (!consent?.consentGiven) {
      throw new Error('Consent vereist');
    }

    // Start tracking
    await startBackgroundTracking();

    await logAuditEvent('tracking_started', { reason: 'privacy_mode_disabled' });
  }
}
```

---

## 6. Platform-specifieke Configuratie

### 6.1 iOS Configuratie

#### app.json / app.config.js

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "Top Tuinen gebruikt je locatie om uren automatisch te koppelen aan projectlocaties.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Top Tuinen gebruikt je locatie voor automatisch in- en uitklokken bij projectlocaties, ook wanneer de app op de achtergrond draait.",
        "NSLocationAlwaysUsageDescription": "Top Tuinen gebruikt je locatie voor automatisch in- en uitklokken bij projectlocaties.",
        "UIBackgroundModes": ["location"]
      },
      "bundleIdentifier": "nl.toptuinen.medewerkers"
    },
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Top Tuinen gebruikt je locatie voor automatisch in- en uitklokken bij projectlocaties.",
          "locationAlwaysPermission": "Top Tuinen gebruikt je locatie voor automatisch inklokken, ook op de achtergrond.",
          "locationWhenInUsePermission": "Top Tuinen gebruikt je locatie om uren te koppelen aan projecten.",
          "isAndroidBackgroundLocationEnabled": true,
          "isAndroidForegroundServiceEnabled": true
        }
      ]
    ]
  }
}
```

#### Handmatige Info.plist (indien geen CNG)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Location Permissions -->
    <key>NSLocationWhenInUseUsageDescription</key>
    <string>Top Tuinen gebruikt je locatie om uren automatisch te koppelen aan projectlocaties.</string>

    <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
    <string>Top Tuinen gebruikt je locatie voor automatisch in- en uitklokken bij projectlocaties, ook wanneer de app op de achtergrond draait.</string>

    <key>NSLocationAlwaysUsageDescription</key>
    <string>Top Tuinen gebruikt je locatie voor automatisch in- en uitklokken bij projectlocaties.</string>

    <!-- Background Modes -->
    <key>UIBackgroundModes</key>
    <array>
        <string>location</string>
    </array>
</dict>
</plist>
```

#### iOS App Store Review Notes

**Belangrijk:** Voeg uitgebreide review notes toe bij App Store submission:

```
LOCATION USAGE EXPLANATION:

This app uses location services for employee time tracking at job sites.

USE CASES:
1. Automatic clock-in when employee arrives at a job site (geofencing)
2. Automatic clock-out reminder when employee leaves a job site
3. Linking worked hours to specific project locations
4. Route tracking for travel time calculation

PRIVACY PROTECTIONS:
- Users must explicitly consent before any tracking starts
- Privacy mode available to disable tracking outside work hours
- All location data is encrypted and stored for maximum 90 days
- Users can export or delete all their data at any time
- GDPR/AVG compliant implementation

WHEN LOCATION IS ACCESSED:
- Only during explicitly started work sessions
- User receives persistent notification when tracking is active
- Background location only with "Always" permission and active work session
```

### 6.2 Android Configuratie

#### app.json / app.config.js

```json
{
  "expo": {
    "android": {
      "permissions": [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "POST_NOTIFICATIONS"
      ],
      "package": "nl.toptuinen.medewerkers"
    }
  }
}
```

#### Handmatige AndroidManifest.xml (indien geen CNG)

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Location Permissions -->
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

    <!-- Foreground Service (Android 9+) -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />

    <!-- Notifications (Android 13+) -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application>
        <!-- Foreground Service Declaration (Android 14+) -->
        <service
            android:name="expo.modules.location.LocationTaskService"
            android:foregroundServiceType="location"
            android:exported="false" />
    </application>
</manifest>
```

### 6.3 Android Foreground Service Notification

Vanaf Android 8+ is een **foreground service notification verplicht** voor background location:

```typescript
await Location.startLocationUpdatesAsync(TASK_NAME, {
  // ... andere opties

  // VERPLICHT voor Android
  foregroundService: {
    notificationTitle: "Top Tuinen",
    notificationBody: "Locatie tracking actief",
    notificationColor: "#16a34a", // Top Tuinen groen

    // Optioneel: kill notification behavior
    killServiceOnDestroy: false,
  },
});
```

**Android 14+ Specifieke Vereisten:**

Volgens [Android Developer docs](https://developer.android.com/develop/background-work/services/fgs/launch):
- `foregroundServiceType="location"` moet gedeclareerd zijn
- App moet `ACCESS_BACKGROUND_LOCATION` permission hebben
- Foreground service kan niet starten vanuit background zonder speciale permissions

### 6.4 Platform Verschillen Samenvatting

| Feature | iOS | Android |
|---------|-----|---------|
| **Max geofences** | 20 | 100 |
| **Permission prompt** | "Always Allow" optie | Aparte background prompt |
| **Background indicator** | Status bar icoon | Notification (verplicht) |
| **Deferred updates** | Ja | Beperkt |
| **Significant location changes** | Ja | Via Fused Location |
| **App Store review** | Streng | Minder streng |

---

## 7. Best Practices & Aanbevelingen

### 7.1 Permission Request Best Practices

1. **Vraag foreground permission eerst** - Background komt later
2. **Toon uitleg VOOR permission dialog** - Verhoogt acceptance rate
3. **Vraag background permission op context moment** - Niet bij eerste launch
4. **Graceful degradation** - App moet werken zonder location
5. **Bied settings link** - Als permission geweigerd is

### 7.2 Battery Optimization Best Practices

1. **Start met Balanced accuracy** - Verhoog alleen indien nodig
2. **Gebruik deferred updates** - Significant betere battery life
3. **Implementeer adaptive tracking** - Pas aan op basis van context
4. **Batch network calls** - Stuur niet elke locatie individueel
5. **Respecteer low battery** - Reduceer tracking automatisch

### 7.3 Privacy Best Practices

1. **Privacy-by-design** - Minimale data collectie
2. **Explicite consent** - Vooraf, duidelijk, specifiek
3. **Audit trail** - Log alle data access
4. **Retention policy** - Automatische verwijdering oude data
5. **User control** - Export en delete opties
6. **Privacy mode** - Optie om tracking te pauzeren

### 7.4 App Store Submission Best Practices

1. **Duidelijke usage descriptions** - Leg uit WAAROM, niet alleen WAT
2. **Review notes** - Uitgebreide uitleg voor reviewer
3. **Demo account** - Zodat reviewer kan testen
4. **Privacy policy URL** - Verplicht
5. **Vermijd continuous tracking claims** - Focus op "when needed"

### 7.5 Technische Best Practices

1. **defineTask in top-level scope** - Niet in component
2. **Check permission status** - Voordat je tracking start
3. **Handle permission changes** - App kan permissions verliezen
4. **Filter low accuracy points** - Voorkom ruis in data
5. **Implement retry logic** - Voor failed syncs
6. **Test op echte devices** - Simulators gedragen zich anders

---

## Bronnen

- [Expo Location Documentation](https://docs.expo.dev/versions/latest/sdk/location/)
- [Expo TaskManager Documentation](https://docs.expo.dev/versions/latest/sdk/task-manager/)
- [Autoriteit Persoonsgegevens - Monitoring Employees](https://www.autoriteitpersoonsgegevens.nl/en/themes/employment-and-benefits/monitoring-employees)
- [Autoriteit Persoonsgegevens - Conditions for Monitoring](https://www.autoriteitpersoonsgegevens.nl/en/themes/employment-and-benefits/monitoring-employees/conditions-for-monitoring-employees)
- [Business.gov.nl - Protection of Personal Data](https://business.gov.nl/regulations/protection-personal-data/)
- [RWV Advocaten - GPS-tracking en privacywetgeving](https://rwv.nl/kennis/gps-tracking-van-werknemers-balans-tussen-controle-en-privacywetgeving)
- [ABAX - GPS-tracking en privacy](https://www.abax.com/nl/blog/hoe-zit-het-met-de-privacy-als-er-een-gps-tracker-wordt-geplaatst)
- [GDPRWise - GPS Data & GDPR](https://gdprwise.eu/questions-and-answers/gps-data-gdpr-implications/?lang=en)
- [Android Developers - Request Location Permissions](https://developer.android.com/develop/sensors-and-location/location/permissions)
- [Android Developers - Foreground Services](https://developer.android.com/develop/background-work/services/fgs/launch)
- [Apple Developer - NSLocationWhenInUseUsageDescription](https://developer.apple.com/documentation/bundleresources/information-property-list/nslocationwheninuseusagedescription)
- [Apple Developer - Handling Location Updates in Background](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background)
- [App Store Review Guidelines Checklist](https://nextnative.dev/blog/app-store-review-guidelines)

---

*Document gegenereerd op 2026-02-01 voor Task #11*
