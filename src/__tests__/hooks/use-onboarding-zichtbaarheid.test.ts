import { describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({ useMutation: vi.fn(), useQuery: vi.fn() }));
vi.mock("@/hooks/use-current-user", () => ({ useCurrentUser: vi.fn() }));
vi.mock("@/hooks/use-users", () => ({ useIsAdmin: vi.fn() }));

import { onboardingZichtbaarheid } from "@/hooks/use-onboarding";

const leegAccount = {
  ingelogd: true,
  laden: false,
  introGezien: false,
  checklistVerborgen: false,
  checklistKlaar: false,
  heeftAlIetsIngevuld: false,
};

describe("onboardingZichtbaarheid", () => {
  it("toont welkom en checklist bij een leeg, nieuw account", () => {
    expect(onboardingZichtbaarheid(leegAccount)).toEqual({ welkom: true, checklist: true });
  });

  it("toont geen welkom meer zodra er iets is ingevuld, ook als het nooit gesloten is", () => {
    const r = onboardingZichtbaarheid({ ...leegAccount, heeftAlIetsIngevuld: true });
    expect(r.welkom).toBe(false);
    expect(r.checklist).toBe(true);
  });

  it("toont geen welkom als het (op het account) al gezien is", () => {
    expect(onboardingZichtbaarheid({ ...leegAccount, introGezien: true }).welkom).toBe(false);
  });

  it("verbergt de checklist als die weggeklikt of af is", () => {
    expect(onboardingZichtbaarheid({ ...leegAccount, checklistVerborgen: true }).checklist).toBe(false);
    expect(onboardingZichtbaarheid({ ...leegAccount, checklistKlaar: true }).checklist).toBe(false);
  });

  it("beslist niets tijdens laden of zonder gebruiker (geen flits)", () => {
    expect(onboardingZichtbaarheid({ ...leegAccount, laden: true })).toEqual({ welkom: false, checklist: false });
    expect(onboardingZichtbaarheid({ ...leegAccount, ingelogd: false })).toEqual({ welkom: false, checklist: false });
  });
});
