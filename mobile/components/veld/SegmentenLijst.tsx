import { WerksoortKeuze, type Werksoort } from './WerksoortKeuze';
/**
 * SegmentenLijst — urensegmenten van de veld-dag (PRD §2.6/§8.10, mobiel).
 * Voorstellen komen uit de dagkaart; de medewerker bevestigt of corrigeert —
 * loggen wordt bevestigen. Corrigeren = tijd aanpassen, segment toevoegen
 * (incl. categorie BES/afvalverwerker met werkitem-koppeling) of verwijderen.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { leesUrenConcept, schrijfUrenConcept, urenConceptSleutel, type UrenConcept } from '../../lib/uren-concept';
import { Alert, Text, View } from 'react-native';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import * as Crypto from 'expo-crypto';
import { DagvoorstelEditor } from './DagvoorstelEditor';
import { KlusKiezer } from './KlusKiezer';
import { useVeldServerActie } from '../../hooks/use-veld-server-actie';
import { Check, CheckCheck, Clock, CloudUpload, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { BottomSheet, Button, Input } from '../ui';
import { Drukvlak, IcoonTegel, Kaart, Melding, Scheiding, SectieKop, StatusPil } from '../werk/Bouwstenen';
import { tekst } from '../../theme';
import {
  CATEGORIE_LABELS,
  isGeldigTijdvak,
  type SegmentCategorie,
  type VeldDagData,
  type VeldSegment,
  type VoorstelSegment,
} from '../../types/veld';
import { useVeldKleuren } from './BuitenModus';

function toonFout(fout: unknown, fallback: string) {
  const bericht =
    fout instanceof Error && fout.message ? fout.message : fallback;
  // ConvexError-berichten zitten in .data of tussen aanhalingstekens
  Alert.alert('Let op', bericht.replace(/^.*Uncaught ConvexError:?\s*/, ''));
}

export function SegmentenLijst({
  dag,
  datum,
  magBewerken,
}: {
  dag: VeldDagData;
  datum: string;
  magBewerken: boolean;
}) {
  const kleuren = useVeldKleuren();
  const { voerUit } = useVeldServerActie();
  const { wachtrij, verstuur } = useVeldOpdracht();
  const actieBezig = useRef(false);
  const dagWacht = wachtrij.some(r =>
    ((r.type === 'dagvoorstel' || r.type === 'segmentToevoegen') && r.payload.datum === datum) ||
    (r.type === 'segmentWijzigen' && dag.segmenten.some(s => s._id === r.payload.id)));


  const [formOpen, setFormOpen] = useState(false);
  const [bewerkSegment, setBewerkSegment] = useState<VeldSegment | null>(null);

  const stopNaam = (werkitemId: string | null | undefined): string | null => {
    if (!werkitemId) return null;
    const stop = dag.stops.find((s) => String(s.werkitemId) === String(werkitemId));
    return stop ? stop.klantNaam ?? stop.naam : null;
  };

  const bevestigVoorstellen = async (voorstellen: VoorstelSegment[]) => {
    if (actieBezig.current || dagWacht) return;
    actieBezig.current = true;
    try {
      const resultaat = await verstuur('dagvoorstel', { datum, verwachteRevisie: dag.revisie, segmenten: voorstellen.map(v => ({ categorie: v.categorie, beginTijd: v.beginTijd, eindTijd: v.eindTijd, ...(v.werkitemId ? { werkitemId: v.werkitemId } : {}) })) });
      if (resultaat.status === 'conflict') toonFout(resultaat.fout, 'Bevestigen is mislukt. Controleer de wachtrij.');
    } catch (fout) { toonFout(fout, 'Bevestigen is mislukt'); }
    finally { actieBezig.current = false; }
  };
  const handleBevestigVoorstel = (voorstel: VoorstelSegment) => bevestigVoorstellen([voorstel]);
  const handleBevestigAlle = () => bevestigVoorstellen(dag.voorstellen);

  const handleVerwijder = (segment: VeldSegment) => {
    Alert.alert(
      'Segment verwijderen',
      `${segment.beginTijd}–${segment.eindTijd} ${CATEGORIE_LABELS[segment.categorie]} verwijderen?`,
      [
        { text: 'Annuleer', style: 'cancel' },
        {
          text: 'Verwijder',
          style: 'destructive',
          onPress: async () => {
            try {
              await voerUit('urenSegmenten:verwijderSegment', { id: segment._id });
            } catch (fout) {
              toonFout(fout, 'Verwijderen is mislukt');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ gap: 10 }}>
      <SectieKop
        titel="Uren"
        telling={dag.segmenten.length}
        rechts={magBewerken ? (
          <Button
            variant="outline"
            size="sm"
            title="Segment"
            disabled={dagWacht}
            icon={<Plus size={16} color={kleuren.foreground} strokeWidth={2} />}
            onPress={() => {
              setBewerkSegment(null);
              setFormOpen(true);
            }}
          />
        ) : undefined}
      />

      {dagWacht && <Melding toon="wachten" icoon={CloudUpload} tekst="Uren van deze dag wachten op synchronisatie. Controleer de wachtrij voordat je verder wijzigt." />}
      {/* Voorgestelde segmenten uit de dagkaart (§8.10) */}
      {magBewerken && !dagWacht && dag.voorstellen.length > 0 && (
        <Kaart style={{ borderStyle: 'dashed', backgroundColor: kleuren.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[tekst.kop, { color: kleuren.foreground }]}>Voorstel uit je dagkaart</Text>
              <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14, lineHeight: 19 }]}>
                Bevestig of corrigeer
              </Text>
            </View>
            <Button
              variant="secondary"
              size="sm"
              title={`Alles (${dag.voorstellen.length})`}
              icon={<CheckCheck size={16} color={kleuren.primary} strokeWidth={2} />}
              onPress={handleBevestigAlle}
            />
          </View>
          <DagvoorstelEditor dag={dag} datum={datum} />
          <View>
            {dag.voorstellen.map((voorstel, i) => (
              <View key={`${voorstel.beginTijd}-${voorstel.categorie}-${i}`}>
                {i > 0 && <Scheiding />}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 52, paddingVertical: 4 }}>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={[tekst.kop, { color: kleuren.foreground }]}>
                      <Text style={tekst.cijfers}>{voorstel.beginTijd}–{voorstel.eindTijd}</Text>
                      <Text style={{ color: kleuren.mutedForeground, fontWeight: '400' }}>{'  '}{CATEGORIE_LABELS[voorstel.categorie]}</Text>
                    </Text>
                    {stopNaam(voorstel.werkitemId) && (
                      <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14 }]} numberOfLines={1}>
                        {stopNaam(voorstel.werkitemId)}
                      </Text>
                    )}
                  </View>
                  <Button
                    variant="secondary"
                    size="sm"
                    title="Bevestig"
                    icon={<Check size={16} color={kleuren.primary} strokeWidth={2} />}
                    onPress={() => handleBevestigVoorstel(voorstel)}
                  />
                </View>
              </View>
            ))}
          </View>
        </Kaart>
      )}

      {/* Bevestigde/ingediende segmenten */}
      {dag.segmenten.length === 0 ? (
        <Kaart variant="stil" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IcoonTegel icoon={Clock} toon="neutraal" grootte={36} />
          <Text style={[tekst.sub, { color: kleuren.mutedForeground, flex: 1 }]}>
            Nog geen segmenten voor deze dag.
          </Text>
        </Kaart>
      ) : (
        <Kaart padding={4} style={{ paddingHorizontal: 14, gap: 0 }}>
          {dag.segmenten.map((segment, i) => {
            const wachtend = wachtrij.find(r => r.type === 'segmentWijzigen' && r.payload.id === segment._id);
            const bewerkbaar = magBewerken && !dagWacht && segment.status !== 'ingediend';
            return (
              <View key={String(segment._id)}>
                {i > 0 && <Scheiding />}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 56, paddingVertical: 8 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={[tekst.kop, tekst.cijfers, { color: kleuren.foreground }]}>
                        {segment.beginTijd}–{segment.eindTijd}
                      </Text>
                      <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>
                        {CATEGORIE_LABELS[segment.categorie]}
                      </Text>
                      {segment.status === 'ingediend' && <StatusPil label="Ingediend" toon="succes" />}
                    </View>
                    {stopNaam(segment.werkitemId) && (
                      <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14 }]} numberOfLines={1}>
                        {stopNaam(segment.werkitemId)}
                      </Text>
                    )}
                    {wachtend && <Text accessibilityLiveRegion="polite" style={[tekst.voetnoot, { color: kleuren.warning, fontSize: 14, lineHeight: 19 }]}>Wachtende wijziging: {String(wachtend.payload.beginTijd ?? segment.beginTijd)}–{String(wachtend.payload.eindTijd ?? segment.eindTijd)} {String(wachtend.payload.categorie ?? segment.categorie)}{typeof wachtend.payload.notitie === 'string' ? ` · ${wachtend.payload.notitie}` : ''}. Nog niet bevestigd.</Text>}
                    {segment.notitie ? (
                      <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14, fontStyle: 'italic' }]} numberOfLines={2}>
                        &quot;{segment.notitie}&quot;
                      </Text>
                    ) : null}
                  </View>
                  {!bewerkbaar && !dagWacht && dag.isEigenDag && <Button title="Notitie" variant="ghost" size="sm" onPress={() => { setBewerkSegment(segment); setFormOpen(true); }} />}
                  {bewerkbaar && (
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <Drukvlak
                        accessibilityLabel="Segment bewerken"
                        onPress={() => {
                          setBewerkSegment(segment);
                          setFormOpen(true);
                        }}
                        style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: kleuren.muted }}
                      >
                        <Pencil size={18} color={kleuren.foreground} strokeWidth={2} />
                      </Drukvlak>
                      <Drukvlak
                        accessibilityLabel="Segment verwijderen"
                        onPress={() => handleVerwijder(segment)}
                        style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: kleuren.dangerSoft }}
                      >
                        <Trash2 size={18} color={kleuren.danger} strokeWidth={2} />
                      </Drukvlak>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </Kaart>
      )}

      {formOpen && <SegmentFormSheet
        key={`${datum}:${bewerkSegment?._id ?? 'nieuw'}`}
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setBewerkSegment(null);
        }}
        dag={dag}
        datum={datum}
        bewerkSegment={bewerkSegment}
      />}
    </View>
  );
}

/**
 * Formulier voor segment toevoegen of tijd/notitie corrigeren.
 * Bij "werken" is de klus-koppeling verplicht; bij BES optioneel
 * (herkomst groenafval, §2.6).
 */
function SegmentFormSheet({
  open,
  onClose,
  dag,
  datum,
  bewerkSegment,
}: {
  open: boolean;
  onClose: () => void;
  dag: VeldDagData;
  datum: string;
  bewerkSegment: VeldSegment | null;
}) {
  const kleuren = useVeldKleuren();
  const { verstuur, wachtrij } = useVeldOpdracht();
  const { userId, orgId } = useAuth();
  const conceptSleutel = urenConceptSleutel(orgId, userId, datum, bewerkSegment?._id ?? null);
  const [geladen, setGeladen] = useState(false);
  const [herstelPoging, setHerstelPoging] = useState<{ sleutel: string; payload: string } | null>(null);
  const [conceptMelding, setConceptMelding] = useState<string | null>(null);
  const receipt = useQuery(api.urenSegmenten.getEigenOpdracht, herstelPoging ? { sleutel: herstelPoging.sleutel, actie: bewerkSegment ? 'wijzigen' : 'toevoegen' } : 'skip');
  const afgewikkeld = useRef(false);
  const opdracht = useRef<{ payload: string; sleutel: string } | null>(null);
  const actiefOpslaan = useRef(false);
  const [revisie, setRevisie] = useState(dag.revisie ?? 0);
  const alleenNotitie = dag.dagStatus === 'ingediend' && !!bewerkSegment;

  const [categorie, setCategorie] = useState<SegmentCategorie>(bewerkSegment?.categorie ?? 'werken');
  const [werksoort, setWerksoort] = useState<Werksoort | undefined>(bewerkSegment?.werksoort);
  const [beginTijd, setBeginTijd] = useState(bewerkSegment?.beginTijd ?? '07:00');
  const [eindTijd, setEindTijd] = useState(bewerkSegment?.eindTijd ?? '08:00');
  const [werkitemId, setWerkitemId] = useState<string | null>(bewerkSegment?.werkitemId ?? null);
  const [notitie, setNotitie] = useState(bewerkSegment?.notitie ?? '');
  const [tijdFout, setTijdFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const maakConcept = useCallback((): UrenConcept | null => conceptSleutel ? {
    versie: 1, scope: conceptSleutel, datum, segmentId: bewerkSegment?._id ?? null, revisie,
    categorie, werksoort, beginTijd, eindTijd, werkitemId, notitie,
    ...(opdracht.current ? { opdracht: opdracht.current } : {}),
  } : null, [conceptSleutel, datum, bewerkSegment?._id, revisie, categorie, werksoort, beginTijd, eindTijd, werkitemId, notitie]);
  useEffect(() => {
    let actief = true;
    if (!conceptSleutel) return;
    void AsyncStorage.getItem(conceptSleutel).then(tekst => {
      if (!actief) return;
      const concept = leesUrenConcept(tekst, conceptSleutel, datum, bewerkSegment?._id ?? null);
      if (concept) {
        if (!(concept.categorie in CATEGORIE_LABELS)) throw new Error('De categorie van dit concept is niet beschikbaar.');
        setCategorie(concept.categorie); setWerksoort(concept.werksoort); setBeginTijd(concept.beginTijd); setEindTijd(concept.eindTijd); setWerkitemId(concept.werkitemId); setNotitie(concept.notitie); setRevisie(concept.revisie);
        opdracht.current = concept.opdracht ?? null; setHerstelPoging(concept.opdracht ?? null);
        setConceptMelding('Je bewaarde invoer is hersteld.');
      }
      setGeladen(true);
    }).catch(error => { if (actief) { setTijdFout(error instanceof Error ? error.message : 'Concept laden mislukt.'); } });
    return () => { actief = false; };
  }, [conceptSleutel, datum, bewerkSegment?._id]);
  useEffect(() => {
    if (!geladen || afgewikkeld.current || !conceptSleutel) return;
    const concept = maakConcept();
    if (concept) void schrijfUrenConcept(AsyncStorage, conceptSleutel, concept).catch(() => setTijdFout('Je invoer kon niet op dit toestel worden bewaard. Houd het formulier open en probeer opnieuw.'));
  }, [geladen, conceptSleutel, maakConcept]);
  const verwijderConcept = useCallback(async () => {
    afgewikkeld.current = true;
    if (conceptSleutel) await schrijfUrenConcept(AsyncStorage, conceptSleutel, null);
  }, [conceptSleutel]);
  const staatInWachtrij = !!herstelPoging && wachtrij.some(r => r.id === herstelPoging.sleutel);
  useEffect(() => {
    if (!herstelPoging || (!receipt && !staatInWachtrij)) return;
    void verwijderConcept().then(onClose).catch(() => setTijdFout('Opruimen van bevestigd concept mislukt. De invoer wordt niet opnieuw verstuurd.'));
  }, [herstelPoging, receipt, staatInWachtrij, verwijderConcept, onClose]);

  const toontKlusKeuze =
    categorie === 'werken' || categorie === 'afvalverwerker_bes';

  const handleOpslaan = async () => {
    if (actiefOpslaan.current || !geladen) return;
    if (!alleenNotitie && !isGeldigTijdvak(beginTijd, eindTijd)) { setTijdFout('Vul tijden als HH:MM in, begin vóór eind'); return; }
    if (!alleenNotitie && categorie === 'werken' && !werkitemId) { setTijdFout('Kies de klus waar je gewerkt hebt'); return; }
    const inhoud = herstelPoging ? JSON.parse(herstelPoging.payload) as Record<string, unknown> : bewerkSegment ? {
      id: bewerkSegment._id, verwachteRevisie: revisie, notitie: notitie.trim(),
      ...(!alleenNotitie ? { categorie, beginTijd, eindTijd, ...(categorie === 'anders' && werksoort ? { werksoort } : {}), werkitemId: toontKlusKeuze ? werkitemId ?? null : null } : {}),
    } : {
      datum, categorie, beginTijd, eindTijd, verwachteRevisie: revisie, bron: 'handmatig',
      ...(categorie === 'anders' && werksoort ? { werksoort } : {}),
      ...(toontKlusKeuze && werkitemId ? { werkitemId } : {}), ...(notitie.trim() ? { notitie: notitie.trim() } : {}),
    };
    const payload = JSON.stringify(inhoud);
    if (opdracht.current?.payload !== payload) opdracht.current = { payload, sleutel: Crypto.randomUUID() };
    setTijdFout(null); setBezig(true); actiefOpslaan.current = true;
    try {
      const concept = maakConcept();
      if (concept && conceptSleutel) await schrijfUrenConcept(AsyncStorage, conceptSleutel, concept);
      const result = await verstuur(bewerkSegment ? 'segmentWijzigen' : 'segmentToevoegen', inhoud, opdracht.current.sleutel);
      if (result.status === 'conflict') setTijdFout(result.fout ?? 'Controleer de wachtende invoer bovenaan de dag.');
      else {
        await verwijderConcept();
        onClose(); opdracht.current = null;
        if (result.status === 'wacht') Alert.alert('Op toestel bewaard', 'De registratie wordt gesynchroniseerd zodra je verbinding hebt.');
      }
    } catch (fout) { toonFout(fout, 'Opslaan is mislukt'); }
    finally { setBezig(false); actiefOpslaan.current = false; }
  };

  const foutRegel = tijdFout && <Text accessibilityRole="alert" style={[tekst.sub, { color: kleuren.danger }]}>{tijdFout}</Text>;
  const conceptInfo = <View style={{ gap: 8 }}>
    <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14, lineHeight: 19 }]}>{conceptMelding ?? 'Je invoer wordt op dit toestel bewaard bij sluiten of herstart.'}</Text>
    {geladen && !herstelPoging && revisie !== dag.revisie && <Text accessibilityRole="alert" style={[tekst.sub, { color: kleuren.warning }]}>De dag is gewijzigd sinds dit concept. Controleer je tijden en laad de actuele dagrevisie voordat je opslaat.</Text>}
    {geladen && !herstelPoging && revisie !== dag.revisie && <Button title="Gecontroleerd, actuele revisie gebruiken" variant="outline" onPress={() => setRevisie(dag.revisie)} />}
    <Button title="Concept verwijderen" variant="ghost" disabled={bezig} onPress={async () => { try { await verwijderConcept(); onClose(); } catch { setTijdFout('Concept verwijderen mislukt.'); } }} />
  </View>;
  if (!geladen || herstelPoging) return <BottomSheet isOpen={open} onClose={onClose} title="Bewaarde ureninvoer">
    <View style={{ gap: 12 }}>
      <Text style={[tekst.kop, herstelPoging ? tekst.cijfers : null, { color: kleuren.foreground }]}>{herstelPoging ? `${beginTijd}–${eindTijd} · ${CATEGORIE_LABELS[categorie]}` : 'Bewaarde invoer laden…'}</Text>
      {herstelPoging && <><Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Deze invoer is eerder aangeboden. We controleren of ze al bevestigd is. Opnieuw versturen gebruikt dezelfde sleutel en maakt geen tweede registratie.</Text><Button title="Dezelfde invoer opnieuw versturen" variant="outline" loading={bezig} onPress={handleOpslaan} disabled={!!receipt || staatInWachtrij} /></>}
      {foutRegel}
      {!herstelPoging && conceptInfo}
    </View>
  </BottomSheet>;

  if (alleenNotitie) return <BottomSheet isOpen={open} onClose={onClose} title="Notitie aanvullen">
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>De dag is ingediend. Je kunt alleen de notitie aanpassen.</Text>
      {conceptInfo}
      <Input label="Notitie" value={notitie} onChangeText={setNotitie} disabled={bezig} multiline />
      {foutRegel}
      <Button title="Notitie opslaan" size="lg" onPress={handleOpslaan} loading={bezig} fullWidth />
    </View>
  </BottomSheet>;

  return (
    <BottomSheet
      isOpen={open}
      onClose={onClose}
      title={bewerkSegment ? 'Segment aanpassen' : 'Segment toevoegen'}
    >
      <View style={{ gap: 16, paddingBottom: 12 }}>
        {conceptInfo}
        {/* Categorie-keuze */}
        <View style={{ gap: 8 }}>
          <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontWeight: '600' }]}>
            Categorie
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(CATEGORIE_LABELS) as SegmentCategorie[]).map(
              (waarde) => {
                const actief = categorie === waarde;
                return (
                  <Drukvlak
                    key={waarde}
                    haptic="selection"
                    accessibilityLabel={CATEGORIE_LABELS[waarde]}
                    accessibilityState={{ selected: actief }}
                    onPress={() => { setCategorie(waarde); setWerksoort(undefined); }}
                    style={{
                      minHeight: 44,
                      justifyContent: 'center',
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      backgroundColor: actief ? kleuren.primary : kleuren.muted,
                    }}
                  >
                    <Text
                      style={[tekst.sub, {
                        fontWeight: actief ? '600' : '500',
                        color: actief
                          ? kleuren.primaryForeground
                          : kleuren.foreground,
                      }]}
                    >
                      {CATEGORIE_LABELS[waarde]}
                    </Text>
                  </Drukvlak>
                );
              }
            )}
          </View>
        </View>

        {categorie === 'anders' && <WerksoortKeuze waarde={werksoort} wijzigen={setWerksoort} disabled={bezig} />}

        {/* Tijdvak */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Input
              label="Begin"
              value={beginTijd}
              onChangeText={setBeginTijd}
              placeholder="07:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              autoCapitalize="none"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Eind"
              value={eindTijd}
              onChangeText={setEindTijd}
              placeholder="08:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Klus-koppeling: verplicht bij werken, herkomst groenafval bij BES */}
        {toontKlusKeuze && (
          <View style={{ gap: 8 }}>
            <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontWeight: '600' }]}>
              {categorie === 'werken'
                ? 'Klus (verplicht)'
                : 'Herkomst groenafval (optioneel)'}
            </Text>
            <KlusKiezer datum={datum} stops={dag.stops} waarde={werkitemId} wijzigen={setWerkitemId} disabled={bezig} />
          </View>
        )}

        <Input
          label="Notitie (optioneel)"
          value={notitie}
          onChangeText={setNotitie}
          placeholder="Korte toelichting"
        />

        {tijdFout && (
          <Text style={[tekst.sub, { color: kleuren.danger }]}>
            {tijdFout}
          </Text>
        )}

        <Button
          title={bewerkSegment ? 'Aanpassen' : 'Opslaan'}
          size="lg"
          onPress={handleOpslaan}
          loading={bezig}
          fullWidth
        />
      </View>
    </BottomSheet>
  );
}
