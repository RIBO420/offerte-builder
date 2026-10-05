import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVeldOpdracht } from '../hooks/use-veld-opdracht';
import { outboxSleutel } from '../lib/veld-outbox-core';

const env = vi.hoisted(() => ({
  userId: 'user', orgId: '', connected: false,
  storage: new Map<string, string>(),
  listeners: new Set<(state: { isConnected: boolean; isInternetReachable: boolean }) => void>(),
  send: vi.fn<(auth: string, payload: Record<string, unknown>) => Promise<unknown>>(),
  token: vi.fn<() => Promise<string>>(),
}));
vi.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: env.userId, orgId: env.orgId, getToken: env.token }) }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => env.storage.get(key) ?? null,
  setItem: async (key: string, value: string) => { env.storage.set(key, value); },
} }));
vi.mock('@react-native-community/netinfo', () => ({ default: { addEventListener: (listener: (state: { isConnected: boolean; isInternetReachable: boolean }) => void) => {
  env.listeners.add(listener);
  listener({ isConnected: env.connected, isInternetReachable: env.connected });
  return () => env.listeners.delete(listener);
} } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'generated-stable-key' }));
vi.mock('../lib/veld-foto-upload', () => ({ bewaarVeldFoto: vi.fn(), ruimVeldFotoOp: vi.fn(), uploadVeldFoto: vi.fn() }));
vi.mock('convex/browser', () => ({ ConvexHttpClient: class {
  constructor(_url: string, private options: { auth: string }) {}
  mutation(_name: unknown, payload: Record<string, unknown>) { return env.send(this.options.auth, payload); }
} }));

function jwt(user = env.userId, org = env.orgId) { return `header.${btoa(JSON.stringify({ sub: user, org_id: org }))}.signature`; }
async function flush() { await act(async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); }); }
async function network(connected: boolean) {
  env.connected = connected;
  await act(async () => { env.listeners.forEach(fn => fn({ isConnected: connected, isInternetReachable: connected })); });
  await flush();
}
let testId = 0;
beforeEach(() => {
  vi.useFakeTimers();
  env.orgId = `organisation-${++testId}`; env.userId = 'user'; env.connected = false;
  env.storage.clear(); env.send.mockReset().mockResolvedValue({ id: 'saved' });
  env.token.mockReset().mockImplementation(async () => jwt());
  process.env.EXPO_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('native outbox hook lifecycle', () => {
  it('returns durable pending after 2.5 seconds while a slow request continues', async () => {
    env.connected = true;
    let finish!: (value: unknown) => void;
    env.send.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const hook = renderHook(useVeldOpdracht); await flush();
    let pending!: ReturnType<typeof hook.result.current.verstuur>;
    await act(async () => { pending = hook.result.current.verstuur('retour', { keuze: 'half' }, 'slow-key'); });
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(await pending).toMatchObject({ id: 'slow-key', status: 'wacht' });
    expect(JSON.parse(env.storage.get(outboxSleutel(env.orgId, env.userId))!)).toHaveLength(1);
    await act(async () => { finish({ id: 'saved' }); }); await flush();
    expect(hook.result.current.wachtrij).toHaveLength(0);
  });

  it('persists before returning pending and shares the queue across mounted forms', async () => {
    const first = renderHook(useVeldOpdracht); const second = renderHook(useVeldOpdracht);
    await flush();
    await act(async () => {
      expect(await first.result.current.verstuur('retour', { datum: '2026-09-12', keuze: 'half' }, 'return-key')).toMatchObject({ status: 'wacht' });
    });
    await flush();
    expect(second.result.current.wachtrij[0].payload.idempotencyKey).toBe('return-key');
    expect(JSON.parse(env.storage.get(outboxSleutel(env.orgId, env.userId))!)).toHaveLength(1);
    expect(env.send).not.toHaveBeenCalled();
    first.unmount(); second.unmount();
    const reopened = renderHook(useVeldOpdracht); await flush();
    expect(reopened.result.current.wachtrij).toHaveLength(1);
    await network(true);
    expect(env.send).toHaveBeenCalledTimes(1);
    expect(reopened.result.current.wachtrij).toHaveLength(0);
  });

  it('retries the identical command after unmount during a successful server request', async () => {
    let finish!: (value: unknown) => void;
    env.send.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const first = renderHook(useVeldOpdracht); await flush();
    await act(async () => { await first.result.current.verstuur('segmentToevoegen', { datum: '2026-09-12', beginTijd: '08:00' }, 'segment-key'); });
    await network(true);
    expect(env.send).toHaveBeenCalledTimes(1);
    first.unmount();
    const reopened = renderHook(useVeldOpdracht); await flush();
    await act(async () => { finish({ id: 'server-already-saved' }); }); await flush();
    expect(reopened.result.current.wachtrij).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); }); await flush();
    expect(env.send).toHaveBeenCalledTimes(2);
    expect(env.send.mock.calls[0]).toEqual(env.send.mock.calls[1]);
    expect(reopened.result.current.wachtrij).toHaveLength(0);
  });

  it('never sends the old organisation queue with a new token during account switch', async () => {
    let tokenReady!: (value: string) => void;
    env.token.mockImplementationOnce(() => new Promise(resolve => { tokenReady = resolve; }));
    const oldOrg = env.orgId; const oldToken = jwt();
    const first = renderHook(useVeldOpdracht); await flush();
    await act(async () => { await first.result.current.verstuur('afvoer', { keuze: 'half' }, 'old-key'); });
    await network(true); first.unmount();
    env.orgId = 'other-organisation';
    const next = renderHook(useVeldOpdracht); await flush();
    await act(async () => { tokenReady(oldToken); }); await flush();
    expect(env.send).not.toHaveBeenCalled();
    expect(next.result.current.wachtrij).toHaveLength(0);
    expect(JSON.parse(env.storage.get(outboxSleutel(oldOrg, 'user'))!)).toHaveLength(1);
  });

  it('keeps network failures pending, blocks FIFO on rejection, and supports explicit identical retry', async () => {
    const hook = renderHook(useVeldOpdracht); await flush();
    await act(async () => {
      await hook.result.current.verstuur('afvoer', { keuze: 'half' }, 'first-key');
      await hook.result.current.verstuur('afronding', { afgerond: true }, 'second-key');
    });
    env.send.mockRejectedValueOnce(new Error('Network request failed'));
    await network(true);
    expect(hook.result.current.wachtrij.map(row => row.status)).toEqual(['wacht', 'wacht']);
    env.send.mockRejectedValueOnce(new Error('De revisie is gewijzigd'));
    await act(async () => { await hook.result.current.synchroniseer(); }); await flush();
    expect(hook.result.current.wachtrij.map(row => row.status)).toEqual(['conflict', 'wacht']);
    expect(env.send).toHaveBeenCalledTimes(2);
    await act(async () => { await hook.result.current.probeerOpnieuw('first-key'); }); await flush();
    expect(env.send).toHaveBeenCalledTimes(4);
    expect(env.send.mock.calls[0]).toEqual(env.send.mock.calls[2]);
    expect(hook.result.current.wachtrij).toHaveLength(0);
  });
});
