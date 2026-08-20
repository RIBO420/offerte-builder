/**
 * De achtergrond-bootstrap in `useCurrentUser` (console-storm 20 aug 2026).
 *
 * `useCurrentUser` hangt in ~80 componenten. De teller stond in een `useRef`,
 * dus élke gemounte component vuurde zijn eigen `users.initializeDefaults` af —
 * en bij een fout die niet vanzelf overgaat kwam die storm bij elke remount
 * terug. Deze test pint vast dat het bij één poging blijft, en dat een fout
 * geen nieuwe pogingen uitlokt.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  useCurrentUser,
  _resetInitialisatieBoekhouding,
} from "@/hooks/use-current-user";

const initializeDefaultsMock = vi.fn();
const upsertMock = vi.fn();
const achtergrondFoutMock = vi.fn();

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: { id: "clerk_user_1" }, isLoaded: true }),
}));

// De echte `api` is een proxy die je niet kunt vergelijken of printen; hier
// volstaan sleutels waaraan de useMutation-mock ziet welke mutatie gevraagd is.
vi.mock("@convex/_generated/api", () => ({
  api: {
    users: {
      current: "users.current",
      upsert: "users.upsert",
      initializeDefaults: "users.initializeDefaults",
    },
    normuren: { list: "normuren.list" },
  },
}));

vi.mock("convex/react", () => ({
  // De hook doet twee queries (users.current, normuren.list); beide mogen hier
  // hetzelfde teruggeven — het gaat om de mutatie.
  useQuery: () => ({ _id: "users:1" }),
  useMutation: (functieRef: unknown) =>
    functieRef === "users.initializeDefaults"
      ? initializeDefaultsMock
      : upsertMock,
}));

vi.mock("@/lib/error-handling", () => ({
  createBackgroundErrorHandler: () => achtergrondFoutMock,
}));

beforeEach(() => {
  initializeDefaultsMock.mockReset();
  upsertMock.mockReset();
  achtergrondFoutMock.mockReset();
  _resetInitialisatieBoekhouding();
  initializeDefaultsMock.mockResolvedValue({ overgeslagen: false });
});

describe("useCurrentUser — bootstrap van standaardgegevens", () => {
  it("vuurt initializeDefaults één keer af, hoeveel componenten de hook ook gebruiken", async () => {
    renderHook(() => useCurrentUser());
    renderHook(() => useCurrentUser());
    renderHook(() => useCurrentUser());

    await waitFor(() => expect(initializeDefaultsMock).toHaveBeenCalledTimes(1));
  });

  it("blijft na een remount bij die ene poging", async () => {
    const eerste = renderHook(() => useCurrentUser());
    await waitFor(() => expect(initializeDefaultsMock).toHaveBeenCalledTimes(1));

    eerste.unmount();
    renderHook(() => useCurrentUser());

    await waitFor(() => expect(initializeDefaultsMock).toHaveBeenCalledTimes(1));
  });

  it("probeert het niet opnieuw na een fout die niet vanzelf overgaat", async () => {
    initializeDefaultsMock.mockRejectedValue(
      new Error("Organisatie niet gevonden. Neem contact op met je beheerder.")
    );

    renderHook(() => useCurrentUser());
    await waitFor(() => expect(achtergrondFoutMock).toHaveBeenCalledTimes(1));

    // Nieuwe componenten mounten: geen tweede poging, dus ook geen tweede
    // melding in de console en in Sentry.
    renderHook(() => useCurrentUser());
    renderHook(() => useCurrentUser());

    await new Promise((r) => setTimeout(r, 20));
    expect(initializeDefaultsMock).toHaveBeenCalledTimes(1);
    expect(achtergrondFoutMock).toHaveBeenCalledTimes(1);
  });
});
