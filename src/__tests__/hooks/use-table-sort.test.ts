import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTableSort } from "@/hooks/use-table-sort";
import { sorteerNaam } from "@convex/lib/klantNaam";

interface TestItem {
  name: string;
  age: number;
  city: string | null;
}

const testData: TestItem[] = [
  { name: "Jan", age: 35, city: "Amsterdam" },
  { name: "Piet", age: 28, city: "Rotterdam" },
  { name: "Klaas", age: 42, city: "Utrecht" },
  { name: "Anna", age: 31, city: null },
  { name: "Bram", age: 28, city: "Den Haag" },
];

describe("useTableSort", () => {
  it("returns unsorted data when no default key is provided", () => {
    const { result } = renderHook(() => useTableSort(testData));

    expect(result.current.sortedData).toEqual(testData);
    expect(result.current.sortConfig).toEqual({ key: null, direction: "asc" });
  });

  it("sorts by default key in ascending order on init", () => {
    const { result } = renderHook(() => useTableSort(testData, "name"));

    const names = result.current.sortedData.map((d) => d.name);
    expect(names).toEqual(["Anna", "Bram", "Jan", "Klaas", "Piet"]);
    expect(result.current.sortConfig).toEqual({ key: "name", direction: "asc" });
  });

  it("toggles sort direction when clicking the same column", () => {
    const { result } = renderHook(() => useTableSort(testData));

    act(() => {
      result.current.toggleSort("name");
    });

    // First click: ascending
    expect(result.current.sortConfig).toEqual({ key: "name", direction: "asc" });
    let names = result.current.sortedData.map((d) => d.name);
    expect(names).toEqual(["Anna", "Bram", "Jan", "Klaas", "Piet"]);

    act(() => {
      result.current.toggleSort("name");
    });

    // Second click: descending
    expect(result.current.sortConfig).toEqual({ key: "name", direction: "desc" });
    names = result.current.sortedData.map((d) => d.name);
    expect(names).toEqual(["Piet", "Klaas", "Jan", "Bram", "Anna"]);
  });

  it("resets to ascending when switching to a different column", () => {
    const { result } = renderHook(() => useTableSort(testData));

    // Sort by name descending
    act(() => result.current.toggleSort("name"));
    act(() => result.current.toggleSort("name"));
    expect(result.current.sortConfig.direction).toBe("desc");

    // Switch to age - should reset to ascending
    act(() => result.current.toggleSort("age"));
    expect(result.current.sortConfig).toEqual({ key: "age", direction: "asc" });

    const ages = result.current.sortedData.map((d) => d.age);
    expect(ages).toEqual([28, 28, 31, 35, 42]);
  });

  it("sorts numbers correctly", () => {
    const { result } = renderHook(() => useTableSort(testData));

    act(() => result.current.toggleSort("age"));
    let ages = result.current.sortedData.map((d) => d.age);
    expect(ages).toEqual([28, 28, 31, 35, 42]);

    act(() => result.current.toggleSort("age"));
    ages = result.current.sortedData.map((d) => d.age);
    expect(ages).toEqual([42, 35, 31, 28, 28]);
  });

  it("sorts strings case-insensitively", () => {
    const mixedCaseData = [
      { name: "zebra", value: 1 },
      { name: "Apple", value: 2 },
      { name: "banana", value: 3 },
    ];

    const { result } = renderHook(() => useTableSort(mixedCaseData, "name"));

    const names = result.current.sortedData.map((d) => d.name);
    expect(names).toEqual(["Apple", "banana", "zebra"]);
  });

  it("handles null values by pushing them to the end in ascending order", () => {
    const { result } = renderHook(() => useTableSort(testData));

    act(() => result.current.toggleSort("city"));

    const cities = result.current.sortedData.map((d) => d.city);
    // null should be at the end in ascending order
    expect(cities[cities.length - 1]).toBeNull();
    // Non-null values should be sorted
    const nonNullCities = cities.filter((c) => c !== null);
    expect(nonNullCities).toEqual(["Amsterdam", "Den Haag", "Rotterdam", "Utrecht"]);
  });

  it("places null values at the start in descending order", () => {
    const { result } = renderHook(() => useTableSort(testData));

    act(() => result.current.toggleSort("city"));
    act(() => result.current.toggleSort("city"));

    const cities = result.current.sortedData.map((d) => d.city);
    // In descending order, the sort logic returns 1 for null aVal (putting null first)
    expect(cities[0]).toBeNull();
    // Non-null values should be sorted descending
    const nonNullCities = cities.filter((c) => c !== null);
    expect(nonNullCities).toEqual(["Utrecht", "Rotterdam", "Den Haag", "Amsterdam"]);
  });

  it("resets sort to initial state", () => {
    const { result } = renderHook(() => useTableSort(testData, "name"));

    // Change sort
    act(() => result.current.toggleSort("age"));
    act(() => result.current.toggleSort("age"));
    expect(result.current.sortConfig).toEqual({ key: "age", direction: "desc" });

    // Reset
    act(() => result.current.resetSort());
    expect(result.current.sortConfig).toEqual({ key: "name", direction: "asc" });
  });

  it("does not mutate the original data array", () => {
    const originalData = [...testData];
    const { result } = renderHook(() => useTableSort(testData));

    act(() => result.current.toggleSort("name"));

    // Original should be unchanged
    expect(testData).toEqual(originalData);
    // Sorted should be a different reference
    expect(result.current.sortedData).not.toBe(testData);
  });

  it("handles empty data array", () => {
    const { result } = renderHook(() => useTableSort<TestItem>([]));

    expect(result.current.sortedData).toEqual([]);

    act(() => result.current.toggleSort("name"));
    expect(result.current.sortedData).toEqual([]);
  });

  it("updates sorted data when input data changes", () => {
    const { result, rerender } = renderHook(
      ({ data }) => useTableSort(data, "name"),
      { initialProps: { data: testData } }
    );

    const newData: TestItem[] = [
      { name: "Zara", age: 22, city: "Groningen" },
      { name: "Aad", age: 55, city: "Leiden" },
    ];

    rerender({ data: newData });

    const names = result.current.sortedData.map((d) => d.name);
    expect(names).toEqual(["Aad", "Zara"]);
  });
});

/**
 * Sorteren op een afgeleide waarde (`accessors`). De klantenlijst sorteert de
 * kolom "Naam" op achternaam — "Jan van der Berg" hoort onder de V — terwijl
 * de cel gewoon `naam` blijft tonen. De accessor-map is daarvoor de enige
 * ingang; zonder map blijft de hook zich exact gedragen als voorheen.
 */
describe("useTableSort met accessors", () => {
  interface KlantRij {
    naam: string;
    voornaam?: string;
    achternaam?: string;
    klantType?: "particulier" | "zakelijk";
    plaats: string;
  }

  const klanten: KlantRij[] = [
    { naam: "Jan van der Berg", voornaam: "Jan", achternaam: "van der Berg", klantType: "particulier", plaats: "Meppel" },
    { naam: "Anna Zwart", voornaam: "Anna", achternaam: "Zwart", klantType: "particulier", plaats: "Assen" },
    { naam: "Piet Aalders", voornaam: "Piet", achternaam: "Aalders", klantType: "particulier", plaats: "Zwolle" },
    { naam: "De Groene Tuin B.V.", klantType: "zakelijk", plaats: "Meppel" },
  ];

  const accessors = { naam: sorteerNaam };

  it("sorts on the derived value instead of the raw field", () => {
    const { result } = renderHook(() => useTableSort(klanten, "naam", accessors));

    // aalders piet | de groene tuin b.v. (bedrijf sorteert op `naam`) |
    // van der berg jan (tussenvoegsel telt mee, dus onder de V) | zwart anna
    expect(result.current.sortedData.map((k) => k.naam)).toEqual([
      "Piet Aalders",
      "De Groene Tuin B.V.",
      "Jan van der Berg",
      "Anna Zwart",
    ]);
  });

  it("keeps the arrow working: toggling reverses the derived order", () => {
    const { result } = renderHook(() => useTableSort(klanten, "naam", accessors));

    act(() => result.current.toggleSort("naam"));
    expect(result.current.sortConfig).toEqual({ key: "naam", direction: "desc" });
    expect(result.current.sortedData.map((k) => k.naam)).toEqual([
      "Anna Zwart",
      "Jan van der Berg",
      "De Groene Tuin B.V.",
      "Piet Aalders",
    ]);
  });

  it("falls back to the raw field for keys without an accessor", () => {
    const { result } = renderHook(() => useTableSort(klanten, "naam", accessors));

    act(() => result.current.toggleSort("plaats"));
    expect(result.current.sortedData.map((k) => k.plaats)).toEqual([
      "Assen",
      "Meppel",
      "Meppel",
      "Zwolle",
    ]);
  });

  it("sorts identically to the plain hook when no accessors are given", () => {
    const zonder = renderHook(() => useTableSort(testData, "name"));
    const metLegeMap = renderHook(() => useTableSort(testData, "name", {}));

    expect(metLegeMap.result.current.sortedData).toEqual(
      zonder.result.current.sortedData
    );
  });

  it("pushes empty accessor values to the end in ascending order", () => {
    const rijen = [
      { naam: "Bakker", sleutel: "bakker" },
      { naam: "Onbekend", sleutel: null },
      { naam: "Alberts", sleutel: "alberts" },
    ];

    const { result } = renderHook(() =>
      useTableSort(rijen, "naam", { naam: (rij) => rij.sleutel })
    );

    expect(result.current.sortedData.map((r) => r.naam)).toEqual([
      "Alberts",
      "Bakker",
      "Onbekend",
    ]);
  });
});
