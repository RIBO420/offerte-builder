/**
 * ProjectFotoUpload — Top Tuinen Mobile App
 *
 * Scherm voor het koppelen en uploaden van foto's aan een project/offerte.
 * Ondersteunt projectselectie via dropdown, QR-code scannen en
 * categorie-selectie per foto.
 *
 * VEREISTE INSTALLATIES (nog niet in package.json):
 *   expo install expo-camera expo-image-picker expo-location expo-image-manipulator
 *
 * Voor QR-scanning is expo-camera vereist.
 * expo-barcode-scanner is deprecated in SDK 54 — gebruik expo-camera met barCodeScannerSettings.
 *
 * Reeds aanwezig:
 *   - @react-native-async-storage/async-storage
 *   - @react-native-community/netinfo
 *   - react-native-reanimated
 */

import React, { useState, useCallback, useMemo, type ComponentType } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CameraOff,
  Check,
  ChevronDown,
  CircleArrowRight,
  CircleCheck,
  CircleX,
  Clock,
  Folder,
  ScanQrCode,
  Search,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { BEELD_OVERLAY, FotoGalerij } from './FotoGalerij';
import { Button } from './ui';
import { useVeldKleuren } from './veld/BuitenModus';
import { Drukvlak, IcoonTegel, Kaart, LegeStaat, Scheiding, SectieKop, toonKleuren, type Toon } from './werk/Bouwstenen';
import { tekst } from '../theme';
import { useOfflineQueue } from '@/hooks/use-offline-queue';
import type { CapturedPhoto } from '@/hooks/use-photo-capture';

type Icoon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

// ============================================
// TYPES
// ============================================

export type FotoCategorie = 'voor' | 'na' | 'probleem';

export interface FotoMetCategorie extends CapturedPhoto {
  categorie: FotoCategorie;
  projectId: string;
}

export interface Project {
  id: string;
  naam: string;
  klant: string;
  status: string;
}

interface ProjectFotoUploadProps {
  /** Lijst van beschikbare projecten */
  projecten: Project[];
  /** Optioneel: al geselecteerd project-ID bij openen */
  initiaalProjectId?: string;
  /** Callback na succesvolle upload-aanvraag */
  onUploadGestart?: (projectId: string, aantalFotos: number) => void;
}

// ============================================
// CONSTANTEN
// ============================================

const CATEGORIE_CONFIG: Record<FotoCategorie, { label: string; toon: Toon; icoon: Icoon; beschrijving: string }> = {
  voor:     { label: 'Voor werkzaamheden', toon: 'info',   icoon: CircleArrowRight, beschrijving: 'Situatie vóór de aanleg' },
  na:       { label: 'Na werkzaamheden',   toon: 'succes', icoon: CircleCheck,      beschrijving: 'Resultaat na voltooiing' },
  probleem: { label: 'Probleem gemeld',    toon: 'gemist', icoon: TriangleAlert,    beschrijving: 'Probleem of afwijking' },
};

// ============================================
// SUBCOMPONENTEN
// ============================================

// ----------------------------------------
// Categorie-selector
// ----------------------------------------

interface CategorieSelectorProps {
  geselecteerd: FotoCategorie;
  onChange: (cat: FotoCategorie) => void;
}

const CategorieSelector = React.memo(({ geselecteerd, onChange }: CategorieSelectorProps) => {
  const kleuren = useVeldKleuren();
  return (
    <View style={{ gap: 8 }}>
      {(Object.entries(CATEGORIE_CONFIG) as [FotoCategorie, typeof CATEGORIE_CONFIG[FotoCategorie]][]).map(
        ([cat, config]) => {
          const actief = geselecteerd === cat;
          const { voor, achter } = toonKleuren(kleuren, config.toon);
          return (
            <Drukvlak
              key={cat}
              onPress={() => onChange(cat)}
              haptic="selection"
              accessibilityLabel={`${config.label}, ${config.beschrijving}`}
              accessibilityState={{ selected: actief }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                minHeight: 64,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: actief ? voor : kleuren.border,
                backgroundColor: actief ? achter : kleuren.card,
              }}
            >
              <IcoonTegel icoon={config.icoon} toon={actief ? config.toon : 'neutraal'} grootte={36} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={[tekst.kop, { color: actief ? voor : kleuren.foreground, fontWeight: actief ? '700' : '500' }]}>
                  {config.label}
                </Text>
                <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground }]}>{config.beschrijving}</Text>
              </View>
              {actief && <Check size={20} color={voor} strokeWidth={2.5} />}
            </Drukvlak>
          );
        }
      )}
    </View>
  );
});
CategorieSelector.displayName = 'CategorieSelector';

// ----------------------------------------
// Project-dropdown
// ----------------------------------------

interface ProjectDropdownProps {
  projecten: Project[];
  geselecteerd: Project | null;
  onSelecteer: (project: Project) => void;
}

function ProjectDropdown({ projecten, geselecteerd, onSelecteer }: ProjectDropdownProps) {
  const kleuren = useVeldKleuren();
  const [open, setOpen] = useState(false);
  const [zoekterm, setZoekterm] = useState('');

  const gefilterd = useMemo(() =>
    projecten.filter(
      (p) =>
        p.naam.toLowerCase().includes(zoekterm.toLowerCase()) ||
        p.klant.toLowerCase().includes(zoekterm.toLowerCase())
    ),
    [projecten, zoekterm]
  );

  return (
    <>
      <Drukvlak
        onPress={() => setOpen(true)}
        accessibilityLabel={geselecteerd !== null ? `Project: ${geselecteerd.naam}, ${geselecteerd.klant}` : 'Selecteer een project'}
        accessibilityHint="Opent de projectlijst"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: 56,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: kleuren.border,
          backgroundColor: kleuren.card,
        }}
      >
        <IcoonTegel icoon={Folder} toon={geselecteerd !== null ? 'primair' : 'neutraal'} grootte={36} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text
            style={[tekst.kop, { color: geselecteerd !== null ? kleuren.foreground : kleuren.mutedForeground, fontWeight: geselecteerd !== null ? '600' : '400' }]}
            numberOfLines={1}
          >
            {geselecteerd !== null ? geselecteerd.naam : 'Selecteer een project...'}
          </Text>
          {geselecteerd !== null && (
            <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground }]} numberOfLines={1}>{geselecteerd.klant}</Text>
          )}
        </View>
        <ChevronDown size={20} color={kleuren.mutedForeground} strokeWidth={2} />
      </Drukvlak>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 10, paddingVertical: 8 }}>
            <Text accessibilityRole="header" style={[tekst.titel3, { color: kleuren.foreground }]}>Selecteer project</Text>
            <Drukvlak
              onPress={() => setOpen(false)}
              accessibilityLabel="Sluiten"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: kleuren.muted, alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} color={kleuren.foreground} strokeWidth={2.25} />
            </Drukvlak>
          </View>

          {/* Zoekbalk */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginHorizontal: 16,
              marginTop: 4,
              marginBottom: 12,
              paddingLeft: 12,
              minHeight: 44,
              borderRadius: 12,
              backgroundColor: kleuren.muted,
            }}
          >
            <Search size={18} color={kleuren.mutedForeground} strokeWidth={2} />
            <TextInput
              style={{ flex: 1, fontSize: tekst.body.fontSize, color: kleuren.foreground, paddingVertical: 10 }}
              value={zoekterm}
              onChangeText={setZoekterm}
              placeholder="Zoek op naam of klant..."
              placeholderTextColor={kleuren.mutedForeground}
              accessibilityLabel="Zoek project"
              autoFocus
            />
            {zoekterm.length > 0 && (
              <Drukvlak
                onPress={() => setZoekterm('')}
                accessibilityLabel="Zoekterm wissen"
                haptic={null}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <CircleX size={18} color={kleuren.mutedForeground} strokeWidth={2} />
              </Drukvlak>
            )}
          </View>

          {/* Projecten-lijst */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            {gefilterd.length === 0 ? (
              <LegeStaat icoon={Search} titel="Geen projecten gevonden" />
            ) : (
              <Kaart padding={0} style={{ paddingHorizontal: 14, gap: 0 }}>
                {gefilterd.map((project, index) => {
                  const actief = geselecteerd?.id === project.id;
                  return (
                    <View key={project.id}>
                      {index > 0 && <Scheiding />}
                      <Drukvlak
                        onPress={() => {
                          onSelecteer(project);
                          setOpen(false);
                          setZoekterm('');
                        }}
                        accessibilityLabel={`${project.naam}, ${project.klant}`}
                        accessibilityState={{ selected: actief }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10 }}
                      >
                        <View style={{ flex: 1, gap: 1 }}>
                          <Text style={[tekst.kop, { color: actief ? kleuren.primary : kleuren.foreground, fontWeight: actief ? '600' : '500' }]} numberOfLines={1}>
                            {project.naam}
                          </Text>
                          <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14 }]} numberOfLines={1}>{project.klant}</Text>
                        </View>
                        <View
                          accessibilityElementsHidden
                          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: project.status === 'actief' ? kleuren.success : kleuren.mutedForeground }}
                        />
                        {actief && <Check size={18} color={kleuren.primary} strokeWidth={2.5} />}
                      </Drukvlak>
                    </View>
                  );
                })}
              </Kaart>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

// ----------------------------------------
// QR-scanner modal
// ----------------------------------------

interface QRScannerProps {
  zichtbaar: boolean;
  onScan: (projectId: string) => void;
  onSluit: () => void;
}

function QRScanner({ zichtbaar, onScan, onSluit }: QRScannerProps) {
  const kleuren = useVeldKleuren();
  const [permissie, vraagPermissie] = useCameraPermissions();
  const [gescand, setGescand] = useState(false);

  const handleScan = useCallback(({ data }: BarcodeScanningResult) => {
    if (gescand) return;
    setGescand(true);

    // Extraheer project-ID uit QR-code
    // Verwacht formaat: "toptuinen://project/<id>" of puur een ID
    const match = data.match(/(?:toptuinen:\/\/project\/|^)([a-zA-Z0-9_-]+)$/);
    const projectId = match !== null ? match[1] : data.trim();

    if (projectId.length > 0) {
      onScan(projectId);
      onSluit();
    } else {
      Alert.alert('Ongeldig QR-code', 'Dit QR-code bevat geen geldig project-ID.', [
        { text: 'Opnieuw proberen', onPress: () => setGescand(false) },
        { text: 'Annuleren', onPress: onSluit },
      ]);
    }
  }, [gescand, onScan, onSluit]);

  if (!zichtbaar) return null;

  return (
    <Modal
      visible={zichtbaar}
      animationType="slide"
      onRequestClose={onSluit}
    >
      {/* Camerapodium: zwart in beide thema's, het camerabeeld vult het. */}
      <View style={{ flex: 1, backgroundColor: BEELD_OVERLAY.achtergrond }}>
        {permissie === null || !permissie.granted ? (
          <SafeAreaView
            style={{ flex: 1, backgroundColor: kleuren.background, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}
            edges={['top', 'bottom']}
          >
            <IcoonTegel icoon={CameraOff} toon="neutraal" grootte={56} />
            <Text style={[tekst.callout, { color: kleuren.mutedForeground, textAlign: 'center', maxWidth: 300 }]}>
              Camera-toegang is vereist voor het scannen van QR-codes.
            </Text>
            <Button title="Toegang verlenen" onPress={() => { void vraagPermissie(); }} />
            <Button title="Annuleren" variant="ghost" onPress={onSluit} />
          </SafeAreaView>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={gescand ? undefined : handleScan}
            />
            {/* Overlay met sluit-knop */}
            <SafeAreaView style={stijlen.scannerOverlay} edges={['top']}>
              <Drukvlak
                onPress={onSluit}
                accessibilityLabel="Scanner sluiten"
                buitenStijl={{ alignSelf: 'flex-end' }}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: BEELD_OVERLAY.scrim, alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={22} color={BEELD_OVERLAY.tekst} strokeWidth={2.25} />
              </Drukvlak>
              <Text
                style={[
                  tekst.sub,
                  { color: BEELD_OVERLAY.tekst, textAlign: 'center', backgroundColor: BEELD_OVERLAY.scrim, borderRadius: 12, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 8 },
                ]}
              >
                Richt de camera op het QR-code van het project
              </Text>
            </SafeAreaView>

            {/* Doelkader */}
            <View style={stijlen.scannerKader} accessibilityElementsHidden>
              <View style={[stijlen.hoek, stijlen.hoekLB]} />
              <View style={[stijlen.hoek, stijlen.hoekRB]} />
              <View style={[stijlen.hoek, stijlen.hoekLO]} />
              <View style={[stijlen.hoek, stijlen.hoekRO]} />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

// ============================================
// HOOFD-COMPONENT
// ============================================

/**
 * ProjectFotoUpload
 *
 * Volledig scherm voor het koppelen van foto's aan een project en
 * toevoegen aan de offline upload-wachtrij.
 *
 * @example
 * <ProjectFotoUpload
 *   projecten={projectenLijst}
 *   onUploadGestart={(id, aantal) => console.log(`${aantal} foto's in wachtrij voor ${id}`)}
 * />
 */
export function ProjectFotoUpload({
  projecten,
  initiaalProjectId,
  onUploadGestart,
}: ProjectFotoUploadProps) {
  const kleuren = useVeldKleuren();
  const [geselecteerdProject, setGeselecteerdProject] = useState<Project | null>(
    () => projecten.find((p) => p.id === initiaalProjectId) ?? null
  );
  const [categorie, setCategorie] = useState<FotoCategorie>('voor');
  const [fotos, setFotos] = useState<CapturedPhoto[]>([]);
  const [qrScannerZichtbaar, setQrScannerZichtbaar] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadVoortgang, setUploadVoortgang] = useState(0);

  const { addToQueue, pendingCount, isSyncing } = useOfflineQueue();

  // ----------------------------------------
  // QR scan callback
  // ----------------------------------------
  const handleQrScan = useCallback((gescandProjectId: string) => {
    const gevonden = projecten.find((p) => p.id === gescandProjectId);
    if (gevonden !== undefined) {
      setGeselecteerdProject(gevonden);
    } else {
      // Project niet in de lokale lijst — maak een tijdelijk object aan
      setGeselecteerdProject({
        id: gescandProjectId,
        naam: `Project ${gescandProjectId}`,
        klant: 'Onbekend',
        status: 'onbekend',
      });
      Alert.alert(
        'Project niet gevonden',
        `Project-ID "${gescandProjectId}" is gescand maar staat niet in de lijst. ` +
        'Het kan alsnog geselecteerd worden.',
        [{ text: 'OK' }]
      );
    }
  }, [projecten]);

  // ----------------------------------------
  // Upload
  // ----------------------------------------
  const handleUpload = useCallback(async () => {
    if (geselecteerdProject === null) {
      Alert.alert('Geen project geselecteerd', 'Selecteer eerst een project voordat je foto\'s uploadt.');
      return;
    }

    if (fotos.length === 0) {
      Alert.alert('Geen foto\'s', 'Voeg eerst foto\'s toe voordat je uploadt.');
      return;
    }

    setIsUploading(true);
    setUploadVoortgang(0);

    try {
      for (let i = 0; i < fotos.length; i++) {
        const foto = fotos[i];

        const payload: FotoMetCategorie = {
          ...foto,
          categorie,
          projectId: geselecteerdProject.id,
        };

        await addToQueue({
          type: 'foto',
          data: payload,
          createdAt: Date.now(),
        });

        setUploadVoortgang(Math.round(((i + 1) / fotos.length) * 100));
      }

      onUploadGestart?.(geselecteerdProject.id, fotos.length);

      Alert.alert(
        'Upload gestart',
        `${fotos.length} foto${fotos.length !== 1 ? '\'s zijn' : ' is'} toegevoegd aan de wachtrij en ` +
        'worden automatisch gesynchroniseerd zodra er een internetverbinding is.',
        [
          {
            text: 'OK',
            onPress: () => {
              setFotos([]);
              setUploadVoortgang(0);
            },
          },
        ]
      );
    } catch (err) {
      const bericht = err instanceof Error ? err.message : 'Upload mislukt.';
      Alert.alert('Fout bij uploaden', bericht);
    } finally {
      setIsUploading(false);
    }
  }, [geselecteerdProject, fotos, categorie, addToQueue, onUploadGestart]);

  const aantalFotos = fotos.length;
  const kanUploaden = geselecteerdProject !== null && aantalFotos > 0 && !isUploading;

  return (
    <View style={{ flex: 1, backgroundColor: kleuren.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 14 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Text accessibilityRole="header" style={[tekst.grootTitel, { color: kleuren.foreground }]}>Foto&apos;s uploaden</Text>

          {/* Sync-status indicator */}
          {(pendingCount > 0 || isSyncing) && (
            <View
              accessibilityLiveRegion="polite"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: isSyncing ? kleuren.infoSoft : kleuren.warningSoft, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 }}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={kleuren.info} />
              ) : (
                <Clock size={16} color={kleuren.warning} strokeWidth={2.25} />
              )}
              <Text style={[tekst.voetnoot, tekst.cijfers, { color: isSyncing ? kleuren.info : kleuren.warning, fontSize: 14, flex: 1 }]}>
                {isSyncing
                  ? 'Synchroniseren...'
                  : `${pendingCount} item${pendingCount !== 1 ? 's' : ''} in wachtrij`}
              </Text>
            </View>
          )}

          {/* === Sectie 1: Project-selectie === */}
          <View style={{ gap: 8 }}>
            <SectieKop
              titel="Project"
              rechts={
                <Drukvlak
                  onPress={() => setQrScannerZichtbaar(true)}
                  accessibilityLabel="QR-code scannen"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: kleuren.primarySoft }}
                >
                  <ScanQrCode size={16} color={kleuren.primary} strokeWidth={2.25} />
                  <Text style={[tekst.voetnoot, { color: kleuren.primary, fontWeight: '600', fontSize: 14 }]}>QR scannen</Text>
                </Drukvlak>
              }
            />
            <ProjectDropdown
              projecten={projecten}
              geselecteerd={geselecteerdProject}
              onSelecteer={setGeselecteerdProject}
            />
          </View>

          {/* === Sectie 2: Categorie === */}
          <View style={{ gap: 8 }}>
            <SectieKop titel="Categorie" />
            <CategorieSelector geselecteerd={categorie} onChange={setCategorie} />
          </View>

          {/* === Sectie 3: Foto's === */}
          <View style={{ gap: 8 }}>
            <SectieKop titel="Foto's" />
            <FotoGalerij
              maxFotos={20}
              fotos={fotos}
              onChange={setFotos}
            />
          </View>

          {/* === Upload-knop === */}
          <View style={{ gap: 10, marginTop: 8 }}>
            {/* Voortgangsbar */}
            {isUploading && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: kleuren.primarySoft, overflow: 'hidden' }}>
                  <View style={{ width: `${uploadVoortgang}%`, height: 6, borderRadius: 3, backgroundColor: kleuren.primary }} />
                </View>
                <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground, minWidth: 40, textAlign: 'right' }]}>{uploadVoortgang}%</Text>
              </View>
            )}

            <Drukvlak
              onPress={handleUpload}
              disabled={!kanUploaden}
              haptic="press"
              accessibilityLabel={isUploading ? 'Toevoegen aan wachtrij' : aantalFotos > 0 ? `${aantalFotos} foto${aantalFotos !== 1 ? '\'s' : ''} uploaden` : 'Upload foto\'s'}
              accessibilityState={{ busy: isUploading }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 52, borderRadius: 14, backgroundColor: kleuren.primary }}
            >
              {isUploading ? (
                <>
                  <ActivityIndicator size="small" color={kleuren.primaryForeground} />
                  <Text style={[tekst.kop, { color: kleuren.primaryForeground }]}>Toevoegen aan wachtrij...</Text>
                </>
              ) : (
                <>
                  <Upload size={20} color={kleuren.primaryForeground} strokeWidth={2.25} />
                  <Text style={[tekst.kop, tekst.cijfers, { color: kleuren.primaryForeground }]}>
                    {aantalFotos > 0
                      ? `${aantalFotos} foto${aantalFotos !== 1 ? '\'s' : ''} uploaden`
                      : 'Upload foto\'s'}
                  </Text>
                </>
              )}
            </Drukvlak>

            {geselecteerdProject === null && (
              <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, textAlign: 'center' }]}>
                Selecteer eerst een project
              </Text>
            )}
            {geselecteerdProject !== null && aantalFotos === 0 && (
              <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, textAlign: 'center' }]}>
                Voeg foto&apos;s toe via de galerij hierboven
              </Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* QR-scanner */}
      <QRScanner
        zichtbaar={qrScannerZichtbaar}
        onScan={handleQrScan}
        onSluit={() => setQrScannerZichtbaar(false)}
      />
    </View>
  );
}

export default ProjectFotoUpload;

// ============================================
// STIJLEN (camera-overlay; kleuren komen uit BEELD_OVERLAY)
// ============================================

const HOEK_GROOTTE = 24;
const HOEK_DIKTE = 3;

const stijlen = StyleSheet.create({
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 16,
    gap: 16,
  },

  // Doelkader voor QR — wit, want het ligt op een camerabeeld.
  scannerKader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 220,
    height: 220,
    marginTop: -110,
    marginLeft: -110,
  },
  hoek: {
    position: 'absolute',
    width: HOEK_GROOTTE,
    height: HOEK_GROOTTE,
    borderColor: BEELD_OVERLAY.tekst,
  },
  hoekLB: {
    top: 0,
    left: 0,
    borderTopWidth: HOEK_DIKTE,
    borderLeftWidth: HOEK_DIKTE,
    borderTopLeftRadius: 4,
  },
  hoekRB: {
    top: 0,
    right: 0,
    borderTopWidth: HOEK_DIKTE,
    borderRightWidth: HOEK_DIKTE,
    borderTopRightRadius: 4,
  },
  hoekLO: {
    bottom: 0,
    left: 0,
    borderBottomWidth: HOEK_DIKTE,
    borderLeftWidth: HOEK_DIKTE,
    borderBottomLeftRadius: 4,
  },
  hoekRO: {
    bottom: 0,
    right: 0,
    borderBottomWidth: HOEK_DIKTE,
    borderRightWidth: HOEK_DIKTE,
    borderBottomRightRadius: 4,
  },
});
