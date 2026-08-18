#!/usr/bin/env node
/**
 * Zet de Clerk-organisatie "Top Tuinen" op en maakt alle medewerkers lid.
 *
 *   CLERK_SECRET_KEY=sk_test_… node scripts/clerk-org-setup.mjs           → dev
 *   CLERK_SECRET_KEY=sk_live_… node scripts/clerk-org-setup.mjs --prod    → productie
 *
 * Het script is idempotent: twee keer draaien geeft dezelfde eindtoestand en
 * geen fouten. Rolregels (bindend, spec §2 besluit 3):
 *
 *   ricardobos43@gmail.com   → org:admin  / public_metadata.role = "directie"
 *   riboebusiness@gmail.com  → org:member / public_metadata.role = "medewerker"
 *   alle overige accounts    → org:admin  / "directie"
 *   public_metadata.role === "klant" → overslaan (portaalaccounts, geen org-lid)
 *
 * Bij elke fout stopt het script met exitcode 1 — een halve run meldt zich
 * nooit stilzwijgend als geslaagd.
 */
import process from "node:process";

const SECRET = process.env.CLERK_SECRET_KEY;
if (!SECRET) {
  console.error("CLERK_SECRET_KEY ontbreekt.");
  process.exit(1);
}

const isProd = process.argv.includes("--prod");
if (isProd !== SECRET.startsWith("sk_live_")) {
  console.error(
    `Key/vlag-mismatch: --prod=${isProd} maar key begint met ${SECRET.slice(0, 8)}…`,
  );
  process.exit(1);
}

const API = "https://api.clerk.com/v1";
const headers = { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" };

const ORG_NAAM = "Top Tuinen";
const ORG_SLUG = "top-tuinen";
const ADMIN_MAIL = "ricardobos43@gmail.com";
const MEDEWERKER_MAIL = "riboebusiness@gmail.com";
const PAGINA = 100;

async function clerk(path, init = {}) {
  const res = await fetch(`${API}${path}`, { headers, ...init });
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Haalt een lijst-endpoint volledig op. Clerk geeft soms een kale array terug
 * (GET /users) en soms { data, total_count } (organizations, memberships).
 */
async function alleItems(path) {
  const items = [];
  for (let offset = 0; ; offset += PAGINA) {
    const scheiding = path.includes("?") ? "&" : "?";
    const body = await clerk(`${path}${scheiding}limit=${PAGINA}&offset=${offset}`);
    const pagina = Array.isArray(body) ? body : (body.data ?? []);
    items.push(...pagina);
    if (pagina.length < PAGINA) return items;
  }
}

/** Het primaire e-mailadres, via primary_email_address_id — niet blind [0]. */
function primaireMail(user) {
  const adressen = user.email_addresses ?? [];
  const primair =
    adressen.find((a) => a.id === user.primary_email_address_id) ?? adressen[0];
  return primair?.email_address?.toLowerCase();
}

function bepaalRollen(email) {
  if (email === MEDEWERKER_MAIL) return { orgRol: "org:member", appRol: "medewerker" };
  if (email === ADMIN_MAIL) return { orgRol: "org:admin", appRol: "directie" };
  return { orgRol: "org:admin", appRol: "directie" };
}

/**
 * Maakt de organisatie aan. Instances waar org-slugs uitstaan weigeren het
 * slug-veld (403 organization_slugs_disabled); dan maken we dezelfde org
 * zonder slug aan. De org wordt daarna op naam teruggevonden.
 */
async function maakOrg() {
  try {
    return await clerk("/organizations", {
      method: "POST",
      body: JSON.stringify({ name: ORG_NAAM, slug: ORG_SLUG }),
    });
  } catch (err) {
    if (!err.message.includes("organization_slugs_disabled")) throw err;
    console.log("slugs staan uit op deze instance — org wordt zonder slug aangemaakt");
    return clerk("/organizations", {
      method: "POST",
      body: JSON.stringify({ name: ORG_NAAM }),
    });
  }
}

function tabel(rijen) {
  const kop = ["E-mail", "Org-rol", "App-rol", "Lidmaatschap", "App-rol-status"];
  const alles = [kop, ...rijen];
  const breedtes = kop.map((_, i) => Math.max(...alles.map((r) => String(r[i]).length)));
  const regel = (r) => r.map((c, i) => String(c).padEnd(breedtes[i])).join("  ");
  return [regel(kop), breedtes.map((b) => "-".repeat(b)).join("  "), ...rijen.map(regel)].join(
    "\n",
  );
}

async function main() {
  console.log(`Clerk-omgeving: ${isProd ? "PRODUCTIE" : "dev"} (${SECRET.slice(0, 8)}…)`);

  // 1. Organisatie vinden of aanmaken.
  const orgs = await alleItems("/organizations");
  let org = orgs.find((o) => o.slug === ORG_SLUG || o.name === ORG_NAAM);
  if (org) {
    console.log(`org bestond al: ${org.name} (${org.id})`);
  } else {
    org = await maakOrg();
    console.log(`org aangemaakt: ${org.name} (${org.id})`);
  }

  // 2. Bestaande memberships ophalen (paginerend) zodat de run idempotent is.
  const memberships = await alleItems(`/organizations/${org.id}/memberships`);
  const rolPerUser = new Map(
    memberships.map((m) => [m.public_user_data?.user_id ?? m.user_id, m.role]),
  );
  console.log(`bestaande leden: ${rolPerUser.size}`);

  // 3. Alle users doorlopen.
  const users = await alleItems("/users");
  console.log(`gevonden users: ${users.length}`);

  const rijen = [];
  for (const user of users) {
    const email = primaireMail(user);
    if (!email) {
      console.log(`skip (geen e-mail): ${user.id}`);
      rijen.push([user.id, "-", "-", "geskipt", "geskipt"]);
      continue;
    }

    const huidigeAppRol = user.public_metadata?.role;
    if (huidigeAppRol === "klant") {
      console.log(`skip (klant): ${email}`);
      rijen.push([email, "-", "klant", "geskipt", "geskipt"]);
      continue;
    }

    const { orgRol, appRol } = bepaalRollen(email);

    // 3a. Lidmaatschap aanmaken of de rol bijwerken.
    const bestaandeRol = rolPerUser.get(user.id);
    let lidStatus;
    if (!bestaandeRol) {
      await clerk(`/organizations/${org.id}/memberships`, {
        method: "POST",
        body: JSON.stringify({ user_id: user.id, role: orgRol }),
      });
      lidStatus = "aangemaakt";
      console.log(`lid aangemaakt: ${email} → ${orgRol}`);
    } else if (bestaandeRol !== orgRol) {
      await clerk(`/organizations/${org.id}/memberships/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: orgRol }),
      });
      lidStatus = "geüpdatet";
      console.log(`lidrol geüpdatet: ${email} ${bestaandeRol} → ${orgRol}`);
    } else {
      lidStatus = "bestond al";
      console.log(`lid bestond al: ${email} (${orgRol})`);
    }

    // 3b. App-rol in public_metadata zetten (PATCH merge't public_metadata).
    let rolStatus;
    if (huidigeAppRol === appRol) {
      rolStatus = "bestond al";
    } else {
      await clerk(`/users/${user.id}/metadata`, {
        method: "PATCH",
        body: JSON.stringify({ public_metadata: { role: appRol } }),
      });
      rolStatus = huidigeAppRol ? "geüpdatet" : "aangemaakt";
      console.log(`app-rol ${rolStatus}: ${email} → ${appRol}`);
    }

    rijen.push([email, orgRol, appRol, lidStatus, rolStatus]);
  }

  console.log(`\n${tabel(rijen)}\n`);
  console.log(`KLAAR. clerkOrgId voor de Convex-migratie: ${org.id}`);
}

main().catch((err) => {
  console.error(`\nMISLUKT: ${err.message}`);
  process.exit(1);
});
