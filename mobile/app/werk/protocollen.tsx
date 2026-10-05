import React, { useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import { useQuery } from 'convex/react';
import { useVeldCache } from '../../hooks/use-veld-cache';
import { api } from '../../convex/_generated/api';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useBuitenModus } from '../../components/veld/BuitenModus';
import { Button } from '../../components/ui';

interface Contact { _id: string; naam: string; telefoon: string; spoed: boolean; actief: boolean }
interface Protocol { _id: string; titel: string; wanneer: string; stappen: string[]; waarschuwing?: string; contactNaam?: string; contactTelefoon?: string; actief: boolean; revision: number }
export default function Protocollen() { return <VeldScherm titel="Protocollen"><ProtocolInhoud /></VeldScherm>; }
function ProtocolInhoud() {
  const { kleuren } = useBuitenModus();
  const liveProtocollen = useQuery(api.protocollen.list, {}) as Protocol[] | undefined;
  const { data: protocollen, uitCache } = useVeldCache('protocollen', liveProtocollen);
  const liveContacten = useQuery(api.protocollen.listContacten, {}) as Contact[] | undefined;
  const { data: contacten } = useVeldCache('protocol-contacten', liveContacten);
  const [zoek, setZoek] = useState(''); const [openId, setOpenId] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const detail = protocollen?.find(p => p._id === openId);
  const bellen = async (nummer: string) => { try { await Linking.openURL(`tel:${nummer.replace(/[^+\d]/g, '')}`); } catch { setFout('Bellen is niet beschikbaar op dit toestel.'); } };
  return <>
    {uitCache && <Text style={{ color: kleuren.mutedForeground }}>Opgeslagen protocollen op dit toestel. Controleer updates zodra je online bent.</Text>}
    {!!contacten?.length && <View style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={{ color: kleuren.foreground, fontSize: 17, fontWeight: '600' }}>Belangrijke telefoonnummers</Text>
      {contacten.filter(c => c.actief).map(c => <View key={c._id} style={{ borderWidth: 1, borderColor: kleuren.border, borderRadius: 12, padding: 12, gap: 8 }}><Text style={{ color: kleuren.foreground, fontWeight: c.spoed ? '700' : '400' }}>{c.naam}{c.spoed ? ' · Spoed' : ''}</Text><Button title={`Bel ${c.telefoon}`} variant="outline" onPress={() => bellen(c.telefoon)} /></View>)}
    </View>}
    <TextInput accessibilityLabel="Protocol zoeken" value={zoek} onChangeText={setZoek} placeholder="Zoek op onderwerp" placeholderTextColor={kleuren.mutedForeground} style={{ color: kleuren.foreground, borderWidth: 1, borderColor: kleuren.border, borderRadius: 10, padding: 12, minHeight: 48, fontSize: 16 }} />
    {fout && !detail && <Text accessibilityRole="alert" style={{ color: kleuren.foreground }}>{fout}</Text>}
    {!protocollen ? <Text style={{ color: kleuren.mutedForeground }}>Protocollen laden…</Text> : <>
      {!protocollen.length && <Text style={{ color: kleuren.mutedForeground }}>Er zijn nog geen protocollen voor jouw rol.</Text>}
      {protocollen.filter(p => `${p.titel} ${p.wanneer} ${p.stappen.join(' ')}`.toLowerCase().includes(zoek.toLowerCase())).map(p => <Pressable key={p._id} accessibilityRole="button" accessibilityLabel={p.titel} accessibilityState={{ expanded: p._id === openId }} onPress={() => { setOpenId(p._id === openId ? null : p._id); setFout(null); }} style={{ minHeight: 56, justifyContent: 'center', borderWidth: 1, borderColor: p._id === openId ? kleuren.primary : kleuren.border, backgroundColor: kleuren.card, padding: 14, borderRadius: 12, gap: 4 }}>
        <Text style={{ color: kleuren.foreground, fontWeight: '600' }}>{p.titel}{!p.actief ? ' · Gearchiveerd' : ''}</Text><Text style={{ color: kleuren.mutedForeground }}>{p.wanneer}</Text>
      </Pressable>)}
      {detail && <View style={{ gap: 14, padding: 16, borderWidth: 1, borderColor: kleuren.border, borderRadius: 14, backgroundColor: kleuren.card }}>
        <Text accessibilityRole="header" style={{ color: kleuren.foreground, fontSize: 20, fontWeight: '600' }}>{detail.titel}</Text>
        {detail.waarschuwing && <Text style={{ color: kleuren.foreground, fontWeight: '600' }}>Let op: {detail.waarschuwing}</Text>}
        {detail.stappen.map((stap, index) => <Text key={index} style={{ color: kleuren.foreground, lineHeight: 24 }}>{index + 1}. {stap}</Text>)}
        {detail.contactNaam && <Text style={{ color: kleuren.mutedForeground }}>Contact: {detail.contactNaam}</Text>}
        {detail.contactTelefoon && <Button title={`Bel ${detail.contactTelefoon}`} variant="outline" onPress={() => bellen(detail.contactTelefoon!)} />}
        {fout && <Text accessibilityRole="alert" style={{ color: kleuren.foreground }}>{fout}</Text>}
      </View>}
    </>}
  </>;
}
