/**
 * POST /api/summarize
 *
 * Ontvangt een transcript en retourneert gestructureerde offerte-data
 * via de Anthropic Claude API.
 *
 * Vereiste environment variabele: ANTHROPIC_API_KEY
 *
 * Request: { transcript: string }
 * Response: SummaryResult (zie interface hieronder)
 */

import { NextRequest, NextResponse } from 'next/server';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-opus-4-6';

interface SummaryResult {
  klantWensen: string[];
  geschatteOppervlakte?: number;
  suggestedScopes: string[];
  bijzonderheden: string[];
  samenvatting: string;
}

interface ErrorResponse {
  error: string;
}

interface AnthropicContent {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content: AnthropicContent[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

const SYSTEM_PROMPT = `Je bent een assistent voor een hoveniersbedrijf genaamd Top Tuinen.
Analyseer dit gesprekstranscript tussen een medewerker en een klant en extraheer de volgende informatie.

Antwoord ALTIJD in geldig JSON formaat met exact deze structuur:
{
  "klantWensen": ["wens 1", "wens 2"],
  "geschatteOppervlakte": 150,
  "suggestedScopes": ["scope 1", "scope 2"],
  "bijzonderheden": ["bijzonderheid 1"],
  "samenvatting": "Korte samenvatting van het gesprek"
}

Richtlijnen:
- klantWensen: Concrete wensen van de klant (beplanting, bestrating, verlichting, etc.)
- geschatteOppervlakte: Geschatte oppervlakte in m² als getal (weglaten als niet vermeld)
- suggestedScopes: Aanbevolen werkzaamheden/scopes voor de offerte (bijv. "Tuinaanleg", "Bestrating", "Beplanting", "Verlichting", "Vijver", "Schutting")
- bijzonderheden: Speciale aandachtspunten, allergieën, huisdieren, budget beperkingen, toegangsproblemen, etc.
- samenvatting: Maximaal 3 zinnen die het gesprek samenvatten voor de offerte medewerker

Antwoord uitsluitend met het JSON object, geen extra tekst.`;

export async function POST(
  request: NextRequest
): Promise<NextResponse<SummaryResult | ErrorResponse>> {
  // Verwerk request body
  let body: { transcript?: string };
  try {
    body = (await request.json()) as { transcript?: string };
  } catch {
    return NextResponse.json(
      { error: 'Ongeldige JSON in het verzoek.' },
      { status: 400 }
    );
  }

  const { transcript } = body;

  if (!transcript || typeof transcript !== 'string') {
    return NextResponse.json(
      { error: 'Geen transcript gevonden. Stuur een "transcript" veld in het verzoek.' },
      { status: 400 }
    );
  }

  if (transcript.trim().length === 0) {
    return NextResponse.json(
      { error: 'Transcript is leeg.' },
      { status: 400 }
    );
  }

  if (transcript.length > 50000) {
    return NextResponse.json(
      { error: 'Transcript te lang. Maximum is 50.000 tekens.' },
      { status: 413 }
    );
  }

  // Controleer of de Anthropic API key beschikbaar is
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.warn('[summarize] ANTHROPIC_API_KEY niet geconfigureerd — placeholder data teruggeven');

    // Retourneer placeholder data voor development
    const placeholder: SummaryResult = {
      klantWensen: [
        '[PLACEHOLDER] Nieuwe bestrating voor de achtertuin',
        '[PLACEHOLDER] Lage onderhoudsbeplanting',
        '[PLACEHOLDER] Verlichting langs het pad',
      ],
      geschatteOppervlakte: 80,
      suggestedScopes: ['Bestrating', 'Beplanting', 'Verlichting'],
      bijzonderheden: [
        '[PLACEHOLDER] ANTHROPIC_API_KEY niet ingesteld — dit zijn testgegevens',
        'Stel de ANTHROPIC_API_KEY environment variabele in voor echte samenvatting',
      ],
      samenvatting:
        '[PLACEHOLDER] Dit is een testsamenvatting. Stel de ANTHROPIC_API_KEY in om echte samenvattingen te genereren op basis van het klantgesprek.',
    };

    return NextResponse.json(placeholder);
  }

  // Stuur transcript naar Claude voor analyse
  const userMessage = `Hier is het gesprekstranscript om te analyseren:\n\n${transcript}`;

  let anthropicResponse: Response;
  try {
    anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userMessage,
          },
        ],
      }),
    });
  } catch (err) {
    console.error('[summarize] Netwerk fout bij Anthropic API:', err);
    return NextResponse.json(
      { error: 'Kon geen verbinding maken met de samenvatting service. Controleer de internetverbinding.' },
      { status: 503 }
    );
  }

  // Verwerk Anthropic response
  if (!anthropicResponse.ok) {
    let errorDetail = `HTTP ${anthropicResponse.status}`;
    try {
      const errorData = (await anthropicResponse.json()) as { error?: { message?: string } };
      errorDetail = errorData.error?.message ?? errorDetail;
    } catch {
      // JSON parsing mislukt
    }

    console.error('[summarize] Anthropic API fout:', errorDetail);

    if (anthropicResponse.status === 401) {
      return NextResponse.json(
        { error: 'Ongeldige Anthropic API key. Controleer de ANTHROPIC_API_KEY instelling.' },
        { status: 502 }
      );
    }

    if (anthropicResponse.status === 429) {
      return NextResponse.json(
        { error: 'Te veel verzoeken aan de samenvatting service. Probeer het later opnieuw.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `Samenvatting service fout: ${errorDetail}` },
      { status: 502 }
    );
  }

  let anthropicData: AnthropicResponse;
  try {
    anthropicData = (await anthropicResponse.json()) as AnthropicResponse;
  } catch {
    return NextResponse.json(
      { error: 'Ongeldige response van de samenvatting service.' },
      { status: 502 }
    );
  }

  // Haal de tekst uit de Claude response
  const textContent = anthropicData.content.find((c) => c.type === 'text');
  if (!textContent?.text) {
    return NextResponse.json(
      { error: 'Geen tekst ontvangen van de samenvatting service.' },
      { status: 502 }
    );
  }

  // Verwerk de JSON response van Claude
  let summaryResult: SummaryResult;
  try {
    // Claude geeft soms JSON terug met markdown code blocks — verwijder deze
    const cleanedText = textContent.text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    summaryResult = JSON.parse(cleanedText) as SummaryResult;
  } catch {
    console.error('[summarize] JSON parsing fout in Claude response:', textContent.text);
    return NextResponse.json(
      { error: 'Kon de samenvatting niet verwerken. De AI gaf een onverwacht formaat terug.' },
      { status: 502 }
    );
  }

  // Valideer en normaliseer de response
  const validated: SummaryResult = {
    klantWensen: Array.isArray(summaryResult.klantWensen) ? summaryResult.klantWensen : [],
    geschatteOppervlakte:
      typeof summaryResult.geschatteOppervlakte === 'number' &&
      summaryResult.geschatteOppervlakte > 0
        ? summaryResult.geschatteOppervlakte
        : undefined,
    suggestedScopes: Array.isArray(summaryResult.suggestedScopes)
      ? summaryResult.suggestedScopes
      : [],
    bijzonderheden: Array.isArray(summaryResult.bijzonderheden)
      ? summaryResult.bijzonderheden
      : [],
    samenvatting:
      typeof summaryResult.samenvatting === 'string'
        ? summaryResult.samenvatting
        : 'Geen samenvatting beschikbaar.',
  };

  return NextResponse.json(validated);
}
