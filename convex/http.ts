import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// Allowed origin for CORS — read from env var, fallback to Top Tuinen domain
function getAllowedOrigin(): string {
  return process.env.ALLOWED_ORIGIN || "https://www.toptuinen.nl";
}

// Simple email format validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone format validation: international or Dutch format, digits/spaces/dashes/parens/plus
const PHONE_REGEX = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;

// Dutch postcode validation: 4 digits + 2 letters, optional space
const POSTCODE_REGEX = /^\d{4}\s?[A-Za-z]{2}$/;

// Slug → display label mappings (website stuurt slugs, we slaan labels op)
const TUINOPPERVLAK_MAP: Record<string, string> = {
  "kleiner-dan-50": "Kleiner dan 50 m²",
  "50-150": "50 – 150 m²",
  "150-300": "150 – 300 m²",
  "groter-dan-300": "Groter dan 300 m²",
  "weet-ik-niet": "Weet ik niet",
  // Accepteer ook display labels direct
  "Kleiner dan 50 m²": "Kleiner dan 50 m²",
  "50 – 150 m²": "50 – 150 m²",
  "150 – 300 m²": "150 – 300 m²",
  "Groter dan 300 m²": "Groter dan 300 m²",
  "Weet ik niet": "Weet ik niet",
};
const HEEFT_ONTWERP_MAP: Record<string, string> = {
  ja: "Ja", nee: "Nee", "weet-ik-niet": "Weet ik niet",
  Ja: "Ja", Nee: "Nee",
};
const ONDERHOUD_FREQUENTIE_MAP: Record<string, string> = {
  eenmalig: "Eenmalig", maandelijks: "Maandelijks",
  seizoensgebonden: "Seizoensgebonden", "weet-ik-niet": "Weet ik niet",
  Eenmalig: "Eenmalig", Maandelijks: "Maandelijks",
  Seizoensgebonden: "Seizoensgebonden",
};
const REINIGING_OPTIES_MAP: Record<string, string> = {
  terras: "Terras", oprit: "Oprit", gevels: "Gevels", anders: "Anders",
  Terras: "Terras", Oprit: "Oprit", Gevels: "Gevels", Anders: "Anders",
};
const HOE_GEVONDEN_MAP: Record<string, string> = {
  google: "Google", "social-media": "Social media",
  "via-via": "Via via / mond-tot-mond", anders: "Anders",
  Google: "Google", "Social media": "Social media",
  "Via via / mond-tot-mond": "Via via / mond-tot-mond", Anders: "Anders",
};
const GELDIGE_ONDERWERPEN = ["tuinonderhoud", "tuinaanleg", "reiniging"];

/**
 * POST /contact-lead
 *
 * Ontvang contactformulier submissions van de Top Tuinen website
 * en maak een lead aan in de pipeline.
 *
 * Beveiligd met een shared secret via de Authorization header.
 */
http.route({
  path: "/contact-lead",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const allowedOrigin = getAllowedOrigin();

    // CORS headers voor cross-origin requests vanuit de website
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Valideer shared secret
    const authHeader = request.headers.get("Authorization");
    const expectedSecret = process.env.WEBSITE_WEBHOOK_SECRET;

    if (!expectedSecret) {
      console.error("WEBSITE_WEBHOOK_SECRET is niet geconfigureerd in Convex");
      return new Response(
        JSON.stringify({ error: "Server configuratiefout" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (authHeader !== `Bearer ${expectedSecret}`) {
      return new Response(
        JSON.stringify({ error: "Niet geautoriseerd" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    try {
      const body = await request.json();

      // Valideer verplichte velden
      if (!body.name || !body.email || !body.subject) {
        return new Response(
          JSON.stringify({ error: "Verplichte velden ontbreken (name, email, subject)" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Valideer email format
      const email = String(body.email).trim();
      if (!EMAIL_REGEX.test(email)) {
        return new Response(
          JSON.stringify({ error: "Ongeldig e-mailadres formaat" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Valideer telefoon format (optioneel veld, maar als opgegeven moet het geldig zijn)
      let phone: string | undefined;
      if (body.phone) {
        phone = String(body.phone).trim();
        if (!PHONE_REGEX.test(phone)) {
          return new Response(
            JSON.stringify({ error: "Ongeldig telefoonnummer formaat" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }

      // Valideer postcode (optioneel, maar als opgegeven moet het NL format zijn)
      let postcode: string | undefined;
      if (body.postcode) {
        postcode = String(body.postcode).trim();
        if (!POSTCODE_REGEX.test(postcode)) {
          return new Response(
            JSON.stringify({ error: "Ongeldig postcode formaat (verwacht: 1234 AB)" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }

      // Valideer onderwerp tegen geldige waarden
      const onderwerp = String(body.subject);
      if (!GELDIGE_ONDERWERPEN.includes(onderwerp)) {
        return new Response(
          JSON.stringify({ error: `Ongeldig onderwerp. Geldige waarden: ${GELDIGE_ONDERWERPEN.join(", ")}` }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Valideer en map optionele velden (slug → display label)
      let tuinoppervlak: string | undefined;
      if (body.tuinoppervlak) {
        tuinoppervlak = TUINOPPERVLAK_MAP[String(body.tuinoppervlak)];
        if (!tuinoppervlak) {
          return new Response(
            JSON.stringify({ error: "Ongeldige tuinoppervlak waarde" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }

      let heeftOntwerp: string | undefined;
      if (body.heeftOntwerp) {
        heeftOntwerp = HEEFT_ONTWERP_MAP[String(body.heeftOntwerp)];
        if (!heeftOntwerp) {
          return new Response(
            JSON.stringify({ error: "Ongeldige heeftOntwerp waarde" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }

      let onderhoudFrequentie: string | undefined;
      if (body.onderhoudFrequentie) {
        onderhoudFrequentie = ONDERHOUD_FREQUENTIE_MAP[String(body.onderhoudFrequentie)];
        if (!onderhoudFrequentie) {
          return new Response(
            JSON.stringify({ error: "Ongeldige onderhoudFrequentie waarde" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }

      let reinigingOpties: string[] | undefined;
      if (body.reinigingOpties && Array.isArray(body.reinigingOpties)) {
        const mapped = (body.reinigingOpties as unknown[]).map((o) => REINIGING_OPTIES_MAP[String(o)]);
        const ongeldig = mapped.findIndex((m) => !m);
        if (ongeldig !== -1) {
          return new Response(
            JSON.stringify({ error: `Ongeldige reinigingsoptie: ${body.reinigingOpties[ongeldig]}` }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        reinigingOpties = mapped as string[];
      }

      let hoeGevonden: string | undefined;
      if (body.hoeGevonden) {
        hoeGevonden = HOE_GEVONDEN_MAP[String(body.hoeGevonden)];
        if (!hoeGevonden) {
          return new Response(
            JSON.stringify({ error: "Ongeldige hoeGevonden waarde" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }

      // Maak lead aan via interne mutation
      const result = await ctx.runMutation(
        internal.configuratorAanvragen.createFromWebsite,
        {
          klantNaam: String(body.name),
          klantEmail: email,
          klantTelefoon: phone,
          onderwerp,
          bericht: body.message ? String(body.message) : "",
          aantalFotos: body.attachmentCount ? Number(body.attachmentCount) : undefined,
          fotoIds: Array.isArray(body.fotoIds) ? body.fotoIds : undefined,
          postcode,
          huisnummer: body.huisnummer ? String(body.huisnummer).trim() : undefined,
          plaats: body.plaats ? String(body.plaats).trim() : undefined,
          tuinoppervlak,
          heeftOntwerp,
          onderhoudFrequentie,
          reinigingOpties,
          hoeGevonden,
        }
      );

      return new Response(
        JSON.stringify({ success: true, referentie: result.referentie }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (error) {
      console.error("Fout bij aanmaken website lead:", error);
      return new Response(
        JSON.stringify({ error: "Interne serverfout" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// CORS preflight handler
http.route({
  path: "/contact-lead",
  method: "OPTIONS",
  handler: httpAction(async () => {
    const allowedOrigin = getAllowedOrigin();

    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }),
});

/**
 * POST /generate-upload-url
 *
 * Genereert een Convex Storage upload URL voor de website.
 * Beveiligd met hetzelfde shared secret als /contact-lead.
 */
http.route({
  path: "/generate-upload-url",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const allowedOrigin = getAllowedOrigin();
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Valideer shared secret
    const authHeader = request.headers.get("Authorization");
    const expectedSecret = process.env.WEBSITE_WEBHOOK_SECRET;

    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return new Response(
        JSON.stringify({ error: "Niet geautoriseerd" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    try {
      const uploadUrl = await ctx.storage.generateUploadUrl();
      return new Response(
        JSON.stringify({ uploadUrl }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (error) {
      console.error("Fout bij genereren upload URL:", error);
      return new Response(
        JSON.stringify({ error: "Interne serverfout" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// CORS preflight handler voor /generate-upload-url
http.route({
  path: "/generate-upload-url",
  method: "OPTIONS",
  handler: httpAction(async () => {
    const allowedOrigin = getAllowedOrigin();
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }),
});

export default http;
