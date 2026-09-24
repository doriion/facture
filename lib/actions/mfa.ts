"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  facteursTotpNonVerifies,
  facteurTotpVerifie,
  normaliserCodeTotp,
  verificationRequise,
} from "@/lib/mfa-helpers";
import { sanitizeNextPath } from "@/lib/safe-next";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type EtatMfa = {
  /** Facteur TOTP actif (null = double authentification désactivée). */
  actif: { id: string; depuis: string } | null;
  /** Niveau de la session courante : aal1 (mot de passe) ou aal2 (code vérifié). */
  niveau: string | null;
};

/**
 * Double authentification par application (TOTP : Google Authenticator,
 * Authy, 1Password…), portée par Supabase Auth. Rien n'est stocké dans
 * les tables de l'application.
 */
export async function etatMfa(): Promise<EtatMfa> {
  const supabase = createClient();
  const [{ data: facteurs }, { data: aal }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const actif = facteurTotpVerifie(facteurs?.totp ?? []);
  return {
    actif: actif ? { id: actif.id, depuis: actif.created_at } : null,
    niveau: aal?.currentLevel ?? null,
  };
}

/**
 * Démarre l'enrôlement : renvoie le QR code (SVG) et le secret à saisir
 * dans l'application. Le facteur reste « non vérifié » — donc sans
 * effet — tant que le premier code n'a pas été confirmé.
 */
export async function demarrerEnrolementAction(): Promise<
  ActionResult<{ factorId: string; qrCodeSvg: string; secret: string; uri: string }>
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  // Un enrôlement commencé puis abandonné bloquerait le suivant (nom
  // déjà pris) : on nettoie les facteurs jamais confirmés.
  const { data: existants } = await supabase.auth.mfa.listFactors();
  if (facteurTotpVerifie(existants?.totp ?? [])) {
    return { ok: false, error: "La double authentification est déjà activée." };
  }
  for (const f of facteursTotpNonVerifies(existants?.totp ?? [])) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "NG Gestion",
    issuer: "NG Gestion",
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Enrôlement impossible." };
  return {
    ok: true,
    data: {
      factorId: data.id,
      qrCodeSvg: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    },
  };
}

/** Confirme l'enrôlement avec le premier code : la session passe en aal2. */
export async function confirmerEnrolementAction(
  factorId: string,
  saisie: string,
): Promise<ActionResult> {
  const code = normaliserCodeTotp(saisie);
  if (!code) return { ok: false, error: "Le code fait 6 chiffres." };
  const supabase = createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    return {
      ok: false,
      error: /invalid|expired|incorrect/i.test(error.message)
        ? "Code incorrect ou expiré : réessayez avec le code affiché maintenant."
        : error.message,
    };
  }
  revalidatePath("/parametres");
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Désactive la double authentification (session aal2 requise par Supabase). */
export async function desactiverMfaAction(saisie: string): Promise<ActionResult> {
  const code = normaliserCodeTotp(saisie);
  if (!code) return { ok: false, error: "Saisissez le code de votre application pour confirmer." };
  const supabase = createClient();
  const { data: facteurs } = await supabase.auth.mfa.listFactors();
  const actif = facteurTotpVerifie(facteurs?.totp ?? []);
  if (!actif) return { ok: false, error: "Aucune double authentification active." };

  // Le code prouve que c'est bien le détenteur de l'application qui
  // désactive — et remonte la session en aal2 si besoin.
  const { error: verifErr } = await supabase.auth.mfa.challengeAndVerify({
    factorId: actif.id,
    code,
  });
  if (verifErr) return { ok: false, error: "Code incorrect ou expiré." };

  const { error } = await supabase.auth.mfa.unenroll({ factorId: actif.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/parametres");
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Deuxième étape de la connexion : vérifie le code puis ouvre la page
 * demandée. Redirige côté serveur (comme signInAction) ; ne renvoie
 * un résultat qu'en cas d'erreur.
 */
export async function verifierCodeConnexionAction(
  saisie: string,
  next?: string,
): Promise<{ ok: false; error: string } | void> {
  const code = normaliserCodeTotp(saisie);
  if (!code) return { ok: false, error: "Le code fait 6 chiffres." };
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: facteurs }, { data: aal }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const actif = facteurTotpVerifie(facteurs?.totp ?? []);
  if (!actif || !verificationRequise(aal?.currentLevel, facteurs?.totp ?? [])) {
    // Rien à vérifier (déjà en aal2, ou aucun facteur) : on continue.
    redirect(sanitizeNextPath(next));
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: actif.id, code });
  if (error) {
    return {
      ok: false,
      error: /invalid|expired|incorrect/i.test(error.message)
        ? "Code incorrect ou expiré : réessayez avec le code affiché maintenant."
        : error.message,
    };
  }
  revalidatePath("/", "layout");
  redirect(sanitizeNextPath(next));
}
