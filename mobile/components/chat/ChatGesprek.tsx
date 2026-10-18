import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useEenmaligePush } from '../../hooks/use-eenmalige-push';
import { useHeaderHeight } from '@react-navigation/elements';
import { useMutation, useQuery } from 'convex/react';
import { ArrowUp, Lock } from 'lucide-react-native';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useCurrentUser } from '../../hooks/use-current-user';
import { normalizeRole, ROLE_LABELS } from '../../lib/roles';
import { Drukvlak } from '../werk/Bouwstenen';
import { useVeldKleuren } from '../veld/BuitenModus';
import { tekst } from '../../theme';
import { PersoonAvatar } from './ChatAvatar';
import { chatItems, klokTijd, voornaam, type ChatBericht, type ChatItem } from './chat-tijd';
import { GesprekAvatar, type GesprekSoort } from './gesprekken';

const BUBBEL_RADIUS = 20;
const BUBBEL_HOEK = 6;
const MINI_AVATAR = 28;

/** Kopopties voor elk gespreksscherm: native balk met terug, titel met avatar. */
export function GesprekKop({ soort, titel }: { soort: GesprekSoort; titel: string }) {
  const kleuren = useVeldKleuren();
  return (
    <Stack.Screen
      options={{
        headerShown: true,
        title: titel,
        headerTitle: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 240 }}>
            <GesprekAvatar soort={soort} naam={titel} grootte={28} />
            <Text accessibilityRole="header" style={[tekst.kop, { color: kleuren.foreground, flexShrink: 1 }]} numberOfLines={1}>
              {titel}
            </Text>
          </View>
        ),
        headerBackTitle: 'Chat',
        headerTintColor: kleuren.primary,
        headerStyle: { backgroundColor: kleuren.background },
        headerShadowVisible: true,
        contentStyle: { backgroundColor: kleuren.background },
      }}
    />
  );
}

/** Staat het toetsenbord open? iOS meldt het vóór de animatie, Android erna. */
function useToetsenbordOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const toon = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setOpen(true));
    const verberg = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setOpen(false));
    return () => {
      toon.remove();
      verberg.remove();
    };
  }, []);
  return open;
}

/**
 * Eén gesprek: berichtenlijst (nieuwste onderaan), dagscheidingen, gegroepeerde
 * bubbels en de invoerbalk boven toetsenbord en thuisbalk. Het projectkanaal is
 * alleen-lezen historie (de webapp behandelt het zo, en de server eist daar een
 * projecttoewijzing) — daar staat een rustige voetregel in plaats van invoer.
 */
export function ChatGesprek({ soort, id, titel }: { soort: GesprekSoort; id?: string; titel: string }) {
  const kleuren = useVeldKleuren();
  const insets = useSafeAreaInsets();
  const headerHoogte = useHeaderHeight();
  const toetsenbordOpen = useToetsenbordOpen();
  const pushEenmalig = useEenmaligePush();
  const { user } = useCurrentUser();
  const lijstRef = useRef<FlatList<ChatItem>>(null);
  const [concept, setConcept] = useState('');
  const [bezig, setBezig] = useState(false);

  const kanaal = soort === 'team' ? 'team' : soort === 'mededelingen' ? 'broadcast' : soort === 'project' ? 'project' : null;
  const projectId = soort === 'project' && id ? (id as Id<'projecten'>) : undefined;
  const partnerId = soort === 'dm' && id ? (id as Id<'users'>) : undefined;
  const kanSturen = soort === 'team' || soort === 'mededelingen' || (soort === 'dm' && !!partnerId);
  const groep = soort !== 'dm';

  const kanaalBerichten = useQuery(
    api.chat.getTeamMessages,
    kanaal && (kanaal !== 'project' || projectId) ? { channelType: kanaal, projectId, limit: 50 } : 'skip'
  );
  const dmBerichten = useQuery(api.chat.getDirectMessages, partnerId ? { withUserId: partnerId, limit: 50 } : 'skip');

  const sendTeamMessage = useMutation(api.chat.sendTeamMessage);
  const sendDirectMessage = useMutation(api.chat.sendDirectMessage);
  const markTeamAsRead = useMutation(api.chat.markTeamMessagesAsRead);
  const markDMAsRead = useMutation(api.chat.markDMAsRead);

  // Gelezen markeren zodra er berichten in beeld zijn (en bij elk nieuw bericht).
  useEffect(() => {
    if (kanaal && kanaalBerichten && kanaalBerichten.length > 0) {
      markTeamAsRead({ channelType: kanaal, projectId }).catch(console.error);
    }
  }, [kanaal, projectId, kanaalBerichten, markTeamAsRead]);

  useEffect(() => {
    if (partnerId && dmBerichten && dmBerichten.length > 0) {
      markDMAsRead({ fromUserId: partnerId }).catch(console.error);
    }
  }, [partnerId, dmBerichten, markDMAsRead]);

  const mijnId = user?._id;
  const bron = soort === 'dm' ? dmBerichten : kanaalBerichten;
  const items = useMemo(() => {
    let berichten: ChatBericht[] = [];
    if (soort === 'dm') {
      berichten = (dmBerichten ?? []).map((m) => {
        const eigen = m.fromUserId === mijnId;
        return { _id: m._id, afzender: eigen ? 'ik' : 'ander', naam: eigen ? 'Jij' : titel, tekst: m.message, tijd: m.createdAt, eigen };
      });
    } else {
      berichten = (kanaalBerichten ?? []).map((m) => ({
        _id: m._id,
        afzender: m.senderId,
        naam: m.senderName,
        rol: m.senderRole,
        tekst: m.message,
        tijd: m.createdAt,
        eigen: m.senderId === mijnId,
      }));
    }
    return chatItems(berichten);
  }, [soort, dmBerichten, kanaalBerichten, mijnId, titel]);

  const verstuur = useCallback(async () => {
    const inhoud = concept.trim();
    if (!inhoud || bezig) return;
    setBezig(true);
    try {
      if (soort === 'dm' && partnerId) {
        await sendDirectMessage({ toUserId: partnerId, message: inhoud, messageType: 'text' });
      } else if (soort === 'team' || soort === 'mededelingen') {
        await sendTeamMessage({ channelType: soort === 'team' ? 'team' : 'broadcast', message: inhoud, messageType: 'text' });
      } else {
        return;
      }
      setConcept('');
      lijstRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch (error) {
      const melding =
        error && typeof error === 'object' && 'data' in error
          ? String((error as { data: unknown }).data)
          : 'Controleer je verbinding en probeer het opnieuw.';
      Alert.alert('Versturen mislukt', melding);
    } finally {
      setBezig(false);
    }
  }, [concept, bezig, soort, partnerId, sendDirectMessage, sendTeamMessage]);

  const renderItem = useCallback(
    ({ item }: { item: ChatItem }) =>
      item.soort === 'dag' ? <DagScheiding label={item.label} /> : <Bubbel item={item} groep={groep} />,
    [groep]
  );

  const plaatshouder =
    soort === 'mededelingen' ? 'Schrijf een mededeling' : soort === 'dm' ? `Bericht aan ${voornaam(titel)}` : 'Bericht aan het team';
  const onderRuimte = toetsenbordOpen ? 8 : Math.max(insets.bottom, 8);

  return (
    <View style={{ flex: 1, backgroundColor: kleuren.background }}>
      <GesprekKop soort={soort} titel={titel} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHoogte : 0}
      >
        {bron === undefined ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={kleuren.primary} accessibilityLabel="Berichten laden" />
          </View>
        ) : items.length === 0 ? (
          // Geen zwevende kaart: een rustige regel vlak boven de invoer, waar je toch al kijkt.
          <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 32, paddingBottom: 20 }}>
            <Text style={[tekst.sub, { color: kleuren.mutedForeground, textAlign: 'center' }]}>
              {kanSturen ? 'Nog geen berichten. Stuur het eerste bericht.' : 'Nog geen berichten in dit project.'}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={lijstRef}
            data={items}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            inverted
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12 }}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}

        {kanSturen ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 8,
              paddingHorizontal: 12,
              paddingTop: 8,
              paddingBottom: onderRuimte,
              backgroundColor: kleuren.background,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: kleuren.border,
            }}
          >
            <TextInput
              value={concept}
              onChangeText={setConcept}
              placeholder={plaatshouder}
              placeholderTextColor={kleuren.mutedForeground}
              accessibilityLabel="Bericht"
              multiline
              maxLength={1000}
              selectionColor={kleuren.primary}
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 140,
                paddingHorizontal: 16,
                paddingTop: 11,
                paddingBottom: 11,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: kleuren.border,
                backgroundColor: kleuren.card,
                color: kleuren.foreground,
                fontSize: tekst.body.fontSize,
                letterSpacing: tekst.body.letterSpacing,
              }}
            />
            <Drukvlak
              onPress={verstuur}
              disabled={!concept.trim() || bezig}
              accessibilityLabel="Versturen"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: kleuren.primary, alignItems: 'center', justifyContent: 'center' }}
            >
              {bezig ? (
                <ActivityIndicator size="small" color={kleuren.primaryForeground} />
              ) : (
                <ArrowUp size={22} color={kleuren.primaryForeground} strokeWidth={2.5} />
              )}
            </Drukvlak>
          </View>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingLeft: 16,
              paddingRight: 8,
              paddingTop: 6,
              paddingBottom: Math.max(insets.bottom, 8),
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: kleuren.border,
            }}
          >
            <Lock size={16} color={kleuren.mutedForeground} strokeWidth={2} />
            <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, flex: 1, fontSize: 14, lineHeight: 19 }]}>
              Alleen lezen: eerdere berichten van dit project.
            </Text>
            {projectId && (
              <Drukvlak
                onPress={() => pushEenmalig(`/project/${projectId}`)}
                accessibilityLabel="Project openen"
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 }}
              >
                <Text style={[tekst.sub, { color: kleuren.primary, fontWeight: '600' }]}>Project</Text>
              </Drukvlak>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function DagScheiding({ label }: { label: string }) {
  const kleuren = useVeldKleuren();
  return (
    <View accessibilityRole="header" style={{ alignItems: 'center', paddingTop: 18, paddingBottom: 6 }}>
      <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

/**
 * Bubbel in een reeks. Eigen berichten rechts op primair, anderen links op het
 * vulvlak. Binnen een reeks staan bubbels dicht op elkaar (2) met een kleinere
 * hoek aan de afzenderkant; tussen reeksen ademt het (10). In groepsgesprekken
 * staat de naam boven de eerste bubbel en de avatar naast de laatste.
 */
const Bubbel = memo(function Bubbel({ item, groep }: { item: Extract<ChatItem, { soort: 'bericht' }>; groep: boolean }) {
  const kleuren = useVeldKleuren();
  const { eigen, eersteVanReeks, laatsteVanReeks } = item;
  const toonAvatar = groep && !eigen;
  const hoekBoven = eersteVanReeks ? BUBBEL_RADIUS : BUBBEL_HOEK;
  const rolSleutel = normalizeRole(item.rol);
  // Alleen een afwijkende rol noemen (voorman, directie); "Medewerker" bij elk bericht is ruis.
  const rol = rolSleutel === 'onbekend' || rolSleutel === 'medewerker' ? undefined : ROLE_LABELS[rolSleutel];

  return (
    <View
      accessible
      accessibilityLabel={`${eigen ? 'Jij' : item.naam}, ${klokTijd(item.tijd)}: ${item.tekst}`}
      style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: eigen ? 'flex-end' : 'flex-start', gap: 8, marginTop: eersteVanReeks ? 10 : 2 }}
    >
      {toonAvatar &&
        (laatsteVanReeks ? (
          <View style={{ marginBottom: 20 }}>
            <PersoonAvatar naam={item.naam} grootte={MINI_AVATAR} />
          </View>
        ) : (
          <View style={{ width: MINI_AVATAR }} />
        ))}
      <View style={{ maxWidth: '78%', alignItems: eigen ? 'flex-end' : 'flex-start' }}>
        {groep && !eigen && eersteVanReeks && (
          <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, marginBottom: 3, marginHorizontal: 12 }]} numberOfLines={1}>
            <Text style={{ fontWeight: '600', color: kleuren.foreground }}>{item.naam}</Text>
            {rol ? ` · ${rol}` : ''}
          </Text>
        )}
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: BUBBEL_RADIUS,
            backgroundColor: eigen ? kleuren.primary : kleuren.vulling,
            ...(eigen
              ? { borderTopRightRadius: hoekBoven, borderBottomRightRadius: BUBBEL_HOEK }
              : { borderTopLeftRadius: hoekBoven, borderBottomLeftRadius: BUBBEL_HOEK }),
          }}
        >
          <Text selectable style={[tekst.body, { color: eigen ? kleuren.primaryForeground : kleuren.foreground }]}>
            {item.tekst}
          </Text>
        </View>
        {laatsteVanReeks && (
          <Text style={[tekst.bijschrift, tekst.cijfers, { color: kleuren.mutedForeground, fontWeight: '400', marginTop: 4, marginHorizontal: 6, lineHeight: 16 }]}>
            {klokTijd(item.tijd)}
          </Text>
        )}
      </View>
    </View>
  );
});
