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
  mentionTvaFranchise,
  MENTION_DEVIS_RECU_AVANT_TRAVAUX,
  mentionRetractation,
  FORMULAIRE_RETRACTATION_LIGNES,
  mentionDecennale,
  mentionFluidesFrigo,
  mentionMediateur,
  mentionRgeQualipac,
  mentionRm,
} from "@/lib/legal-text";
import { profilEffectif } from "@/lib/emetteur";
import {
  MODELE_DEVIS_SIMPLE,
  versionModeleDevis,
} from "@/lib/devis-modele";
import { DevisPdfSimple } from "@/components/devis/devis-pdf-simple";
import { enseigneEmetteur, joursDeValidite } from "@/lib/devis-modele";
import { DUREE_VALIDITE_DEVIS_DEFAUT } from "@/lib/devis-validite";
import { computeSections } from "@/lib/sections";
import { mentionAcompte } from "@/lib/devis-mentions";
import type { Database } from "@/types/database";

type Devis = Database["public"]["Tables"]["devis"]["Row"];
// Liste blanche : le PDF ne connaît QUE les champs destinés au client
// (jamais prix_achat_ttc_unitaire / fournisseur — cf. lib/pdf-payload).
import type { LignePdf } from "@/lib/pdf-payload";
import * as PALETTE from "@/lib/theme";

type Ligne = LignePdf;
type Client = Database["public"]["Tables"]["clients"]["Row"];
type Profil = Database["public"]["Tables"]["profil_entreprise"]["Row"];

// Palette de marque : lib/theme est la SEULE source. Les alias courts
// gardent le reste du fichier lisible sans réintroduire de valeur en dur.
const PRIMARY = PALETTE.PRINCIPAL;
const TEXT = PALETTE.TEXTE;
const MUTED = PALETTE.TEXTE_DOUX;
const BORDER = PALETTE.BORDURE;

const styles = StyleSheet.create({
  page: {
    padding: 36,
    // Réserve la hauteur du pied de page FIXE (mentions légales sur
    // ~6 lignes) : sans ça, un encadré poussé en bas de page passe
    // SOUS le footer (chevauchement constaté sur le PDF d'exemple).
    paddingBottom: 118,
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
    backgroundColor: PALETTE.FOND_NEUTRE,
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

  // Titres de section (lignes type='titre') + sous-totaux par section
  sectionTitreRow: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottom: `1pt solid ${BORDER}`,
    backgroundColor: PALETTE.FOND_NEUTRE,
  },
  sectionTitreText: {
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sousTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottom: `1pt solid ${BORDER}`,
  },
  sousTotalLabel: { fontWeight: 700, fontSize: 9, color: MUTED },
  sousTotalValue: { fontWeight: 700, width: 75, textAlign: "right" },
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
    backgroundColor: PALETTE.FOND_PALE,
    paddingHorizontal: 8,
    marginTop: 4,
    borderRadius: 3,
  },

  encadre: {
    marginTop: 16,
    padding: 10,
    backgroundColor: PALETTE.FOND_PALE,
    border: `1pt solid ${PALETTE.BORDURE_BLEUE}`,
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

/**
 * Point d'entrée du PDF de devis : choisit le modèle selon la version
 * FIGÉE sur le devis (devis.pdf_template_version).
 *
 * GARANTIE : un devis émis avant l'arrivée du modèle simple porte NULL
 * et reste rendu par DevisPdfHistorique, à l'identique de ce que le
 * client a reçu — les PDF étant régénérés à chaque téléchargement,
 * c'est cette version stockée qui empêche de réécrire le passé.
 */
export function DevisPdf(props: {
  devis: Devis;
  lignes: Ligne[];
  client: Client | null;
  profil: Profil | null;
  logoData?: string | null;
  signatureData?: string | null;
}) {
  const version = versionModeleDevis(
    (props.devis as { pdf_template_version?: unknown }).pdf_template_version,
  );
  return version === MODELE_DEVIS_SIMPLE
    ? DevisPdfSimple(props)
    : DevisPdfHistorique(props);
}

/** Modèle d'origine — NE PAS MODIFIER : il rend les devis déjà émis. */
export function DevisPdfHistorique({
  devis,
  lignes,
  client,
  profil: profilCourant,
  logoData,
  signatureData,
}: {
  devis: Devis;
  lignes: Ligne[];
  client: Client | null;
  profil: Profil | null;
  logoData?: string | null;
  /** PNG (data URI) de la signature client enregistrée dans l'app */
  signatureData?: string | null;
}) {
  // Devis émis : mentions émetteur FIGÉES au moment de l'émission
  // (SIRET historisé) ; brouillon : profil courant.
  const profil = profilEffectif(profilCourant, devis.emetteur);
  // Affichage TVA : figé dans le snapshot émetteur du document (les
  // documents émis avant le réglage n'ont pas le champ → false).
  const assujettiTva = profil?.assujetti_tva === true;
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
  const acompte = mentionAcompte(
    totalHt,
    devis.acompte_pct !== null ? Number(devis.acompte_pct) : null,
    devis.acompte_montant !== null ? Number(devis.acompte_montant) : null,
  );
  const resteAcharge = Math.max(0, totalHt - totalAides);

  const sirenComputed = profil?.siren ?? siretToSiren(profil?.siret);

  const mentions = {
    decennale: mentionDecennale({
      numero: profil?.num_assurance_decennale,
      assureur: profil?.assureur_decennale,
      assureurAdresse: profil?.assureur_decennale_adresse,
      zone: profil?.zone_couverture_decennale,
      valideJusquau: profil?.decennale_valide_jusquau,
      dateDocument: devis.date_emission,
    }),
    fluides: isClimPac
      ? mentionFluidesFrigo(profil?.num_attestation_fluides_frigo, {
          valideJusquau: profil?.fluides_valide_jusquau,
          dateDocument: devis.date_emission,
        })
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

  // Raison + « EI » (obligatoire pour l'entrepreneur individuel), même
  // règle que la facture et le devis simple.
  const entrepriseNom = enseigneEmetteur(profil);

  // Validité en jours (entre émission et validité) — jamais négative
  const validiteJours =
    joursDeValidite(devis.date_emission, devis.date_validite) ?? DUREE_VALIDITE_DEVIS_DEFAUT;

  // Rétractation selon le mode de conclusion (hors établissement ou à
  // distance) ; les devis antérieurs à la colonne gardent signe_a_domicile.
  const modeConclusion =
    (devis as { mode_conclusion?: string | null }).mode_conclusion ??
    (devis.signe_a_domicile ? "hors_etablissement" : "etablissement");
  const texteRetractation = mentionRetractation(modeConclusion);
  const adresseChantier = (devis as { adresse_chantier?: string | null }).adresse_chantier ?? null;

  // Pied de page : une mention par ligne, réserve de page calculée sur
  // ce qui est réellement imprimé.
  const lignesPied = [
    mentions.rm,
    mentions.decennale,
    mentions.fluides,
    mentions.rge,
    mentions.mediateur,
  ].filter((m): m is string => Boolean(m));
  const reservePied = 40 + lignesPied.reduce((h, m) => h + (m.length > 110 ? 22 : 11), 0);

  return (
    <Document
      title={`Devis ${devis.numero}`}
      author={entrepriseNom}
      creator="Facture AE"
    >
      <Page size="A4" style={[styles.page, { paddingBottom: reservePied }]}>
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
            <Text>{mentionTvaFranchise(devis.date_emission)}</Text>
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
            {adresseChantier && (
              <Text style={{ marginTop: 4 }}>Lieu des travaux : {adresseChantier}</Text>
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
            <Text style={styles.colPu}>
              {assujettiTva ? "P.U. HT" : "P.U."}
            </Text>
            <Text style={styles.colTotal}>
              {assujettiTva ? "Total HT" : "TOTAL"}
            </Text>
          </View>
          {computeSections(lignes).sections.map((section, si) => (
            <View key={si}>
              {section.titre !== null && (
                <View style={styles.sectionTitreRow} wrap={false}>
                  <Text style={styles.sectionTitreText}>{section.titre}</Text>
                </View>
              )}
              {section.lignes.map((l) => (
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
              {section.titre !== null && (
                <View style={styles.sousTotalRow} wrap={false}>
                  <Text style={styles.sousTotalLabel}>
                    Sous-total {section.titre}
                  </Text>
                  <Text style={styles.sousTotalValue}>
                    {formatEuros(section.sousTotal)}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Totaux */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsTable}>
            {assujettiTva && (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total HT</Text>
                  <Text style={styles.totalValue}>
                    {formatEuros(totalHt)}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>TVA</Text>
                  <Text style={styles.totalValue}>
                    non applicable (voir mention)
                  </Text>
                </View>
              </>
            )}
            <View style={styles.totalFinal}>
              <Text style={styles.totalFinalLabel}>NET À PAYER</Text>
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

        {/* Modalités de paiement (acompte) */}
        {acompte && (
          <View style={styles.conditions}>
            <Text style={styles.encadreTitle}>Modalités de paiement</Text>
            <Text style={{ fontWeight: 700 }}>{acompte}</Text>
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
            {signatureData ? (
              <>
                <Text style={styles.signatureMention}>
                  Bon pour accord — signé le{" "}
                  {devis.date_signature
                    ? formatDateFr(devis.date_signature)
                    : "…"}
                </Text>
                <Image
                  src={signatureData}
                  style={{
                    width: 140,
                    height: 55,
                    objectFit: "contain",
                    marginTop: 4,
                  }}
                />
              </>
            ) : (
              <>
                <Text style={styles.signatureMention}>
                  Date : ……………………………………
                </Text>
                <Text style={styles.signatureMention}>
                  Signature précédée de la mention « Bon pour accord » :
                </Text>
              </>
            )}
            <Text style={styles.signatureMention}>{MENTION_DEVIS_RECU_AVANT_TRAVAUX}</Text>
          </View>
          <View style={styles.signatureCell}>
            <Text style={styles.signatureTitle}>Émetteur</Text>
            <Text style={styles.signatureMention}>{entrepriseNom}</Text>
            <Text style={styles.signatureMention}>
              Date : {formatDateFr(devis.date_emission)}
            </Text>
          </View>
        </View>

        {/* Droit de rétractation (hors établissement ou à distance) */}
        {texteRetractation && (
          <View style={styles.encadreDashed} wrap={false}>
            <Text style={styles.encadreTitle}>
              Droit de rétractation (art. L221-18 du Code de la consommation)
            </Text>
            <Text style={{ fontSize: 8.5 }}>{texteRetractation}</Text>
            <View
              style={{
                marginTop: 8,
                paddingTop: 6,
                borderTop: "1pt dashed #9ca3af",
              }}
            >
              {FORMULAIRE_RETRACTATION_LIGNES.map((ligne, i) => (
                <Text
                  key={i}
                  style={{
                    fontSize: 8.5,
                    fontWeight: i === 0 ? 700 : 400,
                    marginBottom: 4,
                  }}
                >
                  {ligne}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Pied de page */}
        <View style={styles.footer} fixed>
          {lignesPied.map((m, i) => (
            <Text key={i} style={styles.footerLine}>
              {m}
            </Text>
          ))}
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
