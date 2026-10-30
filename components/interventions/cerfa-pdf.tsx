/* eslint-disable jsx-a11y/alt-text -- Image de react-pdf : pas d'attribut alt (document PDF, pas DOM). */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/stylesheet";

import { formatDateFr } from "@/lib/format";
import { familleFluide } from "@/lib/fluides";
import type { CerfaData } from "@/lib/cerfa";

/**
 * Fiche d'intervention fluides frigorigènes : reproduction de la mise
 * en page du formulaire officiel CERFA n° 15497*04 (en-tête, cadres 1
 * à 14, cases à cocher, tableau de signatures, mention de conservation),
 * remplie avec les données de l'intervention. Le document est archivé
 * dans Supabase Storage et conservé 5 ans (opérateur et détenteur).
 */

const NOIR = "#000000";
const GRIS = "#d9d9d9";
const BLEU = "#dbe8f7";
const BLEU_FONCE = "#9dbfe6";
const TRAIT = `0.8pt solid ${NOIR}`;

const s = StyleSheet.create({
  page: { paddingTop: 22, paddingHorizontal: 30, paddingBottom: 18, fontSize: 6.6, fontFamily: "Helvetica", color: NOIR, lineHeight: 1.25 },
  entete: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  marianne: { width: 78, alignItems: "flex-start" },
  marianneBloc: { borderLeft: `2pt solid #0b3d91`, paddingLeft: 3 },
  marianneTxt: { fontSize: 5, lineHeight: 1.15 },
  titreBloc: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  titre: { fontSize: 13, fontFamily: "Helvetica-Bold", lineHeight: 1.1, marginBottom: 3 },
  sousTitre: { fontSize: 6.4, fontFamily: "Helvetica-Oblique", textAlign: "center", lineHeight: 1.25 },
  cerfaBloc: { width: 78, alignItems: "flex-end" },
  cerfaOvale: { backgroundColor: NOIR, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 3 },
  cerfaTxt: { color: "#ffffff", fontFamily: "Helvetica-BoldOblique", fontSize: 11 },
  cerfaNum: { fontSize: 7, marginTop: 2 },

  tableau: { borderLeft: TRAIT, borderTop: TRAIT },
  ligne: { flexDirection: "row", borderBottom: TRAIT },
  cellule: { borderRight: TRAIT, paddingHorizontal: 3, paddingVertical: 2, justifyContent: "center" },
  gras: { fontFamily: "Helvetica-Bold" },
  centre: { textAlign: "center" },
  grisBg: { backgroundColor: GRIS },
  bleuBg: { backgroundColor: BLEU },
  bleuFonceBg: { backgroundColor: BLEU_FONCE },
  champ: { border: `0.6pt solid ${NOIR}`, backgroundColor: BLEU, paddingHorizontal: 3, paddingVertical: 1.5, minHeight: 11, justifyContent: "center" },
  champBlanc: { border: `0.6pt solid ${NOIR}`, backgroundColor: "#ffffff", paddingHorizontal: 3, paddingVertical: 1.5, minHeight: 11, justifyContent: "center" },
  caseLigne: { flexDirection: "row", alignItems: "center", gap: 3 },
  caseCarre: { width: 7.5, height: 7.5, border: `0.7pt solid ${NOIR}`, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  // Croix dessinée (deux barres tournées) : un glyphe texte se fait
  // rogner dans une case de 7,5 pt, un View tourné est fiable.
  caseBarre: { position: "absolute", width: 7.4, height: 1.1, backgroundColor: NOIR },
  rond: { width: 8, height: 8, borderRadius: 4, border: `0.8pt solid ${NOIR}`, alignItems: "center", justifyContent: "center" },
  rondPlein: { width: 4, height: 4, borderRadius: 2, backgroundColor: NOIR },
  signatureImg: { height: 26, width: 120, objectFit: "contain" },
  pied: { borderLeft: TRAIT, borderRight: TRAIT, borderBottom: TRAIT, paddingHorizontal: 6, paddingVertical: 3, fontSize: 6, textAlign: "center" },
});

function Case({ coche, libelle, style }: { coche: boolean; libelle?: string; style?: Style | Style[] }) {
  return (
    <View style={[s.caseLigne, ...(Array.isArray(style) ? style : [style ?? {}])]}>
      <View style={s.caseCarre}>
        {coche ? (
          <>
            <View style={[s.caseBarre, { transform: "rotate(45deg)" }]} />
            <View style={[s.caseBarre, { transform: "rotate(-45deg)" }]} />
          </>
        ) : null}
      </View>
      {libelle ? <Text>{libelle}</Text> : null}
    </View>
  );
}

function Rond({ coche, libelle }: { coche: boolean; libelle: string }) {
  return (
    <View style={[s.caseLigne, { gap: 5 }]}>
      <View style={s.rond}>{coche ? <View style={s.rondPlein} /> : null}</View>
      <Text style={s.gras}>{libelle}</Text>
    </View>
  );
}

/** Cellule de tableau à largeur fixe (en % de la ligne). */
function Cel({ w, children, style, bord = true }: { w: number | string; children?: React.ReactNode; style?: Style | Style[]; bord?: boolean }) {
  return <View style={[s.cellule, { width: w }, bord ? {} : { borderRight: 0 }, ...(Array.isArray(style) ? style : [style ?? {}])]}>{children}</View>;
}

function Champ({ children, blanc, style }: { children?: React.ReactNode; blanc?: boolean; style?: Style | Style[] }) {
  return (
    <View style={[blanc ? s.champBlanc : s.champ, ...(Array.isArray(style) ? style : [style ?? {}])]}>
      <Text>{children ?? ""}</Text>
    </View>
  );
}

function kg(v: number | null): string {
  return v === null ? "" : v.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

function dateParts(ymd: string): [string, string, string] {
  const [a, m, j] = ymd.split("-");
  return [j ?? "", m ?? "", a ?? ""];
}

/**
 * Colonne du cadre 7 (seuil atteint) selon la famille du fluide :
 * HCFC 2/30/300 kg, HFC/PFC 5/50/500 t éq. CO2, HFO 1/10/100 kg.
 */
function colonneCadre7(data: CerfaData): { famille: "HCFC" | "HFC" | "HFO" | null; colonne: 0 | 1 | 2 | null } {
  const famille = familleFluide(data.equipement.fluide);
  const charge = data.equipement.chargeKg;
  const teq = data.equipement.chargeTeqCo2;
  const col = (v: number | null, seuils: [number, number, number]): 0 | 1 | 2 | null => {
    if (v === null) return null;
    if (v >= seuils[2]) return 2;
    if (v >= seuils[1]) return 1;
    if (v >= seuils[0]) return 0;
    return null;
  };
  if (famille === "HCFC") return { famille, colonne: col(charge, [2, 30, 300]) };
  if (famille === "HFC") return { famille, colonne: col(teq, [5, 50, 500]) };
  if (famille === "HFO") return { famille, colonne: col(charge, [1, 10, 100]) };
  return { famille: null, colonne: null };
}

export type CerfaSignature = {
  nom: string;
  qualite: string | null;
  date: string;
  imageDataUrl: string | null;
} | null;

export function CerfaPdf({ data, signatureOperateur, signatureDetenteur }: { data: CerfaData; signatureOperateur: CerfaSignature; signatureDetenteur: CerfaSignature }) {
  const natures = new Set<string>(data.natures);
  const teq = data.equipement.chargeTeqCo2 !== null ? `${data.equipement.chargeTeqCo2.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} t` : "";
  const [jj, mm, aaaa] = data.detecteur?.dernierControle ? dateParts(data.detecteur.dernierControle) : ["", "", ""];
  const { famille, colonne } = colonneCadre7(data);
  const identification = [data.equipement.marqueModele, data.equipement.numeroSerie].filter(Boolean).join(" · ");
  const fluideSansR = data.equipement.fluide.replace(/^R-?/i, "");
  const codeUn = (data.dechets?.codeUn ?? "").toUpperCase();
  const un1078 = /1078/.test(codeUn);
  const un3161 = /3161/.test(codeUn);
  const autreDechet = codeUn && !un1078 && !un3161 ? data.dechets?.codeUn ?? "" : "";
  const destination = data.dechets ? [data.dechets.destinationNom, data.dechets.destinationAdresse].filter(Boolean).join(" — ") : "";
  const fuites: Array<{ localisation: string; reparation: "realisee" | "a_faire" | null }> = data.fuite.constatee === true ? [{ localisation: data.fuite.localisation, reparation: data.fuite.reparation }] : [];
  const signataire = (sig: CerfaSignature) => ({
    nom: sig?.nom ?? "",
    qualite: sig?.qualite ?? "",
    date: sig ? formatDateFr(sig.date.slice(0, 10)) : "",
    image: sig?.imageDataUrl ?? null,
  });
  const op = signataire(signatureOperateur);
  const det = signataire(signatureDetenteur);

  const Mois = ({ libelle, coche }: { libelle: string; coche: boolean }) => (
    <Cel w="16%">
      <Case coche={coche} libelle={libelle} />
    </Cel>
  );

  return (
    <Document title={`Fiche d'intervention fluides ${data.ficheNumero}`} author={data.operateur.nom}>
      <Page size="A4" style={s.page}>
        {/* En-tête */}
        <View style={s.entete}>
          <View style={s.marianne}>
            <View style={s.marianneBloc}>
              <Text style={[s.marianneTxt, s.gras]}>RÉPUBLIQUE</Text>
              <Text style={[s.marianneTxt, s.gras]}>FRANÇAISE</Text>
              <Text style={[s.marianneTxt, { marginTop: 1 }]}>Liberté · Égalité · Fraternité</Text>
            </View>
            <Text style={[s.marianneTxt, s.gras, { marginTop: 4 }]}>Ministère chargé</Text>
            <Text style={[s.marianneTxt, s.gras]}>de l&apos;Écologie</Text>
          </View>
          <View style={s.titreBloc}>
            <Text style={s.titre}>FICHE D&apos;INTERVENTION</Text>
            <Text style={s.sousTitre}>
              pour les opérations nécessitant une manipulation de fluides frigorigènes fluorés effectuées sur un équipement thermodynamique, prévue à l&apos;article R. 543-82 du code de l&apos;environnement et pour les contrôles d&apos;étanchéité prévus au R. 543-79 du même code
            </Text>
          </View>
          <View style={s.cerfaBloc}>
            <View style={s.cerfaOvale}>
              <Text style={s.cerfaTxt}>cerfa</Text>
            </View>
            <Text style={s.cerfaNum}>N° 15497*04</Text>
          </View>
        </View>

        <View style={s.tableau}>
          {/* Fiche n° / [1] / [2] */}
          <View style={s.ligne}>
            <Cel w="16%" style={{ padding: 0 }}>
              <Text style={[s.gras, s.centre, { paddingVertical: 2, borderBottom: TRAIT }]}>Fiche N° :</Text>
              <View style={{ padding: 3, flex: 1 }}>
                <Champ blanc style={{ minHeight: 22 }}>{data.ficheNumero}</Champ>
              </View>
            </Cel>
            <Cel w="42%" style={{ padding: 0, justifyContent: "flex-start" }}>
              <Text style={[s.gras, s.centre, { paddingVertical: 2, borderBottom: TRAIT }]}>[1] OPERATEUR (Nom, adresse et SIRET) :</Text>
              <Text style={{ paddingHorizontal: 3, paddingVertical: 3, minHeight: 30 }}>
                {data.operateur.nom} — {data.operateur.adresse} — SIRET {data.operateur.siret}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", borderTop: TRAIT, padding: 3, gap: 4 }}>
                <Text style={{ width: "42%", textAlign: "center" }}>N° d&apos;attestation de capacité :</Text>
                <View style={{ flex: 1 }}>
                  <Champ style={{ alignItems: "center" }}>{data.operateur.attestationCapacite}</Champ>
                </View>
              </View>
            </Cel>
            <Cel w="42%" style={{ padding: 0, justifyContent: "flex-start" }}>
              <Text style={[s.gras, s.centre, { paddingVertical: 2, borderBottom: TRAIT }]}>[2] DETENTEUR (Nom, adresse et SIRET) :</Text>
              <Text style={{ paddingHorizontal: 3, paddingVertical: 3 }}>
                {data.detenteur.nom} — {data.detenteur.adresse}
                {data.detenteur.siret ? ` — SIRET ${data.detenteur.siret}` : ""}
              </Text>
            </Cel>
          </View>

          {/* [3] Équipement */}
          <View style={s.ligne}>
            <Cel w="16%" style={{ alignItems: "center" }}>
              <Text style={[s.gras, s.centre]}>[3] Équipement</Text>
              <Text style={[s.gras, s.centre]}>concerné :</Text>
            </Cel>
            <Cel w="42%">
              <Text>Identification :</Text>
              <Text style={{ marginTop: 2 }}>{identification}</Text>
              {data.equipement.description ? <Text style={{ marginTop: 1 }}>{data.equipement.description}</Text> : null}
            </Cel>
            <Cel w="42%" style={{ gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ width: "48%", textAlign: "right", paddingRight: 4 }}>Dénomination du fluide :</Text>
                <View style={[s.champ, { width: 14, alignItems: "center", backgroundColor: BLEU_FONCE }]}>
                  <Text>R-</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Champ>{fluideSansR}</Champ>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ width: "48%", textAlign: "right", paddingRight: 4 }}>Charge totale :</Text>
                <View style={{ flex: 1 }}>
                  <Champ style={{ alignItems: "center" }}>{kg(data.equipement.chargeKg)}</Champ>
                </View>
                <View style={[s.champ, { width: 16, alignItems: "center", backgroundColor: BLEU_FONCE }]}>
                  <Text>kg</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ width: "48%", textAlign: "right", paddingRight: 4 }}>Tonnage équivalent CO2 :</Text>
                <View style={{ flex: 1 }}>
                  <Champ style={{ alignItems: "center" }}>{teq}</Champ>
                </View>
                <View style={[s.champ, { width: 34, alignItems: "center", backgroundColor: BLEU_FONCE }]}>
                  <Text>t.éq.CO2</Text>
                </View>
              </View>
            </Cel>
          </View>

          {/* [4] Nature */}
          <View style={s.ligne}>
            <Cel w="16%" style={{ alignItems: "center" }}>
              <Text style={[s.gras, s.centre]}>[4] Nature de l&apos;intervention : cocher une ou plusieurs cases</Text>
            </Cel>
            <Cel w="42%" style={{ gap: 2.5 }}>
              <Case coche={natures.has("assemblage")} libelle="Assemblage de l'équipement" />
              <Case coche={natures.has("mise_en_service")} libelle="Mise en service de l'équipement" />
              <Case coche={natures.has("modification")} libelle="Modification de l'équipement" />
              <Case coche={natures.has("maintenance")} libelle="Maintenance de l'équipement" />
            </Cel>
            <Cel w="42%" style={{ gap: 2.5 }}>
              <Case coche={natures.has("controle_periodique")} libelle="Contrôle d'étanchéité périodique" />
              <Case coche={natures.has("controle_non_periodique")} libelle="Contrôle d'étanchéité non périodique" />
              <Case coche={natures.has("demantelement")} libelle="Démantèlement" />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Case coche={Boolean(data.natureAutre)} libelle="Autre (préciser) :" />
                <View style={{ flex: 1 }}>
                  <Champ>{data.natureAutre}</Champ>
                </View>
              </View>
            </Cel>
          </View>

          {/* Contrôle d'étanchéité : [5] */}
          <View style={s.ligne}>
            <Cel w="34%" style={s.grisBg}>
              <Text style={[s.gras, s.centre]}>Contrôle d&apos;étanchéité</Text>
            </Cel>
            <Cel w="36%" style={s.grisBg}>
              <Text style={[s.gras, s.centre]}>Identification</Text>
            </Cel>
            <Cel w="30%" style={s.grisBg}>
              <Text style={[s.gras, s.centre]}>Contrôlé le</Text>
            </Cel>
          </View>
          <View style={s.ligne}>
            <Cel w="34%">
              <Text style={s.gras}>[5] Détecteur manuel de fuite :</Text>
            </Cel>
            <Cel w="36%">
              <Text>{data.detecteur?.identification ?? ""}</Text>
            </Cel>
            <Cel w="30%" style={[s.bleuBg, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 }]}>
              <Champ blanc style={{ width: 22, alignItems: "center" }}>{jj}</Champ>
              <Text>/</Text>
              <Champ blanc style={{ width: 22, alignItems: "center" }}>{mm}</Champ>
              <Text>/</Text>
              <Champ blanc style={{ width: 34, alignItems: "center" }}>{aaaa}</Champ>
            </Cel>
          </View>

          {/* [6] */}
          <View style={s.ligne}>
            <Cel w="100%" bord={false} style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
              <Text style={[s.gras, { flex: 1 }]}>[6] Présence d&apos;un système permanent de détection de fuites :</Text>
              <Rond coche={data.systemePermanentDetection} libelle="OUI" />
              <Rond coche={!data.systemePermanentDetection} libelle="NON" />
              <View style={{ width: 70 }} />
            </Cel>
          </View>

          {/* Fréquence */}
          <View style={s.ligne}>
            <Cel w="100%" bord={false}>
              <Text style={[s.gras, s.centre]}>Fréquence minimale du contrôle périodique</Text>
            </Cel>
          </View>
          <View style={s.ligne}>
            <Cel w="44%" style={{ justifyContent: "center" }}>
              <Text style={[s.gras, s.centre]}>[7] Quantité de fluide frigorigène dans l&apos;équipement</Text>
            </Cel>
            <View style={{ width: "56%" }}>
              {(
                [
                  ["HCFC", "HCFC", ["2 à 30 kg", "30 à 300 kg", "300 kg et +"]],
                  ["HFC / PFC", "HFC", ["5 à 50 t eqCO2", "50 à 500 t eqCO2", "500 t eqCO2 et +"]],
                  ["HFO", "HFO", ["1 à 10 kg", "10 à 100 kg", "100 kg et +"]],
                ] as Array<[string, "HCFC" | "HFC" | "HFO", [string, string, string]]>
              ).map(([libelle, fam, seuils], i) => (
                <View key={fam} style={{ flexDirection: "row", borderBottom: i < 2 ? TRAIT : 0 }}>
                  <Cel w="16%">
                    <Text>{libelle}</Text>
                  </Cel>
                  {seuils.map((t, j) => (
                    <Cel key={t} w="28%" bord={j < 2}>
                      <Case coche={famille === fam && colonne === j} libelle={t} />
                    </Cel>
                  ))}
                </View>
              ))}
            </View>
          </View>
          <View style={s.ligne}>
            <Cel w="52%">
              <Text style={s.gras}>[8] Équip. HCFC, HFC et HFO sans système permanent de détection des fuites</Text>
            </Cel>
            <Mois libelle="12 mois" coche={!data.systemePermanentDetection && colonne === 0} />
            <Mois libelle="6 mois" coche={!data.systemePermanentDetection && colonne === 1} />
            <Cel w="16%" bord={false}>
              <Case coche={!data.systemePermanentDetection && colonne === 2} libelle="3 mois" />
            </Cel>
          </View>
          <View style={s.ligne}>
            <Cel w="52%">
              <Text style={s.gras}>[9] Équipements HFC et HFO avec système permanent de détection des fuites</Text>
            </Cel>
            <Mois libelle="24 mois" coche={data.systemePermanentDetection && colonne === 0} />
            <Mois libelle="12 mois" coche={data.systemePermanentDetection && colonne === 1} />
            <Cel w="16%" bord={false}>
              <Case coche={data.systemePermanentDetection && colonne === 2} libelle="6 mois" />
            </Cel>
          </View>

          {/* [10] Fuites */}
          <View style={s.ligne}>
            <Cel w="20%" style={{ alignItems: "center", gap: 2 }}>
              <Text style={[s.gras, s.centre]}>[10] Fuites constatées lors du contrôle d&apos;étanchéité</Text>
              <View style={{ alignItems: "flex-start", gap: 1.5, marginTop: 1 }}>
                <Case coche={data.fuite.constatee === true} libelle="OUI" />
                <Case coche={data.fuite.constatee === false} libelle="NON" />
              </View>
            </Cel>
            <View style={{ width: "80%" }}>
              <View style={{ flexDirection: "row", borderBottom: TRAIT }}>
                <Cel w="8%" style={s.grisBg}>
                  <Text style={[s.gras, s.centre]}>N°</Text>
                </Cel>
                <Cel w="72%" style={s.grisBg}>
                  <Text style={[s.gras, s.centre]}>Localisation de la fuite</Text>
                </Cel>
                <Cel w="20%" bord={false} style={s.grisBg}>
                  <Text style={[s.gras, s.centre]}>Réparation de la fuite</Text>
                </Cel>
              </View>
              {[0, 1, 2].map((i) => {
                const f = fuites[i];
                return (
                  <View key={i} style={{ flexDirection: "row", borderBottom: i < 2 ? TRAIT : 0 }}>
                    <Cel w="8%">
                      <Text style={[s.gras, s.centre]}>{i + 1}</Text>
                    </Cel>
                    <Cel w="72%">
                      <Text>{f?.localisation ?? ""}</Text>
                    </Cel>
                    <Cel w="20%" bord={false} style={{ gap: 1.5 }}>
                      <Case coche={f?.reparation === "realisee"} libelle="Réalisée" />
                      <Case coche={f?.reparation === "a_faire"} libelle="A faire" />
                    </Cel>
                  </View>
                );
              })}
            </View>
          </View>

          {/* [11] Manipulation */}
          <View style={s.ligne}>
            <Cel w="100%" bord={false}>
              <Text style={[s.gras, s.centre]}>[11] Manipulation du fluide frigorigène</Text>
            </Cel>
          </View>
          {(
            [
              ["Quantité chargée totale (A+B+C) :", kg(data.quantites.totalChargeKg), "kg", "Quantité de fluide récupérée totale (D+E) :", kg(data.quantites.totalRecupereKg), "kg", true],
              ["A - Dont fluide vierge :", kg(data.quantites.chargeViergeKg), "kg", "D - Dont fluide destiné au traitement", kg(data.quantites.recupereTraitementKg), "kg", false],
              ["Dénomination du fluide chargé si changement :", "", null, "Si connu, numéro du BSFF (Trackdéchets)", data.dechets?.numeroBsff ?? "", null, false],
              ["B - Dont fluide recyclé (fluide récupéré et réintroduit) :", kg(data.quantites.chargeRecycleKg), "kg", "E - Dont fluide conservé pour réutilisation (réintroduction)", kg(data.quantites.recupereReutilisationKg), "kg", false],
              ["C - Dont fluide régénéré :", kg(data.quantites.chargeRegenereKg), "kg", "Identification du ou des contenants", data.dechets?.contenants ?? "", null, false],
            ] as Array<[string, string, string | null, string, string, string | null, boolean]>
          ).map(([l1, v1, u1, l2, v2, u2, grasLigne], i) => (
            <View key={i} style={s.ligne}>
              <Cel w="50%" style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Text style={[{ flex: 1 }, grasLigne ? s.gras : {}]}>{l1}</Text>
                <Champ style={{ width: u1 ? 50 : 90, alignItems: "flex-end" }}>{v1}</Champ>
                {u1 ? <Text style={[s.gras, { width: 10 }]}>{u1}</Text> : null}
              </Cel>
              <Cel w="50%" bord={false} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Text style={[{ flex: 1 }, grasLigne ? s.gras : {}]}>{l2}</Text>
                <Champ style={{ width: u2 ? 50 : 90, alignItems: u2 ? "flex-end" : "flex-start" }}>{v2}</Champ>
                {u2 ? <Text style={[s.gras, { width: 10 }]}>{u2}</Text> : null}
              </Cel>
            </View>
          ))}

          {/* [12] ADR/RID */}
          <View style={s.ligne}>
            <Cel w="100%" bord={false}>
              <Text style={[s.gras, s.centre]}>[12] Dénomination ADR/RID</Text>
            </Cel>
          </View>
          <View style={s.ligne}>
            <Cel w="100%" bord={false} style={{ gap: 2 }}>
              <Text style={s.gras}>Rubrique Déchets : 14 06 01* – CFC, HCFC, HFC, HFO – Fluides non-inflammables</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: "50%" }}>
                  <Case coche={un1078} libelle="UN 1078, Déchet Gaz frigorifique NSA (Gaz réfrigérant, NSA), 2.2 (C/E)" />
                </View>
                <Case coche={Boolean(autreDechet)} libelle="Autres fluides frigorigènes non-inflammables :" />
                <View style={{ flex: 1 }}>
                  <Champ>{un3161 ? "" : autreDechet}</Champ>
                </View>
              </View>
              <Text style={[s.gras, { marginTop: 1 }]}>Rubrique Déchets : 16 05 04* – HFC, HFO – Fluides inflammables</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: "50%" }}>
                  <Case coche={un3161} libelle="UN 3161, Déchet Gaz liquéfié inflammable NSA, 2.1 (B/D)" />
                </View>
                <Case coche={false} libelle="Autres fluides frigorigènes inflammables :" />
                <View style={{ flex: 1 }}>
                  <Champ />
                </View>
              </View>
            </Cel>
          </View>

          {/* [13] */}
          <View style={s.ligne}>
            <Cel w="100%" bord={false} style={[s.bleuFonceBg, { paddingVertical: 1.5 }]}>
              <Text style={s.gras}>[13] Installation prévue de destination du fluide récupéré (Nom, SIRET, adresse)</Text>
            </Cel>
          </View>
          <View style={s.ligne}>
            <Cel w="100%" bord={false} style={{ minHeight: 22 }}>
              <Text>{destination}</Text>
            </Cel>
          </View>

          {/* [14] */}
          <View style={s.ligne}>
            <Cel w="100%" bord={false} style={[s.bleuFonceBg, { paddingVertical: 1.5 }]}>
              <Text style={s.gras}>[14] Observations :</Text>
            </Cel>
          </View>
          <View style={s.ligne}>
            <Cel w="100%" bord={false} style={{ minHeight: 56, justifyContent: "flex-start" }}>
              <Text>{data.observations}</Text>
            </Cel>
          </View>

          {/* Signatures */}
          <View style={s.ligne}>
            <Cel w="100%" bord={false}>
              <Text style={[s.centre, { fontSize: 7 }]}>Je soussigné certifie que l&apos;opération ci-dessus a été effectuée.</Text>
            </Cel>
          </View>
          <View style={s.ligne}>
            <Cel w="22%" style={s.grisBg} />
            <Cel w="39%" style={s.grisBg}>
              <Text style={[s.gras, s.centre]}>Opérateur</Text>
            </Cel>
            <Cel w="39%" bord={false} style={s.grisBg}>
              <Text style={[s.gras, s.centre]}>Détenteur</Text>
            </Cel>
          </View>
          <View style={s.ligne}>
            <Cel w="22%" style={s.grisBg}>
              <Text style={[s.gras, s.centre]}>Nom du Signataire :</Text>
            </Cel>
            <Cel w="39%">
              <Champ blanc>{op.nom}</Champ>
            </Cel>
            <Cel w="39%" bord={false}>
              <Champ blanc>{det.nom}</Champ>
            </Cel>
          </View>
          <View style={s.ligne}>
            <Cel w="22%" style={s.grisBg}>
              <Text style={[s.gras, s.centre]}>Qualité du Signataire :</Text>
            </Cel>
            <Cel w="39%">
              <Champ blanc>{op.qualite}</Champ>
            </Cel>
            <Cel w="39%" bord={false}>
              <Champ blanc>{det.qualite}</Champ>
            </Cel>
          </View>
          <View style={s.ligne}>
            <Cel w="22%" style={s.grisBg}>
              <Text style={[s.gras, s.centre]}>Date et signature :</Text>
            </Cel>
            {[op, det].map((sig, i) => (
              <Cel key={i} w="39%" bord={i === 0}>
                <View style={[s.champBlanc, { flexDirection: "row", alignItems: "center", minHeight: 34, gap: 6 }]}>
                  <Text style={{ width: 54 }}>{sig.date}</Text>
                  {sig.image ? <Image src={sig.image} style={s.signatureImg} /> : null}
                </View>
              </Cel>
            ))}
          </View>
        </View>
        <Text style={s.pied}>
          Le détenteur d&apos;un équipement dont la charge en HCFC est supérieure à 3 kg ou dont la charge en HFC est supérieure à 5t eq CO2 doit conserver l&apos;original de ce document pendant au moins 5 ans (article R. 543-82 du Code de l&apos;environnement).
        </Text>
      </Page>
    </Document>
  );
}
