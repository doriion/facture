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
  MENTION_PENALITES_RETARD_DEFAULT,
  mentionTvaFranchise,
  mentionDecennale,
  mentionFluidesFrigo,
  mentionMediateur,
  mentionRgeQualipac,
  mentionRm,
} from "@/lib/legal-text";
import { profilEffectif } from "@/lib/emetteur";
import type { Database } from "@/types/database";

type Facture = Database["public"]["Tables"]["factures"]["Row"];
type Ligne = Database["public"]["Tables"]["factures_lignes"]["Row"];
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
    // Compense la lineHeight serrée du titre FACTURE à droite : sans
    // ça, la baseline du "Nathan Geneve" (13pt, lineHeight 1.4) est
    // visuellement plus basse que celle du titre 22pt à droite. Avec
    // ce paddingTop, les deux blocs commencent au même niveau.
    paddingTop: 2,
  },
  logo: { width: 56, height: 56, objectFit: "contain" },
  entrepriseBlock: { fontSize: 9 },
  entrepriseNom: { fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 2 },
  entrepriseLine: { color: MUTED, fontSize: 9 },
  factureBlock: { alignItems: "flex-end" },
  factureTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: PRIMARY,
    letterSpacing: 1.5,
    // lineHeight 1 = la boîte du titre fait pile la hauteur du glyphe
    // (au lieu de gaspiller ~9pt avec le 1.4 hérité de la page).
    lineHeight: 1,
    // ≈10pt d'espace entre la base du titre et le numéro en dessous,
    // dans la fourchette 8–12 px demandée.
    marginBottom: 10,
  },
  factureNumero: { fontSize: 12, fontWeight: 700 },
  // marginTop: 3 entre chaque ligne de date pour aérer (Émise /
  // Prestation / Échéance) sans pousser tout le bloc trop bas.
  factureDate: { fontSize: 9, color: MUTED, marginTop: 3 },

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
  totalsTable: { width: 220 },
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

  equipementBox: {
    marginTop: 16,
    padding: 10,
    backgroundColor: "#f6fbf8",
    border: `1pt solid #cfe7d9`,
    borderRadius: 4,
  },
  equipementTitle: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: PRIMARY,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  equipementGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  equipementCell: { width: "32%", marginBottom: 4 },
  equipementLabel: { fontSize: 8, color: MUTED },
  equipementValue: { fontSize: 9.5 },

  aidesBox: {
    marginTop: 12,
    padding: 10,
    border: `1pt dashed #cfd4dc`,
    borderRadius: 4,
  },

  conditions: { marginTop: 16, fontSize: 9 },
  conditionsTitle: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: PRIMARY,
    letterSpacing: 0.8,
    marginBottom: 4,
  },

  banqueBlock: {
    marginTop: 16,
    padding: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    fontSize: 9,
  },

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
  footerStrong: { fontWeight: 700, color: TEXT },

  pageNumber: {
    position: "absolute",
    fontSize: 8,
    bottom: 10,
    right: 36,
    color: MUTED,
  },
});

/**
 * Document PDF complet d'une facture, conforme aux exigences légales
 * auto-entrepreneur BTP françaises.
 */
export function FacturePdf({
  facture,
  lignes,
  client,
  profil: profilCourant,
  logoData,
}: {
  facture: Facture;
  lignes: Ligne[];
  client: Client | null;
  profil: Profil | null;
  logoData?: string | null;
}) {
  // Facture émise : mentions émetteur FIGÉES au moment de l'émission
  // (SIRET historisé) ; brouillon : profil courant.
  const profil = profilEffectif(profilCourant, facture.emetteur);
  const equip = (facture.equipement_info ?? {}) as Record<string, unknown>;
  const aides = (facture.aides_financieres ?? {}) as Record<string, unknown>;
  const isClimPac =
    facture.type_activite === "installation_clim" ||
    facture.type_activite === "installation_pac";
  const aidesEntries = Object.entries(aides).filter(
    ([, v]) => typeof v === "number" && (v as number) > 0,
  );

  const totalHt = Number(facture.total_ht);
  const sirenComputed = profil?.siren ?? siretToSiren(profil?.siret);

  // Mentions légales construites une seule fois
  const mentions = {
    decennale: mentionDecennale({
      numero: profil?.num_assurance_decennale,
      assureur: profil?.assureur_decennale,
      assureurAdresse: profil?.assureur_decennale_adresse,
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

  return (
    <Document
      title={`Facture ${facture.numero}`}
      author={entrepriseNom}
      creator="Facture AE"
    >
      <Page size="A4" style={styles.page}>
        {/* Header : logo + entreprise / FACTURE + numéro */}
        <View style={styles.header}>
          <View style={styles.brand}>
            {logoData ? (
              <Image src={logoData} style={styles.logo} />
            ) : null}
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
          <View style={styles.factureBlock}>
            <Text style={styles.factureTitle}>FACTURE</Text>
            <Text style={styles.factureNumero}>{facture.numero}</Text>
            <Text style={styles.factureDate}>
              Émise le {formatDateFr(facture.date_emission)}
            </Text>
            {facture.date_prestation && (
              <Text style={styles.factureDate}>
                Prestation :{" "}
                {facture.date_prestation_fin &&
                facture.date_prestation_fin !== facture.date_prestation
                  ? `du ${formatDateFr(facture.date_prestation)} au ${formatDateFr(facture.date_prestation_fin)}`
                  : `le ${formatDateFr(facture.date_prestation)}`}
              </Text>
            )}
            <Text style={styles.factureDate}>
              Échéance : {formatDateFr(facture.date_echeance)}
            </Text>
          </View>
        </View>

        {/* Bandeau identité légale + client */}
        <View style={styles.rowBetween}>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Émetteur</Text>
            {profil?.siret && (
              <Text>SIRET : {formatSiret(profil.siret)}</Text>
            )}
            {sirenComputed && <Text>SIREN : {sirenComputed}</Text>}
            {profil?.code_ape && <Text>Code APE : {profil.code_ape}</Text>}
            <Text>{MENTION_AUTO_ENTREPRENEUR}</Text>
            <Text>{mentionTvaFranchise(facture.date_emission)}</Text>
          </View>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Facturé à</Text>
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

        {/* Type d'activité */}
        <View style={{ marginBottom: 6 }}>
          <Text style={styles.blockTitle}>Nature de la prestation</Text>
          <Text>
            {LABELS_TYPE_ACTIVITE[
              facture.type_activite as keyof typeof LABELS_TYPE_ACTIVITE
            ] ?? facture.type_activite}
          </Text>
        </View>

        {/* Tableau des lignes */}
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
              <Text style={styles.totalFinalLabel}>Net à payer</Text>
              <Text style={styles.totalFinalValue}>{formatEuros(totalHt)}</Text>
            </View>
          </View>
        </View>

        {/* Équipement (clim/PAC) */}
        {isClimPac && Object.keys(equip).length > 0 && (
          <View style={styles.equipementBox}>
            <Text style={styles.equipementTitle}>Équipement installé</Text>
            <View style={styles.equipementGrid}>
              {(equip.marque as string) && (
                <View style={styles.equipementCell}>
                  <Text style={styles.equipementLabel}>Marque</Text>
                  <Text style={styles.equipementValue}>
                    {equip.marque as string}
                  </Text>
                </View>
              )}
              {(equip.modele as string) && (
                <View style={styles.equipementCell}>
                  <Text style={styles.equipementLabel}>Modèle</Text>
                  <Text style={styles.equipementValue}>
                    {equip.modele as string}
                  </Text>
                </View>
              )}
              {(equip.num_serie as string) && (
                <View style={styles.equipementCell}>
                  <Text style={styles.equipementLabel}>N° de série</Text>
                  <Text style={styles.equipementValue}>
                    {equip.num_serie as string}
                  </Text>
                </View>
              )}
              {(equip.fluide_frigo_type as string) && (
                <View style={styles.equipementCell}>
                  <Text style={styles.equipementLabel}>Fluide frigorigène</Text>
                  <Text style={styles.equipementValue}>
                    {equip.fluide_frigo_type as string}
                  </Text>
                </View>
              )}
              {typeof equip.fluide_frigo_kg === "number" && (
                <View style={styles.equipementCell}>
                  <Text style={styles.equipementLabel}>Charge fluide</Text>
                  <Text style={styles.equipementValue}>
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

        {/* Aides financières */}
        {aidesEntries.length > 0 && (
          <View style={styles.aidesBox}>
            <Text style={styles.equipementTitle}>Aides financières</Text>
            {aidesEntries.map(([k, v]) => (
              <Text key={k}>
                {labelAide(k)} : {formatEuros(v as number)}
              </Text>
            ))}
          </View>
        )}

        {/* Conditions de paiement */}
        {facture.conditions_paiement && (
          <View style={styles.conditions}>
            <Text style={styles.conditionsTitle}>Conditions de paiement</Text>
            <Text>{facture.conditions_paiement}</Text>
          </View>
        )}

        {/* Coordonnées bancaires */}
        {(profil?.iban || profil?.bic) && (
          <View style={styles.banqueBlock}>
            <Text style={[styles.equipementTitle, { marginBottom: 4 }]}>
              Règlement par virement
            </Text>
            {profil?.banque_nom && <Text>Banque : {profil.banque_nom}</Text>}
            {profil?.iban && <Text>IBAN : {formatIban(profil.iban)}</Text>}
            {profil?.bic && <Text>BIC : {profil.bic}</Text>}
          </View>
        )}

        {/* Pied de page : mentions légales.
            Mention pénalités + indemnité 40 € obligatoires entre pros
            (B2B) — fallback sur le texte par défaut si le profil n'est
            pas renseigné. Le texte par défaut consolide les deux
            mentions (L441-10 + D441-5) pour éviter une double ligne. */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLine}>
            {profil?.penalites_retard_text || MENTION_PENALITES_RETARD_DEFAULT}
          </Text>
          {profil?.escompte_text && (
            <Text style={styles.footerLine}>{profil.escompte_text}</Text>
          )}
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
