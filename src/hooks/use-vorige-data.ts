"use client";

import { useState } from "react";

/**
 * Houdt het laatste niet-`undefined` resultaat van een query vast.
 *
 * Convex' `useQuery` geeft `undefined` zodra de argumenten wijzigen (andere
 * week, maand, team). Zonder dit hookje klapt een raster dan in tot
 * "laden…" en springt de pagina. Met dit hookje blijft het vorige resultaat
 * staan tot het nieuwe binnen is; `verversen` is dan `true`, zodat de
 * aanroeper het raster even kan dimmen (bv. `opacity-60`) in plaats van een
 * skeleton te tonen.
 *
 * Alleen bij de allereerste lading is `data` nog `undefined`.
 */
export function useVorigeData<T>(data: T | undefined): {
  data: T | undefined;
  verversen: boolean;
} {
  const [vorige, setVorige] = useState<T | undefined>(data);
  // Toestand bijstellen tijdens render (React-patroon "informatie uit
  // vorige renders"), geen effect: zo staat het nieuwe resultaat er in
  // dezelfde render al.
  if (data !== undefined && data !== vorige) {
    setVorige(data);
  }
  return {
    data: data ?? vorige,
    verversen: data === undefined && vorige !== undefined,
  };
}
