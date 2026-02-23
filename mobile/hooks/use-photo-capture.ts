/**
 * usePhotoCapture Hook — Top Tuinen Mobile App
 *
 * Hook voor het maken van foto's met GPS-geotagging.
 *
 * VEREISTE INSTALLATIES (nog niet in package.json):
 *   expo install expo-image-picker expo-location expo-image-manipulator
 *
 * Bestaande modules gebruikt:
 *   - @react-native-async-storage/async-storage (aanwezig)
 */

import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as ImageManipulator from 'expo-image-manipulator';

// ============================================
// TYPES
// ============================================

export type FotoType = 'situatie' | 'detail' | 'probleem' | 'overzicht';

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
  latitude?: number;
  longitude?: number;
  timestamp: number;
  type: FotoType;
  beschrijving?: string;
}

export interface UsePhotoCaptureReturn {
  takePhoto: (type: FotoType) => Promise<CapturedPhoto>;
  pickFromGallery: () => Promise<CapturedPhoto>;
  photos: CapturedPhoto[];
  removePhoto: (index: number) => void;
  clearPhotos: () => void;
  error: string | null;
}

// ============================================
// CONSTANTEN
// ============================================

/** Maximale breedte van gecomprimeerde foto in pixels */
const MAX_BREEDTE = 2048;

/** JPEG kwaliteit voor upload (0-1) */
const COMPRESSIE_KWALITEIT = 0.82;

// ============================================
// INTERNE HELPERS
// ============================================

/**
 * Vraagt camera-permissie aan de gebruiker.
 * Gooit een fout als de permissie geweigerd wordt.
 */
async function vraagCameraPermissie(): Promise<void> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error(
      'Camera-toegang is vereist om foto\'s te maken. ' +
      'Ga naar Instellingen → Top Tuinen → Camera en schakel toegang in.'
    );
  }
}

/**
 * Vraagt galerij-permissie aan de gebruiker.
 * Gooit een fout als de permissie geweigerd wordt.
 */
async function vraagGalerĳPermissie(): Promise<void> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error(
      'Toegang tot de fotobibliotheek is vereist. ' +
      'Ga naar Instellingen → Top Tuinen → Foto\'s en schakel toegang in.'
    );
  }
}

/**
 * Probeert de huidige GPS-locatie op te halen.
 * Retourneert null als de permissie geweigerd is of locatie niet beschikbaar.
 */
async function haalLocatieOp(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      // Locatie is optioneel — geen fout gooien
      return null;
    }

    const locatie = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: locatie.coords.latitude,
      longitude: locatie.coords.longitude,
    };
  } catch {
    // Locatie mislukken is niet fataal
    return null;
  }
}

/**
 * Comprimeert een afbeelding en schaalt deze naar maximaal MAX_BREEDTE pixels breed.
 * Retourneert het nieuwe URI en de afmetingen.
 */
async function comprimeerAfbeelding(
  uri: string,
  origineelBreedte: number
): Promise<{ uri: string; width: number; height: number }> {
  const schaalFactor = origineelBreedte > MAX_BREEDTE
    ? MAX_BREEDTE / origineelBreedte
    : 1;

  const acties: ImageManipulator.Action[] =
    schaalFactor < 1
      ? [{ resize: { width: Math.round(origineelBreedte * schaalFactor) } }]
      : [];

  const resultaat = await ImageManipulator.manipulateAsync(
    uri,
    acties,
    {
      compress: COMPRESSIE_KWALITEIT,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  return {
    uri: resultaat.uri,
    width: resultaat.width,
    height: resultaat.height,
  };
}

/**
 * Zet een ImagePicker asset om naar een CapturedPhoto.
 * Haalt locatie op en comprimeert de afbeelding.
 */
async function assetNaarCapturedPhoto(
  asset: ImagePicker.ImagePickerAsset,
  type: FotoType
): Promise<CapturedPhoto> {
  // Parallel: haal locatie op en comprimeer foto
  const [locatie, gecomprimeerd] = await Promise.all([
    haalLocatieOp(),
    comprimeerAfbeelding(asset.uri, asset.width),
  ]);

  const foto: CapturedPhoto = {
    uri: gecomprimeerd.uri,
    width: gecomprimeerd.width,
    height: gecomprimeerd.height,
    timestamp: Date.now(),
    type,
  };

  if (locatie !== null) {
    foto.latitude = locatie.latitude;
    foto.longitude = locatie.longitude;
  }

  return foto;
}

// ============================================
// HOOK
// ============================================

/**
 * usePhotoCapture
 *
 * Hook voor het vastleggen van foto's via camera of galerij,
 * met automatische GPS-geotagging en compressie.
 *
 * @example
 * const { takePhoto, photos, removePhoto } = usePhotoCapture();
 * const foto = await takePhoto('situatie');
 */
export function usePhotoCapture(): UsePhotoCaptureReturn {
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const takePhoto = useCallback(async (type: FotoType): Promise<CapturedPhoto> => {
    setError(null);

    try {
      await vraagCameraPermissie();

      const resultaat = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 1, // We comprimeren zelf achteraf
        exif: false,
      });

      if (resultaat.canceled || resultaat.assets.length === 0) {
        throw new Error('Foto maken geannuleerd.');
      }

      const asset = resultaat.assets[0];
      const foto = await assetNaarCapturedPhoto(asset, type);

      setPhotos((vorige) => [...vorige, foto]);
      return foto;
    } catch (err) {
      const bericht = err instanceof Error ? err.message : 'Onbekende fout bij foto maken.';
      setError(bericht);
      throw err;
    }
  }, []);

  const pickFromGallery = useCallback(async (): Promise<CapturedPhoto> => {
    setError(null);

    try {
      await vraagGalerĳPermissie();

      const resultaat = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 1,
        allowsMultipleSelection: false,
        exif: false,
      });

      if (resultaat.canceled || resultaat.assets.length === 0) {
        throw new Error('Foto kiezen geannuleerd.');
      }

      const asset = resultaat.assets[0];
      // Galerij-foto's krijgen type 'situatie' als standaard;
      // de aanroepende code kan het type achteraf aanpassen.
      const foto = await assetNaarCapturedPhoto(asset, 'situatie');

      setPhotos((vorige) => [...vorige, foto]);
      return foto;
    } catch (err) {
      const bericht = err instanceof Error ? err.message : 'Onbekende fout bij kiezen foto.';
      setError(bericht);
      throw err;
    }
  }, []);

  const removePhoto = useCallback((index: number): void => {
    setPhotos((vorige) => vorige.filter((_, i) => i !== index));
  }, []);

  const clearPhotos = useCallback((): void => {
    setPhotos([]);
    setError(null);
  }, []);

  return {
    takePhoto,
    pickFromGallery,
    photos,
    removePhoto,
    clearPhotos,
    error,
  };
}

export default usePhotoCapture;
