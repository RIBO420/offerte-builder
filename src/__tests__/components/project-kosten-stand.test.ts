import { describe, expect, it } from "vitest";
import {
  duidStand,
  euro,
  isProjectAfgerond,
  nietGeboekteSoorten,
  opsomming,
  standStatus,
  standVanSoort,
  type SoortRegel,
} from "@/components/project/kosten/stand";

const regels: SoortRegel[] = [
  { soort: "materiaal", begroot: 2593, besteed: 0 },
  { soort: "arbeid", begroot: 1728, besteed: 807 },
  { soort: "machine", begroot: 0, besteed: 0 },
  { soort: "overig", begroot: 0, besteed: 0 },
];

describe("standVanSoort", () => {
  it("noemt een begrote soort zonder boeking 'nog niets geboekt' zolang het project loopt", () => {
    expect(standVanSoort(regels[0], false)).toEqual({ tekst: "nog niets geboekt", toon: "aandacht" });
    expect(standVanSoort(regels[0], true)).toEqual({ tekst: "niets geboekt", toon: "gedempt" });
  });

  it("geeft het bestede percentage, 'niet begroot' en 'X% over'", () => {
    expect(standVanSoort(regels[1], false).tekst).toBe("47% besteed");
    expect(standVanSoort(regels[2], false).tekst).toBe("niet begroot");
    expect(standVanSoort({ soort: "arbeid", begroot: 1000, besteed: 1200 }, false)).toEqual({
      tekst: "20% over",
      toon: "over",
    });
  });
});

describe("nietGeboekteSoorten", () => {
  it("signaleert alleen begrote soorten op € 0 bij een lopend project", () => {
    expect(nietGeboekteSoorten(regels, false).map((r) => r.soort)).toEqual(["materiaal"]);
    expect(nietGeboekteSoorten(regels, true)).toEqual([]);
  });
});

describe("standStatus", () => {
  it("zegt 'Project loopt nog' zolang het project niet afgerond is", () => {
    expect(standStatus({ afgerond: false, begroot: 4321, budgetStatus: "onder_budget" }).label).toBe(
      "Project loopt nog"
    );
  });

  it("geeft na afronding onder/binnen/over budget", () => {
    expect(standStatus({ afgerond: true, begroot: 1, budgetStatus: "onder_budget" }).label).toBe("Onder budget");
    expect(standStatus({ afgerond: true, begroot: 1, budgetStatus: "binnen_marge" }).label).toBe("Binnen de marge");
    expect(standStatus({ afgerond: true, begroot: 1, budgetStatus: "over_budget" }).label).toBe("Over budget");
    expect(standStatus({ afgerond: true, begroot: 0 }).label).toBe("Geen begroting");
  });
});

describe("duidStand", () => {
  it("noemt minder besteed bij een lopend project nooit een besparing", () => {
    const zin = duidStand({ besteed: 807, begroot: 4321, regels, afgerond: false });
    expect(zin).toContain("nog niet besteed");
    expect(zin).not.toMatch(/bespaard|besparing gerealiseerd|onder de begroting/);
  });

  it("legt het verschil tussen uren en kosten bij de soort die het draagt", () => {
    const zin = duidStand({ besteed: 807, begroot: 4321, regels, afgerond: false, urenProcent: 49 });
    expect(zin).toBe(
      "Er is 49% van de begrote uren gewerkt, maar pas 19% van de kosten geboekt. Dat verschil zit vooral in materiaal."
    );
  });

  it("meldt een overschrijding tijdens de uitvoering", () => {
    const zin = duidStand({
      besteed: 1200,
      begroot: 1000,
      regels: [{ soort: "arbeid", begroot: 1000, besteed: 1200 }],
      afgerond: false,
      urenProcent: 80,
    });
    expect(zin).toBe(
      `De kosten liggen nu al ${euro(200)} boven de begroting, terwijl het project nog loopt. Vooral arbeid loopt uit.`
    );
  });

  it("mag pas na afronding 'onder de begroting' zeggen", () => {
    const zin = duidStand({ besteed: 800, begroot: 1000, regels: [], afgerond: true });
    expect(zin).toBe(`Het project is ${euro(200)} onder de begroting gebleven.`);
  });
});

describe("hulpjes", () => {
  it("opsomming en afgerond-statussen", () => {
    expect(opsomming(["materiaal", "machine", "overig"])).toBe("materiaal, machine en overig");
    expect(isProjectAfgerond("in_uitvoering")).toBe(false);
    expect(isProjectAfgerond("nacalculatie_compleet")).toBe(true);
  });
});
