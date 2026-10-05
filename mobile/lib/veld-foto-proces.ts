/** Uploadcheckpoint houdt metadataretries bij dezelfde geüploade bytes. */
export interface FotoUpload { storageId: string; ticketId: string }
export async function verwerkFotoUpload(opties: {
  juisteSessie: () => boolean;
  leesCheckpoint: () => Promise<FotoUpload | null>;
  upload: () => Promise<FotoUpload>;
  bewaarCheckpoint: (waarde: FotoUpload) => Promise<void>;
  koppel: (waarde: FotoUpload) => Promise<unknown>;
}) {
  const check = () => { if (!opties.juisteSessie()) throw new Error('Account gewijzigd'); };
  check();
  let upload = await opties.leesCheckpoint();
  check();
  if (!upload) {
    upload = await opties.upload();
    // Ook bij accountwissel het reeds verstuurde bestand onder de OUDE scope
    // bewaren; anders zou de volgende poging nog een bestand uploaden.
    await opties.bewaarCheckpoint(upload);
  }
  check();
  return opties.koppel(upload);
}
