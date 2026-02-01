# Technisch Implementatie Plan
# Top Tuinen Medewerkers App

**Versie:** 1.0
**Datum:** 2026-02-01

---

## 1. Overzicht

Dit document beschrijft de technische implementatie van de Top Tuinen Medewerkers App - een React Native/Expo applicatie voor iOS en Android die integreert met het bestaande offerte-builder systeem.

### 1.1 Tech Stack Keuze

Na uitgebreid onderzoek is gekozen voor:

| Component | Keuze | Alternatieven Overwogen |
|-----------|-------|------------------------|
| **Framework** | React Native + Expo | Flutter, PWA |
| **Backend** | Convex (bestaand) | - |
| **Auth** | Clerk Organizations | Custom JWT |
| **Offline DB** | Expo SQLite | AsyncStorage, WatermelonDB |
| **GPS** | expo-location | react-native-geolocation |
| **Push** | Firebase Cloud Messaging | Pusher Beams, OneSignal |

**Waarom React Native + Expo:**
- Team kent al React/TypeScript (Next.js webapp)
- Maximale code-sharing met bestaande codebase
- Clerk heeft officiële Expo SDK
- Convex heeft officiële React Native support
- Expo vereenvoudigt native features (GPS, biometrics, push)

---

## 2. Project Structuur

### 2.1 Monorepo Setup

```
top-tuinen/
├── apps/
│   ├── web/                          # Bestaande Next.js webapp
│   │   ├── src/
│   │   ├── convex/
│   │   └── package.json
│   │
│   └── mobile/                       # NIEUWE React Native app
│       ├── app/                      # Expo Router (file-based routing)
│       │   ├── (auth)/               # Auth screens
│       │   │   ├── login.tsx
│       │   │   ├── signup.tsx
│       │   │   ├── biometric-setup.tsx
│       │   │   └── _layout.tsx
│       │   ├── (app)/                # Main app screens
│       │   │   ├── dashboard.tsx
│       │   │   ├── projects/
│       │   │   │   ├── index.tsx
│       │   │   │   └── [id].tsx
│       │   │   ├── hours/
│       │   │   │   ├── index.tsx
│       │   │   │   ├── entry.tsx
│       │   │   │   └── history.tsx
│       │   │   ├── chat/
│       │   │   │   ├── index.tsx
│       │   │   │   ├── team.tsx
│       │   │   │   ├── project/[id].tsx
│       │   │   │   └── dm/[userId].tsx
│       │   │   ├── settings/
│       │   │   │   ├── index.tsx
│       │   │   │   ├── privacy.tsx
│       │   │   │   └── notifications.tsx
│       │   │   └── _layout.tsx
│       │   └── _layout.tsx
│       │
│       ├── components/               # Shared components
│       │   ├── ui/                   # Button, Input, Card, etc.
│       │   ├── hours/                # Uren-specifieke components
│       │   ├── chat/                 # Chat-specifieke components
│       │   └── location/             # GPS-specifieke components
│       │
│       ├── lib/                      # Utilities & services
│       │   ├── convex/               # Convex client setup
│       │   ├── auth/                 # Auth helpers
│       │   ├── location/             # GPS services
│       │   ├── sync/                 # Offline sync engine
│       │   └── storage/              # SQLite helpers
│       │
│       ├── hooks/                    # Custom React hooks
│       │   ├── use-auth.ts
│       │   ├── use-location.ts
│       │   ├── use-offline-sync.ts
│       │   └── use-biometric.ts
│       │
│       ├── assets/                   # Images, fonts
│       ├── app.json                  # Expo config
│       ├── eas.json                  # EAS Build config
│       └── package.json
│
└── packages/
    ├── shared-types/                 # TypeScript types
    │   ├── convex.ts                 # Convex schema types
    │   ├── auth.ts                   # Auth types
    │   └── index.ts
    │
    └── shared-utils/                 # Shared utilities
        ├── date.ts                   # date-fns wrappers
        ├── format.ts                 # Formatting helpers
        └── index.ts
```

### 2.2 Turborepo Configuratie

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {}
  }
}
```

---

## 3. Convex Schema Uitbreidingen

### 3.1 Nieuwe Tabellen

```typescript
// convex/schema.ts - Toevoegingen

// ============================================
// MEDEWERKERS APP UITBREIDINGEN
// ============================================

// Update bestaande medewerkers tabel
medewerkers: defineTable({
  // Bestaande velden...
  userId: v.id("users"),
  naam: v.string(),
  email: v.optional(v.string()),
  telefoon: v.optional(v.string()),
  functie: v.optional(v.string()),
  uurtarief: v.optional(v.number()),
  isActief: v.boolean(),
  notities: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),

  // NIEUWE VELDEN voor app integratie
  clerkOrgId: v.optional(v.string()),        // Clerk organization ID
  clerkUserId: v.optional(v.string()),       // Clerk user ID (na signup)
  status: v.optional(v.union(
    v.literal("invited"),                     // Uitnodiging verstuurd
    v.literal("active"),                      // Actief in app
    v.literal("inactive")                     // Niet meer actief
  )),
  biometricEnabled: v.optional(v.boolean()), // Face ID/Touch ID actief
  lastLoginAt: v.optional(v.number()),       // Laatste login timestamp
})
  .index("by_user", ["userId"])
  .index("by_user_actief", ["userId", "isActief"])
  .index("by_org", ["clerkOrgId"])           // NIEUW
  .index("by_clerk_id", ["clerkUserId"]),    // NIEUW

// Update urenRegistraties met sync velden
urenRegistraties: defineTable({
  // Bestaande velden...
  projectId: v.id("projecten"),
  datum: v.string(),
  medewerker: v.string(),
  uren: v.number(),
  taakId: v.optional(v.id("planningTaken")),
  scope: v.optional(v.string()),
  notities: v.optional(v.string()),
  bron: v.union(v.literal("import"), v.literal("handmatig")),

  // NIEUWE VELDEN voor offline sync
  idempotencyKey: v.optional(v.string()),     // UUID voor deduplicatie
  clientTimestamp: v.optional(v.number()),    // Client-side timestamp
  syncStatus: v.optional(v.union(
    v.literal("synced"),
    v.literal("pending"),
    v.literal("conflict"),
    v.literal("error")
  )),
  medewerkerClerkId: v.optional(v.string()), // Link naar Clerk user
})
  .index("by_project", ["projectId"])
  .index("by_datum", ["datum"])
  .index("by_idempotency", ["idempotencyKey"]),  // NIEUW

// ============================================
// GPS TRACKING TABELLEN
// ============================================

locationSessions: defineTable({
  userId: v.id("users"),
  medewerkerClerkId: v.string(),
  medewerkerNaam: v.string(),
  projectId: v.optional(v.id("projecten")),

  status: v.union(
    v.literal("clock_in"),
    v.literal("tracking"),
    v.literal("break"),
    v.literal("clock_out")
  ),

  clockInAt: v.number(),
  lastLocationAt: v.number(),
  clockOutAt: v.optional(v.number()),
  breakStartAt: v.optional(v.number()),
  breakEndAt: v.optional(v.number()),

  // Privacy
  consentGiven: v.boolean(),
  consentGivenAt: v.number(),
  privacyLevel: v.union(
    v.literal("full"),
    v.literal("aggregated"),
    v.literal("minimal")
  ),

  createdAt: v.number(),
})
  .index("by_user_active", ["userId", "status"])
  .index("by_project", ["projectId"])
  .index("by_date", ["clockInAt"]),

locationData: defineTable({
  sessionId: v.id("locationSessions"),
  userId: v.id("users"),
  projectId: v.optional(v.id("projecten")),

  latitude: v.number(),
  longitude: v.number(),
  accuracy: v.number(),
  altitude: v.optional(v.number()),
  speed: v.optional(v.number()),
  heading: v.optional(v.number()),

  source: v.union(
    v.literal("gps"),
    v.literal("network"),
    v.literal("fused")
  ),

  batteryLevel: v.optional(v.number()),
  batteryLow: v.boolean(),

  recordedAt: v.number(),
  receivedAt: v.number(),
})
  .index("by_session", ["sessionId"])
  .index("by_user", ["userId"])
  .index("by_time", ["recordedAt"]),

jobSiteGeofences: defineTable({
  userId: v.id("users"),
  projectId: v.id("projecten"),
  customerName: v.string(),
  customerAddress: v.string(),

  centerLatitude: v.number(),
  centerLongitude: v.number(),
  radiusMeters: v.number(),

  polygonPoints: v.optional(v.array(v.object({
    lat: v.number(),
    lng: v.number(),
  }))),

  isActive: v.boolean(),
  autoClockIn: v.boolean(),
  autoClockOut: v.boolean(),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_project", ["projectId"])
  .index("by_user", ["userId"]),

geofenceEvents: defineTable({
  sessionId: v.id("locationSessions"),
  geofenceId: v.id("jobSiteGeofences"),

  eventType: v.union(
    v.literal("enter"),
    v.literal("exit"),
    v.literal("dwell")
  ),

  latitude: v.number(),
  longitude: v.number(),
  accuracy: v.number(),
  dwellTimeSeconds: v.optional(v.number()),

  createdAt: v.number(),
})
  .index("by_session", ["sessionId"])
  .index("by_geofence", ["geofenceId"]),

routes: defineTable({
  sessionId: v.id("locationSessions"),
  userId: v.id("users"),

  startLocation: v.object({
    latitude: v.number(),
    longitude: v.number(),
    address: v.optional(v.string()),
    timestamp: v.number(),
  }),

  endLocation: v.object({
    latitude: v.number(),
    longitude: v.number(),
    address: v.optional(v.string()),
    timestamp: v.number(),
  }),

  distanceMeters: v.number(),
  durationSeconds: v.number(),
  averageSpeedMps: v.number(),
  maxSpeedMps: v.number(),

  isProjectTravel: v.boolean(),
  travelType: v.union(
    v.literal("to_site"),
    v.literal("from_site"),
    v.literal("between_sites"),
    v.literal("other")
  ),

  pathPoints: v.array(v.object({
    latitude: v.number(),
    longitude: v.number(),
    timestamp: v.number(),
  })),

  createdAt: v.number(),
})
  .index("by_session", ["sessionId"])
  .index("by_user", ["userId"]),

locationAnalytics: defineTable({
  userId: v.id("users"),
  datum: v.string(),

  totalWorkSeconds: v.number(),
  totalBreakSeconds: v.number(),
  totalTravelSeconds: v.number(),
  totalDistanceMeters: v.number(),
  sitesVisited: v.number(),
  locationDataPoints: v.number(),
  averageAccuracyMeters: v.number(),

  medewerkerNaam: v.string(),
  projectId: v.optional(v.id("projecten")),

  createdAt: v.number(),
})
  .index("by_user_date", ["userId", "datum"])
  .index("by_project", ["projectId"]),

locationAuditLog: defineTable({
  userId: v.id("users"),
  employee: v.optional(v.id("medewerkers")),
  action: v.union(
    v.literal("tracking_started"),
    v.literal("tracking_stopped"),
    v.literal("data_accessed"),
    v.literal("data_exported"),
    v.literal("data_deleted"),
    v.literal("consent_given"),
    v.literal("consent_revoked")
  ),

  details: v.optional(v.string()),
  ipAddress: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_employee", ["employee"]),

// ============================================
// CHAT TABELLEN
// ============================================

team_messages: defineTable({
  senderId: v.id("users"),
  senderName: v.string(),
  senderClerkId: v.string(),
  companyId: v.id("users"),

  channelType: v.union(
    v.literal("team"),
    v.literal("project"),
    v.literal("broadcast")
  ),

  projectId: v.optional(v.id("projecten")),
  channelName: v.string(),

  message: v.string(),
  messageType: v.union(
    v.literal("text"),
    v.literal("image"),
    v.literal("announcement")
  ),

  attachmentStorageId: v.optional(v.id("_storage")),
  attachmentType: v.optional(v.string()),

  isRead: v.boolean(),
  readBy: v.optional(v.array(v.string())),

  createdAt: v.number(),
  editedAt: v.optional(v.number()),
})
  .index("by_company", ["companyId"])
  .index("by_channel", ["companyId", "channelType"])
  .index("by_project", ["projectId"])
  .index("by_team_unread", ["companyId", "channelType", "isRead"])
  .searchIndex("search_messages", {
    searchField: "message",
    filterFields: ["companyId", "channelType", "projectId"],
  }),

direct_messages: defineTable({
  fromUserId: v.id("users"),
  fromClerkId: v.string(),
  toUserId: v.id("users"),
  toClerkId: v.string(),
  companyId: v.id("users"),

  message: v.string(),
  messageType: v.union(
    v.literal("text"),
    v.literal("image")
  ),

  attachmentStorageId: v.optional(v.id("_storage")),
  attachmentType: v.optional(v.string()),

  isRead: v.boolean(),
  readAt: v.optional(v.number()),

  createdAt: v.number(),
})
  .index("by_conversation", ["fromClerkId", "toClerkId"])
  .index("by_company", ["companyId"])
  .index("by_recipient_unread", ["toClerkId", "isRead"]),

notification_preferences: defineTable({
  userId: v.id("users"),
  clerkUserId: v.string(),

  enablePushNotifications: v.boolean(),
  deviceToken: v.optional(v.string()),
  devicePlatform: v.optional(v.union(
    v.literal("ios"),
    v.literal("android"),
    v.literal("web")
  )),

  mutedChannels: v.optional(v.array(v.string())),
  mutedUsers: v.optional(v.array(v.string())),

  notifyOnTeamChat: v.boolean(),
  notifyOnDirectMessage: v.boolean(),
  notifyOnProjectChat: v.boolean(),
  notifyOnBroadcast: v.boolean(),

  quietHoursStart: v.optional(v.string()),
  quietHoursEnd: v.optional(v.string()),
  respectQuietHours: v.boolean(),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_clerk_id", ["clerkUserId"]),

chat_attachments: defineTable({
  storageId: v.id("_storage"),
  messageId: v.optional(v.id("team_messages")),
  directMessageId: v.optional(v.id("direct_messages")),

  userId: v.id("users"),
  companyId: v.id("users"),

  fileName: v.string(),
  fileType: v.string(),
  fileSize: v.number(),

  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_company", ["companyId"]),
```

---

## 4. Offline Sync Architectuur

### 4.1 Lokale SQLite Schema

```sql
-- Mobile app lokale database

CREATE TABLE uren_registraties (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  datum TEXT NOT NULL,
  medewerker TEXT NOT NULL,
  uren REAL NOT NULL,
  scope TEXT,
  notities TEXT,
  sync_status TEXT DEFAULT 'pending', -- pending|synced|error
  server_id TEXT,
  idempotency_key TEXT UNIQUE,
  retry_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  client_timestamp INTEGER NOT NULL
);

CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL, -- INSERT|UPDATE|DELETE
  record_id TEXT NOT NULL,
  payload TEXT NOT NULL, -- JSON
  idempotency_key TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  synced_at INTEGER
);

CREATE TABLE location_cache (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL NOT NULL,
  recorded_at INTEGER NOT NULL,
  sync_status TEXT DEFAULT 'pending'
);

CREATE TABLE offline_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX idx_sync_status ON uren_registraties(sync_status);
CREATE INDEX idx_pending ON sync_queue(status) WHERE status='pending';
CREATE INDEX idx_location_sync ON location_cache(sync_status);
```

### 4.2 Sync Engine Implementatie

```typescript
// apps/mobile/lib/sync/sync-engine.ts

import * as SQLite from 'expo-sqlite';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { v4 as uuid } from 'uuid';
import { api } from '../convex';

const SYNC_TASK_NAME = 'BACKGROUND_SYNC_TASK';
const SYNC_INTERVAL = 15 * 60; // 15 minuten

export class SyncEngine {
  private db: SQLite.SQLiteDatabase;
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;

  constructor() {
    this.db = SQLite.openDatabase('toptuinen.db');
    this.initDatabase();
    this.registerBackgroundTask();
  }

  private async initDatabase() {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS uren_registraties (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        datum TEXT NOT NULL,
        medewerker TEXT NOT NULL,
        uren REAL NOT NULL,
        scope TEXT,
        notities TEXT,
        sync_status TEXT DEFAULT 'pending',
        server_id TEXT,
        idempotency_key TEXT UNIQUE,
        retry_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  }

  // Registreer uren lokaal (altijd eerst lokaal)
  async addUrenRegistratie(entry: UrenEntry): Promise<string> {
    const id = uuid();
    const idempotencyKey = uuid();
    const now = Date.now();

    await this.db.runAsync(
      `INSERT INTO uren_registraties
       (id, project_id, datum, medewerker, uren, scope, notities,
        sync_status, idempotency_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [id, entry.projectId, entry.datum, entry.medewerker,
       entry.uren, entry.scope, entry.notities, idempotencyKey, now, now]
    );

    // Probeer direct te syncen als online
    if (this.isOnline) {
      this.syncToServer();
    }

    return id;
  }

  // Background sync naar server
  async syncToServer(): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      const pendingEntries = await this.db.getAllAsync<UrenRow>(
        `SELECT * FROM uren_registraties
         WHERE sync_status = 'pending' AND retry_count < 3
         ORDER BY created_at ASC
         LIMIT 20`
      );

      for (const entry of pendingEntries) {
        try {
          // Sync naar Convex met idempotency key
          const serverId = await api.mutation('urenRegistraties:addWithSync', {
            projectId: entry.project_id,
            datum: entry.datum,
            medewerker: entry.medewerker,
            uren: entry.uren,
            scope: entry.scope,
            notities: entry.notities,
            idempotencyKey: entry.idempotency_key,
            clientTimestamp: entry.created_at,
          });

          // Update lokaal naar synced
          await this.db.runAsync(
            `UPDATE uren_registraties
             SET sync_status = 'synced', server_id = ?, updated_at = ?
             WHERE id = ?`,
            [serverId, Date.now(), entry.id]
          );

        } catch (error) {
          // Increment retry count
          await this.db.runAsync(
            `UPDATE uren_registraties
             SET retry_count = retry_count + 1, updated_at = ?
             WHERE id = ?`,
            [Date.now(), entry.id]
          );

          // Na 3 retries: mark as error
          if (entry.retry_count >= 2) {
            await this.db.runAsync(
              `UPDATE uren_registraties
               SET sync_status = 'error', updated_at = ?
               WHERE id = ?`,
              [Date.now(), entry.id]
            );
          }
        }
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  // Registreer background task
  private async registerBackgroundTask() {
    TaskManager.defineTask(SYNC_TASK_NAME, async () => {
      try {
        await this.syncToServer();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (error) {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });

    await BackgroundFetch.registerTaskAsync(SYNC_TASK_NAME, {
      minimumInterval: SYNC_INTERVAL,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  }

  // Get alle lokale registraties
  async getLocalRegistraties(): Promise<UrenRow[]> {
    return this.db.getAllAsync<UrenRow>(
      `SELECT * FROM uren_registraties ORDER BY datum DESC, created_at DESC`
    );
  }

  // Get pending count
  async getPendingCount(): Promise<number> {
    const result = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM uren_registraties WHERE sync_status = 'pending'`
    );
    return result?.count ?? 0;
  }
}

// Singleton export
export const syncEngine = new SyncEngine();
```

### 4.3 Conflict Resolution

```typescript
// convex/urenRegistraties.ts - Server-side conflict handling

export const addWithSync = mutation({
  args: {
    projectId: v.id("projecten"),
    datum: v.string(),
    medewerker: v.string(),
    uren: v.number(),
    scope: v.optional(v.string()),
    notities: v.optional(v.string()),
    idempotencyKey: v.string(),
    clientTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Check idempotency - voorkom duplicaten
    const existing = await ctx.db
      .query("urenRegistraties")
      .withIndex("by_idempotency", (q) =>
        q.eq("idempotencyKey", args.idempotencyKey)
      )
      .first();

    if (existing) {
      // Duplicate request - return existing
      return existing._id;
    }

    // Check conflict (zelfde dag/medewerker, nieuwere versie bestaat)
    const conflicting = await ctx.db
      .query("urenRegistraties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) =>
        q.and(
          q.eq(q.field("datum"), args.datum),
          q.eq(q.field("medewerker"), args.medewerker),
          q.gt(q.field("clientTimestamp"), args.clientTimestamp)
        )
      )
      .first();

    if (conflicting) {
      // Server heeft nieuwere versie - return conflict
      throw new ConvexError({
        code: "CONFLICT",
        serverVersion: conflicting,
        message: "Server has newer version"
      });
    }

    // Insert nieuwe registratie
    return await ctx.db.insert("urenRegistraties", {
      projectId: args.projectId,
      datum: args.datum,
      medewerker: args.medewerker,
      uren: args.uren,
      scope: args.scope,
      notities: args.notities,
      bron: "handmatig",
      idempotencyKey: args.idempotencyKey,
      clientTimestamp: args.clientTimestamp,
      syncStatus: "synced",
    });
  },
});
```

---

## 5. GPS Tracking Implementatie

### 5.1 Location Service

```typescript
// apps/mobile/lib/location/location-service.ts

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { BatteryOptimizer, TRACKING_PROFILES } from './battery-optimizer';

const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';

export class LocationService {
  private isTracking = false;
  private currentSession: string | null = null;
  private optimizer: BatteryOptimizer;
  private locationBuffer: LocationPoint[] = [];

  constructor() {
    this.optimizer = new BatteryOptimizer(TRACKING_PROFILES.BALANCED);
    this.registerBackgroundTask();
  }

  async requestPermissions(): Promise<boolean> {
    const { status: foreground } = await Location.requestForegroundPermissionsAsync();

    if (foreground !== 'granted') {
      return false;
    }

    const { status: background } = await Location.requestBackgroundPermissionsAsync();
    return background === 'granted';
  }

  async startTracking(sessionId: string, projectId: string): Promise<void> {
    if (this.isTracking) return;

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Location permission not granted');
    }

    this.currentSession = sessionId;
    this.isTracking = true;

    // Start background location updates
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 30000, // 30 seconden
      distanceInterval: 50, // 50 meter
      deferredUpdatesInterval: 60000, // Batch elke minuut
      deferredUpdatesDistance: 100,
      foregroundService: {
        notificationTitle: "Top Tuinen",
        notificationBody: "Locatie wordt getrackt tijdens werkuren",
        notificationColor: "#16a34a", // Green
      },
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Other,
    });
  }

  async stopTracking(): Promise<void> {
    if (!this.isTracking) return;

    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

    // Flush remaining buffer
    await this.flushLocationBuffer();

    this.isTracking = false;
    this.currentSession = null;
  }

  private registerBackgroundTask(): void {
    TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
      if (error) {
        console.error('Location task error:', error);
        return;
      }

      if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };

        for (const location of locations) {
          const point: LocationPoint = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy ?? 0,
            altitude: location.coords.altitude,
            speed: location.coords.speed,
            heading: location.coords.heading,
            recordedAt: location.timestamp,
            source: 'gps',
          };

          // Filter lage kwaliteit punten
          if (point.accuracy > 100) continue;

          this.locationBuffer.push(point);
        }

        // Batch sync wanneer buffer vol is
        if (this.locationBuffer.length >= 10) {
          await this.flushLocationBuffer();
        }
      }
    });
  }

  private async flushLocationBuffer(): Promise<void> {
    if (this.locationBuffer.length === 0) return;
    if (!this.currentSession) return;

    const points = [...this.locationBuffer];
    this.locationBuffer = [];

    try {
      // Compress en sync naar server
      const compressed = this.optimizer.compressLocationData(points);

      await api.mutation('locationTracking:batchInsert', {
        sessionId: this.currentSession,
        points: compressed,
      });
    } catch (error) {
      // Bij error: terug in buffer voor retry
      this.locationBuffer = [...points, ...this.locationBuffer];
      console.error('Location sync failed:', error);
    }
  }
}

export const locationService = new LocationService();
```

### 5.2 Geofencing

```typescript
// apps/mobile/lib/location/geofence-manager.ts

export class GeofenceManager {

  // Haversine formula: afstand tussen twee coördinaten
  static calculateDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371000; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) ** 2 +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // Check of locatie binnen geofence is
  static isInGeofence(
    location: { latitude: number; longitude: number },
    geofence: {
      centerLatitude: number;
      centerLongitude: number;
      radiusMeters: number;
    }
  ): boolean {
    const distance = this.calculateDistance(
      location.latitude,
      location.longitude,
      geofence.centerLatitude,
      geofence.centerLongitude
    );

    return distance <= geofence.radiusMeters;
  }

  // Detecteer geofence event
  static detectEvent(
    previousLocation: { latitude: number; longitude: number } | null,
    currentLocation: { latitude: number; longitude: number },
    geofence: any
  ): 'enter' | 'exit' | 'dwell' | null {
    const wasInside = previousLocation
      ? this.isInGeofence(previousLocation, geofence)
      : false;
    const isInside = this.isInGeofence(currentLocation, geofence);

    if (!wasInside && isInside) return 'enter';
    if (wasInside && !isInside) return 'exit';
    if (wasInside && isInside) return 'dwell';

    return null;
  }
}
```

### 5.3 Battery Optimization

```typescript
// apps/mobile/lib/location/battery-optimizer.ts

export interface TrackingProfile {
  highPrecisionInterval: number;
  normalInterval: number;
  lowBatteryInterval: number;
  criticalBatteryInterval: number;
  batchSize: number;
  enableAdaptiveInterval: boolean;
  enableGeoAwareness: boolean;
}

export const TRACKING_PROFILES = {
  BALANCED: {
    highPrecisionInterval: 30,
    normalInterval: 60,
    lowBatteryInterval: 120,
    criticalBatteryInterval: 300,
    batchSize: 8,
    enableAdaptiveInterval: true,
    enableGeoAwareness: true,
  },
  PRECISION: {
    highPrecisionInterval: 10,
    normalInterval: 15,
    lowBatteryInterval: 30,
    criticalBatteryInterval: 60,
    batchSize: 20,
    enableAdaptiveInterval: false,
    enableGeoAwareness: true,
  },
  BATTERY_SAVER: {
    highPrecisionInterval: 60,
    normalInterval: 120,
    lowBatteryInterval: 300,
    criticalBatteryInterval: 600,
    batchSize: 5,
    enableAdaptiveInterval: true,
    enableGeoAwareness: true,
  },
};

export class BatteryOptimizer {
  private profile: TrackingProfile;

  constructor(profile: TrackingProfile) {
    this.profile = profile;
  }

  calculateInterval(state: {
    batteryLevel: number;
    speed: number;
    isAtGeofence: boolean;
    isOffline: boolean;
  }): number {
    let interval = this.profile.normalInterval;

    // Battery awareness
    if (state.batteryLevel < 10) {
      interval = this.profile.criticalBatteryInterval;
    } else if (state.batteryLevel < 20) {
      interval = this.profile.lowBatteryInterval;
    }

    // Geofence awareness
    if (this.profile.enableGeoAwareness && state.isAtGeofence) {
      interval = this.profile.highPrecisionInterval;
    }

    // Adaptive based on speed
    if (this.profile.enableAdaptiveInterval && state.speed > 0) {
      const speedFactor = Math.min(state.speed / 20, 2);
      interval = Math.round(interval * speedFactor);
    }

    // Offline: reduce sampling
    if (state.isOffline) {
      interval = Math.round(interval * 2);
    }

    return interval;
  }

  compressLocationData(points: LocationPoint[]): CompressedData {
    if (points.length < 2) return { points };

    const compressed: CompressedPoint[] = [];

    for (let i = 0; i < points.length; i += this.profile.batchSize) {
      const batch = points.slice(i, i + this.profile.batchSize);

      compressed.push({
        lat: Math.round(
          batch.reduce((sum, p) => sum + p.latitude, 0) / batch.length * 10000
        ) / 10000,
        lng: Math.round(
          batch.reduce((sum, p) => sum + p.longitude, 0) / batch.length * 10000
        ) / 10000,
        t: batch[0].recordedAt,
        acc: Math.round(
          batch.reduce((sum, p) => sum + p.accuracy, 0) / batch.length
        ),
        n: batch.length,
      });
    }

    return { points: compressed, compression: 'micro' };
  }
}
```

---

## 6. Chat Implementatie

### 6.1 Real-time Message Hook

```typescript
// apps/mobile/hooks/use-team-chat.ts

import { useQuery, useMutation } from 'convex/react';
import { api } from '../lib/convex';

export function useTeamChat(channelType: 'team' | 'project', projectId?: string) {
  // Real-time messages (Convex auto-syncs)
  const messages = useQuery(api.teamMessages.getTeamChat, {
    channelType,
    projectId,
    limit: 50,
  });

  const sendMessage = useMutation(api.teamMessages.send);
  const markAsRead = useMutation(api.teamMessages.markChannelAsRead);

  const send = async (text: string, attachmentStorageId?: string) => {
    await sendMessage({
      channelType,
      projectId,
      message: text,
      attachmentStorageId,
    });
  };

  return {
    messages,
    send,
    markAsRead: () => markAsRead({ channelType, projectId }),
    isLoading: messages === undefined,
  };
}

export function useUnreadCounts() {
  return useQuery(api.teamMessages.getAllUnreadCounts);
}
```

### 6.2 Chat Component

```typescript
// apps/mobile/components/chat/message-list.tsx

import { FlashList } from '@shopify/flash-list';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface MessageListProps {
  messages: TeamMessage[];
  currentUserId: string;
}

export function MessageList({ messages, currentUserId }: MessageListProps) {
  const renderMessage = ({ item }: { item: TeamMessage }) => {
    const isOwn = item.senderClerkId === currentUserId;

    return (
      <View className={`flex-row mb-3 ${isOwn ? 'justify-end' : 'justify-start'}`}>
        {!isOwn && (
          <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center mr-2">
            <Text className="text-primary font-semibold">
              {item.senderName.charAt(0)}
            </Text>
          </View>
        )}

        <View className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
          {!isOwn && (
            <Text className="text-xs text-muted-foreground mb-1">
              {item.senderName}
            </Text>
          )}

          <View className={`rounded-2xl px-4 py-2 ${
            isOwn ? 'bg-primary' : 'bg-muted'
          }`}>
            <Text className={isOwn ? 'text-primary-foreground' : 'text-foreground'}>
              {item.message}
            </Text>

            {item.attachmentStorageId && (
              <Image
                source={{ uri: item.attachmentUrl }}
                className="w-48 h-48 rounded-lg mt-2"
                resizeMode="cover"
              />
            )}
          </View>

          <Text className="text-[10px] text-muted-foreground mt-1">
            {format(item.createdAt, 'HH:mm', { locale: nl })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <FlashList
      data={messages}
      renderItem={renderMessage}
      estimatedItemSize={80}
      inverted
      keyExtractor={(item) => item._id}
    />
  );
}
```

### 6.3 Push Notifications

```typescript
// apps/mobile/lib/notifications/push-service.ts

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from '../convex';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get Expo push token
  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // Register with backend
  await api.mutation('notifications:registerDeviceToken', {
    token,
    platform: Platform.OS as 'ios' | 'android',
  });

  // Android channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#16a34a',
    });
  }

  return token;
}

export function useNotificationListener() {
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Handle notification received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
      }
    );

    // Handle user tapping on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const { channelType, projectId, messageId } =
          response.notification.request.content.data;

        // Navigate to appropriate screen
        if (channelType === 'direct') {
          router.push(`/chat/dm/${projectId}`);
        } else if (channelType === 'project') {
          router.push(`/chat/project/${projectId}`);
        } else {
          router.push('/chat/team');
        }
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}
```

---

## 7. Authenticatie Flow

### 7.1 Clerk Setup

```typescript
// apps/mobile/app/_layout.tsx

import { ClerkProvider, useAuth } from '@clerk/expo';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import * as SecureStore from 'expo-secure-store';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

// Secure token cache voor Clerk
const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
};

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

### 7.2 Biometric Authentication

```typescript
// apps/mobile/lib/auth/biometric.ts

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return compatible && enrolled;
}

export async function getBiometricType(): Promise<'face' | 'fingerprint' | null> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'face';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'fingerprint';
  }
  return null;
}

export async function setupBiometric(sessionToken: string): Promise<boolean> {
  const available = await isBiometricAvailable();
  if (!available) return false;

  // Store session token securely
  await SecureStore.setItemAsync('biometric_session_token', sessionToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });

  await SecureStore.setItemAsync('biometric_enabled', 'true');

  return true;
}

export async function authenticateWithBiometric(): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  const biometricEnabled = await SecureStore.getItemAsync('biometric_enabled');

  if (biometricEnabled !== 'true') {
    return { success: false, error: 'Biometric not enabled' };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Log in op Top Tuinen',
    fallbackLabel: 'Gebruik pincode',
    disableDeviceFallback: false,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const token = await SecureStore.getItemAsync('biometric_session_token');

  if (!token) {
    return { success: false, error: 'No stored session' };
  }

  return { success: true, token };
}

export async function disableBiometric(): Promise<void> {
  await SecureStore.deleteItemAsync('biometric_session_token');
  await SecureStore.deleteItemAsync('biometric_enabled');
}
```

### 7.3 Login Screen

```typescript
// apps/mobile/app/(auth)/login.tsx

import { useSignIn, useAuth } from '@clerk/expo';
import { authenticateWithBiometric, isBiometricAvailable } from '@/lib/auth/biometric';

export default function LoginScreen() {
  const { signIn, setActive } = useSignIn();
  const { getToken } = useAuth();
  const [email, setEmail] = useState('');
  const [showBiometric, setShowBiometric] = useState(false);

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const available = await isBiometricAvailable();
    const enabled = await SecureStore.getItemAsync('biometric_enabled');
    setShowBiometric(available && enabled === 'true');
  };

  const handleBiometricLogin = async () => {
    const result = await authenticateWithBiometric();

    if (result.success && result.token) {
      // Validate token met Clerk
      try {
        await setActive({ session: result.token });
        router.replace('/(app)/dashboard');
      } catch {
        // Token expired - require fresh login
        await disableBiometric();
        setShowBiometric(false);
      }
    }
  };

  const handleMagicLink = async () => {
    try {
      await signIn?.create({
        strategy: 'email_link',
        identifier: email,
        redirectUrl: 'toptuinen://auth/callback',
      });

      router.push('/(auth)/check-email');
    } catch (error) {
      console.error('Magic link error:', error);
    }
  };

  return (
    <View className="flex-1 bg-background p-6">
      <View className="flex-1 justify-center">
        <Image
          source={require('@/assets/logo.png')}
          className="w-24 h-24 self-center mb-8"
        />

        <Text className="text-2xl font-bold text-center mb-8">
          Top Tuinen
        </Text>

        {showBiometric ? (
          <View className="items-center">
            <TouchableOpacity
              onPress={handleBiometricLogin}
              className="w-20 h-20 bg-primary rounded-full items-center justify-center mb-4"
            >
              <Ionicons name="finger-print" size={40} color="white" />
            </TouchableOpacity>

            <Text className="text-muted-foreground">
              Gebruik Face ID of Touch ID
            </Text>

            <TouchableOpacity
              onPress={() => setShowBiometric(false)}
              className="mt-6"
            >
              <Text className="text-primary">Andere methode gebruiken</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="E-mailadres"
              keyboardType="email-address"
              autoCapitalize="none"
              className="border border-input rounded-lg px-4 py-3 mb-4"
            />

            <Button onPress={handleMagicLink}>
              <Text className="text-primary-foreground font-semibold">
                Inloggen met magic link
              </Text>
            </Button>
          </View>
        )}
      </View>
    </View>
  );
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

```typescript
// apps/mobile/__tests__/sync-engine.test.ts

import { SyncEngine } from '@/lib/sync/sync-engine';

describe('SyncEngine', () => {
  let syncEngine: SyncEngine;

  beforeEach(() => {
    syncEngine = new SyncEngine();
  });

  test('should store entry locally with pending status', async () => {
    const entry = {
      projectId: 'project123',
      datum: '2026-02-01',
      medewerker: 'Jan',
      uren: 8,
    };

    const id = await syncEngine.addUrenRegistratie(entry);

    const stored = await syncEngine.getLocalRegistraties();
    expect(stored[0].sync_status).toBe('pending');
    expect(stored[0].id).toBe(id);
  });

  test('should generate unique idempotency keys', async () => {
    const entry1 = await syncEngine.addUrenRegistratie({...});
    const entry2 = await syncEngine.addUrenRegistratie({...});

    const stored = await syncEngine.getLocalRegistraties();
    expect(stored[0].idempotency_key).not.toBe(stored[1].idempotency_key);
  });

  test('should increment retry count on sync failure', async () => {
    // Mock network failure
    jest.spyOn(api, 'mutation').mockRejectedValue(new Error('Network error'));

    await syncEngine.addUrenRegistratie({...});
    await syncEngine.syncToServer();

    const stored = await syncEngine.getLocalRegistraties();
    expect(stored[0].retry_count).toBe(1);
  });
});
```

### 8.2 Integration Tests

```typescript
// apps/mobile/__tests__/integration/offline-flow.test.ts

describe('Offline Flow Integration', () => {
  test('should queue entries when offline and sync when online', async () => {
    // Simulate offline
    NetInfo.mockImplementation(() => ({ isConnected: false }));

    // Add entries while offline
    await syncEngine.addUrenRegistratie({ ... });
    await syncEngine.addUrenRegistratie({ ... });

    expect(await syncEngine.getPendingCount()).toBe(2);

    // Go online
    NetInfo.mockImplementation(() => ({ isConnected: true }));

    // Trigger sync
    await syncEngine.syncToServer();

    expect(await syncEngine.getPendingCount()).toBe(0);
  });
});
```

### 8.3 E2E Tests

```typescript
// apps/mobile/e2e/uren-registration.e2e.ts

describe('Uren Registration E2E', () => {
  beforeAll(async () => {
    await device.launchApp();
    await loginWithBiometric();
  });

  test('should complete full uren entry flow', async () => {
    // Open dashboard
    await expect(element(by.id('dashboard'))).toBeVisible();

    // Start werkdag
    await element(by.id('start-werkdag')).tap();

    // Select project
    await element(by.id('project-selector')).tap();
    await element(by.text('Tuin Renovatie - De Vries')).tap();

    // Wait and stop
    await new Promise(r => setTimeout(r, 1000));
    await element(by.id('stop-werkdag')).tap();

    // Verify entry created
    await element(by.id('tab-history')).tap();
    await expect(element(by.text('Tuin Renovatie - De Vries'))).toBeVisible();
  });
});
```

---

## 9. Deployment

### 9.1 EAS Build Configuration

```json
// apps/mobile/eas.json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "resourceClass": "m1-medium"
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "ios": {
        "resourceClass": "m1-medium"
      },
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "developer@toptuinen.nl",
        "ascAppId": "1234567890"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-key.json",
        "track": "internal"
      }
    }
  }
}
```

### 9.2 Environment Variables

```bash
# apps/mobile/.env
EXPO_PUBLIC_CONVEX_URL=https://xxx.convex.cloud
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
```

### 9.3 App Store Submission Checklist

**iOS App Store:**
- [ ] App icon (1024x1024)
- [ ] Screenshots (6.5", 5.5")
- [ ] Privacy policy URL
- [ ] App beschrijving (NL)
- [ ] Keywords
- [ ] NSLocationWhenInUseUsageDescription
- [ ] NSLocationAlwaysAndWhenInUseUsageDescription
- [ ] NSFaceIDUsageDescription
- [ ] Background modes: location

**Google Play:**
- [ ] Feature graphic (1024x500)
- [ ] Screenshots (phone, tablet)
- [ ] Privacy policy URL
- [ ] App beschrijving (NL)
- [ ] Data safety questionnaire
- [ ] Target audience
- [ ] Signed APK/AAB

---

## 10. Monitoring & Analytics

### 10.1 Error Tracking (Sentry)

```typescript
// apps/mobile/app/_layout.tsx

import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enableAutoSessionTracking: true,
  tracesSampleRate: 0.2,
  environment: __DEV__ ? 'development' : 'production',
});

export default Sentry.wrap(RootLayout);
```

### 10.2 Analytics Events

```typescript
// apps/mobile/lib/analytics.ts

export const Analytics = {
  trackEvent(name: string, properties?: Record<string, any>) {
    // Track naar eigen backend of analytics service
    api.mutation('analytics:trackEvent', {
      event: name,
      properties,
      timestamp: Date.now(),
      platform: Platform.OS,
      appVersion: Application.nativeApplicationVersion,
    });
  },

  // Specifieke events
  trackUrenEntry(projectId: string, uren: number) {
    this.trackEvent('uren_entry', { projectId, uren });
  },

  trackLocationConsent(level: string) {
    this.trackEvent('location_consent', { level });
  },

  trackSyncComplete(count: number, duration: number) {
    this.trackEvent('sync_complete', { count, duration });
  },
};
```

---

## 11. Risico Mitigatie

| Risico | Mitigatie |
|--------|-----------|
| iOS reject door privacy | Uitgebreide consent flow, duidelijke usage descriptions |
| Battery drain complaints | Adaptive tracking, battery monitoring, user controls |
| Sync data loss | Idempotency keys, local backup, retry logic |
| Auth token expiry | 50s refresh loop, biometric fallback |
| Background location fails | Foreground service notification, user education |
| Offline periode te lang | Queue capacity 500+, manual sync button |

---

## 12. Volgende Stappen

1. **Week 1-2:** Monorepo setup, Expo project, Clerk integratie
2. **Week 3-4:** SQLite lokale DB, basis sync engine
3. **Week 5-6:** Urenregistratie UI, offline flow
4. **Week 7-8:** GPS tracking, consent flow
5. **Week 9-10:** Chat module, push notifications
6. **Week 11-12:** Biometric auth, polish
7. **Week 13-14:** Beta testing, bug fixes
8. **Week 15-16:** App Store submission

---

*Document versie 1.0 - Gegenereerd op 2026-02-01*
