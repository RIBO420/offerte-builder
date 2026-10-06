import React from 'react';
import { Folder, Megaphone, Users } from 'lucide-react-native';
import { KanaalAvatar, PersoonAvatar } from './ChatAvatar';

/**
 * De vier soorten gesprekken. `team` en `mededelingen` zijn de vaste kanalen,
 * `dm` heeft een users-id, `project` een projecten-id (alleen-lezen historie).
 */
export type GesprekSoort = 'team' | 'mededelingen' | 'dm' | 'project';

export const VASTE_NAMEN = { team: 'Teamchat', mededelingen: 'Mededelingen' } as const;

export function isGesprekSoort(waarde: unknown): waarde is GesprekSoort {
  return waarde === 'team' || waarde === 'mededelingen' || waarde === 'dm' || waarde === 'project';
}

/**
 * Route naar een gesprek. `naam` reist mee, zodat de kop meteen klopt; zonder
 * naam zoekt het gespreksscherm hem zelf op.
 */
export function gesprekHref(soort: GesprekSoort, naam?: string, id?: string) {
  const params: Record<string, string> = { soort };
  if (naam) params.naam = naam;
  if (id) params.id = id;
  return { pathname: '/chat/[soort]' as const, params };
}

/** Het gezicht van een gesprek: initialen voor een collega, een icoon voor een kanaal. */
export function GesprekAvatar({ soort, naam, grootte = 44 }: { soort: GesprekSoort; naam: string; grootte?: number }) {
  switch (soort) {
    case 'team':
      return <KanaalAvatar icoon={Users} toon="primair" grootte={grootte} />;
    case 'mededelingen':
      return <KanaalAvatar icoon={Megaphone} toon="wachten" grootte={grootte} />;
    case 'project':
      return <KanaalAvatar icoon={Folder} toon="info" grootte={grootte} />;
    default:
      return <PersoonAvatar naam={naam} grootte={grootte} />;
  }
}
