/**
 * Reconnaissance vocale du navigateur (Web Speech API : Safari iOS,
 * Chrome). Pas de serveur, pas de clé : la voix est traitée par le
 * téléphone. Indisponible → le dialogue reste utilisable au clavier
 * (la dictée du clavier iPhone fonctionne aussi dans le champ).
 */

type ResultatVocal = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };
type ReconnaissanceVocale = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: ResultatVocal) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type Constructeur = new () => ReconnaissanceVocale;

function constructeur(): Constructeur | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Constructeur; webkitSpeechRecognition?: Constructeur };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function dicteeDisponible(): boolean {
  return constructeur() !== null;
}

export type SessionDictee = { arreter: () => void };

/**
 * Lance l'écoute en français ; `onTexte` reçoit le texte complet à
 * chaque mise à jour (intermédiaire puis définitif), `onFin` à l'arrêt.
 */
export function demarrerDictee(args: {
  onTexte: (texte: string) => void;
  onFin: () => void;
  onErreur: (message: string) => void;
}): SessionDictee | null {
  const C = constructeur();
  if (!C) return null;
  const rec = new C();
  rec.lang = "fr-FR";
  rec.continuous = true;
  rec.interimResults = true;
  let definitif = "";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]!;
      const t = r[0]?.transcript ?? "";
      if (r.isFinal) definitif += `${t} `;
      else interim += t;
    }
    args.onTexte(`${definitif}${interim}`.trim());
  };
  rec.onerror = (e) => {
    const messages: Record<string, string> = {
      "not-allowed": "Micro refusé : autorisez-le dans les réglages du navigateur.",
      "no-speech": "Rien entendu. Parlez après avoir appuyé sur le micro.",
      network: "La reconnaissance vocale a besoin du réseau.",
      "audio-capture": "Aucun micro disponible.",
    };
    args.onErreur(messages[e.error] ?? `Dictée interrompue (${e.error}).`);
  };
  rec.onend = () => args.onFin();
  try {
    rec.start();
  } catch {
    args.onErreur("Impossible de démarrer la dictée.");
    return null;
  }
  return { arreter: () => rec.stop() };
}
