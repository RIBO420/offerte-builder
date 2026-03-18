import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

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
    // CORS headers voor cross-origin requests vanuit de website
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
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
      if (!body.name || !body.email || !body.subject || !body.message) {
        return new Response(
          JSON.stringify({ error: "Verplichte velden ontbreken (name, email, subject, message)" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Maak lead aan via interne mutation
      const result = await ctx.runMutation(
        internal.configuratorAanvragen.createFromWebsite,
        {
          klantNaam: String(body.name),
          klantEmail: String(body.email),
          klantTelefoon: body.phone ? String(body.phone) : undefined,
          onderwerp: String(body.subject),
          bericht: String(body.message),
          aantalFotos: body.attachmentCount ? Number(body.attachmentCount) : undefined,
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
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }),
});

export default http;
