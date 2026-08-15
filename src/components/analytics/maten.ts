/**
 * Eén maat voor grafiek, skeleton en print (R6).
 *
 * De recharts-componenten komen via `dynamic()` binnen en renderen dus ná de
 * eerste paint. Reserveert de skeleton niet exact deze hoogte, dan springt de
 * hele pagina op het moment dat de chunk landt — dat was fase 3 van het oude
 * laadgedrag. Deze constante is daarom de enige plek waar de hoogte staat.
 */
export const BEWIJS_HOOGTE = 232;
