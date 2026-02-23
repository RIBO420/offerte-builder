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

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { FotoGalerij } from './FotoGalerij';
import { useOfflineQueue } from '@/hooks/use-offline-queue';
import type { CapturedPhoto, FotoType } from '@/hooks/use-photo-capture';

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

const { width: SCHERM_BREEDTE } = Dimensions.get('window');

const CATEGORIE_CONFIG: Record<FotoCategorie, { label: string; kleur: string; icoon: string; beschrijving: string }> = {
  voor:     { label: 'Voor werkzaamheden', kleur: '#3b82f6', icoon: 'arrow-right-circle', beschrijving: 'Situatie vóór de aanleg' },
  na:       { label: 'Na werkzaamheden',   kleur: '#10b981', icoon: 'check-circle',        beschrijving: 'Resultaat na voltooiing' },
  probleem: { label: 'Probleem gemeld',    kleur: '#ef4444', icoon: 'alert-triangle',       beschrijving: 'Probleem of afwijking' },
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

const CategorieSelector = React.memo(({ geselecteerd, onChange }: CategorieSelectorProps) => (
  <View style={stijlen.categorieContainer}>
    {(Object.entries(CATEGORIE_CONFIG) as [FotoCategorie, typeof CATEGORIE_CONFIG[FotoCategorie]][]).map(
      ([cat, config]) => {
        const actief = geselecteerd === cat;
        return (
          <TouchableOpacity
            key={cat}
            style={[
              stijlen.categorieKnop,
              actief && { borderColor: config.kleur, backgroundColor: config.kleur + '18' },
            ]}
            onPress={() => onChange(cat)}
            activeOpacity={0.7}
          >
            <Feather
              name={config.icoon as 'check-circle'}
              size={20}
              color={actief ? config.kleur : '#6b7280'}
            />
            <Text
              style={[
                stijlen.categorieKnopLabel,
                actief && { color: config.kleur, fontWeight: '700' },
              ]}
            >
              {config.label}
            </Text>
            <Text style={stijlen.categorieKnopOndertitel}>{config.beschrijving}</Text>
          </TouchableOpacity>
        );
      }
    )}
  </View>
));
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
      <TouchableOpacity
        style={stijlen.dropdownKnop}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <View style={stijlen.dropdownKnopInhoud}>
          <Feather name="folder" size={18} color={geselecteerd !== null ? '#3b82f6' : '#6b7280'} />
          <Text
            style={[
              stijlen.dropdownKnopTekst,
              geselecteerd !== null && { color: '#f9fafb', fontWeight: '600' },
            ]}
            numberOfLines={1}
          >
            {geselecteerd !== null ? geselecteerd.naam : 'Selecteer een project...'}
          </Text>
        </View>
        <Feather name="chevron-down" size={18} color="#6b7280" />
      </TouchableOpacity>

      {geselecteerd !== null && (
        <Text style={stijlen.geselecteerdKlant}>{geselecteerd.klant}</Text>
      )}

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={stijlen.dropdownModal} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={stijlen.dropdownModalHeader}>
            <Text style={stijlen.dropdownModalTitel}>Selecteer project</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Feather name="x" size={22} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Zoekbalk */}
          <View style={stijlen.zoekContainer}>
            <Feather name="search" size={16} color="#6b7280" />
            <TextInput
              style={stijlen.zoekInput}
              value={zoekterm}
              onChangeText={setZoekterm}
              placeholder="Zoek op naam of klant..."
              placeholderTextColor="#6b7280"
              autoFocus
            />
            {zoekterm.length > 0 && (
              <TouchableOpacity onPress={() => setZoekterm('')}>
                <Feather name="x-circle" size={16} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>

          {/* Projecten-lijst */}
          <ScrollView style={stijlen.dropdownLijst}>
            {gefilterd.length === 0 ? (
              <View style={stijlen.dropdownLeeg}>
                <Text style={stijlen.dropdownLeegTekst}>Geen projecten gevonden</Text>
              </View>
            ) : (
              gefilterd.map((project) => {
                const actief = geselecteerd?.id === project.id;
                return (
                  <TouchableOpacity
                    key={project.id}
                    style={[
                      stijlen.dropdownItem,
                      actief && stijlen.dropdownItemActief,
                    ]}
                    onPress={() => {
                      onSelecteer(project);
                      setOpen(false);
                      setZoekterm('');
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={stijlen.dropdownItemInfo}>
                      <Text
                        style={[
                          stijlen.dropdownItemNaam,
                          actief && { color: '#3b82f6' },
                        ]}
                        numberOfLines={1}
                      >
                        {project.naam}
                      </Text>
                      <Text style={stijlen.dropdownItemKlant}>{project.klant}</Text>
                    </View>
                    <View style={[stijlen.statusDot, { backgroundColor: project.status === 'actief' ? '#10b981' : '#6b7280' }]} />
                    {actief && <Feather name="check" size={16} color="#3b82f6" />}
                  </TouchableOpacity>
                );
              })
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
      <View style={stijlen.scannerContainer}>
        {permissie === null || !permissie.granted ? (
          <SafeAreaView style={stijlen.scannerPermissie} edges={['top', 'bottom']}>
            <Feather name="camera-off" size={48} color="#6b7280" />
            <Text style={stijlen.scannerPermissieTekst}>
              Camera-toegang is vereist voor het scannen van QR-codes.
            </Text>
            <TouchableOpacity
              style={stijlen.permissieKnop}
              onPress={vraagPermissie}
            >
              <Text style={stijlen.permissieKnopTekst}>Toegang verlenen</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSluit} style={{ marginTop: 12 }}>
              <Text style={{ color: '#6b7280', fontSize: 15 }}>Annuleren</Text>
            </TouchableOpacity>
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
              <TouchableOpacity style={stijlen.scannerSluitKnop} onPress={onSluit}>
                <Feather name="x" size={22} color="#ffffff" />
              </TouchableOpacity>
              <Text style={stijlen.scannerInstructie}>
                Richt de camera op het QR-code van het project
              </Text>
            </SafeAreaView>

            {/* Doelkader */}
            <View style={stijlen.scannerKader}>
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
    <View style={stijlen.scherm}>
      <SafeAreaView style={stijlen.safeArea} edges={['top']}>
        <ScrollView
          style={stijlen.scrollView}
          contentContainerStyle={stijlen.scrollInhoud}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={stijlen.schermHeader}>
            <Feather name="upload-cloud" size={24} color="#3b82f6" />
            <Text style={stijlen.schermTitel}>Foto's uploaden</Text>
          </View>

          {/* Sync-status indicator */}
          {(pendingCount > 0 || isSyncing) && (
            <View style={stijlen.syncIndicator}>
              {isSyncing ? (
                <ActivityIndicator size="small" color="#3b82f6" />
              ) : (
                <Feather name="clock" size={14} color="#f59e0b" />
              )}
              <Text style={stijlen.syncIndicatorTekst}>
                {isSyncing
                  ? 'Synchroniseren...'
                  : `${pendingCount} item${pendingCount !== 1 ? 's' : ''} in wachtrij`}
              </Text>
            </View>
          )}

          {/* === Sectie 1: Project-selectie === */}
          <View style={stijlen.sectie}>
            <View style={stijlen.sectieHeaderRij}>
              <Text style={stijlen.sectieLabel}>Project</Text>
              <TouchableOpacity
                style={stijlen.qrKnop}
                onPress={() => setQrScannerZichtbaar(true)}
                activeOpacity={0.7}
              >
                <Feather name="maximize" size={14} color="#3b82f6" />
                <Text style={stijlen.qrKnopTekst}>QR scannen</Text>
              </TouchableOpacity>
            </View>

            <ProjectDropdown
              projecten={projecten}
              geselecteerd={geselecteerdProject}
              onSelecteer={setGeselecteerdProject}
            />
          </View>

          {/* === Sectie 2: Categorie === */}
          <View style={stijlen.sectie}>
            <Text style={stijlen.sectieLabel}>Categorie</Text>
            <CategorieSelector geselecteerd={categorie} onChange={setCategorie} />
          </View>

          {/* === Sectie 3: Foto's === */}
          <View style={stijlen.sectie}>
            <Text style={stijlen.sectieLabel}>Foto's</Text>
            <FotoGalerij
              maxFotos={20}
              fotos={fotos}
              onChange={setFotos}
            />
          </View>

          {/* === Upload-knop === */}
          <View style={stijlen.uploadKnopContainer}>
            {/* Voortgangsbar */}
            {isUploading && (
              <View style={stijlen.voortgangContainer}>
                <View style={stijlen.voortgangBalk}>
                  <View
                    style={[
                      stijlen.voortgangVulling,
                      { width: `${uploadVoortgang}%` },
                    ]}
                  />
                </View>
                <Text style={stijlen.voortgangTekst}>{uploadVoortgang}%</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                stijlen.uploadKnop,
                !kanUploaden && stijlen.uploadKnopDisabled,
              ]}
              onPress={handleUpload}
              disabled={!kanUploaden}
              activeOpacity={0.85}
            >
              {isUploading ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={stijlen.uploadKnopTekst}>Toevoegen aan wachtrij...</Text>
                </>
              ) : (
                <>
                  <Feather name="upload" size={20} color="#ffffff" />
                  <Text style={stijlen.uploadKnopTekst}>
                    {aantalFotos > 0
                      ? `${aantalFotos} foto${aantalFotos !== 1 ? '\'s' : ''} uploaden`
                      : 'Upload foto\'s'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {geselecteerdProject === null && (
              <Text style={stijlen.uploadHintTekst}>
                Selecteer eerst een project
              </Text>
            )}
            {geselecteerdProject !== null && aantalFotos === 0 && (
              <Text style={stijlen.uploadHintTekst}>
                Voeg foto's toe via de galerij hierboven
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
// STIJLEN
// ============================================

const HOEK_GROOTTE = 24;
const HOEK_DIKTE = 3;

const stijlen = StyleSheet.create({
  scherm: {
    flex: 1,
    backgroundColor: '#111827',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollInhoud: {
    padding: 16,
    paddingBottom: 40,
  },

  // Header
  schermHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  schermTitel: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f9fafb',
  },

  // Sync-indicator
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  syncIndicatorTekst: {
    fontSize: 13,
    color: '#9ca3af',
  },

  // Secties
  sectie: {
    marginBottom: 24,
  },
  sectieHeaderRij: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectieLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // QR-knop
  qrKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#1e3a5f',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  qrKnopTekst: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },

  // Dropdown
  dropdownKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dropdownKnopInhoud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dropdownKnopTekst: {
    fontSize: 15,
    color: '#6b7280',
    flex: 1,
  },
  geselecteerdKlant: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 5,
    marginLeft: 4,
  },
  dropdownModal: {
    flex: 1,
    backgroundColor: '#111827',
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  dropdownModalTitel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f9fafb',
  },
  zoekContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
  },
  zoekInput: {
    flex: 1,
    fontSize: 15,
    color: '#f9fafb',
  },
  dropdownLijst: {
    flex: 1,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  dropdownItemActief: {
    backgroundColor: '#1e3a5f',
  },
  dropdownItemInfo: {
    flex: 1,
  },
  dropdownItemNaam: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f9fafb',
  },
  dropdownItemKlant: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dropdownLeeg: {
    padding: 32,
    alignItems: 'center',
  },
  dropdownLeegTekst: {
    fontSize: 15,
    color: '#6b7280',
  },

  // Categorie-selector
  categorieContainer: {
    gap: 8,
  },
  categorieKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    borderWidth: 1.5,
    borderColor: '#374151',
  },
  categorieKnopLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d5db',
    flex: 1,
  },
  categorieKnopOndertitel: {
    fontSize: 12,
    color: '#6b7280',
  },

  // Upload-knop
  uploadKnopContainer: {
    gap: 10,
    marginTop: 8,
  },
  voortgangContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voortgangBalk: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1f2937',
    overflow: 'hidden',
  },
  voortgangVulling: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  voortgangTekst: {
    fontSize: 12,
    color: '#6b7280',
    width: 36,
    textAlign: 'right',
  },
  uploadKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 16,
  },
  uploadKnopDisabled: {
    opacity: 0.45,
  },
  uploadKnopTekst: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  uploadHintTekst: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },

  // QR-scanner
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scannerPermissie: {
    flex: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  scannerPermissieTekst: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
  },
  permissieKnop: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permissieKnopTekst: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 16,
    gap: 16,
  },
  scannerSluitKnop: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    padding: 8,
  },
  scannerInstructie: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  // Doelkader voor QR
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
    borderColor: '#3b82f6',
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
