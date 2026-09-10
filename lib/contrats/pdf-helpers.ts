import "server-only";

import { createHash } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ContratPdf, type PreuveSignature } from "@/components/contrats/contrat-pdf";
import type {
  ClientSnapshot,
  ContratRow,
  PrestataireSnapshot,
} from "@/lib/contrats/rendu";
import type { Database } from "@/types/database";

type AnySupabase = SupabaseClient<Database>;

/** Télécharge le logo du bucket `logos` en data URI (tolérant à l'échec). */
export async function chargerLogoDataUri(
  supabase: AnySupabase,
  logoUrl: string | null | undefined,
): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    const { data: blob } = await supabase.storage
      .from("logos")
      .download(logoUrl);
    if (!blob) return null;
    const buf = Buffer.from(await blob.arrayBuffer());
    const ext = logoUrl.split(".").pop()?.toLowerCase();
    const mime =
      ext === "svg"
        ? "image/svg+xml"
        : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "webp"
            ? "image/webp"
            : "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Télécharge la signature PNG du bucket `signatures` en data URI. */
export async function chargerSignatureDataUri(
  supabase: AnySupabase,
  signaturePath: string | null | undefined,
): Promise<string | null> {
  if (!signaturePath) return null;
  try {
    const { data: blob } = await supabase.storage
      .from("signatures")
      .download(signaturePath);
    if (!blob) return null;
    const buf = Buffer.from(await blob.arrayBuffer());
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export function construirePreuve(
  contrat: ContratRow,
  sha256: string | null,
): PreuveSignature | null {
  if (!contrat.signed_at) return null;
  return {
    signataireNom: contrat.signataire_nom ?? "—",
    signeLeText: new Date(contrat.signed_at).toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      dateStyle: "full",
      timeStyle: "medium",
    }),
    ip: contrat.signature_ip ?? "—",
    userAgent: contrat.signature_user_agent ?? "—",
    sha256,
  };
}

/**
 * Rendu du PDF signé en DEUX passes :
 * 1. document contractuel seul (contrat + signature, sans page de
 *    preuve) → empreinte SHA-256 ;
 * 2. document final avec la page de preuve qui reprend cette empreinte.
 * L'empreinte imprimée et stockée (pdf_sha256) identifie donc le
 * contenu contractuel présenté au signataire — verifiable en
 * régénérant la passe 1 depuis les données archivées.
 */
export async function rendreContratSigne(args: {
  contrat: ContratRow;
  prestataire: PrestataireSnapshot;
  clientSnapshot: ClientSnapshot;
  logoData: string | null;
  signatureData: string | null;
}): Promise<{ pdf: Buffer; sha256: string }> {
  const base = await renderToBuffer(
    ContratPdf({
      contrat: args.contrat,
      prestataire: args.prestataire,
      clientSnapshot: args.clientSnapshot,
      logoData: args.logoData,
      signatureData: args.signatureData,
      preuve: null,
    }),
  );
  const sha256 = createHash("sha256").update(base).digest("hex");

  const finalBuffer = await renderToBuffer(
    ContratPdf({
      contrat: args.contrat,
      prestataire: args.prestataire,
      clientSnapshot: args.clientSnapshot,
      logoData: args.logoData,
      signatureData: args.signatureData,
      preuve: construirePreuve(args.contrat, sha256),
    }),
  );
  return { pdf: Buffer.from(finalBuffer), sha256 };
}
