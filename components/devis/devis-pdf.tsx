import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import {
  formatDateFr,
  formatEuros,
  formatIban,
  formatSiret,
  siretToSiren,
} from "@/lib/format";
import {
  LABELS_TYPE_ACTIVITE,
  MENTION_AUTO_ENTREPRENEUR,
  MENTION_DEVIS_GRATUIT,
  MENTION_TVA_FRANCHISE,
  mentionDecennale,
  mentionFluidesFrigo,
  mentionMediateur,
  mentionRgeQualipac,
  mentionRm,
} from "@/lib/legal-text";
import type { Database } from "@/types/database";

type Devis = Database["public"]["Tables"]["devis"]["Row"];
type Ligne = Database["public"]["Tables"]["devis_lignes"]["Row"];
type Client = Database["public"]["Tables"]["clients"]["Row"];
type Profil = Database["public"]["Tables"]["profil_entreprise"]["Row"];

const PRIMARY = "#2A7D5B";
const TEXT = "#1c1f24";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: TEXT,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 12,
    borderBottom: `1pt solid ${BORDER}`,
  },
  brand: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    // Compense la lineHeight serrée du titre DEVIS à droite pour
    // aligner les baselines des deux blocs (cf. facture-pdf.tsx).
    paddingTop: 2,
  },
  logo: { width: 56, height: 56, objectFit: "contain" },
  entrepriseBlock: { fontSize: 9 },
  entrepriseNom: { fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 2 },
  entrepriseLine: { color: MUTED, fontSize: 9 },
  docBlock: { alignItems: "flex-end" },
  docTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: PRIMARY,
    letterSpacing: 1.5,
    lineHeight: 1,
    marginBottom: 10,
  },
  docNumero: { fontSize: 12, fontWeight: 700 },
  docDate: { fontSize: 9, color: MUTED, marginTop: 3 },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    gap: 24,
  },
  block: { flex: 1 },
  blockTitle: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: PRIMARY,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  clientNom: { fontSize: 11, fontWeight: 700, marginBottom: 2 },

  table: { marginTop: 8, borderTop: `1pt solid ${BORDER}` },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f6f7f9",
    borderBottom: `1pt solid ${BORDER}`,
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: MUTED,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottom: `1pt solid ${BORDER}`,
  },
  colDesignation: { flex: 1, paddingRight: 8 },
  colQte: { width: 50, textAlign: "right" },
  colPu: { width: 70, textAlign: "right" },
  colTotal: { width: 75, textAlign: "right" },

  totalsBlock: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  totalsTable: { width: 240 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalLabel: { color: MUTED },
  totalValue: { textAlign: "right" },
  totalFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTop: `1pt solid ${BORDER}`,
    marginTop: 4,
  },
  totalFinalLabel: { fontSize: 11, fontWeight: 700 },
  totalFinalValue: {
    fontSize: 13,
    fontWeight: 700,
    color: PRIMARY,
    textAlign: "right",
  },

  resteAcharge: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    backgroundColor: "#f6fbf8",
    paddingHorizontal: 8,
    marginTop: 4,
    borderRadius: 3,
  },

  encadre: {
    marginTop: 16,
    padding: 10,
    backgroundColor: "#f6fbf8",
    border: `1pt solid #cfe7d9`,
    borderRadius: 4,
  },
  encadreDashed: {
    marginTop: 12,
    padding: 10,
    border: `1pt dashed #cfd4dc`,
    borderRadius: 4,
  },
  encadreTitle: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: PRIMARY,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: "32%", marginBottom: 4 },
  cellLabel: { fontSize: 8, color: MUTED },
  cellValue: { fontSize: 9.5 },

  travaux: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#f9fafb",
    borderRadius: 3,
    fontSize: 9,
  },

  conditions: { marginTop: 16, fontSize: 9 },

  signatureBox: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 24,
  },
  signatureCell: {
    flex: 1,
    border: `1pt solid ${BORDER}`,
    borderRadius: 4,
    padding: 12,
    minHeight: 80,
  },
  signatureTitle: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: PRIMARY,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  signatureMention: { fontSize: 9, marginTop: 4, color: MUTED },

  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 24,
    fontSize: 7.5,
    color: MUTED,
    paddingTop: 10,
    borderTop: `1pt solid ${BORDER}`,
    lineHeight: 1.45,
  },
  footerLine: { marginBottom: 2 },

  pageNumber: {
    position: "absolute",
    fontSize: 8,
    bottom: 10,
    right: 36,
    color: MUTED,
  },
});

export function DevisPdf({
  devis,
  lignes,
  client,
  profil,
  logoData,
}: {
  devis: Devis;
  lignes: Ligne[];
  client: Client | null;
  profil: Profil | null;
  logoData?: string | null;
}) {
  const equip = (devis.equipement_info ?? {}) as Record<string, unknown>;
  const perfs = (devis.performances_energetiques ?? {}) as Record<string, unknown>;
  const aides = (devis.aides_financieres ?? {}) as Record<string, unknown>;

  const isClimPac =
    devis.type_activite === "installation_clim" ||
    devis.type_activite === "installation_pac";

  const aidesEntries = Object.entries(aides).filter(
    ([, v]) => typeof v === "number" && (v as number) > 0,
  );
  const totalAides = aidesEntries.reduce(
    (sum, [, v]) => sum + (v as number),
    0,
  );
  const totalHt = Number(devis.total_ht);
  const resteAcharge = Math.max(0, totalHt - totalAides);

  const sirenComputed = profil?.siren ?? siretToSiren(profil?.siret);

  const mentions = {
    decennale: mentionDecennale({
      numero: profil?.num_assurance_decennale,
      assureur: profil?.assureur_decennale,
      zone: profil?.zone_couverture_decennale,
    }),
    fluides: isClimPac
      ? mentionFluidesFrigo(profil?.num_attestation_fluides_frigo)
      : null,
    rge: isClimPac ? mentionRgeQualipac(profil?.num_rge_qualipac) : null,
    rm: mentionRm(profil?.num_rm),
    mediateur:
      client?.type === "particulier"
        ? mentionMediateur({
            nom: profil?.mediateur_nom,
            siteWeb: profil?.mediateur_site_web,
            adresse: profil?.mediateur_adresse,
          })
        : null,
  };

  const entrepriseNom =
    profil?.nom_commercial ||
    [profil?.prenom, profil?.nom].filter(Boolean).join(" ") ||
    "Auto-entrepreneur";

  // Validité en jours (entre émission et validité)
  const validiteJours =
    devis.date_emission && devis.date_validite
      ? Math.round(
          (new Date(devis.date_validite).getTime() -
            new Date(devis.date_emission).getTime()) /
            (24 * 3600 * 1000),
        )
      : 90;

  return (
    <Document
      title={`Devis ${devis.numero}`}
      author={entrepriseNom}
      creator="Facture AE"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brand}>
            {logoData ? <Image src={logoData} style={styles.logo} /> : null}
            <View style={styles.entrepriseBlock}>
              <Text style={styles.entrepriseNom}>{entrepriseNom}</Text>
              {profil?.adresse_ligne1 && (
                <Text style={styles.entrepriseLine}>
                  {profil.adresse_ligne1}
                </Text>
              )}
              {profil?.adresse_ligne2 && (
                <Text style={styles.entrepriseLine}>
                  {profil.adresse_ligne2}
                </Text>
              )}
              {(profil?.code_postal || profil?.ville) && (
                <Text style={styles.entrepriseLine}>
                  {profil?.code_postal} {profil?.ville}
                </Text>
              )}
              {profil?.email_pro && (
                <Text style={styles.entrepriseLine}>{profil.email_pro}</Text>
              )}
              {profil?.telephone && (
                <Text style={styles.entrepriseLine}>{profil.telephone}</Text>
              )}
            </View>
          </View>
          <View style={styles.docBlock}>
            <Text style={styles.docTitle}>DEVIS</Text>
            <Text style={styles.docNumero}>{devis.numero}</Text>
            <Text style={styles.docDate}>
              Émis le {formatDateFr(devis.date_emission)}
            </Text>
            <Text style={styles.docDate}>
              Valable jusqu'au {formatDateFr(devis.date_validite)} ({validiteJours} jours)
            </Text>
            <Text style={[styles.docDate, { color: PRIMARY, fontWeight: 700 }]}>
              {MENTION_DEVIS_GRATUIT}
            </Text>
          </View>
        </View>

        {/* Émetteur + Client */}
        <View style={styles.rowBetween}>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Émetteur</Text>
            {profil?.siret && (
              <Text>SIRET : {formatSiret(profil.siret)}</Text>
            )}
            {sirenComputed && <Text>SIREN : {sirenComputed}</Text>}
            {profil?.code_ape && <Text>Code APE : {profil.code_ape}</Text>}
            <Text>{MENTION_AUTO_ENTREPRENEUR}</Text>
            <Text>{MENTION_TVA_FRANCHISE}</Text>
          </View>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Devis pour</Text>
            <Text style={styles.clientNom}>
              {client?.raison_sociale || client?.nom || "Client"}
            </Text>
            {client?.raison_sociale && client.nom !== client.raison_sociale && (
              <Text>{client.nom}</Text>
            )}
            {client?.adresse_ligne1 && <Text>{client.adresse_ligne1}</Text>}
            {client?.adresse_ligne2 && <Text>{client.adresse_ligne2}</Text>}
            {(client?.code_postal || client?.ville) && (
              <Text>
                {client?.code_postal} {client?.ville}
              </Text>
            )}
            {client?.siret && (
              <Text style={{ marginTop: 4 }}>
                SIRET : {formatSiret(client.siret)}
              </Text>
            )}
          </View>
        </View>

        {/* Type d'activité + travaux */}
        <View style={{ marginBottom: 6 }}>
          <Text style={styles.blockTitle}>Nature de la prestation</Text>
          <Text>
            {LABELS_TYPE_ACTIVITE[
              devis.type_activite as keyof typeof LABELS_TYPE_ACTIVITE
            ] ?? devis.type_activite}
          </Text>
        </View>

        {(devis.date_debut_travaux || devis.duree_estimee_jours) && (
          <View style={styles.travaux}>
            {devis.date_debut_travaux && (
              <Text>
                <Text style={{ color: MUTED }}>Début prévu : </Text>
                {formatDateFr(devis.date_debut_travaux)}
              </Text>
            )}
            {devis.duree_estimee_jours && (
              <Text>
                <Text style={{ color: MUTED }}>Durée estimée : </Text>
                {devis.duree_estimee_jours} jour
                {devis.duree_estimee_jours > 1 ? "s" : ""}
              </Text>
            )}
          </View>
        )}

        {/* Lignes */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesignation}>Désignation</Text>
            <Text style={styles.colQte}>Qté</Text>
            <Text style={styles.colPu}>P.U. HT</Text>
            <Text style={styles.colTotal}>Total HT</Text>
          </View>
          {lignes.map((l) => (
            <View key={l.id} style={styles.tableRow} wrap={false}>
              <Text style={styles.colDesignation}>{l.designation}</Text>
              <Text style={styles.colQte}>
                {Number(l.quantite).toLocaleString("fr-FR", {
                  maximumFractionDigits: 3,
                })}
              </Text>
              <Text style={styles.colPu}>
                {formatEuros(Number(l.prix_unitaire_ht))}
              </Text>
              <Text style={styles.colTotal}>
                {formatEuros(Number(l.total_ht))}
              </Text>
            </View>
          ))}
        </View>

        {/* Totaux */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsTable}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total HT</Text>
              <Text style={styles.totalValue}>{formatEuros(totalHt)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TVA</Text>
              <Text style={styles.totalValue}>—</Text>
            </View>
            <View style={styles.totalFinal}>
              <Text style={styles.totalFinalLabel}>Total</Text>
              <Text style={styles.totalFinalValue}>{formatEuros(totalHt)}</Text>
            </View>
            {totalAides > 0 && (
              <>
                <View style={[styles.totalRow, { paddingTop: 8 }]}>
                  <Text style={styles.totalLabel}>Aides estimées</Text>
                  <Text style={styles.totalValue}>
                    − {formatEuros(totalAides)}
                  </Text>
                </View>
                <View style={styles.resteAcharge}>
                  <Text style={{ fontWeight: 700 }}>Reste à charge estimé</Text>
                  <Text style={{ fontWeight: 700, color: PRIMARY }}>
                    {formatEuros(resteAcharge)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Équipement */}
        {isClimPac && Object.keys(equip).length > 0 && (
          <View style={styles.encadre}>
            <Text style={styles.encadreTitle}>Équipement proposé</Text>
            <View style={styles.grid}>
              {(equip.marque as string) && (
                <View style={styles.cell}>
                  <Text style={styles.cellLabel}>Marque</Text>
                  <Text style={styles.cellValue}>{equip.marque as string}</Text>
                </View>
              )}
              {(equip.modele as string) && (
                <View style={styles.cell}>
                  <Text style={styles.cellLabel}>Modèle</Text>
                  <Text style={styles.cellValue}>{equip.modele as string}</Text>
                </View>
              )}
              {(equip.num_serie as string) && (
                <View style={styles.cell}>
                  <Text style={styles.cellLabel}>N° de série</Text>
                  <Text style={styles.cellValue}>
                    {equip.num_serie as string}
                  </Text>
                </View>
              )}
              {(equip.fluide_frigo_type as string) && (
                <View style={styles.cell}>
                  <Text style={styles.cellLabel}>Fluide frigorigène</Text>
                  <Text style={styles.cellValue}>
                    {equip.fluide_frigo_type as string}
                  </Text>
                </View>
              )}
              {typeof equip.fluide_frigo_kg === "number" && (
                <View style={styles.cell}>
                  <Text style={styles.cellLabel}>Charge fluide</Text>
                  <Text style={styles.cellValue}>
                    {(equip.fluide_frigo_kg as number).toLocaleString("fr-FR", {
                      maximumFractionDigits: 3,
                    })}{" "}
                    kg
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Performances énergétiques */}
        {isClimPac &&
          (typeof perfs.cop === "number" ||
            typeof perfs.scop === "number" ||
            typeof perfs.seer === "number" ||
            !!perfs.classe_energetique) && (
            <View style={styles.encadre}>
              <Text style={styles.encadreTitle}>Performances énergétiques</Text>
              <View style={styles.grid}>
                {typeof perfs.cop === "number" && (
                  <View style={styles.cell}>
                    <Text style={styles.cellLabel}>COP</Text>
                    <Text style={styles.cellValue}>
                      {(perfs.cop as number).toLocaleString("fr-FR")}
                    </Text>
                  </View>
                )}
                {typeof perfs.scop === "number" && (
                  <View style={styles.cell}>
                    <Text style={styles.cellLabel}>SCOP (chauffage)</Text>
                    <Text style={styles.cellValue}>
                      {(perfs.scop as number).toLocaleString("fr-FR")}
                    </Text>
                  </View>
                )}
                {typeof perfs.seer === "number" && (
                  <View style={styles.cell}>
                    <Text style={styles.cellLabel}>SEER (refroidissement)</Text>
                    <Text style={styles.cellValue}>
                      {(perfs.seer as number).toLocaleString("fr-FR")}
                    </Text>
                  </View>
                )}
                {!!perfs.classe_energetique && (
                  <View style={styles.cell}>
                    <Text style={styles.cellLabel}>Classe énergétique</Text>
                    <Text style={styles.cellValue}>
                      {perfs.classe_energetique as string}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

        {/* Aides financières */}
        {aidesEntries.length > 0 && (
          <View style={styles.encadreDashed}>
            <Text style={styles.encadreTitle}>Aides financières estimées</Text>
            {aidesEntries.map(([k, v]) => (
              <Text key={k}>
                {labelAide(k)} : {formatEuros(v as number)}
              </Text>
            ))}
            <Text style={[styles.signatureMention, { marginTop: 6 }]}>
              Estimations à confirmer auprès des organismes concernés.
            </Text>
          </View>
        )}

        {/* Conditions */}
        {devis.conditions && (
          <View style={styles.conditions}>
            <Text style={styles.encadreTitle}>Conditions</Text>
            <Text>{devis.conditions}</Text>
          </View>
        )}

        {/* Coordonnées bancaires */}
        {(profil?.iban || profil?.bic) && (
          <View
            style={{
              marginTop: 16,
              padding: 10,
              backgroundColor: "#f9fafb",
              borderRadius: 4,
              fontSize: 9,
            }}
          >
            <Text style={[styles.encadreTitle, { marginBottom: 4 }]}>
              Règlement par virement
            </Text>
            {profil?.banque_nom && <Text>Banque : {profil.banque_nom}</Text>}
            {profil?.iban && <Text>IBAN : {formatIban(profil.iban)}</Text>}
            {profil?.bic && <Text>BIC : {profil.bic}</Text>}
          </View>
        )}

        {/* Signature client */}
        <View style={styles.signatureBox} wrap={false}>
          <View style={styles.signatureCell}>
            <Text style={styles.signatureTitle}>Bon pour accord du client</Text>
            <Text style={styles.signatureMention}>
              Date : ……………………………………
            </Text>
            <Text style={styles.signatureMention}>
              Signature précédée de la mention « Bon pour accord » :
            </Text>
          </View>
          <View style={styles.signatureCell}>
            <Text style={styles.signatureTitle}>Émetteur</Text>
            <Text style={styles.signatureMention}>{entrepriseNom}</Text>
            <Text style={styles.signatureMention}>
              Date : {formatDateFr(devis.date_emission)}
            </Text>
          </View>
        </View>

        {/* Pied de page */}
        <View style={styles.footer} fixed>
          {mentions.rm && (
            <Text style={styles.footerLine}>{mentions.rm}</Text>
          )}
          {mentions.decennale && (
            <Text style={styles.footerLine}>{mentions.decennale}</Text>
          )}
          {mentions.fluides && (
            <Text style={styles.footerLine}>{mentions.fluides}</Text>
          )}
          {mentions.rge && (
            <Text style={styles.footerLine}>{mentions.rge}</Text>
          )}
          {mentions.mediateur && (
            <Text style={styles.footerLine}>{mentions.mediateur}</Text>
          )}
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

function labelAide(key: string): string {
  switch (key) {
    case "maprimerenov":
      return "MaPrimeRénov'";
    case "cee":
      return "Certificats d'Économie d'Énergie (CEE)";
    case "eco_ptz":
      return "Eco-PTZ";
    default:
      return key;
  }
}
