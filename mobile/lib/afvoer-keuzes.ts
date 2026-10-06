/** Afvoer bij een klus: hoeveel aanhanger groenafval ging mee. Gedeeld door werkbezoek en wachtrij. */
export type AfvoerKeuze = 'geen' | 'kwart' | 'half' | 'driekwart' | 'vol';
export const AFVOER: [AfvoerKeuze, string][] = [['geen', 'Geen'], ['kwart', '¼ aanhanger'], ['half', '½ aanhanger'], ['driekwart', '¾ aanhanger'], ['vol', 'Volle aanhanger']];
