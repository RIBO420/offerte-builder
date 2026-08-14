#!/usr/bin/env node
/**
 * dev-all.mjs — start `next dev` én `npx convex dev` in één terminal.
 *
 * WAAROM DIT BESTAAT
 * ------------------
 * De app is stuk zonder Convex: elke query blijft hangen. `.claude/launch.json`
 * kent maar één configuratie met één poort, en `npx convex dev` heeft helemaal
 * geen poort — die past dus niet in dat schema. Met dit script start één
 * commando (`npm run dev:all`) beide processen, en kan launch.json gewoon
 * `npm run dev:all` aanroepen met de Next-poort.
 *
 * WAAROM GEEN `concurrently`
 * --------------------------
 * `concurrently` zou werken, maar zou een nieuwe devDependency (plus
 * transitieve afhankelijkheden) toevoegen voor iets wat in ~60 regels Node
 * kan. De repo heeft een bewust kleine dependency-lijst; dit script houdt die
 * zo. Ruilt gemak in voor nul supply-chain-oppervlak.
 *
 * Gedrag:
 *  - beide processen erven stdio, met een prefix per regel;
 *  - Ctrl-C (SIGINT/SIGTERM) stopt beide netjes;
 *  - valt één proces om, dan wordt het andere ook gestopt en eindigt het
 *    script met dezelfde exitcode. Zo blijf je nooit met een half-draaiende
 *    omgeving zitten.
 *
 * Extra argumenten gaan naar `next dev`:
 *   npm run dev:all -- --port 3100
 */

import { spawn } from "node:child_process";

const extraNextArgs = process.argv.slice(2);

/** @type {{naam: string, commando: string, args: string[]}[]} */
const processen = [
  { naam: "next  ", commando: "npx", args: ["next", "dev", ...extraNextArgs] },
  { naam: "convex", commando: "npx", args: ["convex", "dev"] },
];

const kinderen = [];
let afsluiten = false;

function stopAlles(signaal = "SIGTERM") {
  if (afsluiten) return;
  afsluiten = true;
  for (const kind of kinderen) {
    if (kind.exitCode === null && kind.signalCode === null) {
      kind.kill(signaal);
    }
  }
}

for (const { naam, commando, args } of processen) {
  const kind = spawn(commando, args, {
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  });
  kinderen.push(kind);

  const prefix = `[${naam}] `;
  const schrijf = (stroom, chunk) => {
    for (const regel of chunk.toString().split("\n")) {
      if (regel.trim() !== "") stroom.write(prefix + regel + "\n");
    }
  };
  kind.stdout.on("data", (c) => schrijf(process.stdout, c));
  kind.stderr.on("data", (c) => schrijf(process.stderr, c));

  kind.on("exit", (code, signaal) => {
    if (afsluiten) return;
    console.log(
      `${prefix}proces gestopt (code ${code ?? "-"}, signaal ${signaal ?? "-"}) — de rest wordt ook gestopt.`,
    );
    stopAlles();
    process.exitCode = code ?? 1;
  });

  kind.on("error", (fout) => {
    console.error(`${prefix}kon niet starten: ${fout.message}`);
    stopAlles();
    process.exitCode = 1;
  });
}

for (const signaal of ["SIGINT", "SIGTERM"]) {
  process.on(signaal, () => stopAlles(signaal));
}
