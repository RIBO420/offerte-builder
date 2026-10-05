import React, { Fragment, useState } from 'react';
import { Linking, Text, TextInput, View } from 'react-native';
import { AlertTriangle, BookOpen, ChevronDown, ChevronRight, Phone, Search } from 'lucide-react-native';
import { useQuery } from 'convex/react';
import { useVeldCache } from '../../hooks/use-veld-cache';
import { api } from '../../convex/_generated/api';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useBuitenModus } from '../../components/veld/BuitenModus';
import { Drukvlak, IcoonTegel, Kaart, LegeStaat, Melding, SectieKop, StatusPil, toonKleuren } from '../../components/werk/Bouwstenen';
import { tekst } from '../../theme';

interface Contact { _id: string; naam: string; telefoon: string; spoed: boolean; actief: boolean }
interface Protocol { _id: string; titel: string; wanneer: string; stappen: string[]; waarschuwing?: string; contactNaam?: string; contactTelefoon?: string; actief: boolean; revision: number }
export default function Protocollen() { return <VeldScherm titel="Protocollen"><ProtocolInhoud /></VeldScherm>; }

/** "Bel"-knop van 44 pt; spoed krijgt de rode toon. */
function BelKnop({ spoed }: { spoed?: boolean }) {
  const { kleuren } = useBuitenModus();
  const { voor, achter } = toonKleuren(kleuren, spoed ? 'gemist' : 'primair');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: achter }}>
      <Phone size={16} color={voor} strokeWidth={2.25} />
      <Text style={[tekst.sub, { color: voor, fontWeight: '700' }]}>Bel</Text>
    </View>
  );
}

function ProtocolInhoud() {
  const { kleuren } = useBuitenModus();
  const liveProtocollen = useQuery(api.protocollen.list, {}) as Protocol[] | undefined;
  const { data: protocollen, uitCache } = useVeldCache('protocollen', liveProtocollen);
  const liveContacten = useQuery(api.protocollen.listContacten, {}) as Contact[] | undefined;
  const { data: contacten } = useVeldCache('protocol-contacten', liveContacten);
  const [zoek, setZoek] = useState(''); const [openId, setOpenId] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const bellen = async (nummer: string) => { try { await Linking.openURL(`tel:${nummer.replace(/[^+\d]/g, '')}`); } catch { setFout('Bellen is niet beschikbaar op dit toestel.'); } };
  const actieveContacten = contacten?.filter(c => c.actief) ?? [];
  const gevonden = protocollen?.filter(p => `${p.titel} ${p.wanneer} ${p.stappen.join(' ')}`.toLowerCase().includes(zoek.toLowerCase())) ?? [];
  const detailZichtbaar = gevonden.some(p => p._id === openId);
  const lijn = (inspring: number) => <View style={{ height: 1, backgroundColor: kleuren.border, marginLeft: inspring }} />;

  return <>
    {uitCache && <Melding tekst="Opgeslagen protocollen op dit toestel. Controleer updates zodra je online bent." />}

    {actieveContacten.length > 0 && <View style={{ gap: 8 }}>
      <SectieKop titel="Belangrijke telefoonnummers" />
      <Kaart padding={0} style={{ gap: 0, overflow: 'hidden' }}>
        {actieveContacten.map((c, i) => <Fragment key={c._id}>
          {i > 0 && lijn(64)}
          <Drukvlak
            onPress={() => { void bellen(c.telefoon); }}
            haptic="press"
            accessibilityLabel={`Bel ${c.naam}${c.spoed ? ', spoed' : ''}, ${c.telefoon}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, paddingHorizontal: 16, paddingVertical: 10 }}
          >
            <IcoonTegel icoon={Phone} toon={c.spoed ? 'gemist' : 'primair'} grootte={36} />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <Text style={[tekst.kop, { color: kleuren.foreground, flexShrink: 1 }]} numberOfLines={2}>{c.naam}</Text>
                {c.spoed && <StatusPil label="Spoed" toon="gemist" />}
              </View>
              <Text style={[tekst.sub, tekst.cijfers, { color: kleuren.mutedForeground }]}>{c.telefoon}</Text>
            </View>
            <BelKnop spoed={c.spoed} />
          </Drukvlak>
        </Fragment>)}
      </Kaart>
    </View>}

    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: kleuren.muted, borderRadius: 12, minHeight: 44, paddingHorizontal: 12 }}>
      <Search size={18} color={kleuren.mutedForeground} strokeWidth={2} />
      <TextInput
        accessibilityLabel="Protocol zoeken"
        value={zoek}
        onChangeText={setZoek}
        placeholder="Zoek op onderwerp"
        placeholderTextColor={kleuren.mutedForeground}
        clearButtonMode="while-editing"
        style={{ flex: 1, color: kleuren.foreground, fontSize: 16, minHeight: 44, paddingVertical: 10 }}
      />
    </View>
    {fout && !detailZichtbaar && <Melding tekst={fout} toon="gemist" />}

    {!protocollen ? <Kaart variant="stil"><Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Protocollen laden…</Text></Kaart> : <>
      {!protocollen.length && <LegeStaat icoon={BookOpen} titel="Nog geen protocollen" uitleg="Er zijn nog geen protocollen voor jouw rol." />}
      {protocollen.length > 0 && !gevonden.length && <Text style={[tekst.sub, { color: kleuren.mutedForeground, textAlign: 'center', paddingVertical: 12 }]}>Geen protocol gevonden voor “{zoek}”.</Text>}
      {gevonden.length > 0 && <View style={{ gap: 8 }}>
        <SectieKop titel="Protocollen" telling={gevonden.length} />
        <Kaart padding={0} style={{ gap: 0, overflow: 'hidden' }}>
          {gevonden.map((p, i) => {
            const open = p._id === openId;
            const Pijl = open ? ChevronDown : ChevronRight;
            return <Fragment key={p._id}>
              {i > 0 && lijn(64)}
              <Drukvlak
                onPress={() => { setOpenId(open ? null : p._id); setFout(null); }}
                haptic="selection"
                accessibilityLabel={p.actief ? p.titel : `${p.titel}, gearchiveerd`}
                accessibilityState={{ expanded: open }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12 }}
              >
                <IcoonTegel icoon={BookOpen} toon={p.actief ? 'primair' : 'neutraal'} grootte={36} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[tekst.kop, { color: kleuren.foreground }]} numberOfLines={open ? undefined : 2}>{p.titel}</Text>
                  <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14, lineHeight: 19 }]} numberOfLines={open ? undefined : 2}>{p.wanneer}</Text>
                  {!p.actief && <StatusPil label="Gearchiveerd" />}
                </View>
                <Pijl size={18} color={kleuren.mutedForeground} strokeWidth={2} />
              </Drukvlak>
              {open && <ProtocolDetail protocol={p} bellen={bellen} fout={fout} />}
            </Fragment>;
          })}
        </Kaart>
      </View>}
    </>}
  </>;
}

function ProtocolDetail({ protocol: p, bellen, fout }: { protocol: Protocol; bellen: (nummer: string) => Promise<void>; fout: string | null }) {
  const { kleuren } = useBuitenModus();
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 16 }}>
      {!!p.waarschuwing && <Melding tekst={`Let op: ${p.waarschuwing}`} toon="wachten" icoon={AlertTriangle} />}
      <View style={{ gap: 12 }}>
        {p.stappen.map((stap, index) => (
          <View key={index} accessible accessibilityLabel={`Stap ${index + 1}: ${stap}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: kleuren.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.primary, fontWeight: '700' }]}>{index + 1}</Text>
            </View>
            <Text style={[tekst.callout, { color: kleuren.foreground, flex: 1, paddingTop: 3 }]}>{stap}</Text>
          </View>
        ))}
      </View>
      {(!!p.contactNaam || !!p.contactTelefoon) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: kleuren.muted, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, minHeight: 64 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[tekst.bijschrift, { color: kleuren.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Contact</Text>
            {!!p.contactNaam && <Text style={[tekst.kop, { color: kleuren.foreground }]}>{p.contactNaam}</Text>}
            {!!p.contactTelefoon && <Text style={[tekst.sub, tekst.cijfers, { color: kleuren.mutedForeground }]}>{p.contactTelefoon}</Text>}
          </View>
          {!!p.contactTelefoon && (
            <Drukvlak onPress={() => { void bellen(p.contactTelefoon!); }} haptic="press" accessibilityLabel={`Bel ${p.contactTelefoon}`}>
              <BelKnop />
            </Drukvlak>
          )}
        </View>
      )}
      {fout && <Melding tekst={fout} toon="gemist" />}
    </View>
  );
}
