// Nederlandse input patterns en configuraties

export interface InputPatternConfig {
  pattern?: string;
  placeholder?: string;
  inputMode?: "text" | "tel" | "email" | "decimal" | "numeric";
  autoComplete?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  format?: (value: string) => string;
  validate?: (value: string) => boolean;
}

export const inputPatterns: Record<string, InputPatternConfig> = {
  postcode: {
    pattern: "^[1-9][0-9]{3}\\s?[A-Za-z]{2}$",
    placeholder: "1234 AB",
    inputMode: "text",
    autoComplete: "postal-code",
    maxLength: 7,
    format: (value: string) => {
      // Format naar "1234 AB" formaat
      const clean = value.replace(/\s/g, "").toUpperCase();
      if (clean.length > 4) {
        return clean.slice(0, 4) + " " + clean.slice(4, 6);
      }
      return clean;
    },
    validate: (value: string) => /^[1-9][0-9]{3}\s?[A-Za-z]{2}$/.test(value),
  },
  telefoon: {
    pattern: "^(\\+31|0)[1-9][0-9]{8}$",
    placeholder: "06 12345678",
    inputMode: "tel",
    autoComplete: "tel",
    format: (value: string) => {
      // Format met spaties
      const clean = value.replace(/[^0-9+]/g, "");
      if (clean.startsWith("06") && clean.length > 2) {
        return (
          clean.slice(0, 2) +
          " " +
          clean.slice(2, 6) +
          (clean.length > 6 ? " " + clean.slice(6, 10) : "")
        );
      }
      // Format voor andere nummers (landlijnen)
      if (clean.startsWith("0") && clean.length > 3) {
        return (
          clean.slice(0, 3) +
          " " +
          clean.slice(3, 6) +
          (clean.length > 6 ? " " + clean.slice(6, 10) : "")
        );
      }
      // Format voor +31 nummers
      if (clean.startsWith("+31") && clean.length > 3) {
        return (
          clean.slice(0, 3) +
          " " +
          clean.slice(3, 5) +
          (clean.length > 5 ? " " + clean.slice(5, 9) : "") +
          (clean.length > 9 ? " " + clean.slice(9, 13) : "")
        );
      }
      return clean;
    },
    validate: (value: string) =>
      /^(\+31|0)[1-9][0-9]{8}$/.test(value.replace(/\s/g, "")),
  },
  email: {
    pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
    placeholder: "naam@voorbeeld.nl",
    inputMode: "email",
    autoComplete: "email",
    validate: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  },
  oppervlakte: {
    min: 0,
    max: 10000,
    step: 0.5,
    suffix: "m\u00B2",
    inputMode: "decimal",
    placeholder: "0",
    format: (value: string) => {
      // Verwijder niet-numerieke tekens behalve punt en komma
      const clean = value.replace(/[^0-9.,]/g, "").replace(",", ".");
      return clean;
    },
    validate: (value: string) => {
      const num = parseFloat(value.replace(",", "."));
      return !isNaN(num) && num >= 0 && num <= 10000;
    },
  },
  bedrag: {
    min: 0,
    step: 0.01,
    prefix: "\u20AC",
    inputMode: "decimal",
    placeholder: "0,00",
    format: (value: string) => {
      // Verwijder niet-numerieke tekens behalve punt en komma
      const clean = value.replace(/[^0-9.,]/g, "").replace(",", ".");
      return clean;
    },
    validate: (value: string) => {
      const num = parseFloat(value.replace(",", "."));
      return !isNaN(num) && num >= 0;
    },
  },
  huisnummer: {
    pattern: "^[1-9][0-9]{0,4}[a-zA-Z]?$",
    placeholder: "123a",
    inputMode: "text",
    autoComplete: "address-line2",
    maxLength: 6,
    format: (value: string) => {
      // Behoud alleen cijfers en letters
      return value.replace(/[^0-9a-zA-Z]/g, "");
    },
    validate: (value: string) => /^[1-9][0-9]{0,4}[a-zA-Z]?$/.test(value),
  },
  kvkNummer: {
    pattern: "^[0-9]{8}$",
    placeholder: "12345678",
    inputMode: "numeric",
    maxLength: 8,
    format: (value: string) => {
      return value.replace(/[^0-9]/g, "").slice(0, 8);
    },
    validate: (value: string) => /^[0-9]{8}$/.test(value),
  },
  btwNummer: {
    pattern: "^NL[0-9]{9}B[0-9]{2}$",
    placeholder: "NL123456789B01",
    inputMode: "text",
    maxLength: 14,
    format: (value: string) => {
      // Automatisch NL prefix en uppercase
      let clean = value.toUpperCase().replace(/[^0-9A-Z]/g, "");
      if (!clean.startsWith("NL")) {
        clean = "NL" + clean.replace(/^NL/, "");
      }
      return clean.slice(0, 14);
    },
    validate: (value: string) => /^NL[0-9]{9}B[0-9]{2}$/.test(value.toUpperCase()),
  },
  iban: {
    pattern: "^NL[0-9]{2}[A-Z]{4}[0-9]{10}$",
    placeholder: "NL91 ABNA 0417 1643 00",
    inputMode: "text",
    autoComplete: "cc-number",
    maxLength: 22,
    format: (value: string) => {
      // Format met spaties per 4 karakters
      const clean = value.toUpperCase().replace(/[^0-9A-Z]/g, "");
      const groups = clean.match(/.{1,4}/g);
      return groups ? groups.join(" ") : clean;
    },
    validate: (value: string) => {
      const clean = value.replace(/\s/g, "").toUpperCase();
      return /^NL[0-9]{2}[A-Z]{4}[0-9]{10}$/.test(clean);
    },
  },
};

export type InputPatternKey =
  | "postcode"
  | "telefoon"
  | "email"
  | "oppervlakte"
  | "bedrag"
  | "huisnummer"
  | "kvkNummer"
  | "btwNummer"
  | "iban";

/**
 * Helper functie om pattern config op te halen
 */
export function getInputPattern(key: InputPatternKey): InputPatternConfig {
  return inputPatterns[key];
}

/**
 * Helper functie om te valideren
 */
export function validateInput(key: InputPatternKey, value: string): boolean {
  const pattern = inputPatterns[key];
  if (pattern.validate) {
    return pattern.validate(value);
  }
  if (pattern.pattern) {
    return new RegExp(pattern.pattern).test(value);
  }
  return true;
}

/**
 * Helper functie om te formatteren
 */
export function formatInput(key: InputPatternKey, value: string): string {
  const pattern = inputPatterns[key];
  if (pattern.format) {
    return pattern.format(value);
  }
  return value;
}
