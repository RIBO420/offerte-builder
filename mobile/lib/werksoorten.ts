export const ANDERS_WERKSOORTEN = ['Winkel', 'Loods opruimen', 'Vergadering', 'Administratie', 'Bezichtiging', 'Inspectie'] as const;
export type Werksoort = typeof ANDERS_WERKSOORTEN[number] | 'Tuinaanleg' | 'Tuinonderhoud';
