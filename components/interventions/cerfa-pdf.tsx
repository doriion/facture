import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { formatDateFr } from "@/lib/format";
import {
  NATURES_INTERVENTION,
  type CerfaData,
  type NatureIntervention,
} from "@/lib/cerfa";

/**
 * Fiche d'intervention fluides frigorigènes — réimplémentation de la
 * trame du CERFA n° 15497*04 (14 cadres + signatures). Le document
 * généré reprend les rubriques du formulaire officiel ; il est archivé
 * dans Supabase Storage et conservé 5 ans (opérateur et détenteur).
 */

const TEXT = "#111318";
const MUTED = "#5b6169";
const BORDER = "#9aa0a8";
const HEAD_BG = "#eef1f4";

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: TEXT,
    lineHeight: 1.35,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  title: { fontSize: 13, fontWeight: 700 },
  subtitle: { fontSize: 8, color: MUTED, marginTop: 2, maxWidth: 380 },
  ficheNum: { fontSize: 9, fontWeight: 700, textAlign: "right" },

  cadre: {
    border: `1pt solid ${BORDER}`,
    marginBottom: 6,
  },
  cadreTitle: {
    backgroundColor: HEAD_BG,
    borderBottom: `1pt solid ${BORDER}`,
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  cadreBody: { paddingVertical: 4, paddingHorizontal: 6 },
  row: { flexDirection: "row", gap: 10 },
  col: { flex: 1 },
  label: { color: MUTED, fontSize: 7.5 },
  value: { fontSize: 9, marginBottom: 3 },

  checkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 2,
  },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  checkbox: {
    width: 8,
    height: 8,
    border: `1pt solid ${TEXT}`,
    alignItems: "center",
    justifyContent: "center",
  },
  // Coche = carré plein (un glyphe texte se fait clipper dans une boîte
  // de 8 pt ; un View plein est fiable quel que soit le moteur).
  checkboxFill: { width: 4.4, height: 4.4, backgroundColor: TEXT },

  qtyTable: { border: `0.5pt solid ${BORDER}`, marginTop: 2 },
  qtyRow: {
    flexDirection: "row",
    borderBottom: `0.5pt solid ${BORDER}`,
  },
  qtyCellLabel: {
    flex: 3,
    paddingVertical: 2.5,
    paddingHorizontal: 5,
    borderRight: `0.5pt solid ${BORDER}`,
  },
  qtyCellValue: {
    flex: 1,
    paddingVertical: 2.5,
    paddingHorizontal: 5,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  totalRow: { backgroundColor: HEAD_BG },

  signatureRow: { flexDirection: "row", gap: 6 },
  signatureBox: {
    flex: 1,
    border: `1pt solid ${BORDER}`,
    padding: 6,
    minHeight: 86,
  },
  signatureTitle: { fontSize: 8, fontWeight: 700, marginBottom: 2 },
  signatureImage: { height: 40, objectFit: "contain", marginTop: 3 },
  signatureMeta: { fontSize: 7.5, color: MUTED, marginTop: 2 },

  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    fontSize: 6.5,
    color: MUTED,
    textAlign: "center",
  },
});

function Checkbox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={styles.checkItem}>
      <View style={styles.checkbox}>
        {checked ? <View style={styles.checkboxFill} /> : null}
      </View>
      <Text>{label}</Text>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || "—"}</Text>
    </View>
  );
}

function kg(v: number): string {
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} kg`;
}

export type CerfaSignature = {
  nom: string;
  qualite: string | null;
  date: string;
  imageDataUrl: string | null;
} | null;

export function CerfaPdf({
  data,
  signatureOperateur,
  signatureDetenteur,
}: {
  data: CerfaData;
  signatureOperateur: CerfaSignature;
  signatureDetenteur: CerfaSignature;
}) {
  const naturesSet = new Set<NatureIntervention>(data.natures);
  const teq =
    data.equipement.chargeTeqCo2 !== null
      ? `${data.equipement.chargeTeqCo2.toLocaleString("fr-FR", {
          maximumFractionDigits: 3,
        })} t éq. CO2`
      : "—";

  return (
    <Document
      title={`Fiche d'intervention fluides ${data.ficheNumero}`}
      author={data.operateur.nom}
    >
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>
              Fiche d&apos;intervention — fluides frigorigènes
            </Text>
            <Text style={styles.subtitle}>
              Opérations nécessitant une manipulation de fluides frigorigènes
              (art. R. 543-82 et s. du code de l&apos;environnement) —{" "}
              {data.version}
            </Text>
          </View>
          <View>
            <Text style={styles.ficheNum}>Fiche n° {data.ficheNumero}</Text>
            <Text style={{ fontSize: 8, textAlign: "right", color: MUTED }}>
              Intervention du {formatDateFr(data.dateIntervention)}
            </Text>
          </View>
        </View>

        {/* 1. Opérateur */}
        <View style={styles.cadre}>
          <Text style={styles.cadreTitle}>1 · Opérateur</Text>
          <View style={styles.cadreBody}>
            <View style={styles.row}>
              <View style={styles.col}>
                <Field label="Nom / raison sociale" value={data.operateur.nom} />
                <Field label="Adresse" value={data.operateur.adresse} />
              </View>
              <View style={styles.col}>
                <Field label="SIRET" value={data.operateur.siret} />
                <Field
                  label="N° d'attestation de capacité"
                  value={data.operateur.attestationCapacite}
                />
              </View>
            </View>
          </View>
        </View>

        {/* 2. Détenteur */}
        <View style={styles.cadre}>
          <Text style={styles.cadreTitle}>2 · Détenteur de l&apos;équipement</Text>
          <View style={styles.cadreBody}>
            <View style={styles.row}>
              <View style={styles.col}>
                <Field label="Nom / raison sociale" value={data.detenteur.nom} />
                <Field label="Adresse" value={data.detenteur.adresse} />
              </View>
              <View style={styles.col}>
                <Field label="SIRET (le cas échéant)" value={data.detenteur.siret} />
              </View>
            </View>
          </View>
        </View>

        {/* 3. Équipement */}
        <View style={styles.cadre}>
          <Text style={styles.cadreTitle}>3 · Équipement</Text>
          <View style={styles.cadreBody}>
            <View style={styles.row}>
              <View style={styles.col}>
                <Field
                  label="Marque et référence du modèle"
                  value={data.equipement.marqueModele}
                />
                <Field
                  label="N° de série / identification de l'équipement et du circuit"
                  value={data.equipement.numeroSerie}
                />
                {data.equipement.description ? (
                  <Field label="Description" value={data.equipement.description} />
                ) : null}
              </View>
              <View style={styles.col}>
                <Field
                  label="Nature du fluide (désignation R-)"
                  value={data.equipement.fluide}
                />
                <View style={styles.row}>
                  <View style={styles.col}>
                    <Field
                      label="Charge totale (kg)"
                      value={
                        data.equipement.chargeKg !== null
                          ? kg(data.equipement.chargeKg)
                          : "—"
                      }
                    />
                  </View>
                  <View style={styles.col}>
                    <Field label="Charge (t éq. CO2)" value={teq} />
                  </View>
                  <View style={styles.col}>
                    <Field
                      label="PRG (UE 2024/573)"
                      value={
                        data.equipement.prg !== null
                          ? String(data.equipement.prg)
                          : "—"
                      }
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 4. Nature de l'intervention */}
        <View style={styles.cadre}>
          <Text style={styles.cadreTitle}>4 · Nature de l&apos;intervention</Text>
          <View style={styles.cadreBody}>
            <View style={styles.checkRow}>
              {(
                Object.entries(NATURES_INTERVENTION) as Array<
                  [NatureIntervention, string]
                >
              ).map(([key, label]) => (
                <Checkbox key={key} checked={naturesSet.has(key)} label={label} />
              ))}
            </View>
          </View>
        </View>

        {/* 5-6. Détecteur + système permanent */}
        <View style={styles.cadre}>
          <Text style={styles.cadreTitle}>
            5 · Détecteur manuel de fuite — 6 · Système permanent de détection
          </Text>
          <View style={styles.cadreBody}>
            <View style={styles.row}>
              <View style={styles.col}>
                <Field
                  label="Identification du détecteur (n° de série ou repère)"
                  value={data.detecteur?.identification ?? "—"}
                />
              </View>
              <View style={styles.col}>
                <Field
                  label="Date du dernier contrôle du détecteur"
                  value={
                    data.detecteur?.dernierControle
                      ? formatDateFr(data.detecteur.dernierControle)
                      : "—"
                  }
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>
                  Système permanent de détection des fuites
                </Text>
                <View style={[styles.checkRow, { marginTop: 2 }]}>
                  <Checkbox
                    checked={data.systemePermanentDetection}
                    label="Oui"
                  />
                  <Checkbox
                    checked={!data.systemePermanentDetection}
                    label="Non"
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 8-9. Périodicité + 10. Fuites */}
        <View style={styles.cadre}>
          <Text style={styles.cadreTitle}>
            8-9 · Périodicité du contrôle d&apos;étanchéité — 10 · Fuites constatées
          </Text>
          <View style={styles.cadreBody}>
            <View style={styles.row}>
              <View style={styles.col}>
                <Field
                  // Pas de glyphes <= / >= : Helvetica WinAnsi ne les couvre pas.
                  // Seuils F-Gas en t éq. CO2 (art. 5, règlement UE 2024/573).
                  label="Périodicité applicable (sans détection permanente : 12 mois de 5 à moins de 50 t éq. CO2 · 6 mois de 50 à moins de 500 · 3 mois à partir de 500 · R22 : seuils en kg 2/30/300)"
                  value={data.periodiciteLabel}
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Fuite constatée lors du contrôle</Text>
                <View style={[styles.checkRow, { marginTop: 2 }]}>
                  <Checkbox checked={data.fuite.constatee === true} label="Oui" />
                  <Checkbox checked={data.fuite.constatee === false} label="Non" />
                </View>
                {data.fuite.constatee === true ? (
                  <Field
                    label="Localisation / réparation"
                    value={data.fuite.localisation}
                  />
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* 11. Quantités */}
        <View style={styles.cadre}>
          <Text style={styles.cadreTitle}>
            11 · Quantités de fluide manipulées (kg)
          </Text>
          <View style={styles.cadreBody}>
            <View style={styles.qtyTable}>
              <View style={styles.qtyRow}>
                <Text style={styles.qtyCellLabel}>A — Fluide vierge chargé</Text>
                <Text style={styles.qtyCellValue}>
                  {kg(data.quantites.chargeViergeKg)}
                </Text>
              </View>
              <View style={styles.qtyRow}>
                <Text style={styles.qtyCellLabel}>B — Fluide recyclé chargé</Text>
                <Text style={styles.qtyCellValue}>
                  {kg(data.quantites.chargeRecycleKg)}
                </Text>
              </View>
              <View style={styles.qtyRow}>
                <Text style={styles.qtyCellLabel}>C — Fluide régénéré chargé</Text>
                <Text style={styles.qtyCellValue}>
                  {kg(data.quantites.chargeRegenereKg)}
                </Text>
              </View>
              <View style={[styles.qtyRow, styles.totalRow]}>
                <Text style={styles.qtyCellLabel}>
                  Quantité totale chargée (A + B + C)
                </Text>
                <Text style={styles.qtyCellValue}>
                  {kg(data.quantites.totalChargeKg)}
                </Text>
              </View>
              <View style={styles.qtyRow}>
                <Text style={styles.qtyCellLabel}>
                  D — Fluide récupéré destiné au traitement
                </Text>
                <Text style={styles.qtyCellValue}>
                  {kg(data.quantites.recupereTraitementKg)}
                </Text>
              </View>
              <View style={styles.qtyRow}>
                <Text style={styles.qtyCellLabel}>
                  E — Fluide récupéré conservé pour réutilisation
                </Text>
                <Text style={styles.qtyCellValue}>
                  {kg(data.quantites.recupereReutilisationKg)}
                </Text>
              </View>
              <View style={[styles.qtyRow, styles.totalRow, { borderBottom: 0 }]}>
                <Text style={styles.qtyCellLabel}>
                  Quantité totale récupérée (D + E)
                </Text>
                <Text style={styles.qtyCellValue}>
                  {kg(data.quantites.totalRecupereKg)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 12-13. Déchets */}
        {data.dechets ? (
          <View style={styles.cadre}>
            <Text style={styles.cadreTitle}>
              12-13 · Déchets de fluides — suivi (BSFF)
            </Text>
            <View style={styles.cadreBody}>
              <View style={styles.row}>
                <View style={styles.col}>
                  <Field
                    label="Code UN et dénomination ADR"
                    value={data.dechets.codeUn}
                  />
                  <Field
                    label="Contenant(s) de récupération"
                    value={data.dechets.contenants}
                  />
                </View>
                <View style={styles.col}>
                  <Field
                    label="N° de bordereau (BSFF Trackdéchets)"
                    value={data.dechets.numeroBsff}
                  />
                  <Field
                    label="Installation de destination"
                    value={[
                      data.dechets.destinationNom,
                      data.dechets.destinationAdresse,
                    ]
                      .filter(Boolean)
                      .join(" — ")}
                  />
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* 14. Observations */}
        <View style={styles.cadre}>
          <Text style={styles.cadreTitle}>14 · Observations</Text>
          <View style={styles.cadreBody}>
            <Text>{data.observations || "—"}</Text>
          </View>
        </View>

        {/* Signatures — wrap=false : le bloc ne doit jamais être coupé
            entre deux pages. */}
        <View style={styles.signatureRow} wrap={false}>
          {(
            [
              ["Opérateur", signatureOperateur],
              ["Détenteur", signatureDetenteur],
            ] as const
          ).map(([titre, sig]) => (
            <View key={titre} style={styles.signatureBox}>
              <Text style={styles.signatureTitle}>Signature — {titre.toLowerCase()}</Text>
              {sig ? (
                <>
                  {sig.imageDataUrl ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image src={sig.imageDataUrl} style={styles.signatureImage} />
                  ) : null}
                  <Text style={styles.signatureMeta}>
                    {sig.nom}
                    {sig.qualite ? ` — ${sig.qualite}` : ""} · signé le{" "}
                    {formatDateFr(sig.date)}
                  </Text>
                </>
              ) : (
                <Text style={styles.signatureMeta}>Non signé.</Text>
              )}
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Document établi conformément aux rubriques du CERFA n° 15497*04
          (arrêté du 29 mai 2024) — à conserver 5 ans par l&apos;opérateur et
          le détenteur. PRG : règlement (UE) 2024/573, annexe I (base IPCC
          AR4) ; t éq. CO2 = charge (kg) × PRG / 1000.
        </Text>
      </Page>
    </Document>
  );
}
