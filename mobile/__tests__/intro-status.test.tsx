import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { bevestigIntroLokaal, introScope, moetIntroTonen, useIntroLokaalGezien } from '../lib/intro-status';

const opslag = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => opslag.get(key) ?? null,
  setItem: async (key: string, value: string) => { opslag.set(key, value); },
} }));
async function flush() { await act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); }); }

describe('moetIntroTonen', () => {
  it('toont de intro alleen als server, wachtrij en toestel alle drie "niet gezien" zeggen', () => {
    expect(moetIntroTonen({ serverGezien: false, inWachtrij: false, lokaalGezien: false })).toBe(true);
  });
  it('toont hem niet bij eerdere activiteit of een rij op de server', () => {
    expect(moetIntroTonen({ serverGezien: true, inWachtrij: false, lokaalGezien: false })).toBe(false);
  });
  it('toont hem niet terwijl de markering nog in de wachtrij staat', () => {
    expect(moetIntroTonen({ serverGezien: false, inWachtrij: true, lokaalGezien: false })).toBe(false);
  });
  it('toont hem niet als dit toestel hem al liet zien, ook als de server dat (nog) niet weet', () => {
    expect(moetIntroTonen({ serverGezien: false, inWachtrij: false, lokaalGezien: true })).toBe(false);
  });
  it('wacht tot server en lokale opslag bekend zijn', () => {
    expect(moetIntroTonen({ serverGezien: undefined, inWachtrij: false, lokaalGezien: false })).toBe(false);
    expect(moetIntroTonen({ serverGezien: false, inWachtrij: false, lokaalGezien: undefined })).toBe(false);
  });
});

describe('lokale introbevestiging', () => {
  it('blijft bewaard per account en organisatie', async () => {
    const scope = introScope('org-a', 'user-1');
    const eerst = renderHook(() => useIntroLokaalGezien(scope));
    expect(eerst.result.current).toBeUndefined();
    await flush();
    expect(eerst.result.current).toBe(false);
    await act(async () => { await bevestigIntroLokaal(scope); });
    expect(eerst.result.current).toBe(true);
    expect([...opslag.keys()]).toEqual(['toptuinen:intro-gezien:v1:org-a:user-1']);
    const ander = renderHook(() => useIntroLokaalGezien(introScope('org-a', 'user-2')));
    await flush();
    expect(ander.result.current).toBe(false);
  });

  it('markeert nooit een anonieme scope', async () => {
    expect(introScope(null, 'user-a')).toBeNull();
    await bevestigIntroLokaal(null);
    const hook = renderHook(() => useIntroLokaalGezien(null));
    expect(hook.result.current).toBeUndefined();
  });

  it('leest een eerdere bevestiging terug uit de opslag (na herstart)', async () => {
    opslag.set('toptuinen:intro-gezien:v1:org-b:user-1', '1');
    const hook = renderHook(() => useIntroLokaalGezien(introScope('org-b', 'user-1')));
    await flush();
    expect(hook.result.current).toBe(true);
  });
});
