import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/database";
import { aujourdhuiParis } from "@/lib/dates";
import { etatLienDevis, type EtatLienDevis } from "@/lib/devis-public";
import { payloadLignesPdf, type LignePdf } from "@/lib/pdf-payload";
import { logoApplication } from "@/lib/logo-app";
import { acompteDevis } from "@/lib/devis-mentions";
import { nomExpediteur, type Profil } from "@/lib/visites/proposer";

type DevisRow = Database["public"]["Tables"]["devis"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

export type DevisPublic = {
  etat: EtatLienDevis | "indisponible";
  devis: DevisRow | null;
  client: ClientRow | null;
  profil: Profil | null;
  lignes: LignePdf[];
  prestataireNom: string;
  /** « 375,00 € (30 %) », null sans acompte. */
  acompteText: string | null;
};

/**
 * Résolution d'un devis par son jeton — CÔTÉ SERVEUR UNIQUEMENT (service
 * role, RLS fermée à anon). Les lignes passent par la liste blanche du
 * PDF : jamais de prix d'achat ni de fournisseur.
 */
export async function getDevisParToken(token: string): Promise<DevisPublic> {
  const vide: DevisPublic = { etat: "introuvable", devis: null, client: null, profil: null, lignes: [], prestataireNom: "Votre artisan", acompteText: null };
  if (!token || token.length < 16) return vide;
  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch (e) {
    console.error("Lien public devis — service indisponible :", e);
    return { ...vide, etat: "indisponible" };
  }
  const { data: devis } = await service.from("devis").select("*").eq("access_token", token).maybeSingle();
  const etat = etatLienDevis(devis, new Date().toISOString(), aujourdhuiParis());
  if (!devis) return vide;

  const [{ data: client }, { data: profil }, { data: lignes }] = await Promise.all([
    service.from("clients").select("*").eq("id", devis.client_id).maybeSingle(),
    service.from("profil_entreprise").select("*").eq("user_id", devis.user_id).maybeSingle(),
    service.from("devis_lignes").select("*").eq("devis_id", devis.id).order("ordre"),
  ]);
  return {
    etat,
    devis,
    client: client ?? null,
    profil: (profil as Profil | null) ?? null,
    lignes: payloadLignesPdf(lignes ?? []),
    prestataireNom: nomExpediteur(profil as Profil | null),
    acompteText:
      acompteDevis(
        Number(devis.total_ht),
        devis.acompte_pct !== null ? Number(devis.acompte_pct) : null,
        devis.acompte_montant !== null ? Number(devis.acompte_montant) : null,
      )?.texte ?? null,
  };
}

/** Logo du profil (bucket privé) ou de l'application, en data URI. */
export async function logoDataUri(service: ReturnType<typeof createServiceClient>, logoUrl: string | null | undefined): Promise<string | null> {
  if (logoUrl) {
    try {
      const { data: blob } = await service.storage.from("logos").download(logoUrl);
      if (blob) {
        const buf = Buffer.from(await blob.arrayBuffer());
        const ext = logoUrl.split(".").pop()?.toLowerCase();
        const mime = ext === "svg" ? "image/svg+xml" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
        return `data:${mime};base64,${buf.toString("base64")}`;
      }
    } catch {
      // repli ci-dessous
    }
  }
  return logoApplication();
}

/** Signature « bon pour accord » (bucket privé) en data URI. */
export async function signatureDataUri(service: ReturnType<typeof createServiceClient>, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  try {
    const { data: blob } = await service.storage.from("signatures").download(path);
    if (!blob) return null;
    return `data:image/png;base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/** PDF du devis tel que le client le voit (signature comprise si signé). */
export async function rendrePdfDevisPublic(pub: DevisPublic): Promise<Buffer> {
  const service = createServiceClient();
  const [{ renderToBuffer }, { DevisPdf }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/devis/devis-pdf")]);
  const [logoData, signatureData] = await Promise.all([
    logoDataUri(service, pub.profil?.logo_url),
    signatureDataUri(service, pub.devis?.signature_client_url),
  ]);
  return renderToBuffer(
    DevisPdf({ devis: pub.devis!, lignes: pub.lignes, client: pub.client, profil: pub.profil, logoData, signatureData }),
  );
}
