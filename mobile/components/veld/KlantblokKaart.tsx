/**
 * KlantblokKaart — één geplande klus op de veld-dag (PRD §2.6, stap 9b):
 * klant/adres/taken (bouwsteencode + normtijd), route-knop met
 * materiaaldelta-checklist (§8.5: eerst afvinken, dan pas Maps),
 * afrondingsflow op taakniveau (§8.8), meerwerk-verzoek met status en
 * foto's naar de klanttijdlijn (§2.3).
 */

import React, { useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import {
  CheckCircle2,
  Circle,
  CircleDot,
  ClipboardCheck,
  MapPin,
  Plus,
  TriangleAlert,
} from 'lucide-react-native';
import { api } from '../../convex/_generated/api';
import { BottomSheet, Button, Checkbox, Input } from '../ui';
import { Drukvlak, Kaart, Scheiding, SectieKop, StatusPil, toonKleuren, type Toon } from '../werk/Bouwstenen';
import { tekst } from '../../theme';
import { BezoekFotoActies } from './BezoekFotoActies';
import {
  type DeltaChecklistData,
  type MeerwerkRij,
  type TaakStatus,
  type VeldStop,
} from '../../types/veld';
import { useVeldKleuren } from './BuitenModus';

const STATUS_VOLGORDE: TaakStatus[] = [
  'niet_gestart',
  'begonnen_niet_af',
  'afgerond',
];

const STATUS_WEERGAVE: Record<
  TaakStatus,
  { label: string; icoon: typeof Circle; toon: Toon }
> = {
  afgerond: { label: 'Afgerond', icoon: CheckCircle2, toon: 'succes' },
  begonnen_niet_af: { label: 'Begonnen, niet af', icoon: CircleDot, toon: 'wachten' },
  niet_gestart: { label: 'Niet gestart', icoon: Circle, toon: 'neutraal' },
};

const MEERWERK_STATUS_LABELS: Record<MeerwerkRij['status'], string> = {
  aangevraagd: 'Wacht op planning',
  goedgekeurd: 'Goedgekeurd',
  afgewezen: 'Afgewezen',
  gefactureerd: 'Gefactureerd',
};

const MEERWERK_TOON: Record<MeerwerkRij['status'], Toon> = {
  aangevraagd: 'wachten',
  goedgekeurd: 'succes',
  afgewezen: 'gemist',
  gefactureerd: 'neutraal',
};

function toonFout(fout: unknown, fallback: string) {
  const bericht =
    fout instanceof Error && fout.message ? fout.message : fallback;
  Alert.alert('Let op', bericht.replace(/^.*Uncaught ConvexError:?\s*/, ''));
}

/** Klusstatus als leesbaar label ("deels_uitgevoerd" → "Deels uitgevoerd"). */
function statusLabel(status: string): string {
  const s = status.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Bouwsteencode als rustig label naast de taak. */
function Code({ code }: { code: string }) {
  const kleuren = useVeldKleuren();
  return (
    <View style={{ backgroundColor: kleuren.muted, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={[tekst.bijschrift, tekst.cijfers, { color: kleuren.mutedForeground }]}>{code}</Text>
    </View>
  );
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
  const kleuren = useVeldKleuren();
  const isAfgerond =
    stop.status === 'uitgevoerd' ||
    stop.status === 'afgerond' ||
    stop.status === 'deels_uitgevoerd';

  const [routeOpen, setRouteOpen] = useState(false);
  const [afrondOpen, setAfrondOpen] = useState(false);
  const [meerwerkOpen, setMeerwerkOpen] = useState(false);
  const waarschuwing = toonKleuren(kleuren, 'wachten');

  return (
    <Kaart>
      {/* Klant + status */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[tekst.titel3, { color: kleuren.foreground }]} numberOfLines={2}>
            {stop.klantNaam ?? stop.naam}
          </Text>
          {stop.adres && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} color={kleuren.mutedForeground} strokeWidth={2} />
              <Text style={[tekst.sub, { color: kleuren.mutedForeground, flex: 1 }]} numberOfLines={2}>
                {stop.adres}
              </Text>
            </View>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <StatusPil
            label={statusLabel(stop.status)}
            toon={stop.status === 'deels_uitgevoerd' ? 'wachten' : isAfgerond ? 'succes' : 'neutraal'}
          />
          {stop.klaarVoorFacturatie && <StatusPil label="Klaar voor facturatie" toon="info" />}
        </View>
      </View>

      {/* Vast klantkenmerk ("hond los in de tuin"). Alleen als het gevuld
          is, en kort: het dossier mag 2000 tekens bevatten, hier passen er
          drie regels — de rest leest kantoor voor. */}
      {stop.bijzonderheden ? (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: waarschuwing.achter, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 }}>
          <TriangleAlert size={18} color={waarschuwing.voor} strokeWidth={2} />
          <Text style={[tekst.voetnoot, { color: waarschuwing.voor, flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '500' }]} numberOfLines={3}>
            {stop.bijzonderheden}
          </Text>
        </View>
      ) : null}

      {/* Takenlijst: bouwstenen met code + normtijd (§8.8) */}
      {stop.taken.length > 0 && (
        <View>
          {stop.taken.map((taak, i) => (
            <View key={i}>
              {i > 0 && <Scheiding />}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, paddingVertical: 4 }}>
                {taak.code && <Code code={taak.code} />}
                <Text style={[tekst.callout, { color: kleuren.foreground, flex: 1 }]}>
                  {taak.omschrijving}
                </Text>
                {taak.normUren !== null && (
                  <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground }]}>
                    ±{taak.normUren} u
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Acties */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {magBewerken && !isAfgerond && (
          <Button
            variant="primary"
            size="sm"
            title="Afronden"
            icon={<ClipboardCheck size={16} color={kleuren.primaryForeground} strokeWidth={2} />}
            onPress={() => setAfrondOpen(true)}
          />
        )}
        <Button
          variant="secondary"
          size="sm"
          title="Route"
          icon={<MapPin size={16} color={kleuren.primary} strokeWidth={2} />}
          onPress={() => setRouteOpen(true)}
        />
        {magBewerken && (
          <Button
            variant="outline"
            size="sm"
            title="Meerwerk"
            icon={<Plus size={16} color={kleuren.foreground} strokeWidth={2} />}
            onPress={() => setMeerwerkOpen(true)}
          />
        )}
      </View>
      {magBewerken && (
        <>
          <Scheiding />
          <BezoekFotoActies werkitemId={stop.werkitemId} datum={datum} />
        </>
      )}

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
    </Kaart>
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
  const kleuren = useVeldKleuren();
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
      <View style={{ gap: 14, paddingBottom: 12 }}>
        <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>
          Dit heb je voor deze klus nodig bovenop de standaardinventaris van de
          bus. Vink af — wie afvinkt wordt gelogd.
        </Text>
        {delta === undefined ? (
          <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>
            Checklist laden…
          </Text>
        ) : (
          <>
            {delta.voertuig && (
              <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground }]}>
                Bus: {delta.voertuig.merk} ({delta.voertuig.kenteken})
              </Text>
            )}
            {delta.delta.length === 0 ? (
              <Text style={[tekst.callout, { color: kleuren.foreground }]}>
                Alles voor deze klus zit in de standaardinventaris. Goede reis!
              </Text>
            ) : (
              <View>
                {delta.delta.map((item, i) => (
                  <View key={item.naam}>
                    {i > 0 && <Scheiding />}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 4 }}>
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
                        <Text style={[tekst.bijschrift, { color: kleuren.mutedForeground }]}>
                          {item.afgevinktDoor}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        {!!delta?.suggesties?.length && <View style={{ gap: 8 }}>
          <SectieKop titel="Suggesties bij deze klus" />
          <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Voeg alleen toe wat je nodig hebt.</Text>
          {delta.suggesties.map(item => <Button key={`${item.soort}:${item.naam}`} title={`Toevoegen: ${item.naam}`} variant="outline" disabled={bezig} onPress={() => toevoegen({ naam: item.naam, soort: item.soort, bron: 'suggestie' })} />)}
        </View>}
        <View style={{ gap: 8 }}>
          <Input label="Zelf een benodigdheid toevoegen" value={naam} onChangeText={setNaam} disabled={bezig} />
          <View style={{ flexDirection: 'row', gap: 8 }}>{(['materiaal', 'machine'] as const).map(waarde => <Button key={waarde} title={waarde === 'materiaal' ? 'Materiaal' : 'Machine'} variant={soort === waarde ? 'secondary' : 'outline'} geselecteerd={soort === waarde} disabled={bezig} onPress={() => setSoort(waarde)} />)}</View>
          <Button title="Toevoegen aan checklist" variant="outline" disabled={bezig || !naam.trim()} onPress={() => toevoegen({ naam: naam.trim(), soort, bron: 'handmatig' })} />
        </View>
        {delta?.kanVerwijderen && delta.handmatigBenodigd?.map(item => <Button key={item.id} title={`Verwijderen: ${item.naam}`} variant="ghost" disabled={bezig} onPress={() => Alert.alert('Benodigdheid verwijderen?', item.naam, [{ text: 'Annuleren', style: 'cancel' }, { text: 'Verwijderen', style: 'destructive', onPress: async () => { try { await verwijder({ id: item.id, datum }); } catch (fout) { toonFout(fout, 'Verwijderen mislukt'); } } }])} />)}
        <Button
          title="Open route in Maps"
          size="lg"
          icon={
            <MapPin
              size={18}
              color={kleuren.primaryForeground}
              strokeWidth={2}
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
  const kleuren = useVeldKleuren();
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
        <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>
          Zet per taak de status. Alles afgerond → klaar voor facturatie. Niet
          af → automatisch als rest-opdracht terug in de wachtrij.
        </Text>
        {taken.map((taak, i) => {
          const weergave = STATUS_WEERGAVE[statussen[i]];
          const Icoon = weergave.icoon;
          const isKlaar = statussen[i] === 'afgerond';
          const { voor, achter } = toonKleuren(kleuren, weergave.toon);
          return (
            <Kaart key={i} padding={14} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {taak.code && <Code code={taak.code} />}
                <Text style={[tekst.callout, { color: kleuren.foreground, flex: 1 }]}>
                  {taak.omschrijving}
                </Text>
                {taak.normUren !== null && (
                  <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground }]}>
                    ±{taak.normUren} u
                  </Text>
                )}
              </View>
              <Drukvlak
                accessibilityLabel={`Status van ${taak.omschrijving}: ${weergave.label}. Tik om te wisselen.`}
                onPress={() => wisselStatus(i)}
                haptic="selection"
                buitenStijl={{ alignSelf: 'flex-start' }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 44,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: achter,
                }}
              >
                <Icoon size={18} color={voor} strokeWidth={2} />
                <Text style={[tekst.sub, { color: voor, fontWeight: '600' }]}>
                  {weergave.label}
                </Text>
              </Drukvlak>
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
                  accessibilityLabel={`Notitie taak ${i + 1}`}
                />
              )}
            </Kaart>
          );
        })}
        {nietAf > 0 && (
          <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground }]}>
            {nietAf} taak{nietAf === 1 ? '' : 'en'} gaat als rest-opdracht
            terug naar kantoor.
          </Text>
        )}
        <Button
          title="Klus afronden"
          size="lg"
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
  const kleuren = useVeldKleuren();
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

  return (
    <BottomSheet isOpen={open} onClose={onClose} title="Meerwerk aanvragen">
      <View style={{ gap: 12, paddingBottom: 12 }}>
        <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>
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
          size="lg"
          onPress={handleVersturen}
          loading={bezig}
          disabled={!omschrijving.trim()}
          fullWidth
        />

        {verzoeken !== undefined && verzoeken.length > 0 && (
          <View style={{ gap: 4, marginTop: 4 }}>
            <SectieKop titel="Eerdere verzoeken" telling={verzoeken.length} />
            <Kaart padding={6} style={{ paddingHorizontal: 14, gap: 0 }}>
              {verzoeken
                .slice()
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((rij, i) => (
                  <View key={rij._id}>
                    {i > 0 && <Scheiding />}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 48 }}>
                      <Text style={[tekst.sub, { color: kleuren.foreground, flex: 1 }]} numberOfLines={1}>
                        {rij.omschrijving}
                      </Text>
                      <StatusPil label={MEERWERK_STATUS_LABELS[rij.status]} toon={MEERWERK_TOON[rij.status]} />
                    </View>
                  </View>
                ))}
            </Kaart>
          </View>
        )}
      </View>
    </BottomSheet>
  );
}
