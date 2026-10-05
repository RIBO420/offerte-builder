import { describe, expect, it } from 'vitest';
import { USER_ROLES, getPermissionsForRole, normalizeRole, isInternalRole } from '../../../mobile/lib/roles';
import { amsterdamTijd, retourTijdstip } from '../../../mobile/lib/retour-tijd';
import { bevestigIntroLokaal, introIsBevestigd, introScope } from '../../../mobile/lib/intro-status';

describe('native canonical role boundary', () => {
  it.each(USER_ROLES)('preserves canonical %s', role => {
    expect(normalizeRole(role)).toBe(role);
  });
  it('maps only explicit legacy roles', () => {
    expect(normalizeRole('admin')).toBe('directie');
    expect(normalizeRole('viewer')).toBe('klant');
  });
  it.each([undefined, null, '', 'user', 'owner', 'DIRECTIE'])('fails closed for %s', role => {
    expect(normalizeRole(role)).toBe('onbekend');
    const permissions = getPermissionsForRole(role);
    expect(permissions.isReadOnly).toBe(true);
    for (const [key, value] of Object.entries(permissions)) {
      if (key !== 'isReadOnly') expect(value, key).toBe(false);
    }
  });
  it('keeps office, foreman, external workers and clients distinct', () => {
    expect(getPermissionsForRole('directie').canManageUsers).toBe(true);
    expect(getPermissionsForRole('projectleider').canManageUsers).toBe(false);
    expect(getPermissionsForRole('projectleider').canManageProjects).toBe(true);
    for (const role of ['voorman', 'medewerker', 'onderaannemer_zzp', 'materiaalman']) {
      expect(getPermissionsForRole(role).canViewUren).toBe(true);
      expect(getPermissionsForRole(role).canManageUsers).toBe(false);
      expect(getPermissionsForRole(role).canManageMedewerkers).toBe(false);
    }
    expect(isInternalRole('klant')).toBe(false);
    expect(getPermissionsForRole('klant').canCreateEntries).toBe(false);
  });
});

describe('return observations use Dutch date and time', () => {
  it.each([
    ['2026-09-12', '16:30', '2026-09-12T14:30:00.000Z'],
    ['2026-01-12', '16:30', '2026-01-12T15:30:00.000Z'],
    ['2026-09-12', '00:05', '2026-09-11T22:05:00.000Z'],
    ['2026-03-29', '03:30', '2026-03-29T01:30:00.000Z'],
  ])('converts %s %s independently of device time zone', (date, time, expected) => {
    const timestamp = retourTijdstip(date, time)!;
    expect(new Date(timestamp).toISOString()).toBe(expected);
    expect(amsterdamTijd(timestamp)).toBe(time);
  });
  it.each([['2026-02-30', '16:00'], ['2026-03-29', '02:30'], ['2026-09-12', '25:00'], ['bad', '16:00']])('rejects invalid/nonexistent %s %s', (date, time) => {
    expect(retourTijdstip(date, time)).toBeNull();
  });
});

describe('intro confirmation query-race bridge', () => {
  it('holds a confirmed result until the live query catches up without crossing account or organisation', () => {
    const eigen = introScope('org-a', 'user-a');
    bevestigIntroLokaal(eigen);
    expect(introIsBevestigd(eigen)).toBe(true);
    expect(introIsBevestigd(introScope('org-b', 'user-a'))).toBe(false);
    expect(introIsBevestigd(introScope('org-a', 'user-b'))).toBe(false);
  });
  it('never marks anonymous scope as completed', () => {
    expect(introScope(null, 'user-a')).toBeNull();
    bevestigIntroLokaal(null);
    expect(introIsBevestigd(null)).toBe(false);
  });
});
