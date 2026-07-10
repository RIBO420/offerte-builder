/**
 * SegmentenLijst — urensegmenten van de veld-dag (PRD §2.6/§8.10, mobiel).
 * Voorstellen komen uit de dagkaart; de medewerker bevestigt of corrigeert —
 * loggen wordt bevestigen. Corrigeren = tijd aanpassen, segment toevoegen
 * (incl. categorie BES/afvalverwerker met werkitem-koppeling) of verwijderen.
 */

import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useMutation } from 'convex/react';
import { Check, CheckCheck, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { api } from '../../convex/_generated/api';
import { Badge, BottomSheet, Button, Input } from '../ui';
import {
  CATEGORIE_LABELS,
  isGeldigTijdvak,
  type SegmentCategorie,
  type VeldDagData,
  type VeldSegment,
  type VoorstelSegment,
} from '../../types/veld';
import { useBuitenModus } from './BuitenModus';

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
  const { kleuren } = useBuitenModus();
  const bevestigSegment = useMutation(api.urenSegmenten.bevestigSegment);
  const bevestigAlle = useMutation(api.urenSegmenten.bevestigAlleVoorstellen);
  const verwijderSegment = useMutation(api.urenSegmenten.verwijderSegment);

  const [formOpen, setFormOpen] = useState(false);
  const [bewerkSegment, setBewerkSegment] = useState<VeldSegment | null>(null);

  const stopNaam = (werkitemId: string | null | undefined): string | null => {
    if (!werkitemId) return null;
    const stop = dag.stops.find((s) => String(s.werkitemId) === String(werkitemId));
    return stop ? stop.klantNaam ?? stop.naam : null;
  };

  const handleBevestigVoorstel = async (voorstel: VoorstelSegment) => {
    try {
      await bevestigSegment({
        datum,
        categorie: voorstel.categorie,
        beginTijd: voorstel.beginTijd,
        eindTijd: voorstel.eindTijd,
        werkitemId: voorstel.werkitemId ?? undefined,
        bron: 'voorstel',
      });
    } catch (fout) {
      toonFout(fout, 'Bevestigen is mislukt');
    }
  };

  const handleBevestigAlle = async () => {
    try {
      await bevestigAlle({ datum });
    } catch (fout) {
      toonFout(fout, 'Bevestigen is mislukt');
    }
  };

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
              await verwijderSegment({ id: segment._id });
            } catch (fout) {
              toonFout(fout, 'Verwijderen is mislukt');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{ color: kleuren.foreground, fontSize: 17, fontWeight: '600' }}
          accessibilityRole="header"
        >
          Uren
        </Text>
        {magBewerken && (
          <Button
            variant="outline"
            size="sm"
            title="Segment"
            icon={<Plus size={16} color={kleuren.foreground} />}
            onPress={() => {
              setBewerkSegment(null);
              setFormOpen(true);
            }}
          />
        )}
      </View>

      {/* Voorgestelde segmenten uit de dagkaart (§8.10) */}
      {magBewerken && dag.voorstellen.length > 0 && (
        <View
          style={{
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: kleuren.border,
            borderRadius: 12,
            padding: 12,
            gap: 8,
            backgroundColor: kleuren.surface,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <Text
              style={{
                color: kleuren.mutedForeground,
                fontSize: 12,
                flexShrink: 1,
              }}
            >
              Voorgesteld uit je dagkaart — bevestig of corrigeer
            </Text>
            <Button
              variant="secondary"
              size="sm"
              title={`Alles (${dag.voorstellen.length})`}
              icon={<CheckCheck size={16} color={kleuren.foreground} />}
              onPress={handleBevestigAlle}
            />
          </View>
          {dag.voorstellen.map((voorstel, i) => (
            <View
              key={`${voorstel.beginTijd}-${voorstel.categorie}-${i}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <View style={{ flexShrink: 1 }}>
                <Text style={{ color: kleuren.foreground, fontSize: 14 }}>
                  {voorstel.beginTijd}–{voorstel.eindTijd}{' '}
                  {CATEGORIE_LABELS[voorstel.categorie]}
                </Text>
                {stopNaam(voorstel.werkitemId) && (
                  <Text
                    style={{ color: kleuren.mutedForeground, fontSize: 12 }}
                    numberOfLines={1}
                  >
                    {stopNaam(voorstel.werkitemId)}
                  </Text>
                )}
              </View>
              <Button
                variant="secondary"
                size="sm"
                title="Bevestig"
                icon={<Check size={16} color={kleuren.foreground} />}
                onPress={() => handleBevestigVoorstel(voorstel)}
              />
            </View>
          ))}
        </View>
      )}

      {/* Bevestigde/ingediende segmenten */}
      {dag.segmenten.length === 0 ? (
        <Text style={{ color: kleuren.mutedForeground, fontSize: 13 }}>
          Nog geen segmenten voor deze dag.
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          {dag.segmenten.map((segment) => {
            const bewerkbaar = magBewerken && segment.status !== 'ingediend';
            return (
              <View
                key={String(segment._id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: kleuren.border,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: kleuren.card,
                }}
              >
                <View style={{ flexShrink: 1, gap: 2 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Text
                      style={{
                        color: kleuren.foreground,
                        fontSize: 15,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {segment.beginTijd}–{segment.eindTijd}
                    </Text>
                    <Badge variant="outline">
                      {CATEGORIE_LABELS[segment.categorie]}
                    </Badge>
                    {segment.status === 'ingediend' && (
                      <Badge variant="secondary">ingediend</Badge>
                    )}
                  </View>
                  {stopNaam(segment.werkitemId) && (
                    <Text
                      style={{ color: kleuren.mutedForeground, fontSize: 12 }}
                      numberOfLines={1}
                    >
                      {stopNaam(segment.werkitemId)}
                    </Text>
                  )}
                  {segment.notitie ? (
                    <Text
                      style={{ color: kleuren.mutedForeground, fontSize: 12 }}
                      numberOfLines={2}
                    >
                      &quot;{segment.notitie}&quot;
                    </Text>
                  ) : null}
                </View>
                {bewerkbaar && (
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Segment bewerken"
                      hitSlop={8}
                      onPress={() => {
                        setBewerkSegment(segment);
                        setFormOpen(true);
                      }}
                      style={{ padding: 8 }}
                    >
                      <Pencil size={18} color={kleuren.mutedForeground} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Segment verwijderen"
                      hitSlop={8}
                      onPress={() => handleVerwijder(segment)}
                      style={{ padding: 8 }}
                    >
                      <Trash2 size={18} color={kleuren.destructive} />
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <SegmentFormSheet
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setBewerkSegment(null);
        }}
        dag={dag}
        datum={datum}
        bewerkSegment={bewerkSegment}
      />
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
  const { kleuren } = useBuitenModus();
  const bevestigSegment = useMutation(api.urenSegmenten.bevestigSegment);
  const updateSegment = useMutation(api.urenSegmenten.updateSegment);

  const [categorie, setCategorie] = useState<SegmentCategorie>('werken');
  const [beginTijd, setBeginTijd] = useState('07:00');
  const [eindTijd, setEindTijd] = useState('08:00');
  const [werkitemId, setWerkitemId] = useState<string | null>(null);
  const [notitie, setNotitie] = useState('');
  const [tijdFout, setTijdFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  // Formulier vullen zodra het opengaat (nieuw of bewerken)
  const [vorigeSleutel, setVorigeSleutel] = useState<string | null>(null);
  const sleutel = open ? String(bewerkSegment?._id ?? 'nieuw') : null;
  if (sleutel !== vorigeSleutel) {
    setVorigeSleutel(sleutel);
    if (sleutel !== null) {
      setCategorie(bewerkSegment?.categorie ?? 'werken');
      setBeginTijd(bewerkSegment?.beginTijd ?? '07:00');
      setEindTijd(bewerkSegment?.eindTijd ?? '08:00');
      setWerkitemId(
        bewerkSegment?.werkitemId ? String(bewerkSegment.werkitemId) : null
      );
      setNotitie(bewerkSegment?.notitie ?? '');
      setTijdFout(null);
    }
  }

  const toontKlusKeuze =
    categorie === 'werken' || categorie === 'afvalverwerker_bes';

  const handleOpslaan = async () => {
    if (!isGeldigTijdvak(beginTijd, eindTijd)) {
      setTijdFout('Vul tijden als HH:MM in, begin vóór eind');
      return;
    }
    if (categorie === 'werken' && !werkitemId) {
      setTijdFout('Kies de klus waar je gewerkt hebt');
      return;
    }
    setTijdFout(null);
    setBezig(true);
    try {
      if (bewerkSegment) {
        await updateSegment({
          id: bewerkSegment._id,
          categorie,
          beginTijd,
          eindTijd,
          werkitemId: toontKlusKeuze ? werkitemId ?? null : null,
          notitie: notitie.trim() || undefined,
        });
      } else {
        await bevestigSegment({
          datum,
          categorie,
          beginTijd,
          eindTijd,
          werkitemId: toontKlusKeuze && werkitemId ? werkitemId : undefined,
          notitie: notitie.trim() || undefined,
          bron: 'handmatig',
        });
      }
      onClose();
    } catch (fout) {
      toonFout(
        fout,
        bewerkSegment ? 'Aanpassen is mislukt' : 'Opslaan is mislukt'
      );
    } finally {
      setBezig(false);
    }
  };

  return (
    <BottomSheet
      isOpen={open}
      onClose={onClose}
      title={bewerkSegment ? 'Segment aanpassen' : 'Segment toevoegen'}
    >
      <View style={{ gap: 14, paddingBottom: 12 }}>
        {/* Categorie-keuze */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: kleuren.mutedForeground, fontSize: 12 }}>
            Categorie
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(CATEGORIE_LABELS) as SegmentCategorie[]).map(
              (waarde) => {
                const actief = categorie === waarde;
                return (
                  <Pressable
                    key={waarde}
                    accessibilityRole="button"
                    accessibilityState={{ selected: actief }}
                    onPress={() => setCategorie(waarde)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: actief ? kleuren.primary : kleuren.border,
                      backgroundColor: actief
                        ? kleuren.primary
                        : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        color: actief
                          ? kleuren.primaryForeground
                          : kleuren.foreground,
                      }}
                    >
                      {CATEGORIE_LABELS[waarde]}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>
        </View>

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
          <View style={{ gap: 6 }}>
            <Text style={{ color: kleuren.mutedForeground, fontSize: 12 }}>
              {categorie === 'werken'
                ? 'Klus (verplicht)'
                : 'Herkomst groenafval (optioneel)'}
            </Text>
            {dag.stops.length === 0 ? (
              <Text style={{ color: kleuren.mutedForeground, fontSize: 13 }}>
                Geen geplande klussen op deze dag.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {dag.stops.map((stop) => {
                  const id = String(stop.werkitemId);
                  const actief = werkitemId === id;
                  return (
                    <Pressable
                      key={id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: actief }}
                      onPress={() => setWerkitemId(actief ? null : id)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: actief ? kleuren.primary : kleuren.border,
                        backgroundColor: actief
                          ? kleuren.secondary
                          : 'transparent',
                      }}
                    >
                      <Text
                        style={{ color: kleuren.foreground, fontSize: 14 }}
                        numberOfLines={1}
                      >
                        {stop.klantNaam ?? stop.naam}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        <Input
          label="Notitie (optioneel)"
          value={notitie}
          onChangeText={setNotitie}
          placeholder="Korte toelichting"
        />

        {tijdFout && (
          <Text style={{ color: kleuren.destructive, fontSize: 13 }}>
            {tijdFout}
          </Text>
        )}

        <Button
          title={bewerkSegment ? 'Aanpassen' : 'Opslaan'}
          onPress={handleOpslaan}
          loading={bezig}
          fullWidth
        />
      </View>
    </BottomSheet>
  );
}
