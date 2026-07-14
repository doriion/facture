/**
 * Compression d'image CÔTÉ CLIENT avant upload (photos de chantier) :
 * redimensionne à max 1600 px (grand côté) et ré-encode en JPEG.
 * Une photo d'iPhone de ~4 Mo descend typiquement sous ~400 Ko —
 * crucial sur réseau de chantier.
 *
 * Tolérant : si le navigateur ne sait pas décoder le fichier (HEIC
 * hors Safari, formats exotiques), on renvoie l'original tel quel —
 * l'upload garde alors la limite serveur de 10 Mo.
 */

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

export async function compressImage(
  file: File,
  maxDimension: number = MAX_DIMENSION,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // Fond blanc : les PNG transparents ré-encodés en JPEG deviennent
    // noirs sinon.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) return file;

    // Si le fichier n'a pas été réduit ET que le ré-encodage est plus
    // lourd que l'original, garder l'original.
    if (scale === 1 && blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
