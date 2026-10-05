import { expect, it, vi } from 'vitest';
import { verwerkFotoUpload, type FotoUpload } from '../../../../mobile/lib/veld-foto-proces';
it('replayt na verloren koppelantwoord dezelfde storageID zonder opnieuw uploaden', async () => {
  let checkpoint: FotoUpload | null = null;
  const upload = vi.fn(async () => ({ storageId: 'photo', ticketId: 'ticket' }));
  const koppel = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ id: 'link' });
  const opties = { juisteSessie: () => true, leesCheckpoint: async () => checkpoint, upload, bewaarCheckpoint: async (v: FotoUpload) => { checkpoint = v; }, koppel };
  await expect(verwerkFotoUpload(opties)).rejects.toThrow('offline');
  await expect(verwerkFotoUpload(opties)).resolves.toEqual({ id: 'link' });
  expect(upload).toHaveBeenCalledTimes(1);
  expect(koppel.mock.calls[0]).toEqual(koppel.mock.calls[1]);
});
it('bewaart de upload onder oude scope maar koppelt niets na accountwissel', async () => {
  let huidig = true;
  const bewaar = vi.fn(), koppel = vi.fn();
  await expect(verwerkFotoUpload({ juisteSessie: () => huidig, leesCheckpoint: async () => null, upload: async () => { huidig = false; return { storageId: 'p', ticketId: 't' }; }, bewaarCheckpoint: bewaar, koppel })).rejects.toThrow('Account gewijzigd');
  expect(bewaar).toHaveBeenCalledWith({ storageId: 'p', ticketId: 't' }); expect(koppel).not.toHaveBeenCalled();
});
it('claimt geen gekoppelde foto als de lokale checkpoint niet opgeslagen kon worden', async () => {
  const koppel = vi.fn();
  await expect(verwerkFotoUpload({ juisteSessie: () => true, leesCheckpoint: async () => null, upload: async () => ({ storageId: 'p', ticketId: 't' }), bewaarCheckpoint: async () => { throw new Error('Opslag vol'); }, koppel })).rejects.toThrow('Opslag vol');
  expect(koppel).not.toHaveBeenCalled();
});
