/**
 * Mail-rendering helpers voor transactionele mails (PRD §2.7).
 *
 * Pure functies, bewust dependency-vrij (net als mailGuard.ts) zodat
 * Convex-functies én unit-tests ze kunnen importeren.
 *
 * Principe 3: de HUISSTIJL zit in de layout (hieronder), niet in de tekst.
 * Sjablonen en concept-mails zijn platte tekst met {{variabelen}}; kantoor
 * bewerkt alleen inhoudsvelden, geen opmaak. Bij verzending wordt de platte
 * tekst omgezet naar paragrafen binnen de branded layout (zelfde visuele
 * stijl als portaalEmail.ts: groene header, witte content, grijze footer).
 */

/** Vervang {{variabelen}} door waarden; onbekende variabelen blijven staan. */
export function renderTemplateString(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return variables[key] ?? match;
  });
}

/** Minimale HTML-escaping voor platte tekst die in HTML terechtkomt. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Platte tekst → HTML-paragrafen (dubbele newline = nieuwe alinea,
 * enkele newline = regeleinde). Escaped — de tekst kan door kantoor
 * bewerkt zijn en mag nooit als HTML geïnterpreteerd worden.
 */
export function tekstNaarHtmlParagrafen(tekst: string): string {
  return tekst
    .split(/\n{2,}/)
    .map((alinea) => alinea.trim())
    .filter((alinea) => alinea.length > 0)
    .map(
      (alinea) =>
        `<p style="color:#374151;font-size:15px;line-height:24px;margin:0 0 16px;">${escapeHtml(alinea).replace(/\n/g, "<br />")}</p>`
    )
    .join("\n");
}

/**
 * Branded HTML-layout (huisstijl) rond de mail-body. Zelfde visuele opzet
 * als de bestaande portaal-mails (portaalEmail.ts).
 */
export function wrapInBrandedLayout(params: {
  bedrijfsNaam: string;
  bedrijfsEmail: string;
  bedrijfsTelefoon: string;
  title: string;
  bodyHtml: string;
}): string {
  const contactParts = [escapeHtml(params.bedrijfsNaam)];
  if (params.bedrijfsEmail) {
    contactParts.push(
      `<a href="mailto:${escapeHtml(params.bedrijfsEmail)}" style="color:#16a34a;text-decoration:none;">${escapeHtml(params.bedrijfsEmail)}</a>`
    );
  }
  if (params.bedrijfsTelefoon) {
    contactParts.push(escapeHtml(params.bedrijfsTelefoon));
  }

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Ubuntu,sans-serif;margin:0;padding:0;">
  <div style="background-color:#ffffff;margin:0 auto;max-width:600px;">
    <!-- Header -->
    <div style="background-color:#16a34a;padding:24px 32px;">
      <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">${escapeHtml(params.bedrijfsNaam)}</h1>
    </div>
    <!-- Content -->
    <div style="padding:32px;">
      <h2 style="color:#1f2937;font-size:24px;font-weight:600;margin:0 0 24px;">${escapeHtml(params.title)}</h2>
      ${params.bodyHtml}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#4b5563;font-size:15px;line-height:24px;margin:0;">
        Met vriendelijke groet,<br /><strong>${escapeHtml(params.bedrijfsNaam)}</strong>
      </p>
    </div>
    <!-- Footer -->
    <div style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 32px;">
      <p style="color:#6b7280;font-size:13px;margin:0;text-align:center;">
        ${contactParts.join(" | ")}
      </p>
    </div>
  </div>
</body>
</html>`;
}
