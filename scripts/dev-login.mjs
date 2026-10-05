#!/usr/bin/env node
/**
 * dev-login.mjs — lokale ontwikkelhulp: log de browser in als staf-gebruiker
 * ZONDER wachtwoord, via een Clerk **sign-in token** (Backend API).
 *
 * WAAROM DIT BESTAAT
 * ------------------
 * Vrijwel elk interessant scherm (sidebar, klanten, offertes, projecten,
 * portaal) zit achter Clerk-auth. Een agent met browsertools kwam daar niet
 * binnen en bouwde daarom telkens een tijdelijke publieke "meetpagina".
 * Dat is omslachtig én je kijkt niet naar het echte scherm.
 *
 * HOE HET WERKT
 * -------------
 *  1. Dit script zoekt de gebruiker op via de Clerk Backend API (op e-mail).
 *  2. Het vraagt een kortlevend sign-in token aan (POST /v1/sign_in_tokens).
 *  3. Het legt dat token kort in `public/dev-login-ticket.json` neer en ruimt
 *     het daarna zelf weer op.
 *  4. Jij draait in de browserconsole van localhost:3000 een klein snippet dat
 *     het token ophaalt en inwisselt via `Clerk.client.signIn.create(
 *     { strategy: 'ticket', ticket })` + `Clerk.setActive(...)`.
 *
 * Het token komt dus NOOIT in een terminal-log, in een transcript, in een
 * tool-aanroep of in git terecht. Er wordt ook geen wachtwoord gebruikt.
 *
 * WAAROM VIA `public/` EN NIET VIA EEN EIGEN SERVERTJE
 * ---------------------------------------------------
 * Eerste opzet was een hulp-servertje op 127.0.0.1:4599 waar de pagina het
 * ticket vandaan haalde. Dat werkt niet: `next.config.ts` zet een CSP met
 * `connect-src 'self' …`, dus de browser blokkeert elke fetch naar een andere
 * origin ("Failed to fetch"). Een bestand onder `public/` is wél same-origin
 * en dus toegestaan. Het bestand staat in `.gitignore`, leeft standaard maar
 * 120 seconden, wordt bij afsluiten (ook Ctrl-C) verwijderd, en het ticket
 * zelf vervalt sowieso na 5 minuten.
 *
 * BEWUST GEEN APP-ROUTE
 * ---------------------
 * Dit is een script buiten `src/`, zodat er niets van in een productiebuild
 * belandt. Er is dus geen enkele route toegevoegd die auth omzeilt — het
 * inloggen gebeurt via de gewone Clerk-sessie, alleen met een ticket in plaats
 * van een wachtwoord.
 *
 * MOBIELE APP (`--mobiel`)
 * ------------------------
 * De Expo-app heeft een "Dev Login"-knop (alleen in __DEV__) die een token
 * POST't naar `EXPO_PUBLIC_DEV_LOGIN_URL`. Een native app valt niet onder de
 * web-CSP, dus hier wél een kortlevend servertje — nog steeds buiten `src/`,
 * zodat er geen auth-omzeilende route in de webapp komt. Elke POST levert een
 * vers token van 120 s voor het medewerkeraccount (`--email` of
 * DEV_LOGIN_MOBIEL_EMAIL). Standaard alleen op 127.0.0.1 (simulator); `--lan`
 * luistert ook op het netwerk voor een echte telefoon in hetzelfde wifi.
 *
 * Gebruik:
 *   npm run dev:login                 # gebruikt E2E_CLERK_USER_EMAIL
 *   npm run dev:login -- --email x@y  # of expliciet een ander account
 *   npm run dev:login -- --mobiel     # token-server voor de Expo-app (15 min)
 *   npm run dev:login -- --mobiel --lan
 */

import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HIER, "..");

/**
 * Bestandsnaam onder `public/` — same-origin, dus toegestaan door de CSP.
 *
 * Let op de extensie `.js` (de inhoud is gewoon JSON). De matcher van
 * `src/proxy.ts` sluit statische bestanden uit op extensie, maar `js(?!on)`
 * betekent dat juist `.json` er WÉL doorheen gaat: een `.json` in `public/`
 * wordt door clerkMiddleware afgeschermd en levert een 307 naar `/` op.
 * Met `.js` wordt het bestand rechtstreeks statisch geserveerd.
 */
const TICKET_BESTAND = "dev-login-ticket.js";
const TICKET_PAD = resolve(PROJECT_ROOT, "public", TICKET_BESTAND);
/** Origin van de lokale Next-dev-server. */
const APP_ORIGIN = process.env.DEV_LOGIN_APP_ORIGIN ?? "http://localhost:3000";
/** Het token is maar kort geldig — genoeg om één keer in te wisselen. */
const TOKEN_TTL_SECONDS = 300;
/** Hoe lang het ticketbestand blijft staan voordat het script het opruimt. */
const BESTAND_TTL_MS = Number(process.env.DEV_LOGIN_TTL_MS ?? 120_000);

// ---------------------------------------------------------------------------
// .env.local inlezen (geen dotenv-dependency nodig)
// ---------------------------------------------------------------------------

function leesEnvLocal() {
  const env = {};
  let inhoud;
  try {
    inhoud = readFileSync(resolve(PROJECT_ROOT, ".env.local"), "utf8");
  } catch {
    return env;
  }
  for (const regel of inhoud.split("\n")) {
    const m = regel.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let waarde = m[2].trim();
    if (
      (waarde.startsWith('"') && waarde.endsWith('"')) ||
      (waarde.startsWith("'") && waarde.endsWith("'"))
    ) {
      waarde = waarde.slice(1, -1);
    }
    env[m[1]] = waarde;
  }
  return env;
}

const envLocal = leesEnvLocal();
/** process.env wint van .env.local, zodat je lokaal kunt overschrijven. */
const env = (naam) => process.env[naam] ?? envLocal[naam];

// ---------------------------------------------------------------------------
// Veiligheidsgrendels
// ---------------------------------------------------------------------------

/**
 * Waarom deze guard er staat:
 * dit hulpmiddel maakt een geldige inlogsessie aan zonder wachtwoord. Op een
 * PRODUCTIE-instance zou dat neerkomen op een achterdeur naar echte
 * klantaccounts. Daarom weigert het script te draaien tenzij *alles* op een
 * lokale Clerk **development**-instance wijst:
 *   - de secret key moet een `sk_test_`-sleutel zijn;
 *   - de publishable key moet een `pk_test_`-sleutel zijn;
 *   - de app-origin moet loopback zijn (localhost / 127.0.0.1).
 * Faalt één van die controles, dan stoppen we vóórdat er ook maar iets bij
 * Clerk wordt opgevraagd.
 */
function controleerLokaleOmgeving() {
  const fouten = [];

  const secret = env("CLERK_SECRET_KEY");
  if (!secret) {
    fouten.push("CLERK_SECRET_KEY ontbreekt (zet 'm in .env.local).");
  } else if (!secret.startsWith("sk_test_")) {
    fouten.push(
      "CLERK_SECRET_KEY is geen sk_test_-sleutel. Dit script draait alleen " +
        "tegen een Clerk development-instance, nooit tegen productie.",
    );
  }

  const publishable = env("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  if (!publishable) {
    fouten.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ontbreekt.");
  } else if (!publishable.startsWith("pk_test_")) {
    fouten.push(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is geen pk_test_-sleutel " +
        "(productie-instance) — geweigerd.",
    );
  }

  let origin;
  try {
    origin = new URL(APP_ORIGIN);
  } catch {
    fouten.push(`DEV_LOGIN_APP_ORIGIN is geen geldige URL: ${APP_ORIGIN}`);
  }
  if (origin && !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) {
    fouten.push(
      `App-origin ${APP_ORIGIN} is niet lokaal. Dit script logt alleen in op ` +
        "een dev-server op de eigen machine.",
    );
  }

  if (fouten.length > 0) {
    console.error("\n[dev-login] GEWEIGERD — omgeving is niet lokaal/dev:\n");
    for (const fout of fouten) console.error("  - " + fout);
    console.error("");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Clerk Backend API
// ---------------------------------------------------------------------------

const CLERK_API = "https://api.clerk.com/v1";

async function clerkFetch(pad, init = {}) {
  const res = await fetch(`${CLERK_API}${pad}`, {
    ...init,
    headers: {
      // De sleutel wordt alleen hier gelezen en nooit gelogd.
      Authorization: `Bearer ${env("CLERK_SECRET_KEY")}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const tekst = await res.text();
    throw new Error(`Clerk API ${init.method ?? "GET"} ${pad} → ${res.status}: ${tekst}`);
  }
  return res.json();
}

async function zoekGebruikerId(email) {
  const lijst = await clerkFetch(
    `/users?email_address=${encodeURIComponent(email)}&limit=1`,
  );
  const gebruiker = Array.isArray(lijst) ? lijst[0] : lijst?.data?.[0];
  if (!gebruiker) {
    throw new Error(
      `Geen Clerk-gebruiker gevonden met e-mailadres ${email}. ` +
        `Controleer het account in het Clerk-dashboard.`,
    );
  }
  return gebruiker.id;
}

async function maakSignInToken(userId) {
  const token = await clerkFetch("/sign_in_tokens", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      expires_in_seconds: TOKEN_TTL_SECONDS,
    }),
  });
  if (!token?.token) throw new Error("Clerk gaf geen token terug.");
  return token.token;
}

// ---------------------------------------------------------------------------
// Ticket kort neerleggen onder public/ en daarna opruimen
// ---------------------------------------------------------------------------

function ruimOp() {
  try {
    rmSync(TICKET_PAD, { force: true });
  } catch {
    /* al weg — prima */
  }
}

/** Het snippet dat je in de browserconsole van de app draait. */
function browserSnippet() {
  return (
    `(async () => {` +
    ` const r = await fetch('/${TICKET_BESTAND}', { cache: 'no-store' });` +
    ` const { ticket } = await r.json();` +
    ` await window.Clerk.load();` +
    ` const s = await window.Clerk.client.signIn.create({ strategy: 'ticket', ticket });` +
    ` if (s.status !== 'complete') return 'status=' + s.status;` +
    ` await window.Clerk.setActive({ session: s.createdSessionId });` +
    ` return 'ok';` +
    ` })()`
  );
}

function legTicketKlaar(ticket) {
  writeFileSync(TICKET_PAD, JSON.stringify({ ticket }), { mode: 0o600 });

  // Opruimen bij élke manier van eindigen, zodat er nooit een geldig ticket
  // op schijf blijft slingeren.
  process.on("exit", ruimOp);
  for (const signaal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signaal, () => {
      ruimOp();
      process.exit(0);
    });
  }

  console.log("");
  console.log("[dev-login] Ticket klaargezet. Open " + APP_ORIGIN + "/ en draai daar:");
  console.log("");
  console.log(browserSnippet());
  console.log("");
  console.log("[dev-login] Daarna: navigeer naar " + APP_ORIGIN + "/dashboard");
  console.log(
    "[dev-login] Bestand wordt over " +
      Math.round(BESTAND_TTL_MS / 1000) +
      "s verwijderd; het ticket vervalt sowieso na " +
      TOKEN_TTL_SECONDS +
      "s.",
  );

  setTimeout(() => {
    ruimOp();
    console.log("[dev-login] Ticketbestand opgeruimd.");
    process.exit(0);
  }, BESTAND_TTL_MS);
}

// ---------------------------------------------------------------------------
// Mobiel: kortlevende token-server voor de Dev Login-knop van de Expo-app
// ---------------------------------------------------------------------------

const MOBIEL_POORT = Number(process.env.DEV_LOGIN_MOBIEL_POORT ?? 4599);
const MOBIEL_TTL_MS = Number(process.env.DEV_LOGIN_MOBIEL_TTL_MS ?? 15 * 60_000);
const MOBIEL_TOKEN_TTL_SECONDS = 120;

function lanAdres() {
  for (const lijst of Object.values(networkInterfaces())) {
    for (const nic of lijst ?? []) {
      if (nic.family === "IPv4" && !nic.internal) return nic.address;
    }
  }
  return null;
}

function startMobieleServer(userId, email, lan) {
  const server = createServer(async (req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }
    try {
      const token = await clerkFetch("/sign_in_tokens", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, expires_in_seconds: MOBIEL_TOKEN_TTL_SECONDS }),
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ token: token.token }));
      console.log(`[dev-login] Token uitgegeven aan de app (${email}).`);
    } catch (fout) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Token aanmaken mislukt" }));
      console.error("[dev-login] Token aanmaken mislukt: " + fout.message);
    }
  });

  const host = lan ? "0.0.0.0" : "127.0.0.1";
  server.listen(MOBIEL_POORT, host, () => {
    const adres = lan ? lanAdres() ?? "<lan-ip>" : "127.0.0.1";
    console.log("");
    console.log(`[dev-login] Mobiele token-server luistert op http://${adres}:${MOBIEL_POORT}`);
    console.log("[dev-login] Zet in mobile/.env.local en herstart Expo:");
    console.log(`  EXPO_PUBLIC_DEV_LOGIN_URL=http://${adres}:${MOBIEL_POORT}`);
    console.log(
      `[dev-login] Stopt vanzelf over ${Math.round(MOBIEL_TTL_MS / 60_000)} min (of Ctrl-C).`,
    );
  });

  setTimeout(() => {
    console.log("[dev-login] Mobiele token-server gestopt.");
    process.exit(0);
  }, MOBIEL_TTL_MS);
}

// ---------------------------------------------------------------------------

async function main() {
  // `--clean` verwijdert alleen een achtergebleven ticketbestand.
  if (process.argv.includes("--clean")) {
    ruimOp();
    console.log("[dev-login] Eventueel achtergebleven ticketbestand verwijderd.");
    return;
  }

  controleerLokaleOmgeving();

  const mobiel = process.argv.includes("--mobiel");
  const argIndex = process.argv.indexOf("--email");
  const email =
    argIndex !== -1
      ? process.argv[argIndex + 1]
      : mobiel
        ? env("DEV_LOGIN_MOBIEL_EMAIL")
        : env("E2E_CLERK_USER_EMAIL");

  if (!email) {
    console.error(
      "[dev-login] Geen e-mailadres. Zet " +
        (mobiel ? "DEV_LOGIN_MOBIEL_EMAIL" : "E2E_CLERK_USER_EMAIL") +
        " in .env.local of geef --email <adres> mee.",
    );
    process.exit(1);
  }

  console.log("[dev-login] Clerk dev-instance OK. Gebruiker opzoeken…");
  const userId = await zoekGebruikerId(email);
  console.log("[dev-login] Gebruiker gevonden: " + userId);

  if (mobiel) {
    startMobieleServer(userId, email, process.argv.includes("--lan"));
    return;
  }

  const ticket = await maakSignInToken(userId);
  legTicketKlaar(ticket);
}

main().catch((fout) => {
  // Alleen de foutmelding, nooit de sleutel of het token.
  console.error("[dev-login] Mislukt: " + fout.message);
  process.exit(1);
});
