/**
 * "Buiten"-modus voor de veld-rol (PRD §2.6 / bijlage C): hoog-contrast
 * licht thema voor fel daglicht. De app is standaard donker; buiten-modus
 * legt de `buitenColors`-tokens over de actieve theme-tokens heen.
 * De keuze wordt per gebruiker onthouden op het toestel (AsyncStorage),
 * zoals de Hub dat deed.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buitenColors, type ColorScheme } from '../../theme/colors';
import { useColors } from '../../theme';

interface BuitenModusContextValue {
  /** Staat de buiten-modus aan? */
  buiten: boolean;
  /** Zet de buiten-modus aan/uit (persistent per gebruiker). */
  toggleBuiten: () => void;
  /** Actieve tokens: theme-kleuren, in buiten-modus overschreven. */
  kleuren: ColorScheme;
}

const BuitenModusContext = createContext<BuitenModusContextValue | null>(null);

function storageKey(userId: string | null): string {
  return `veld-buiten-modus:${userId ?? 'onbekend'}`;
}

export function BuitenModusProvider({
  userId,
  children,
}: {
  /** Convex user-id zodat de voorkeur per gebruiker bewaard blijft. */
  userId: string | null;
  children: ReactNode;
}) {
  const themeKleuren = useColors();
  const [buiten, setBuiten] = useState(false);

  // Voorkeur laden zodra de gebruiker bekend is
  useEffect(() => {
    let actief = true;
    AsyncStorage.getItem(storageKey(userId))
      .then((waarde) => {
        if (actief) setBuiten(waarde === '1');
      })
      .catch(() => {
        // Voorkeur laden mislukt — val terug op standaard (uit)
      });
    return () => {
      actief = false;
    };
  }, [userId]);

  const toggleBuiten = useCallback(() => {
    setBuiten((huidig) => {
      const volgende = !huidig;
      AsyncStorage.setItem(storageKey(userId), volgende ? '1' : '0').catch(
        () => {
          // Opslaan mislukt — de toggle werkt deze sessie alsnog
        }
      );
      return volgende;
    });
  }, [userId]);

  const kleuren = useMemo<ColorScheme>(
    () => (buiten ? { ...themeKleuren, ...buitenColors } : themeKleuren),
    [buiten, themeKleuren]
  );

  const waarde = useMemo(
    () => ({ buiten, toggleBuiten, kleuren }),
    [buiten, toggleBuiten, kleuren]
  );

  return (
    <BuitenModusContext.Provider value={waarde}>
      {children}
    </BuitenModusContext.Provider>
  );
}

export function useBuitenModus(): BuitenModusContextValue {
  const context = useContext(BuitenModusContext);
  if (!context) {
    throw new Error(
      'useBuitenModus moet binnen een BuitenModusProvider gebruikt worden'
    );
  }
  return context;
}
