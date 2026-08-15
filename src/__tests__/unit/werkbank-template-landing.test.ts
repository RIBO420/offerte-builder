/**
 * S2 (eindschouw 15 aug 2026): "Gebruik deze" op een sjabloon leverde een
 * offerte met 0 regels en € 0.
 *
 * De oorzaak zit niet in het sjabloon maar in de arbeidsverdeling:
 * `standaardtuinen.createOfferteFromTemplate` kopieert `scopes` en `scopeData`
 * uit het sjabloon en zet `regels: []` met een totaal van € 0 — die mutation
 * kán niet rekenen, want de calculator draait in de browser op de normuren en
 * producten van dit bedrijf. Zolang de landing de detailpagina was, die alleen
 * ópgeslagen regels toont, bleef dat dus staan.
 *
 * Sindsdien landt het sjabloon in het werkblad, en bewaart het werkblad zijn
 * eerste doorrekening — precies wanneer het document zonder regels binnenkwam.
 * Deze test bewaakt die grens: een offerte die al regels heeft mag níét
 * stilzwijgend worden overschreven door een verse berekening.
 */
import { describe, it, expect } from "vitest";
import { moetEersteDoorrekeningBewaren } from "@/components/offerte/werkbank/use-werkbank";

describe("werkblad: eerste doorrekening bewaren", () => {
  it("bewaart de berekende regels van een sjabloon-offerte (0 opgeslagen)", () => {
    expect(moetEersteDoorrekeningBewaren(0, 5)).toBe(true);
  });

  it("laat opgeslagen regels met rust bij het openen van 'Bewerken'", () => {
    expect(moetEersteDoorrekeningBewaren(5, 5)).toBe(false);
    // Ook als de verse berekening iets anders uitkomt (gewijzigde normuren):
    // pas als iemand het document wijzigt schrijft de autosave.
    expect(moetEersteDoorrekeningBewaren(5, 7)).toBe(false);
  });

  it("schrijft niets weg zolang de calculatie nog niets oplevert", () => {
    // Een leeg sjabloon (geen scopes, of de calculatie is nog aan het laden)
    // mag geen lege opslagronde uitlokken.
    expect(moetEersteDoorrekeningBewaren(0, 0)).toBe(false);
  });
});
