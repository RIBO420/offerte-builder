import React, { StrictMode, useState } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessieConvexProvider } from '../components/SessieConvexProvider';

const env = vi.hoisted(() => ({
  auth: { sessionId: 'session', userId: 'user', orgId: 'org' },
  clients: [] as { close: ReturnType<typeof vi.fn> }[],
  active: null as { close: ReturnType<typeof vi.fn> } | null,
}));
vi.mock('@clerk/clerk-expo', () => ({ useAuth: () => env.auth }));
vi.mock('../lib/convex', () => ({ maakConvexClient: () => {
  const client = { close: vi.fn().mockResolvedValue(undefined) }; env.clients.push(client); return client;
} }));
vi.mock('convex/react-clerk', () => ({ ConvexProviderWithClerk: ({ client, children }: { client: typeof env.active; children: React.ReactNode }) => {
  env.active = client; return children;
} }));
function Draft() { const [value] = useState(() => env.auth.orgId); return <span>{value}</span>; }
beforeEach(() => { vi.useFakeTimers(); env.clients = []; env.auth = { sessionId: 'session', userId: 'user', orgId: 'org' }; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Clerk identity boundary', () => {
  it('replaces both query client and form subtree when organisation or session changes', async () => {
    const mounted = render(<SessieConvexProvider><Draft /></SessieConvexProvider>);
    const first = env.active!;
    expect(screen.getByText('org')).toBeTruthy();
    env.auth = { ...env.auth, orgId: 'other' };
    mounted.rerender(<SessieConvexProvider><Draft /></SessieConvexProvider>);
    const second = env.active!;
    expect(second).not.toBe(first);
    expect(screen.queryByText('org')).toBeNull();
    expect(screen.getByText('other')).toBeTruthy();
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(second.close).not.toHaveBeenCalled();
    env.auth = { ...env.auth, sessionId: 'new-session' };
    mounted.rerender(<SessieConvexProvider><Draft /></SessieConvexProvider>);
    expect(env.active).not.toBe(second);
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    expect(second.close).toHaveBeenCalledTimes(1);
  });
  it('does not close the active client during StrictMode effect replay, and closes it on real unmount', async () => {
    const mounted = render(<StrictMode><SessieConvexProvider><Draft /></SessieConvexProvider></StrictMode>);
    const active = env.active!;
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    expect(active.close).not.toHaveBeenCalled();
    mounted.unmount();
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    expect(active.close).toHaveBeenCalledTimes(1);
  });
});
