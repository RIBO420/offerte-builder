"use client";

/**
 * De motor onder het werkblad.
 *
 * Drie dingen die dit anders doet dan de wizard die het verving:
 *
 * 1. **De offerte bestaat meteen.** Bij binnenkomst maakt dit hook één concept
 *    aan (juiste type, `bron: "wizard"`, scopes uit `?scope=`, klant uit
 *    `?klantId=`). Het offertenummer komt server-side uit `offertes.create` —
 *    het oude client-side ophalen was een raceconditie.
 * 2. **Autosave gaat naar Convex, niet naar localStorage.** Er is dus geen
 *    "concept herstellen?"-dialoog meer: een concept ís een offerte. Elke
 *    opslag draait met `createVersion: false`, anders zou de versiegeschiedenis
 *    volstromen met tikwerk.
 * 3. **De regels leven mee.** Zodra type + m² kloppen rekent de bestaande
 *    engine door en verschijnen de regels onder de scope.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useOfferteCalculation } from "@/hooks/use-offerte-calculation";
import { getMutationErrorMessage } from "@/lib/error-handling";
import {
  calculateTotals,
  type OfferteRegel,
} from "@/lib/offerte-calculator";
import {
  LEGE_CATALOGUS_SELECTIE,
  berekenCatalogusTotalen,
  bouwOfferteBouwsteenRegels,
  catalogusRegelsNaarOfferteRegels,
  type BouwsteenDefault,
  type CatalogusSelectie,
  type OfferteBouwsteenRegel,
} from "@/lib/bouwsteen-offerte";
import {
  catalogusUitBouwsteenRegels,
  garantieUitRegels,
  geldigeScopes,
  isScopeCompleet,
  scopeDataVoorOfferte,
  sorteerScopes,
  werkbankRegels,
  werkbankVoortgang,
  type WerkbankScopeId,
  type WerkbankType,
} from "@/lib/werkbank";
import { legeScopeData } from "./scope-defaults";
import type { Achterstalligheid, Bereikbaarheid } from "@/types/offerte";

export type OpslagStatus = "rustig" | "bezig" | "opgeslagen" | "fout";

export interface WerkbankKlantVelden {
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  email: string;
  telefoon: string;
}

const LEGE_KLANT: WerkbankKlantVelden = {
  naam: "",
  adres: "",
  postcode: "",
  plaats: "",
  email: "",
  telefoon: "",
};

/** Debounce van de autosave: lang genoeg om typen niet te onderbreken. */
const AUTOSAVE_MS = 900;

export interface WerkbankOpties {
  /**
   * Bewerkmodus: het werkblad opent een offerte die al bestaat
   * (`/offertes/[id]/bewerken`) in plaats van er zelf een aan te maken. De
   * hydratie hieronder is dezelfde als na een herlaadactie.
   */
  offerteId?: Id<"offertes">;
}

/**
 * Moet de eerste doorrekening na het inladen worden weggeschreven?
 *
 * Ja, precies wanneer het document zónder regels binnenkwam terwijl het
 * werkblad er wél uitrekent. Dat is de sjabloonsituatie:
 * `standaardtuinen.createOfferteFromTemplate` kopieert `scopes` en
 * `scopeData` uit het sjabloon maar zet `regels: []` en een totaal van € 0 —
 * rekenen kan die mutation niet, want de calculator draait in de browser op de
 * normuren en producten van dit bedrijf.
 *
 * Nee zodra er al regels stáán: die zijn dan leidend tot iemand iets wijzigt.
 * Anders zou het openen van "Bewerken" de opgeslagen regels stilzwijgend
 * vervangen door een verse berekening.
 */
export function moetEersteDoorrekeningBewaren(
  opgeslagenRegels: number,
  doorgerekendeRegels: number
): boolean {
  return opgeslagenRegels === 0 && doorgerekendeRegels > 0;
}

export function useWerkbank(type: WerkbankType, opties?: WerkbankOpties) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const klantIdParam = searchParams.get("klantId")?.trim() || undefined;
  const leadIdParam = searchParams.get("leadId")?.trim() || undefined;
  const scopeParams = useMemo(
    () => searchParams.getAll("scope"),
    [searchParams]
  );
  // `?offerte=` zetten we zelf in de URL zodra het concept bestaat: een
  // herlaadde pagina pakt hetzelfde document op in plaats van een tweede
  // concept aan te maken.
  const offerteParam = searchParams.get("offerte")?.trim() || undefined;

  /**
   * Het document dat we openen in plaats van aanmaken: de bewerkroute geeft
   * het id als prop mee, een herlaadactie via `?offerte=`. Beide vragen om
   * dezelfde hydratie.
   */
  const bestaandId = (opties?.offerteId ??
    (offerteParam as Id<"offertes"> | undefined)) as
    | Id<"offertes">
    | undefined;
  /** Bewerkmodus = het werkblad maakt zelf geen concept aan. */
  const bewerkModus = Boolean(opties?.offerteId);

  const createOfferte = useMutation(api.offertes.create);
  const updateOfferte = useMutation(api.offertes.update);
  const updateRegels = useMutation(api.offertes.updateRegels);
  const updateStatus = useMutation(api.offertes.updateStatus);
  const updateBouwsteenRegels = useMutation(api.offertes.updateBouwsteenRegels);

  const [offerteId, setOfferteId] = useState<Id<"offertes"> | null>(
    bestaandId ?? null
  );
  const [aanmaakFout, setAanmaakFout] = useState<string | null>(null);

  const offerte = useQuery(
    api.offertes.get,
    offerteId ? { id: offerteId } : "skip"
  );

  // ─── Documentstaat ────────────────────────────────────────────────────────
  const [scopes, setScopesRuw] = useState<WerkbankScopeId[]>(() =>
    geldigeScopes(type, scopeParams)
  );
  const [scopeData, setScopeData] = useState<Record<string, unknown>>(() =>
    legeScopeData(type)
  );
  const [bereikbaarheid, setBereikbaarheid] = useState<Bereikbaarheid>("goed");
  const [achterstalligheid, setAchterstalligheid] =
    useState<Achterstalligheid>("laag");
  const [garantieId, setGarantieId] = useState<string | null>(null);
  const [catalogus, setCatalogusRuw] = useState<CatalogusSelectie>(
    LEGE_CATALOGUS_SELECTIE
  );
  const [klant, setKlant] = useState<WerkbankKlantVelden>(LEGE_KLANT);
  const [klantId, setKlantId] = useState<Id<"klanten"> | null>(null);

  const setCatalogus = useCallback(
    (
      updater: CatalogusSelectie | ((prev: CatalogusSelectie) => CatalogusSelectie)
    ) => {
      setCatalogusRuw((prev) =>
        typeof updater === "function" ? updater(prev) : updater
      );
    },
    []
  );

  // ─── Het concept aanmaken (exact één keer) ────────────────────────────────
  const aangemaaktRef = useRef(false);
  useEffect(() => {
    if (offerteId || aangemaaktRef.current) return;
    // Synchroon vóór de await: React 18/19 draait effecten in dev twee keer,
    // en een tweede create zou een tweede offertenummer verbranden.
    aangemaaktRef.current = true;

    const beginScopes = geldigeScopes(type, scopeParams);
    const beginData = legeScopeData(type);

    createOfferte({
      type,
      bron: "wizard",
      algemeenParams:
        type === "onderhoud"
          ? { bereikbaarheid: "goed", achterstalligheid: "laag" }
          : { bereikbaarheid: "goed" },
      scopes: beginScopes,
      scopeData: scopeDataVoorOfferte(beginScopes, beginData),
      klantId: klantIdParam as Id<"klanten"> | undefined,
      leadId: leadIdParam as Id<"configuratorAanvragen"> | undefined,
    })
      .then((id) => {
        setOfferteId(id);
        // history.replaceState i.p.v. router.replace: de URL moet het id
        // dragen zonder dat de pagina opnieuw rendert (en het werkblad
        // opnieuw zou opstarten).
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("offerte", id);
          window.history.replaceState(null, "", url.toString());
        }
      })
      .catch((fout) => {
        aangemaaktRef.current = false;
        setAanmaakFout(getMutationErrorMessage(fout));
      });
  }, [offerteId, type, scopeParams, klantIdParam, leadIdParam, createOfferte]);

  // ─── Eenmalig hydrateren uit een bestaand document ────────────────────────
  // Alleen nodig na een herlaadactie (`?offerte=` stond al in de URL); een vers
  // aangemaakt concept kent de client al.
  //
  // `hydratieVersie` telt mee in de React-key van de scope-blokken. De
  // scope-formulieren zijn react-hook-form-formulieren die hun `defaultValues`
  // alléén bij het monteren lezen: zonder die key zou een herladen werkblad
  // lege velden tonen terwijl de offerte wél gevuld is (regels klopten,
  // invoervelden stonden op 0).
  const [hydratieVersie, setHydratieVersie] = useState(0);
  const [gehydrateerd, setGehydrateerd] = useState(!bestaandId);
  const gehydrateerdRef = useRef(!bestaandId);
  /**
   * De nulmeting van de autosave moet ná de hydratie opnieuw worden genomen —
   * anders geldt de lege beginstaat als "wat er al staat".
   */
  const nulmetingVervaltRef = useRef(false);
  /**
   * Hoeveel regels het ingeladen document meebracht. `null` = er is niets
   * ingeladen (vers concept). Zie `moetEersteDoorrekeningBewaren`.
   */
  const opgeslagenRegelsRef = useRef<number | null>(null);
  useEffect(() => {
    if (gehydrateerdRef.current || !offerte) return;
    gehydrateerdRef.current = true;
    nulmetingVervaltRef.current = true;
    opgeslagenRegelsRef.current = (offerte.regels ?? []).length;

    const bestaandeScopes = sorteerScopes(type, offerte.scopes ?? []);
    const bestaandeData = (offerte.scopeData ?? {}) as Record<string, unknown>;
    setScopesRuw(bestaandeScopes);
    setScopeData({ ...legeScopeData(type), ...bestaandeData });
    setBereikbaarheid(offerte.algemeenParams.bereikbaarheid);
    setAchterstalligheid(offerte.algemeenParams.achterstalligheid ?? "laag");
    // Garantie en contract leven in de regels van de offerte zelf; scopeData
    // heeft een strikte validator per scope en is dus geen bewaarplaats voor
    // losse keuzes.
    setGarantieId(garantieUitRegels(offerte.regels ?? []));
    setCatalogusRuw(
      catalogusUitBouwsteenRegels(
        offerte.bouwsteenRegels as OfferteBouwsteenRegel[] | undefined
      )
    );
    if (offerte.klant) {
      setKlant({
        naam: offerte.klant.naam ?? "",
        adres: offerte.klant.adres ?? "",
        postcode: offerte.klant.postcode ?? "",
        plaats: offerte.klant.plaats ?? "",
        email: offerte.klant.email ?? "",
        telefoon: offerte.klant.telefoon ?? "",
      });
    }
    if (offerte.klantId) setKlantId(offerte.klantId);
    setHydratieVersie((v) => v + 1);
    setGehydrateerd(true);
  }, [offerte, type]);

  // De klant uit `?klantId=` komt via create op de offerte terecht; zodra het
  // document binnen is nemen we die gegevens over voor de klantsectie.
  const klantOvergenomenRef = useRef(false);
  useEffect(() => {
    if (klantOvergenomenRef.current) return;
    if (!offerte?.klant || klant.naam) return;
    klantOvergenomenRef.current = true;
    setKlant({
      naam: offerte.klant.naam ?? "",
      adres: offerte.klant.adres ?? "",
      postcode: offerte.klant.postcode ?? "",
      plaats: offerte.klant.plaats ?? "",
      email: offerte.klant.email ?? "",
      telefoon: offerte.klant.telefoon ?? "",
    });
    if (offerte.klantId) setKlantId(offerte.klantId);
  }, [offerte, klant.naam]);

  // ─── Bouwstenen (onderhoudscontract, PRD §2.5a) ───────────────────────────
  const offerteDatum = useMemo(
    () => new Date().toISOString().slice(0, 10),
    []
  );
  const bouwsteenDefaults = useQuery(
    api.onderhoudscontracten.getBouwsteenDefaults,
    type === "onderhoud" ? { datum: offerteDatum } : "skip"
  ) as BouwsteenDefault[] | undefined;

  const offerteBouwsteenRegels = useMemo(
    () =>
      type === "onderhoud"
        ? bouwOfferteBouwsteenRegels(bouwsteenDefaults ?? [], catalogus)
        : [],
    [type, bouwsteenDefaults, catalogus]
  );
  const catalogusTotalen = useMemo(
    () => berekenCatalogusTotalen(offerteBouwsteenRegels),
    [offerteBouwsteenRegels]
  );

  // ─── Doorrekenen ──────────────────────────────────────────────────────────
  const calculatie = useOfferteCalculation();
  const { calculate, isLoading: calcLaadt, instellingen } = calculatie;

  const scopeDataSleutel = useMemo(
    () => JSON.stringify(scopeDataVoorOfferte(scopes, scopeData)),
    [scopes, scopeData]
  );

  const berekendeRegels = useMemo<OfferteRegel[]>(() => {
    if (calcLaadt) return [];
    const uitkomst = calculate({
      type,
      scopes,
      scopeData: scopeDataVoorOfferte(scopes, scopeData),
      bereikbaarheid,
      achterstalligheid: type === "onderhoud" ? achterstalligheid : undefined,
    });
    return uitkomst?.regels ?? [];
    // `calculate` is elke render een nieuwe functie en `scopeData` zit als
    // stabiele sleutel in `scopeDataSleutel`; de calculatiedata staat er los in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    calcLaadt,
    type,
    scopes,
    scopeDataSleutel,
    bereikbaarheid,
    achterstalligheid,
    calculatie.normuren,
    calculatie.producten,
    calculatie.correctiefactoren,
    calculatie.instellingen,
  ]);

  const bouwsteenOfferteRegels = useMemo(
    () => catalogusRegelsNaarOfferteRegels(offerteBouwsteenRegels),
    [offerteBouwsteenRegels]
  );

  const { regels, vervallen } = useMemo(
    () =>
      werkbankRegels({
        type,
        berekendeRegels,
        bouwsteenRegels: bouwsteenOfferteRegels,
        garantieId,
      }),
    [type, berekendeRegels, bouwsteenOfferteRegels, garantieId]
  );

  const totalen = useMemo(
    () =>
      calculateTotals(
        regels,
        instellingen?.standaardMargePercentage ?? 15,
        instellingen?.btwPercentage ?? 21
      ),
    [regels, instellingen]
  );

  /** Regels per scope — het document toont ze onder het bijbehorende blok. */
  const regelsPerScope = useMemo(() => {
    const kaart = new Map<string, OfferteRegel[]>();
    regels.forEach((regel) => {
      const lijst = kaart.get(regel.scope) ?? [];
      lijst.push(regel);
      kaart.set(regel.scope, lijst);
    });
    return kaart;
  }, [regels]);

  const voortgang = useMemo(
    () =>
      werkbankVoortgang({
        type,
        scopes,
        scopeData,
        klant,
        aantalRegels: regels.length,
      }),
    [type, scopes, scopeData, klant, regels.length]
  );

  // ─── Autosave ─────────────────────────────────────────────────────────────
  const [opslagStatus, setOpslagStatus] = useState<OpslagStatus>("rustig");
  const [opgeslagenOm, setOpgeslagenOm] = useState<Date | null>(null);
  const laatstOpgeslagenRef = useRef<string | null>(null);

  const regelSleutel = useMemo(
    () => JSON.stringify(regels.map((r) => [r.id, r.hoeveelheid, r.totaal])),
    [regels]
  );

  useEffect(() => {
    if (!offerteId) return;
    // Vóór de hydratie staat de staat hier nog leeg; die mag nooit over een
    // bestaand document heen worden geschreven.
    if (!gehydrateerd) return;
    if (nulmetingVervaltRef.current) {
      nulmetingVervaltRef.current = false;
      laatstOpgeslagenRef.current = null;
    }

    const momentopname = JSON.stringify({
      scopes,
      scopeDataSleutel,
      bereikbaarheid,
      achterstalligheid,
      garantieId,
      catalogus,
      regelSleutel,
    });
    if (laatstOpgeslagenRef.current === null) {
      // Wat we net met `create` hebben meegegeven (of net hebben ingeladen)
      // staat er al — op de sjabloonsituatie na.
      const bewaarDoorrekening =
        opgeslagenRegelsRef.current !== null &&
        moetEersteDoorrekeningBewaren(
          opgeslagenRegelsRef.current,
          regels.length
        );
      if (!bewaarDoorrekening) {
        laatstOpgeslagenRef.current = momentopname;
        return;
      }
      opgeslagenRegelsRef.current = null;
    }
    if (laatstOpgeslagenRef.current === momentopname) return;

    setOpslagStatus("bezig");
    const timer = setTimeout(async () => {
      try {
        await updateOfferte({
          id: offerteId,
          algemeenParams:
            type === "onderhoud"
              ? { bereikbaarheid, achterstalligheid }
              : { bereikbaarheid },
          scopes,
          scopeData: scopeDataVoorOfferte(scopes, scopeData),
          createVersion: false,
        });
        await updateRegels({
          id: offerteId,
          regels,
          margePercentage: instellingen?.standaardMargePercentage ?? 15,
          btwPercentage: instellingen?.btwPercentage ?? 21,
          uurtarief: instellingen?.uurtarief ?? 45,
          createVersion: false,
        });
        if (type === "onderhoud") {
          await updateBouwsteenRegels({
            id: offerteId,
            bouwsteenRegels: offerteBouwsteenRegels,
          });
        }
        laatstOpgeslagenRef.current = momentopname;
        setOpslagStatus("opgeslagen");
        setOpgeslagenOm(new Date());
      } catch (fout) {
        setOpslagStatus("fout");
        toast.error(getMutationErrorMessage(fout));
      }
    }, AUTOSAVE_MS);

    return () => clearTimeout(timer);
    // De mutations en alle afgeleide waarden zitten in de momentopname
    // hierboven; ze opnieuw in de dep-lijst zetten zou elke render opslaan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    offerteId,
    gehydrateerd,
    scopes,
    scopeDataSleutel,
    bereikbaarheid,
    achterstalligheid,
    garantieId,
    catalogus,
    regelSleutel,
  ]);

  // ─── Scopes toevoegen en weghalen ─────────────────────────────────────────
  const wisselScope = useCallback(
    (scope: WerkbankScopeId) => {
      setScopesRuw((huidige) =>
        sorteerScopes(
          type,
          huidige.includes(scope)
            ? huidige.filter((s) => s !== scope)
            : [...huidige, scope]
        )
      );
    },
    [type]
  );

  const voegScopesToe = useCallback(
    (toevoegen: WerkbankScopeId[]) => {
      setScopesRuw((huidige) =>
        sorteerScopes(type, [...new Set([...huidige, ...toevoegen])])
      );
    },
    [type]
  );

  const wijzigScopeData = useCallback((scope: string, waarde: unknown) => {
    setScopeData((huidige) =>
      Object.is(huidige[scope], waarde) ? huidige : { ...huidige, [scope]: waarde }
    );
  }, []);

  // ─── Klant koppelen ───────────────────────────────────────────────────────
  /**
   * Het koppelen zélf zit in `KlantKoppeling` — één component, één
   * `offertes.koppelKlant`, voor het werkblad én de regel-editor. Dit is
   * alleen de terugmelding: het werkblad houdt de klant lokaal bij voor de
   * voortgang (klant compleet?) en de kop.
   */
  const kiesKlant = useCallback(
    (velden: WerkbankKlantVelden, gekozenKlantId: Id<"klanten"> | null) => {
      setKlant(velden);
      setKlantId(gekozenKlantId);
    },
    []
  );

  // ─── Afronden ─────────────────────────────────────────────────────────────
  const [afronden, setAfronden] = useState(false);
  const [afrondFout, setAfrondFout] = useState<string | null>(null);
  const [succesOpen, setSuccesOpen] = useState(false);

  /**
   * Definitief maken = de conceptfase verlaten. De backend eist daar een
   * complete klant (`assertKlantVoorStatus`); die melding tonen we letterlijk
   * en we sturen de aandacht naar de klantsectie.
   */
  const maakDefinitief = useCallback(async () => {
    if (!offerteId) return;
    setAfronden(true);
    setAfrondFout(null);
    try {
      await updateStatus({ id: offerteId, status: "voorcalculatie" });
      setSuccesOpen(true);
    } catch (fout) {
      const melding = getMutationErrorMessage(fout);
      setAfrondFout(melding);
      toast.error(melding);
      if (typeof document !== "undefined") {
        const sectie = document.getElementById("werkbank-klant");
        sectie?.scrollIntoView({ behavior: "smooth", block: "center" });
        sectie
          ?.querySelector<HTMLElement>("button, [role='combobox']")
          ?.focus();
      }
    } finally {
      setAfronden(false);
    }
  }, [offerteId, updateStatus]);

  const naarOfferte = useCallback(() => {
    if (offerteId) router.push(`/offertes/${offerteId}`);
  }, [offerteId, router]);

  return {
    // document
    offerteId,
    klantIdParam,
    leadIdParam,
    offerte,
    offerteNummer: offerte?.offerteNummer ?? null,
    status: offerte?.status ?? "concept",
    bewerkModus,
    aanmaakFout,
    /** Staat het document klaar om formulieren op te monteren? */
    documentGereed: gehydrateerd,
    hydratieVersie,

    // staat
    scopes,
    scopeData,
    bereikbaarheid,
    achterstalligheid,
    garantieId,
    catalogus,
    klant,
    klantId,

    // acties
    wisselScope,
    voegScopesToe,
    wijzigScopeData,
    setBereikbaarheid,
    setAchterstalligheid,
    setGarantieId,
    setCatalogus,
    kiesKlant,
    maakDefinitief,
    naarOfferte,

    // afgeleid
    regels,
    regelsPerScope,
    vervallenDoorContract: vervallen,
    totalen,
    voortgang,
    bouwsteenDefaults,
    catalogusTotalen,
    isScopeCompleet: (scope: WerkbankScopeId) =>
      isScopeCompleet(type, scope, scopeData),
    calculatieLaadt: calcLaadt,

    // opslag & afronden
    opslagStatus,
    opgeslagenOm,
    afronden,
    afrondFout,
    setAfrondFout,
    succesOpen,
    setSuccesOpen,
  };
}

export type WerkbankState = ReturnType<typeof useWerkbank>;
