/**
 * KlantblokKaart — één geplande klus op de veld-dag (PRD §2.6, stap 9b):
 * klant/adres/taken (bouwsteencode + normtijd), route-knop met
 * materiaaldelta-checklist (§8.5: eerst afvinken, dan pas Maps),
 * afrondingsflow op taakniveau (§8.8), meerwerk-verzoek met status en
 * foto's naar de klanttijdlijn (§2.3).
 */

import React, { useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import {
  CheckCircle2,
  Circle,
  CircleDot,
  ClipboardCheck,
  MapPin,
  Plus,
} from 'lucide-react-native';
import { api } from '../../convex/_generated/api';
import { Badge, BottomSheet, Button, Checkbox, Input } from '../ui';
import { BezoekFotoActies } from './BezoekFotoActies';
import {
  type DeltaChecklistData,
  type MeerwerkRij,
  type TaakStatus,
  type VeldStop,
} from '../../types/veld';
import { useBuitenModus } from './BuitenModus';

const STATUS_VOLGORDE: TaakStatus[] = [
  'niet_gestart',
  'begonnen_niet_af',
  'afgerond',
];

const STATUS_WEERGAVE: Record<
  TaakStatus,
  { label: string; icoon: typeof Circle }
> = {
  afgerond: { label: 'Afgerond', icoon: CheckCircle2 },
  begonnen_niet_af: { label: 'Begonnen, niet af', icoon: CircleDot },
  niet_gestart: { label: 'Niet gestart', icoon: Circle },
};

const MEERWERK_STATUS_LABELS: Record<MeerwerkRij['status'], string> = {
  aangevraagd: 'Wacht op planning',
  goedgekeurd: 'Goedgekeurd',
  afgewezen: 'Afgewezen',
  gefactureerd: 'Gefactureerd',
};

function toonFout(fout: unknown, fallback: string) {
  const bericht =
    fout instanceof Error && fout.message ? fout.message : fallback;
  Alert.alert('Let op', bericht.replace(/^.*Uncaught ConvexError:?\s*/, ''));
}

export function KlantblokKaart({
  stop,
  datum,
  magBewerken,
}: {
  stop: VeldStop;
  datum: string;
  magBewerken: boolean;
}) {
  const { kleuren } = useBuitenModus();
  const isAfgerond =
    stop.status === 'uitgevoerd' ||
    stop.status === 'afgerond' ||
    stop.status === 'deels_uitgevoerd';

  const [routeOpen, setRouteOpen] = useState(false);
  const [afrondOpen, setAfrondOpen] = useState(false);
  const [meerwerkOpen, setMeerwerkOpen] = useState(false);

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: kleuren.border,
        borderRadius: 14,
        padding: 14,
        gap: 10,
        backgroundColor: kleuren.card,
      }}
    >
      {/* Klant + status */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <View style={{ flexShrink: 1 }}>
          <Text
            style={{
              color: kleuren.cardForeground,
              fontSize: 16,
              fontWeight: '600',
            }}
          >
            {stop.klantNaam ?? stop.naam}
          </Text>
          {stop.adres && (
            <Text
              style={{ color: kleuren.mutedForeground, fontSize: 13 }}
              numberOfLines={2}
            >
              {stop.adres}
            </Text>
          )}
          {/* Vast klantkenmerk ("hond los in de tuin"). Alleen als het gevuld
              is, en kort: het dossier mag 2000 tekens bevatten, hier passen er
              drie regels — de rest leest kantoor voor. */}
          {stop.bijzonderheden ? (
            <Text
              style={{
                color: kleuren.cardForeground,
                fontSize: 13,
                fontWeight: '500',
                marginTop: 4,
              }}
              numberOfLines={3}
            >
              {stop.bijzonderheden}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Badge variant={isAfgerond ? 'secondary' : 'outline'}>
            {stop.status.replace(/_/g, ' ')}
          </Badge>
          {stop.klaarVoorFacturatie && (
            <Badge variant="success">Klaar voor facturatie</Badge>
          )}
        </View>
      </View>

      {/* Takenlijst: bouwstenen met code + normtijd (§8.8) */}
      {stop.taken.length > 0 && (
        <View style={{ gap: 4 }}>
          {stop.taken.map((taak, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {taak.code && <Badge variant="outline">{taak.code}</Badge>}
              <Text
                style={{
                  color: kleuren.cardForeground,
                  fontSize: 14,
                  flexShrink: 1,
                }}
              >
                {taak.omschrijving}
              </Text>
              {taak.normUren !== null && (
                <Text style={{ color: kleuren.mutedForeground, fontSize: 12 }}>
                  ±{taak.normUren} u
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Acties */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button
          variant="outline"
          size="sm"
          title="Route"
          icon={<MapPin size={16} color={kleuren.foreground} />}
          onPress={() => setRouteOpen(true)}
        />
        {magBewerken && !isAfgerond && (
          <Button
            variant="primary"
            size="sm"
            title="Afronden"
            icon={<ClipboardCheck size={16} color={kleuren.primaryForeground} />}
            onPress={() => setAfrondOpen(true)}
          />
        )}
        {magBewerken && (
          <Button
            variant="outline"
            size="sm"
            title="Meerwerk"
            icon={<Plus size={16} color={kleuren.foreground} />}
            onPress={() => setMeerwerkOpen(true)}
          />
        )}
        {magBewerken && <BezoekFotoActies werkitemId={stop.werkitemId} datum={datum} />}
      </View>

      <RouteDeltaSheet
        stop={stop}
        datum={datum}
        open={routeOpen}
        onClose={() => setRouteOpen(false)}
      />
      <AfrondSheet
        stop={stop}
        open={afrondOpen}
        onClose={() => setAfrondOpen(false)}
      />
      <MeerwerkSheet
        stop={stop}
        open={meerwerkOpen}
        onClose={() => setMeerwerkOpen(false)}
      />
    </View>
  );
}

/**
 * Route-knop (§8.5): eerst de materiaaldelta-checklist (benodigd uit de
 * bouwsteen-koppelingen mínus businventaris), afvinken wordt gelogd, en pas
 * daarna door naar de kaart-app (native maps-URL via Linking).
 */
function RouteDeltaSheet({
  stop,
  datum,
  open,
  onClose,
}: {
  stop: VeldStop;
  datum: string;
  open: boolean;
  onClose: () => void;
}) {
  const { kleuren } = useBuitenModus();
  const delta = useQuery(
    api.materiaalDelta.getDeltaChecklist,
    open ? { werkitemId: stop.werkitemId, datum } : 'skip'
  ) as DeltaChecklistData | undefined;
  const vinkAf = useMutation(api.materiaalDelta.vinkAf);
  const voegToe = useMutation(api.materiaalDelta.voegBenodigdheidToe);
  const verwijder = useMutation(api.materiaalDelta.verwijderBenodigdheid);
  const [naam, setNaam] = useState('');
  const [soort, setSoort] = useState<'machine' | 'materiaal'>('materiaal');
  const [bezig, setBezig] = useState(false);
  const toevoegen = async (item: { naam: string; soort: 'machine' | 'materiaal'; bron: 'handmatig' | 'suggestie' }) => {
    if (bezig) return;
    setBezig(true);
    try { await voegToe({ werkitemId: stop.werkitemId, datum, ...item }); if (item.bron === 'handmatig') setNaam(''); }
    catch (fout) { toonFout(fout, 'Toevoegen is mislukt'); }
    finally { setBezig(false); }
  };

  const handleVink = async (item: string, ongedaan: boolean) => {
    try {
      await vinkAf({ werkitemId: stop.werkitemId, datum, item, ongedaan });
    } catch (fout) {
      toonFout(fout, 'Afvinken is mislukt');
    }
  };

  const klaarVoorVertrek =
    delta !== undefined && (delta.delta.length === 0 || delta.allesAfgevinkt);

  const openMaps = () => {
    if (!klaarVoorVertrek) {
      Alert.alert('Nog even', 'Vink eerst de checklist af.');
      return;
    }
    if (!delta?.mapsUrl) {
      Alert.alert('Geen adres', 'Er is geen adres bekend voor deze klus.');
      return;
    }
    Linking.openURL(delta.mapsUrl).catch(() =>
      Alert.alert('Let op', 'Kaart-app openen is mislukt')
    );
  };

  return (
    <BottomSheet isOpen={open} onClose={onClose} title="Check je bus eerst">
      <View style={{ gap: 12, paddingBottom: 12 }}>
        <Text style={{ color: kleuren.mutedForeground, fontSize: 13 }}>
          Dit heb je voor deze klus nodig bovenop de standaardinventaris van de
          bus. Vink af — wie afvinkt wordt gelogd.
        </Text>
        {delta === undefined ? (
          <Text style={{ color: kleuren.mutedForeground, fontSize: 13 }}>
            Checklist laden…
          </Text>
        ) : (
          <>
            {delta.voertuig && (
              <Text style={{ color: kleuren.mutedForeground, fontSize: 12 }}>
                Bus: {delta.voertuig.merk} ({delta.voertuig.kenteken})
              </Text>
            )}
            {delta.delta.length === 0 ? (
              <Text style={{ color: kleuren.foreground, fontSize: 14 }}>
                Alles voor deze klus zit in de standaardinventaris. Goede reis!
              </Text>
            ) : (
              <View style={{ gap: 10 }}>
                {delta.delta.map((item) => (
                  <View
                    key={item.naam}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Checkbox
                        checked={item.afgevinkt}
                        onCheckedChange={(aangevinkt) =>
                          handleVink(item.naam, !aangevinkt)
                        }
                        label={`${item.naam} (${item.soort})`}
                      />
                    </View>
                    {item.afgevinkt && item.afgevinktDoor && (
                      <Text
                        style={{
                          color: kleuren.mutedForeground,
                          fontSize: 11,
                        }}
                      >
                        {item.afgevinktDoor}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        {!!delta?.suggesties?.length && <View style={{ gap: 8 }}>
          <Text style={{ color: kleuren.foreground, fontWeight: '600' }}>Suggesties bij deze klus</Text>
          <Text style={{ color: kleuren.mutedForeground }}>Voeg alleen toe wat je nodig hebt.</Text>
          {delta.suggesties.map(item => <Button key={`${item.soort}:${item.naam}`} title={`Toevoegen: ${item.naam}`} variant="outline" disabled={bezig} onPress={() => toevoegen({ naam: item.naam, soort: item.soort, bron: 'suggestie' })} />)}
        </View>}
        <View style={{ gap: 8 }}>
          <Input label="Zelf een benodigdheid toevoegen" value={naam} onChangeText={setNaam} disabled={bezig} />
          <View style={{ flexDirection: 'row', gap: 8 }}>{(['materiaal', 'machine'] as const).map(waarde => <Button key={waarde} title={waarde === 'materiaal' ? 'Materiaal' : 'Machine'} variant={soort === waarde ? 'secondary' : 'outline'} disabled={bezig} onPress={() => setSoort(waarde)} />)}</View>
          <Button title="Toevoegen aan checklist" variant="outline" disabled={bezig || !naam.trim()} onPress={() => toevoegen({ naam: naam.trim(), soort, bron: 'handmatig' })} />
        </View>
        {delta?.kanVerwijderen && delta.handmatigBenodigd?.map(item => <Button key={item.id} title={`Verwijderen: ${item.naam}`} variant="ghost" disabled={bezig} onPress={() => Alert.alert('Benodigdheid verwijderen?', item.naam, [{ text: 'Annuleren', style: 'cancel' }, { text: 'Verwijderen', style: 'destructive', onPress: async () => { try { await verwijder({ id: item.id, datum }); } catch (fout) { toonFout(fout, 'Verwijderen mislukt'); } } }])} />)}
        <Button
          title="Open route in Maps"
          icon={
            <MapPin
              size={16}
              color={
                klaarVoorVertrek ? kleuren.primaryForeground : kleuren.inactive
              }
            />
          }
          onPress={openMaps}
          disabled={!klaarVoorVertrek}
          fullWidth
        />
      </View>
    </BottomSheet>
  );
}

/** Afrondingsflow bij het uitklokken: per taak ✓ / ◐ / ○ + notitie (§8.8). */
function AfrondSheet({
  stop,
  open,
  onClose,
}: {
  stop: VeldStop;
  open: boolean;
  onClose: () => void;
}) {
  const { kleuren } = useBuitenModus();
  const rondAf = useMutation(api.afronding.rondWerkitemAf);

  const taken =
    stop.taken.length > 0
      ? stop.taken
      : [
          {
            omschrijving: stop.naam,
            code: null,
            normUren: null,
            bouwsteenId: null,
          },
        ];

  const [statussen, setStatussen] = useState<TaakStatus[]>(() =>
    taken.map(() => 'afgerond' as TaakStatus)
  );
  const [notities, setNotities] = useState<string[]>(() => taken.map(() => ''));
  const [bezig, setBezig] = useState(false);

  const wisselStatus = (index: number) => {
    setStatussen((huidige) => {
      const volgende = [...huidige];
      const positie = STATUS_VOLGORDE.indexOf(volgende[index]);
      volgende[index] = STATUS_VOLGORDE[(positie + 1) % STATUS_VOLGORDE.length];
      return volgende;
    });
  };

  const nietAf = statussen.filter((s) => s !== 'afgerond').length;

  const handleAfronden = async () => {
    setBezig(true);
    try {
      const resultaat = (await rondAf({
        werkitemId: stop.werkitemId,
        taken: taken.map((_, i) => ({
          index: i,
          status: statussen[i],
          notitie: notities[i].trim() || undefined,
        })),
      })) as { status: string };
      onClose();
      Alert.alert(
        'Klus afgerond',
        resultaat.status === 'deels_uitgevoerd'
          ? 'Deels uitgevoerd — de openstaande taken staan als rest-opdracht in de wachtrij.'
          : 'Afgerond — klaar voor facturatie.'
      );
    } catch (fout) {
      toonFout(fout, 'Afronden is mislukt');
    } finally {
      setBezig(false);
    }
  };

  return (
    <BottomSheet
      isOpen={open}
      onClose={onClose}
      title={`Afronden — ${stop.klantNaam ?? stop.naam}`}
    >
      <View style={{ gap: 12, paddingBottom: 12 }}>
        <Text style={{ color: kleuren.mutedForeground, fontSize: 13 }}>
          Zet per taak de status. Alles afgerond → klaar voor facturatie. Niet
          af → automatisch als rest-opdracht terug in de wachtrij.
        </Text>
        {taken.map((taak, i) => {
          const weergave = STATUS_WEERGAVE[statussen[i]];
          const Icoon = weergave.icoon;
          const isKlaar = statussen[i] === 'afgerond';
          return (
            <View
              key={i}
              style={{
                borderWidth: 1,
                borderColor: kleuren.border,
                borderRadius: 10,
                padding: 10,
                gap: 8,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {taak.code && <Badge variant="outline">{taak.code}</Badge>}
                <Text
                  style={{
                    color: kleuren.foreground,
                    fontSize: 14,
                    flexShrink: 1,
                  }}
                >
                  {taak.omschrijving}
                </Text>
                {taak.normUren !== null && (
                  <Text
                    style={{ color: kleuren.mutedForeground, fontSize: 12 }}
                  >
                    ±{taak.normUren} u
                  </Text>
                )}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Status van ${taak.omschrijving}: ${weergave.label}. Tik om te wisselen.`}
                onPress={() => wisselStatus(i)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  alignSelf: 'flex-start',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: isKlaar ? kleuren.primary : kleuren.border,
                  backgroundColor: isKlaar ? kleuren.primary : 'transparent',
                }}
              >
                <Icoon
                  size={16}
                  color={
                    isKlaar ? kleuren.primaryForeground : kleuren.foreground
                  }
                />
                <Text
                  style={{
                    fontSize: 13,
                    color: isKlaar
                      ? kleuren.primaryForeground
                      : kleuren.foreground,
                  }}
                >
                  {weergave.label}
                </Text>
              </Pressable>
              {!isKlaar && (
                <Input
                  value={notities[i]}
                  onChangeText={(tekst) =>
                    setNotities((huidige) => {
                      const volgende = [...huidige];
                      volgende[i] = tekst;
                      return volgende;
                    })
                  }
                  placeholder="Korte notitie (optioneel)"
                />
              )}
            </View>
          );
        })}
        {nietAf > 0 && (
          <Text style={{ color: kleuren.mutedForeground, fontSize: 12 }}>
            {nietAf} taak{nietAf === 1 ? '' : 'en'} gaat als rest-opdracht
            terug naar kantoor.
          </Text>
        )}
        <Button
          title="Klus afronden"
          onPress={handleAfronden}
          loading={bezig}
          fullWidth
        />
      </View>
    </BottomSheet>
  );
}

/**
 * Meerwerk-verzoek vanuit de dagkaart (§2.6): omschrijving + geschatte tijd
 * naar planning; eerdere verzoeken met status blijven zichtbaar.
 */
function MeerwerkSheet({
  stop,
  open,
  onClose,
}: {
  stop: VeldStop;
  open: boolean;
  onClose: () => void;
}) {
  const { kleuren } = useBuitenModus();
  const maakVerzoek = useMutation(api.meerwerk.maakVeldVerzoek);
  const verzoeken = useQuery(
    api.meerwerk.listVoorWerkitem,
    open ? { werkitemId: stop.werkitemId } : 'skip'
  ) as MeerwerkRij[] | undefined;

  const [omschrijving, setOmschrijving] = useState('');
  const [minuten, setMinuten] = useState('30');
  const [bezig, setBezig] = useState(false);

  const handleVersturen = async () => {
    const geschatteMinuten = Number(minuten);
    if (!omschrijving.trim()) return;
    if (!Number.isFinite(geschatteMinuten) || geschatteMinuten < 1) {
      Alert.alert('Let op', 'Vul een geschatte tijd in minuten in.');
      return;
    }
    setBezig(true);
    try {
      await maakVerzoek({
        werkitemId: stop.werkitemId,
        omschrijving: omschrijving.trim(),
        geschatteMinuten,
      });
      setOmschrijving('');
      Alert.alert(
        'Verstuurd',
        'Meerwerk-verzoek verstuurd — planning keurt goed vóór je begint.'
      );
    } catch (fout) {
      toonFout(fout, 'Versturen is mislukt');
    } finally {
      setBezig(false);
    }
  };

  const statusVariant = (
    status: MeerwerkRij['status']
  ): 'warning' | 'success' | 'destructive' | 'secondary' => {
    if (status === 'aangevraagd') return 'warning';
    if (status === 'goedgekeurd') return 'success';
    if (status === 'afgewezen') return 'destructive';
    return 'secondary';
  };

  return (
    <BottomSheet isOpen={open} onClose={onClose} title="Meerwerk aanvragen">
      <View style={{ gap: 12, paddingBottom: 12 }}>
        <Text style={{ color: kleuren.mutedForeground, fontSize: 13 }}>
          Meerwerk kan alleen ná akkoord van planning. Beschrijf de taak en
          schat de tijd; kantoor plust de tijd bij of plant het apart in.
        </Text>
        <Input
          label="Taakomschrijving"
          value={omschrijving}
          onChangeText={setOmschrijving}
          placeholder="bijv. extra haag aan de achterzijde snoeien"
        />
        <Input
          label="Geschatte tijd (minuten)"
          value={minuten}
          onChangeText={setMinuten}
          keyboardType="number-pad"
          maxLength={4}
        />
        <Button
          title="Verstuur naar planning"
          onPress={handleVersturen}
          loading={bezig}
          disabled={!omschrijving.trim()}
          fullWidth
        />

        {verzoeken !== undefined && verzoeken.length > 0 && (
          <View style={{ gap: 8, marginTop: 4 }}>
            <Text style={{ color: kleuren.mutedForeground, fontSize: 12 }}>
              Eerdere verzoeken
            </Text>
            {verzoeken
              .slice()
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((rij) => (
                <View
                  key={rij._id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      color: kleuren.foreground,
                      fontSize: 13,
                      flexShrink: 1,
                    }}
                    numberOfLines={1}
                  >
                    {rij.omschrijving}
                  </Text>
                  <Badge variant={statusVariant(rij.status)}>
                    {MEERWERK_STATUS_LABELS[rij.status]}
                  </Badge>
                </View>
              ))}
          </View>
        )}
      </View>
    </BottomSheet>
  );
}
