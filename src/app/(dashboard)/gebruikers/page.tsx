import { redirect } from "next/navigation";

/**
 * Het losse gebruikersbeheer bestaat niet meer: rollen en toegang horen bij de
 * collega, niet in een tweede lijst met dezelfde namen. Wat hier stond, staat
 * nu in `/team` — rijacties voor wie een dossier heeft, de Accounts-tab voor de
 * rest.
 */
export default function GebruikersPage() {
  redirect("/team");
}
