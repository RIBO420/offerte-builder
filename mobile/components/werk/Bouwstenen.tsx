/**
 * Bouwstenen van de veldapp in de stijl "Tuinvenster" (okt 2026).
 *
 * Eén vormtaal voor alle schermen: kaarten op radius 24 (uitgelicht 26), in licht
 * met zachte schaduw en in donker met haarlijn, statuspillen met stip, icoontegels
 * als anker en drukfeedback (0,96) op elk tikbaar vlak. Alle kleuren komen uit
 * `useVeldKleuren()`, dus licht, donker en buiten-modus kloppen vanzelf.
 */

import React, { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  View,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Text } from '../ui/Tekst';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, ChevronRight as Pijl } from 'lucide-react-native';
import { useIsDonker, useVeldKleuren } from '../veld/BuitenModus';
import { colors, hapticPatterns, tekst, type ColorScheme } from '../../theme';

type Icoon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
export type Toon = 'primair' | 'succes' | 'wachten' | 'gemist' | 'info' | 'neutraal';

export function toonKleuren(kleuren: ColorScheme, toon: Toon): { voor: string; achter: string } {
  switch (toon) {
    case 'primair':
    case 'succes':
      return { voor: kleuren.success, achter: kleuren.successSoft };
    case 'wachten':
      return { voor: kleuren.warning, achter: kleuren.warningSoft };
    case 'gemist':
      return { voor: kleuren.danger, achter: kleuren.dangerSoft };
    case 'info':
      return { voor: kleuren.info, achter: kleuren.infoSoft };
    default:
      return { voor: kleuren.mutedForeground, achter: kleuren.muted };
  }
}

// ── Drukvlak ────────────────────────────────────────────────────────────────

/**
 * Tikbaar vlak met fysieke drukfeedback: schaal 0,96 bij het indrukken (120 ms,
 * ease-out), haptic bij loslaten. Lay-out (flex, breedte) hoort op `buitenStijl`.
 */
export function Drukvlak({
  onPress,
  children,
  style,
  buitenStijl,
  disabled,
  haptic = 'tap',
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  accessibilityRole = 'button',
  hitSlop,
}: {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  buitenStijl?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: 'tap' | 'selection' | 'press' | null;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  accessibilityRole?: 'button' | 'tab' | 'link' | 'switch' | 'radio';
  /** Vergroot het raakvlak zonder de vorm te veranderen (doel: 44pt). */
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
}) {
  const [ingedrukt, setIngedrukt] = useState(false);
  const rustig = useReducedMotion();
  return (
    <Pressable
      onPress={() => {
        if (disabled || !onPress) return;
        if (haptic) void hapticPatterns[haptic]();
        onPress();
      }}
      onPressIn={() => setIngedrukt(true)}
      onPressOut={() => setIngedrukt(false)}
      disabled={disabled}
      hitSlop={hitSlop}
      pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...accessibilityState }}
      style={buitenStijl}
    >
      <Animated.View
        style={[
          style,
          {
            opacity: disabled ? 0.45 : 1,
            transform: [{ scale: ingedrukt && !rustig && !disabled ? 0.96 : 1 }],
            transitionProperty: 'transform',
            transitionDuration: 120,
            transitionTimingFunction: 'ease-out',
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ── Kaart ───────────────────────────────────────────────────────────────────

/**
 * `standaard`: kaartvlak met haarlijn. `natuur`: het groene verloop met gloed —
 * uitsluitend voor wat vandaag speelt. `stil`: geen rand, verzonken vlak.
 */
export function Kaart({
  children,
  variant = 'standaard',
  style,
  padding = 16,
}: {
  children: ReactNode;
  variant?: 'standaard' | 'natuur' | 'stil';
  style?: StyleProp<ViewStyle>;
  padding?: number;
}) {
  const kleuren = useVeldKleuren();
  const donker = useIsDonker();
  if (variant === 'natuur') {
    return (
      <View
        style={[
          { borderRadius: 26 },
          // Tuinvenster: in licht draagt een zachte schaduw de diepte, in donker
          // een haarlijn. Geen gekleurde gloed.
          !donker && {
            shadowColor: colors.schaduw,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.08,
            shadowRadius: 22,
            elevation: 4,
          },
          style,
        ]}
      >
        <LinearGradient
          colors={[kleuren.gradientStart, kleuren.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 26, borderWidth: donker ? 1 : 0, borderColor: kleuren.gradientBorder, padding, gap: 14 }}
        >
          {children}
        </LinearGradient>
      </View>
    );
  }
  return (
    <View
      style={[
        {
          // Concentrisch: binnenvlakken (knoppen, 8) + padding (16) = 24.
          borderRadius: 24,
          padding,
          gap: 12,
          backgroundColor: variant === 'stil' ? kleuren.muted : kleuren.card,
          // Schaduw voor hoogte in licht, haarlijn voor structuur in donker.
          borderWidth: variant === 'stil' || !donker ? 0 : 1,
          borderColor: kleuren.border,
        },
        variant === 'standaard' && !donker && {
          shadowColor: colors.schaduw,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.05,
          shadowRadius: 14,
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ── Sectiekop ───────────────────────────────────────────────────────────────

/** iOS-groepskop boven een blok: klein, gedempt, met optionele telling of actie. */
export function SectieKop({ titel, telling, rechts }: { titel: string; telling?: number; rechts?: ReactNode }) {
  const kleuren = useVeldKleuren();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 2, minHeight: 32 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
        <Text accessibilityRole="header" style={[tekst.titel3, { color: kleuren.foreground }]}>
          {titel}
        </Text>
        {telling !== undefined && telling > 0 && (
          <View style={{ backgroundColor: kleuren.muted, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}>
            <Text style={[tekst.bijschrift, tekst.cijfers, { color: kleuren.mutedForeground }]}>{telling}</Text>
          </View>
        )}
      </View>
      {rechts}
    </View>
  );
}

// ── Statuspil ───────────────────────────────────────────────────────────────

/** Status altijd als pil mét stip: kleur draagt nooit alleen de betekenis. */
export function StatusPil({ label, toon = 'neutraal' }: { label: string; toon?: Toon }) {
  const kleuren = useVeldKleuren();
  const { voor, achter } = toonKleuren(kleuren, toon);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, backgroundColor: achter, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: voor }} />
      <Text style={[tekst.voetnoot, { color: voor, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

// ── Icoontegel ──────────────────────────────────────────────────────────────

export function IcoonTegel({ icoon: I, toon = 'primair', grootte = 40 }: { icoon: Icoon; toon?: Toon; grootte?: number }) {
  const kleuren = useVeldKleuren();
  const { voor, achter } = toonKleuren(kleuren, toon);
  return (
    <View style={{ width: grootte, height: grootte, borderRadius: grootte * 0.3, backgroundColor: achter, alignItems: 'center', justifyContent: 'center' }}>
      <I size={Math.round(grootte * 0.5)} color={voor} strokeWidth={2} />
    </View>
  );
}

// ── Lege staat ──────────────────────────────────────────────────────────────

export function LegeStaat({ icoon, titel, uitleg, actie }: { icoon: Icoon; titel: string; uitleg?: string; actie?: ReactNode }) {
  const kleuren = useVeldKleuren();
  return (
    <Kaart variant="stil" style={{ alignItems: 'center', paddingVertical: 28, gap: 10 }}>
      <IcoonTegel icoon={icoon} toon="neutraal" grootte={48} />
      <Text accessibilityRole="header" style={[tekst.kop, { color: kleuren.foreground, textAlign: 'center' }]}>{titel}</Text>
      {uitleg && <Text style={[tekst.sub, { color: kleuren.mutedForeground, textAlign: 'center', maxWidth: 300 }]}>{uitleg}</Text>}
      {actie && <View style={{ marginTop: 4 }}>{actie}</View>}
    </Kaart>
  );
}

// ── Rij ─────────────────────────────────────────────────────────────────────

/** Label links, waarde rechts in tabelcijfers. */
export function Rij({ label, waarde, nadruk }: { label: string; waarde: string; nadruk?: boolean }) {
  const kleuren = useVeldKleuren();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, minHeight: 28 }}>
      <Text style={[tekst.sub, { color: nadruk ? kleuren.foreground : kleuren.mutedForeground, flexShrink: 1, fontWeight: nadruk ? '600' : '400' }]}>{label}</Text>
      <Text style={[tekst.sub, tekst.cijfers, { color: kleuren.foreground, fontWeight: nadruk ? '700' : '500' }]}>{waarde}</Text>
    </View>
  );
}

/** Haarlijn tussen rijen in een kaart. */
export function Scheiding() {
  const kleuren = useVeldKleuren();
  return <View style={{ height: 1, backgroundColor: kleuren.border, marginVertical: 2 }} />;
}

// ── Melding ─────────────────────────────────────────────────────────────────

/** Rustige regel voor "opgeslagen gegevens" en fouten; geen modal, geen schreeuw. */
export function Melding({ tekst: t, toon = 'neutraal', icoon }: { tekst: string; toon?: Toon; icoon?: Icoon }) {
  const kleuren = useVeldKleuren();
  const { voor, achter } = toonKleuren(kleuren, toon);
  const fout = toon === 'gemist';
  // iOS kent geen live regions: een fout expliciet voorlezen zodra hij verschijnt of wijzigt.
  useEffect(() => {
    if (fout) AccessibilityInfo.announceForAccessibility(t);
  }, [fout, t]);
  return (
    <View
      accessibilityRole={fout ? 'alert' : undefined}
      accessibilityLiveRegion={fout ? 'polite' : undefined}
      style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: achter, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 }}
    >
      {icoon ? React.createElement(icoon, { size: 18, color: voor, strokeWidth: 2 }) : <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: voor, marginTop: 7 }} />}
      <Text style={[tekst.voetnoot, { color: toon === 'neutraal' ? kleuren.foreground : voor, flex: 1, fontSize: 14, lineHeight: 19 }]}>{t}</Text>
    </View>
  );
}

// ── Segmentkeuze ────────────────────────────────────────────────────────────

/**
 * Segmentkeuze met glijdende pil (200 ms ease-out) en selectie-haptic. De pil is
 * absoluut gepositioneerd en kinderloos: alleen `transform` beweegt.
 */
export function Segment<T extends string>({
  opties,
  waarde,
  onChange,
  label,
}: {
  opties: { waarde: T; label: string }[];
  waarde: T;
  onChange: (waarde: T) => void;
  label: string;
}) {
  const kleuren = useVeldKleuren();
  const donker = useIsDonker();
  const rustig = useReducedMotion();
  const [breedte, setBreedte] = useState(0);
  const index = Math.max(0, opties.findIndex(o => o.waarde === waarde));
  const segment = breedte > 0 ? (breedte - 6) / opties.length : 0;
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      onLayout={e => setBreedte(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', backgroundColor: kleuren.muted, borderRadius: 14, padding: 3, minHeight: 48 }}
    >
      {segment > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 3,
            bottom: 3,
            left: 3,
            width: segment,
            borderRadius: 11,
            backgroundColor: donker ? kleuren.accent : kleuren.card,
            borderWidth: donker ? 1 : 0,
            borderColor: donker ? `${kleuren.primary}47` : kleuren.border,
            shadowColor: colors.schaduw,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: donker ? 0 : 0.08,
            shadowRadius: 6,
            elevation: donker ? 0 : 2,
            transform: [{ translateX: index * segment }],
            transitionProperty: 'transform',
            transitionDuration: rustig ? 0 : 200,
            transitionTimingFunction: 'ease-out',
          }}
        />
      )}
      {opties.map(optie => {
        const actief = optie.waarde === waarde;
        return (
          <Pressable
            key={optie.waarde}
            accessibilityRole="tab"
            accessibilityState={{ selected: actief }}
            onPress={() => {
              if (actief) return;
              void hapticPatterns.selection();
              onChange(optie.waarde);
            }}
            // 42 hoog in een balk van 48; hitSlop tilt het raakvlak naar 44.
            hitSlop={{ top: 1, bottom: 1 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 42 }}
          >
            <Text style={[tekst.sub, { fontWeight: actief ? '600' : '500', color: actief ? kleuren.foreground : kleuren.mutedForeground }]}>{optie.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Periodekiezer ───────────────────────────────────────────────────────────

/** Vorige/volgende met een leesbaar label in het midden; "Vandaag" als je weg bent. */
export function PeriodeKiezer({
  titel,
  ondertitel,
  onVorige,
  onVolgende,
  vorigeLabel,
  volgendeLabel,
  onVandaag,
}: {
  titel: string;
  ondertitel?: string;
  onVorige: () => void;
  onVolgende: () => void;
  vorigeLabel: string;
  volgendeLabel: string;
  /** Alleen meegeven als de gekozen periode niet de huidige is. */
  onVandaag?: () => void;
}) {
  const kleuren = useVeldKleuren();
  // Eén rustige regel: periode links, Vandaag + pijlen rechts. Geen gevulde
  // ronde knoppen meer; de periode is context, niet de hoofdzaak van het scherm.
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}>
      <Text style={[tekst.sub, tekst.cijfers, { flex: 1, color: kleuren.mutedForeground }]} numberOfLines={1}>
        <Text style={{ color: kleuren.foreground, fontWeight: '600' }}>{titel}</Text>
        {ondertitel ? ` · ${ondertitel}` : ''}
      </Text>
      {onVandaag && (
        <Drukvlak onPress={onVandaag} haptic="selection" accessibilityLabel="Naar vandaag" style={{ height: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: 'center', backgroundColor: kleuren.primarySoft }}>
          <Text style={[tekst.voetnoot, { color: kleuren.primary, fontWeight: '600' }]}>Vandaag</Text>
        </Drukvlak>
      )}
      {(['vorige', 'volgende'] as const).map(richting => {
        const I = richting === 'vorige' ? ChevronLeft : ChevronRight;
        return (
          <Drukvlak key={richting} onPress={richting === 'vorige' ? onVorige : onVolgende} haptic="selection" hitSlop={4} accessibilityLabel={richting === 'vorige' ? vorigeLabel : volgendeLabel} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
            <I size={20} color={kleuren.foreground} strokeWidth={2.25} />
          </Drukvlak>
        );
      })}
    </View>
  );
}

// ── Weekstrook ──────────────────────────────────────────────────────────────

export type DagMarkering = 'gepland' | 'gelogd' | 'gemist' | 'ingediend';

/**
 * Zeven dagen als tikbare kolommen. Gekozen dag = gevulde cirkel, vandaag =
 * ring, een stip eronder vertelt wat er die dag speelt. De stip verschilt ook
 * in vorm, niet alleen in kleur: gelogd = gevulde stip, gepland = open ring,
 * gemist = grotere gevulde stip.
 */
export function WeekStrook({
  dagen,
  gekozen,
  vandaag,
  onKies,
  markering,
  labelVan,
}: {
  dagen: string[];
  gekozen: string;
  vandaag: string;
  onKies: (datum: string) => void;
  markering?: Partial<Record<string, DagMarkering>>;
  labelVan: (datum: string) => { kort: string; nummer: number; voluit: string };
}) {
  const kleuren = useVeldKleuren();
  const stipStijl = (m?: DagMarkering): ViewStyle => {
    if (m === 'gemist') return { width: 8, height: 8, borderRadius: 4, backgroundColor: kleuren.danger };
    if (m === 'gelogd' || m === 'ingediend') return { width: 6, height: 6, borderRadius: 3, backgroundColor: kleuren.success };
    if (m === 'gepland') return { width: 6, height: 6, borderRadius: 3, borderWidth: 1.5, borderColor: kleuren.mutedForeground, backgroundColor: 'transparent' };
    return { width: 6, height: 6 };
  };
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {dagen.map(dag => {
        const { kort, nummer, voluit } = labelVan(dag);
        const isGekozen = dag === gekozen;
        const isVandaag = dag === vandaag;
        const m = markering?.[dag];
        return (
          <Drukvlak
            key={dag}
            onPress={() => onKies(dag)}
            haptic="selection"
            accessibilityRole="tab"
            accessibilityState={{ selected: isGekozen }}
            accessibilityLabel={`${voluit}${isVandaag ? ', vandaag' : ''}${m === 'gemist' ? ', uren ontbreken' : m === 'gelogd' || m === 'ingediend' ? ', uren gelogd' : m === 'gepland' ? ', klussen gepland' : ''}`}
            buitenStijl={{ flex: 1 }}
            style={{ alignItems: 'center', gap: 6, paddingVertical: 4 }}
          >
            <Text style={[tekst.bijschrift, { color: isGekozen ? kleuren.foreground : kleuren.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.4 }]}>{kort}</Text>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isGekozen ? kleuren.primary : 'transparent',
                borderWidth: isVandaag && !isGekozen ? 1.5 : 0,
                borderColor: kleuren.goud,
              }}
            >
              <Text style={[tekst.kop, tekst.cijfers, { color: isGekozen ? kleuren.primaryForeground : kleuren.foreground }]}>{nummer}</Text>
            </View>
            <View style={{ height: 8, justifyContent: 'center' }}>
              <View style={stipStijl(m)} />
            </View>
          </Drukvlak>
        );
      })}
    </View>
  );
}

// ── Lijstregel ──────────────────────────────────────────────────────────────

/** Tikbare regel met icoontegel, titel, subregel en pijl — voor menu's en lijsten. */
export function LijstRegel({
  icoon,
  toon = 'primair',
  titel,
  sub,
  rechts,
  onPress,
}: {
  icoon?: Icoon;
  toon?: Toon;
  titel: string;
  sub?: string;
  rechts?: ReactNode;
  onPress?: () => void;
}) {
  const kleuren = useVeldKleuren();
  const inhoud = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10 }}>
      {icoon && <IcoonTegel icoon={icoon} toon={toon} grootte={36} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[tekst.kop, { color: kleuren.foreground, fontWeight: '500' }]} numberOfLines={2}>{titel}</Text>
        {sub && <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14 }]} numberOfLines={2}>{sub}</Text>}
      </View>
      {rechts}
      {onPress && <Pijl size={18} color={kleuren.mutedForeground} strokeWidth={2} />}
    </View>
  );
  return onPress ? <Drukvlak onPress={onPress} accessibilityLabel={sub ? `${titel}, ${sub}` : titel}>{inhoud}</Drukvlak> : inhoud;
}
