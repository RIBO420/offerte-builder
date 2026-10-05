/** iOS may report a copied image as application/octet-stream. The picker keeps
 * the original extension when the durable copy is made. Never relabel an
 * unknown extension as an image merely to bypass the server's MIME check. */
export function veldFotoContentType(type: string, extension: string): string {
  if (type.toLowerCase().startsWith('image/')) return type.toLowerCase();
  const types: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp', gif: 'image/gif' };
  const gekozen = types[extension.replace(/^\./, '').toLowerCase()];
  if (!gekozen) throw new Error('Het bestand heeft geen herkenbaar fotoformaat. Kies de foto opnieuw.');
  return gekozen;
}
