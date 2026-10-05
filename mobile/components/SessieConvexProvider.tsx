import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { maakConvexClient } from '../lib/convex';

/** Iedere identiteit krijgt een nieuwe querycache én een nieuwe componentboom.
 * Anders kan een oude realtime respons bij orgwissel in de nieuwe offlinecache
 * terechtkomen voordat de asynchrone Clerk-tokenwissel is bevestigd. */
export function SessieConvexProvider({ children }: { children: ReactNode }) {
  const { sessionId, userId, orgId } = useAuth();
  const sleutel = `${sessionId ?? 'uit'}:${userId ?? 'uit'}:${orgId ?? 'geen-org'}`;
  return <SessieClient key={sleutel}>{children}</SessieClient>;
}
function SessieClient({ children }: { children: ReactNode }) {
  const [client] = useState(maakConvexClient);
  const sluiten = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (sluiten.current) clearTimeout(sluiten.current);
    return () => {
      // Eén tick uitstel maakt StrictMode's effect-proef veilig; een echte
      // identiteitwissel gebruikt een andere componentinstantie en andere client.
      sluiten.current = setTimeout(() => { void client.close(); }, 0);
    };
  }, [client]);
  return <ConvexProviderWithClerk client={client} useAuth={useAuth}>{children}</ConvexProviderWithClerk>;
}
