# Push Notifications Research Document

**Project:** Top Tuinen Medewerkers App
**Datum:** 2026-02-01
**Versie:** 1.0

---

## Inhoudsopgave

1. [Overzicht](#1-overzicht)
2. [Expo Notifications Setup](#2-expo-notifications-setup)
3. [FCM Integration (Firebase Cloud Messaging)](#3-fcm-integration-firebase-cloud-messaging)
4. [Device Token Management](#4-device-token-management)
5. [Notification Handling Patterns](#5-notification-handling-patterns)
6. [Platform-Specifieke Configuratie](#6-platform-specifieke-configuratie)
7. [Server-Side Push Implementatie (Convex)](#7-server-side-push-implementatie-convex)
8. [Implementatie Stappenplan](#8-implementatie-stappenplan)

---

## 1. Overzicht

Push notifications zijn essentieel voor de Top Tuinen Medewerkers App om gebruikers op de hoogte te houden van:
- Nieuwe chat berichten (team, project, direct)
- Broadcast announcements van management
- Uren registratie herinneringen
- Project updates en toewijzingen

### Gekozen Stack

| Component | Keuze | Reden |
|-----------|-------|-------|
| **Client Library** | expo-notifications | Native Expo integratie, unified API |
| **Push Service** | Expo Push Service + FCM/APNs | Gratis, betrouwbaar, automatische batching |
| **Backend** | Convex + @convex-dev/expo-push-notifications | Naadloze integratie met bestaande backend |
| **Token Type** | ExpoPushToken | Vereenvoudigt server-side implementatie |

---

## 2. Expo Notifications Setup

### 2.1 Installatie

```bash
npx expo install expo-notifications expo-device expo-constants
```

### 2.2 App Configuration (app.json)

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#16a34a",
          "defaultChannel": "default",
          "sounds": [
            "./assets/sounds/notification.wav"
          ]
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      },
      "entitlements": {
        "aps-environment": "development"
      }
    },
    "android": {
      "useNextNotificationsApi": true
    }
  }
}
```

> **Belangrijk:** De plugin moet expliciet worden toegevoegd aan de `plugins` array. Zonder deze configuratie missen iOS builds de benodigde APNs entitlements en background modes.

### 2.3 Basis Setup Code

```typescript
// apps/mobile/lib/notifications/setup.ts

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configureer hoe notificaties worden afgehandeld wanneer app actief is
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,    // Toon banner bovenin scherm
    shouldShowList: true,      // Toon in notification center
    shouldPlaySound: true,     // Speel geluid af
    shouldSetBadge: true,      // Update app badge
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications werken alleen op fysieke devices
  if (!Device.isDevice) {
    console.log('Push notifications vereisen een fysiek device');
    return null;
  }

  // Check en vraag permissies
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permissie niet verleend');
    return null;
  }

  // Haal Expo Push Token op
  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      throw new Error('Project ID niet gevonden');
    }

    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;

    console.log('ExpoPushToken:', token);
    return token;

  } catch (error) {
    console.error('Fout bij ophalen push token:', error);
    return null;
  }
}
```

---

## 3. FCM Integration (Firebase Cloud Messaging)

### 3.1 Waarom FCM?

FCM is de onderliggende push service voor Android. Expo's push service communiceert automatisch met FCM, maar je moet wel credentials configureren.

### 3.2 Firebase Project Setup

1. **Maak Firebase Project**
   - Ga naar [Firebase Console](https://console.firebase.google.com)
   - Maak nieuw project of selecteer bestaand project

2. **Download Configuratie Files**
   - Android: `google-services.json` (Project Settings > General > Your Apps)
   - iOS: `GoogleService-Info.plist` (zelfde locatie)

3. **Genereer FCM V1 Service Account Key**
   - Project Settings > Service accounts
   - Klik "Generate New Private Key"
   - Download JSON file (bewaar veilig!)

### 3.3 EAS Credentials Configuratie

```bash
# Upload FCM credentials via EAS CLI
eas credentials

# Of via Expo Dashboard:
# Project > Configuration > Credentials > Service Credentials
# FCM V1 service account key > Add a service account key
```

### 3.4 FCM V1 API (Server-Side)

Voor directe FCM communicatie (optioneel, Expo Push Service handelt dit normaal af):

```typescript
// convex/actions/sendFcmNotification.ts

import { action } from "./_generated/server";
import { v } from "convex/values";

// FCM V1 endpoint
const FCM_ENDPOINT = 'https://fcm.googleapis.com/v1/projects/{project_id}/messages:send';

export const sendDirectFcm = action({
  args: {
    deviceToken: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Haal access token op via Google Auth
    const accessToken = await getGoogleAccessToken();

    const message = {
      message: {
        token: args.deviceToken,
        notification: {
          title: args.title,
          body: args.body,
        },
        data: args.data,
        android: {
          priority: 'high',
          notification: {
            channel_id: 'default',
            sound: 'default',
          },
        },
      },
    };

    const response = await fetch(FCM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    return response.json();
  },
});
```

---

## 4. Device Token Management

### 4.1 Token Types

| Token Type | Beschrijving | Gebruik |
|------------|--------------|---------|
| **ExpoPushToken** | Expo's abstractie token (format: `ExponentPushToken[xxx]`) | Aanbevolen voor Expo Push Service |
| **DevicePushToken** | Native FCM/APNs token | Directe FCM/APNs communicatie |

### 4.2 Token Registratie Flow

```typescript
// apps/mobile/lib/notifications/token-manager.ts

import * as Notifications from 'expo-notifications';
import { useMutation } from 'convex/react';
import { api } from '../convex';

export function useTokenRegistration() {
  const recordToken = useMutation(api.notifications.recordToken);

  const registerToken = async (userId: string) => {
    // Registreer voor push notifications
    const token = await registerForPushNotificationsAsync();

    if (token) {
      // Sla token op in Convex backend
      await recordToken({
        userId,
        token,
        platform: Platform.OS as 'ios' | 'android',
      });
    }

    return token;
  };

  return { registerToken };
}
```

### 4.3 Token Refresh Handling

```typescript
// apps/mobile/hooks/usePushTokenListener.ts

import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useMutation } from 'convex/react';
import { api } from '../lib/convex';

export function usePushTokenListener(userId: string | null) {
  const recordToken = useMutation(api.notifications.recordToken);

  useEffect(() => {
    if (!userId) return;

    // Luister naar token updates (token kan veranderen)
    const subscription = Notifications.addPushTokenListener(async (tokenData) => {
      console.log('Push token updated:', tokenData);

      await recordToken({
        userId,
        token: tokenData.data,
        platform: Platform.OS as 'ios' | 'android',
      });
    });

    return () => subscription.remove();
  }, [userId, recordToken]);
}
```

### 4.4 Convex Token Storage Schema

```typescript
// convex/schema.ts

notification_preferences: defineTable({
  userId: v.id("users"),
  clerkUserId: v.string(),

  // Token management
  enablePushNotifications: v.boolean(),
  deviceToken: v.optional(v.string()),         // ExpoPushToken
  devicePlatform: v.optional(v.union(
    v.literal("ios"),
    v.literal("android"),
    v.literal("web")
  )),

  // Granulaire voorkeuren
  notifyOnTeamChat: v.boolean(),
  notifyOnDirectMessage: v.boolean(),
  notifyOnProjectChat: v.boolean(),
  notifyOnBroadcast: v.boolean(),

  // Quiet hours
  quietHoursStart: v.optional(v.string()),     // "22:00"
  quietHoursEnd: v.optional(v.string()),       // "07:00"
  respectQuietHours: v.boolean(),

  // Muting
  mutedChannels: v.optional(v.array(v.string())),
  mutedUsers: v.optional(v.array(v.string())),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_clerk_id", ["clerkUserId"]),
```

---

## 5. Notification Handling Patterns

### 5.1 Notification Handler Configuratie

```typescript
// apps/mobile/lib/notifications/handlers.ts

import * as Notifications from 'expo-notifications';

// Bepaalt hoe notificaties worden gepresenteerd wanneer app in foreground is
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Custom logica op basis van notification data
    const data = notification.request.content.data;

    // Bijv: stille notificaties voor bepaalde types
    if (data.silent) {
      return {
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: true,
      };
    }

    // Standaard: toon alles
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});
```

### 5.2 Foreground Notification Listener

Wordt getriggerd wanneer notificatie binnenkomt terwijl app actief is:

```typescript
// apps/mobile/hooks/useNotificationListeners.ts

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

export function useNotificationListeners() {
  const router = useRouter();
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // FOREGROUND: Notificatie ontvangen terwijl app open is
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const { title, body, data } = notification.request.content;

        console.log('Notification received in foreground:', {
          title,
          body,
          data,
        });

        // Optioneel: toon in-app toast/alert
        // showInAppNotification({ title, body, data });
      }
    );

    // TAP: Gebruiker tikt op notificatie
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;

        console.log('Notification tapped:', data);

        // Navigeer naar juiste scherm op basis van data
        handleNotificationNavigation(data, router);
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);
}

function handleNotificationNavigation(
  data: Record<string, unknown>,
  router: ReturnType<typeof useRouter>
) {
  const { type, channelType, projectId, userId, messageId } = data;

  switch (type) {
    case 'chat':
      if (channelType === 'direct') {
        router.push(`/chat/dm/${userId}`);
      } else if (channelType === 'project') {
        router.push(`/chat/project/${projectId}`);
      } else {
        router.push('/chat/team');
      }
      break;

    case 'project_update':
      router.push(`/projects/${projectId}`);
      break;

    case 'hours_reminder':
      router.push('/hours/entry');
      break;

    default:
      router.push('/dashboard');
  }
}
```

### 5.3 Background/Killed State Handling

Voor notificaties die binnenkomen wanneer app op achtergrond of gesloten is:

```typescript
// apps/mobile/app/_layout.tsx

import { useLastNotificationResponse } from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function RootLayout() {
  const router = useRouter();

  // Hook die laatste notification response teruggeeft
  // Belangrijk voor cold start via notification tap
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (lastNotificationResponse) {
      const data = lastNotificationResponse.notification.request.content.data;

      // Navigeer na app start
      handleNotificationNavigation(data, router);
    }
  }, [lastNotificationResponse, router]);

  return (
    // ... layout content
  );
}
```

### 5.4 Dropped Notifications Listener (Android)

```typescript
// Specifiek voor FCM/Android wanneer te veel notificaties in queue staan
Notifications.addNotificationsDroppedListener(() => {
  console.log('Some notifications were dropped by the system');

  // Optioneel: sync unread counts met server
  refreshUnreadCounts();
});
```

---

## 6. Platform-Specifieke Configuratie

### 6.1 iOS Configuratie

#### APNs Entitlements

De `aps-environment` entitlement wordt automatisch door Xcode naar `production` gezet bij release builds.

```json
// app.json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      },
      "entitlements": {
        "aps-environment": "development"
      }
    }
  }
}
```

#### Apple Developer Account Requirements

- **Betaald Apple Developer Account vereist** ($99/jaar)
- Device moet geregistreerd zijn voor development builds
- Push Notification capability moet enabled zijn in App ID

#### APNs Key Genereren

1. Apple Developer Portal > Certificates, Identifiers & Profiles
2. Keys > Create new Key
3. Enable "Apple Push Notifications service (APNs)"
4. Download .p8 file (sla veilig op, kan maar 1x gedownload worden)
5. Noteer Key ID en Team ID

#### EAS iOS Credentials Setup

```bash
# Tijdens eerste EAS Build wordt gevraagd:
# "Would you like to enable Push Notifications?"
# Kies "Yes" om automatisch APNs key te genereren

eas build --platform ios --profile preview
```

### 6.2 Android Notification Channels

Vanaf Android 13 (API 33) moeten gebruikers expliciet toestemming geven voor notificaties. Dit werkt alleen als er minimaal 1 notification channel bestaat.

```typescript
// apps/mobile/lib/notifications/android-channels.ts

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function setupAndroidChannels() {
  if (Platform.OS !== 'android') return;

  // Default channel
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Algemeen',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#16a34a',
    description: 'Algemene meldingen',
  });

  // Chat messages - high priority
  await Notifications.setNotificationChannelAsync('chat', {
    name: 'Chat Berichten',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#16a34a',
    sound: 'message.wav',
    enableVibrate: true,
    showBadge: true,
    description: 'Berichten van collega\'s en projecten',
  });

  // Broadcasts - max priority
  await Notifications.setNotificationChannelAsync('broadcast', {
    name: 'Aankondigingen',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    lightColor: '#ef4444',
    bypassDnd: true,
    enableVibrate: true,
    description: 'Belangrijke aankondigingen van management',
  });

  // Reminders - low priority
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Herinneringen',
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: [0, 100],
    lightColor: '#3b82f6',
    description: 'Uren registratie herinneringen',
  });
}
```

#### Android Channel Properties

| Property | Type | Beschrijving |
|----------|------|--------------|
| `name` | string | Gebruiker-zichtbare naam |
| `importance` | AndroidImportance | Prioriteit (MIN, LOW, DEFAULT, HIGH, MAX) |
| `description` | string | Beschrijving voor instellingen |
| `sound` | string | Custom geluid (in `android/app/src/main/res/raw/`) |
| `vibrationPattern` | number[] | Vibratie patroon [pause, vibrate, pause, vibrate...] |
| `lightColor` | string | LED kleur (hex) |
| `enableVibrate` | boolean | Vibratie aan/uit |
| `enableLights` | boolean | LED notificatie aan/uit |
| `showBadge` | boolean | Toon badge op app icon |
| `bypassDnd` | boolean | Bypass Do Not Disturb |
| `lockscreenVisibility` | AndroidNotificationVisibility | Zichtbaarheid op lockscreen |

> **Let op:** Na aanmaken kunnen alleen `name` en `description` worden gewijzigd. Andere properties vereisen een nieuwe channel.

### 6.3 Android Permissions

```xml
<!-- Automatisch toegevoegd door expo-notifications -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>

<!-- Voor exacte scheduled notifications (Android 12+) -->
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>
```

---

## 7. Server-Side Push Implementatie (Convex)

### 7.1 Convex Component Installatie

```bash
npm i @convex-dev/expo-push-notifications
```

### 7.2 Component Configuratie

```typescript
// convex/convex.config.ts

import { defineApp } from "convex/server";
import pushNotifications from "@convex-dev/expo-push-notifications/convex.config.js";

const app = defineApp();
app.use(pushNotifications);
export default app;
```

### 7.3 Push Notifications Service

```typescript
// convex/notifications.ts

import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { PushNotifications } from "@convex-dev/expo-push-notifications";
import { components } from "./_generated/api";

// Initialiseer push notifications component
const pushNotifications = new PushNotifications(components.pushNotifications, {
  logLevel: "INFO", // DEBUG voor troubleshooting
});

// Token registratie
export const recordToken = mutation({
  args: {
    userId: v.string(),
    token: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android")),
  },
  handler: async (ctx, args) => {
    // Gebruik Convex component om token op te slaan
    await pushNotifications.recordToken(ctx, {
      userId: args.userId,
      pushToken: args.token,
    });

    // Update ook eigen notification_preferences tabel
    const existing = await ctx.db
      .query("notification_preferences")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        deviceToken: args.token,
        devicePlatform: args.platform,
        enablePushNotifications: true,
        updatedAt: Date.now(),
      });
    }
  },
});

// Verstuur push notification
export const sendPushNotification = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.object({
      type: v.string(),
      channelType: v.optional(v.string()),
      projectId: v.optional(v.string()),
      messageId: v.optional(v.string()),
    })),
    channelId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check notification preferences
    const prefs = await ctx.db
      .query("notification_preferences")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.userId))
      .first();

    if (!prefs?.enablePushNotifications) {
      return { sent: false, reason: "notifications_disabled" };
    }

    // Check quiet hours
    if (prefs.respectQuietHours && isQuietHours(prefs)) {
      return { sent: false, reason: "quiet_hours" };
    }

    // Check muted channels/users
    if (args.data?.channelType && prefs.mutedChannels?.includes(args.data.channelType)) {
      return { sent: false, reason: "channel_muted" };
    }

    // Verstuur via Convex component
    const notificationId = await pushNotifications.sendPushNotification(ctx, {
      userId: args.userId,
      notification: {
        title: args.title,
        body: args.body,
        data: args.data,
        channelId: args.channelId || "default",
      },
    });

    return { sent: true, notificationId };
  },
});

// Notification status query
export const getNotificationStatus = query({
  args: {
    notificationId: v.string(),
  },
  handler: async (ctx, args) => {
    return pushNotifications.getNotification(ctx, {
      notificationId: args.notificationId,
    });
  },
});

// Pause/resume notifications
export const pauseNotifications = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await pushNotifications.pausePushNotifications(ctx, { userId: args.userId });
  },
});

export const resumeNotifications = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await pushNotifications.resumePushNotifications(ctx, { userId: args.userId });
  },
});

// Helper function
function isQuietHours(prefs: NotificationPreferences): boolean {
  if (!prefs.quietHoursStart || !prefs.quietHoursEnd) return false;

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const start = prefs.quietHoursStart;
  const end = prefs.quietHoursEnd;

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (start > end) {
    return currentTime >= start || currentTime < end;
  }

  return currentTime >= start && currentTime < end;
}
```

### 7.4 Chat Message Notification Trigger

```typescript
// convex/teamMessages.ts

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const send = mutation({
  args: {
    channelType: v.union(v.literal("team"), v.literal("project"), v.literal("broadcast")),
    projectId: v.optional(v.id("projecten")),
    message: v.string(),
    attachmentStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Insert message
    const messageId = await ctx.db.insert("team_messages", {
      senderId: identity.subject,
      senderName: identity.name || "Onbekend",
      senderClerkId: identity.subject,
      channelType: args.channelType,
      projectId: args.projectId,
      message: args.message,
      attachmentStorageId: args.attachmentStorageId,
      isRead: false,
      createdAt: Date.now(),
    });

    // Trigger push notifications naar relevante gebruikers
    await ctx.scheduler.runAfter(0, internal.notifications.sendChatNotifications, {
      messageId,
      senderId: identity.subject,
      senderName: identity.name || "Onbekend",
      channelType: args.channelType,
      projectId: args.projectId,
      messagePreview: args.message.slice(0, 100),
    });

    return messageId;
  },
});
```

### 7.5 Internal Notification Action

```typescript
// convex/notifications.ts

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const sendChatNotifications = internalAction({
  args: {
    messageId: v.string(),
    senderId: v.string(),
    senderName: v.string(),
    channelType: v.string(),
    projectId: v.optional(v.string()),
    messagePreview: v.string(),
  },
  handler: async (ctx, args) => {
    // Haal relevante gebruikers op
    let recipientIds: string[] = [];

    if (args.channelType === "team" || args.channelType === "broadcast") {
      // Alle team leden behalve sender
      const teamMembers = await ctx.runQuery(api.medewerkers.getAllActive);
      recipientIds = teamMembers
        .filter((m) => m.clerkUserId !== args.senderId)
        .map((m) => m.clerkUserId)
        .filter(Boolean);
    } else if (args.channelType === "project" && args.projectId) {
      // Project team leden
      const projectMembers = await ctx.runQuery(api.projecten.getTeamMembers, {
        projectId: args.projectId,
      });
      recipientIds = projectMembers
        .filter((m) => m.clerkUserId !== args.senderId)
        .map((m) => m.clerkUserId)
        .filter(Boolean);
    }

    // Verstuur naar elke ontvanger
    for (const userId of recipientIds) {
      await ctx.runMutation(api.notifications.sendPushNotification, {
        userId,
        title: args.senderName,
        body: args.messagePreview,
        data: {
          type: "chat",
          channelType: args.channelType,
          projectId: args.projectId,
          messageId: args.messageId,
        },
        channelId: args.channelType === "broadcast" ? "broadcast" : "chat",
      });
    }
  },
});
```

---

## 8. Implementatie Stappenplan

### Fase 1: Basis Setup (Week 1)

- [ ] Installeer expo-notifications, expo-device, expo-constants
- [ ] Configureer app.json met plugin en iOS entitlements
- [ ] Implementeer basis token registratie
- [ ] Setup Convex push notifications component

### Fase 2: FCM/APNs Credentials (Week 1-2)

- [ ] Maak Firebase project aan
- [ ] Genereer en upload FCM V1 service account key naar EAS
- [ ] Configureer APNs key via EAS Build
- [ ] Test token ophalen op fysiek device

### Fase 3: Android Channels (Week 2)

- [ ] Definieer notification channels (default, chat, broadcast, reminders)
- [ ] Implementeer channel setup bij app start
- [ ] Configureer custom sounds

### Fase 4: Notification Handlers (Week 2)

- [ ] Implementeer setNotificationHandler voor foreground
- [ ] Implementeer notification listeners (received, response)
- [ ] Implementeer cold start handling met useLastNotificationResponse
- [ ] Setup navigatie op basis van notification data

### Fase 5: Server-Side Integration (Week 3)

- [ ] Implementeer token storage in Convex
- [ ] Implementeer sendPushNotification mutation
- [ ] Koppel aan chat message triggers
- [ ] Implementeer notification preferences (quiet hours, muting)

### Fase 6: Testing & Polish (Week 3-4)

- [ ] Test op iOS device
- [ ] Test op Android device
- [ ] Test foreground, background, killed state scenarios
- [ ] Implementeer error handling en retry logic
- [ ] Performance optimalisatie (batching)

---

## Referenties

- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo Push Notifications Setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Send notifications with FCM and APNs](https://docs.expo.dev/push-notifications/sending-notifications-custom/)
- [Firebase Cloud Messaging Setup](https://rnfirebase.io/messaging/usage)
- [Convex Push Notifications Component](https://www.convex.dev/components/push-notifications)
- [@convex-dev/expo-push-notifications](https://github.com/get-convex/expo-push-notifications)
- [Convex Actions Documentation](https://docs.convex.dev/functions/actions)

---

*Document gegenereerd op 2026-02-01*
