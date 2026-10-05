import { v } from 'convex/values';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { isKantoorRol } from './roles';
import { isEmailVerzendenActief } from './lib/mailGuard';
import { leesDekking } from './veldDekking';

export const leesOpdracht = internalQuery({
  args: { runId: v.id('veldHerinnerRuns') }, handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run || run.emailStatus !== 'gepland') return null;
    const org = await ctx.db.get(run.orgId);
    if (!org?.actief) return null;
    const config = await ctx.db.query('veldHerinnerInstellingen').withIndex('by_org', q => q.eq('orgId', run.orgId)).unique();
    if (!config?.actief || !config.ookEmail) return null;
    const users = await Promise.all(config.ontvangerIds.map(id => ctx.db.get(id)));
    const ontvangers = [...new Set(users.filter(u => u?.orgId === run.orgId && isKantoorRol(u.role)).flatMap(u => u?.email ? [u.email] : []))];
    const rijen = await leesDekking(ctx, run.orgId, run.datum, run.datum);
    const open = rijen.filter(r => r.status === 'open' || r.status === 'deels');
    if (!ontvangers.length || !open.length) return null;
    return { ontvangers, onderwerp: `Top Tuinen — open velduren (${run.datum})`, tekst: [
      `Stand van ${run.datum}:`, '', ...open.map(r => `• ${r.medewerkerNaam}: ${r.status === 'deels' ? 'deels ingediend' : 'nog niet ingediend'}`), '',
      `Wel ingediend: ${rijen.filter(r => r.status === 'ingediend').length}.`,
      'Bekijk de urencontrole in Top Tuinen OS voor de details en klusdekking.',
    ].join('\n') };
  },
});
export const registreer = internalMutation({
  args: { runId: v.id('veldHerinnerRuns'), status: v.union(v.literal('verzonden'), v.literal('onderdrukt'), v.literal('mislukt')), fout: v.optional(v.string()) },
  handler: async (ctx, args) => { const run = await ctx.db.get(args.runId); if (run?.emailStatus === 'gepland') await ctx.db.patch(run._id, { emailStatus: args.status, emailFout: args.fout?.slice(0, 500) }); },
});
/** Uitsluitend door opt-in cron; geen publiek endpoint dat mail kan triggeren. */
export const verstuur = internalAction({
  args: { runId: v.id('veldHerinnerRuns') }, handler: async (ctx, { runId }) => {
    const opdracht = await ctx.runQuery(internal.veldHerinnerEmail.leesOpdracht, { runId });
    if (!opdracht || !isEmailVerzendenActief()) {
      await ctx.runMutation(internal.veldHerinnerEmail.registreer, { runId, status: 'onderdrukt', fout: !opdracht ? 'Geen actuele open dagen of actieve ontvangers.' : 'Verzending staat uit in deze omgeving.' });
      return;
    }
    const apiKey = process.env.RESEND_API_KEY;
    const afzender = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !afzender) {
      await ctx.runMutation(internal.veldHerinnerEmail.registreer, { runId, status: 'mislukt', fout: 'Mailprovider of geverifieerde afzender ontbreekt.' }); return;
    }
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('https://api.resend.com/emails', { method: 'POST', signal: controller.signal, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `velduren-${runId}` }, body: JSON.stringify({ from: afzender, to: opdracht.ontvangers, subject: opdracht.onderwerp, text: opdracht.tekst }) });
      if (!response.ok) throw new Error(`Mailprovider antwoordde met status ${response.status}.`);
      await ctx.runMutation(internal.veldHerinnerEmail.registreer, { runId, status: 'verzonden' });
    } catch (error) {
      await ctx.runMutation(internal.veldHerinnerEmail.registreer, { runId, status: 'mislukt', fout: error instanceof Error ? error.message : 'Mailverzending mislukt.' });
    } finally { clearTimeout(timeout); }
  },
});
