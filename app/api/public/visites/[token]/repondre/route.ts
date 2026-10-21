import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { reponseVisiteSchema } from "@/lib/creneaux-visite";
import { repondreProposition } from "@/lib/visites/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Réponse PUBLIQUE du client à une proposition de visite (aucun compte) :
 * le jeton est résolu côté serveur (service role), l'état revérifié, le
 * créneau choisi revalidé contre l'agenda, puis le rendez-vous créé.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  if (!token || token.length < 16) {
    return NextResponse.json({ ok: false, error: "Lien invalide." }, { status: 404 });
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête illisible." }, { status: 400 });
  }
  const parsed = reponseVisiteSchema.safeParse(corps);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Choix invalide." }, { status: 400 });
  }
  try {
    const res = await repondreProposition(token, parsed.data);
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.code });
    return NextResponse.json({ ok: true, resultat: res.resultat });
  } catch (e) {
    Sentry.captureException(e, { tags: { route: "visites/repondre" } });
    return NextResponse.json(
      { ok: false, error: "Service momentanément indisponible — réessayez dans quelques minutes." },
      { status: 503 },
    );
  }
}
