/**
 * POST /api/transcribe
 *
 * Ontvangt een audio bestand via multipart/form-data en transcribeert dit
 * naar tekst via de OpenAI Whisper API.
 *
 * Vereiste environment variabele: OPENAI_API_KEY
 *
 * Request: multipart/form-data met veld "audio" (audio bestand, max 25MB)
 * Response: { text: string, duration: number }
 */

import { NextRequest, NextResponse } from 'next/server';

const OPENAI_WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

interface WhisperResponse {
  text: string;
  duration?: number;
}

interface ErrorResponse {
  error: string;
}

interface SuccessResponse {
  text: string;
  duration: number;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  // Controleer of de request multipart is
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'Verzoek moet multipart/form-data zijn met een audio bestand' },
      { status: 400 }
    );
  }

  // Verwerk de multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Kon form data niet verwerken. Controleer het formaat van het verzoek.' },
      { status: 400 }
    );
  }

  // Haal het audio bestand op
  const rawAudioField = formData.get('audio');

  // Controleer of het een Blob of File is
  if (!(rawAudioField instanceof Blob)) {
    return NextResponse.json(
      { error: 'Geen audio bestand gevonden. Stuur het bestand als "audio" veld.' },
      { status: 400 }
    );
  }

  // Nu is rawAudioField gegarandeerd een Blob (of File, dat extends Blob)
  const audioFile: Blob = rawAudioField;

  // Controleer bestandsgrootte
  if (audioFile.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (audioFile.size / (1024 * 1024)).toFixed(1);
    return NextResponse.json(
      { error: `Audio bestand te groot: ${sizeMB}MB. Maximum is 25MB.` },
      { status: 413 }
    );
  }

  // Controleer of er een bestand is
  if (audioFile.size === 0) {
    return NextResponse.json(
      { error: 'Audio bestand is leeg.' },
      { status: 400 }
    );
  }

  // Controleer of de OpenAI API key beschikbaar is
  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey) {
    console.warn('[transcribe] OPENAI_API_KEY niet geconfigureerd — placeholder tekst teruggeven');

    // Retourneer placeholder tekst voor development
    return NextResponse.json({
      text: '[PLACEHOLDER] Dit is een testtranscript omdat OPENAI_API_KEY niet is ingesteld. Stel de OPENAI_API_KEY environment variabele in om echte transcriptie te activeren.',
      duration: 0,
    });
  }

  // Bepaal de bestandsnaam — File extends Blob en heeft een .name property
  const fileName =
    rawAudioField instanceof File
      ? rawAudioField.name
      : `audio.${getExtensionFromMimeType(audioFile.type)}`;

  // Bouw de FormData op voor Whisper
  const whisperFormData = new FormData();
  whisperFormData.append('file', audioFile, fileName);
  whisperFormData.append('model', 'whisper-1');
  whisperFormData.append('language', 'nl'); // Nederlands als standaard
  whisperFormData.append('response_format', 'verbose_json'); // Voor duur metadata

  // Stuur naar OpenAI Whisper
  let whisperResponse: Response;
  try {
    whisperResponse = await fetch(OPENAI_WHISPER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAIKey}`,
      },
      body: whisperFormData,
    });
  } catch (err) {
    console.error('[transcribe] Netwerk fout bij Whisper API:', err);
    return NextResponse.json(
      { error: 'Kon geen verbinding maken met de transcriptie service. Controleer de internetverbinding.' },
      { status: 503 }
    );
  }

  // Verwerk Whisper response
  if (!whisperResponse.ok) {
    let errorDetail = `HTTP ${whisperResponse.status}`;
    try {
      const errorData = (await whisperResponse.json()) as { error?: { message?: string } };
      errorDetail = errorData.error?.message ?? errorDetail;
    } catch {
      // JSON parsing mislukt
    }

    console.error('[transcribe] Whisper API fout:', errorDetail);

    if (whisperResponse.status === 401) {
      return NextResponse.json(
        { error: 'Ongeldige OpenAI API key. Controleer de OPENAI_API_KEY instelling.' },
        { status: 502 }
      );
    }

    if (whisperResponse.status === 429) {
      return NextResponse.json(
        { error: 'Te veel verzoeken aan de transcriptie service. Probeer het later opnieuw.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `Transcriptie service fout: ${errorDetail}` },
      { status: 502 }
    );
  }

  let whisperData: WhisperResponse;
  try {
    whisperData = (await whisperResponse.json()) as WhisperResponse;
  } catch {
    return NextResponse.json(
      { error: 'Ongeldige response van de transcriptie service.' },
      { status: 502 }
    );
  }

  if (!whisperData.text) {
    return NextResponse.json(
      { error: 'Geen tekst ontvangen van de transcriptie service.' },
      { status: 502 }
    );
  }

  return NextResponse.json({
    text: whisperData.text,
    duration: whisperData.duration ?? 0,
  });
}

/**
 * Bepaal de bestandsextensie op basis van het MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'audio/m4a': 'm4a',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
  };
  return mimeMap[mimeType] ?? 'm4a';
}
