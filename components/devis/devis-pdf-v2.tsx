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
} from "@/lib/format";
import {
  LABELS_TYPE_ACTIVITE,
  MENTION_DEVIS_GRATUIT,
  mentionTvaFranchise,
  MENTION_RETRACTATION_L221_18,
  FORMULAIRE_RETRACTATION_LIGNES,
  mentionMediateur,
} from "@/lib/legal-text";
import { profilEffectif } from "@/lib/emetteur";
import { computeSections } from "@/lib/sections";
import {
  acompteDevis,
  blocsAssurance,
  CLAUSE_MATERIEL_DISPO,
  CLAUSE_TRAVAUX_SUPPLEMENTAIRES,
  conditionsOffre,
  lignesPourRendu,
} from "@/lib/devis-v2";
import type { Database } from "@/types/database";
import type { LignePdf } from "@/lib/pdf-payload";

type Devis = Database["public"]["Tables"]["devis"]["Row"];
type Ligne = LignePdf;
type Client = Database["public"]["Tables"]["clients"]["Row"];
type Profil = Database["public"]["Tables"]["profil_entreprise"]["Row"];

// Palette identique au modèle v1 et au reste de l'application.
const PRIMARY = "#2A7D5B";
const TEXT = "#1c1f24";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    // Pied de page réduit à deux lignes dans ce modèle (les assurances
    // ont leur propre section, imprimée UNE fois) : la réserve passe
    // donc de 118 pt à 56 pt, ce qui rend ~60 pt utiles par page.
    paddingBottom: 56,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: TEXT,
    lineHeight: 1.4,
  },

  // --- En-tête sobre ---
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
    paddingBottom: 10,
    borderBottom: `1pt solid ${BORDER}`,
  },
  brand: { flexDirection: "row", gap: 10, alignItems: "center" },
  logo: { width: 40, height: 40, objectFit: "contain" },
  entrepriseNom: { fontSize: 13, fontWeight: 700 },
  entrepriseLigne: { fontSize: 8.5, color: MUTED, marginTop: 1 },
  docBlock: { alignItems: "flex-end" },
  docTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: PRIMARY,
    letterSpacing: 1.5,
    lineHeight: 1,
    marginBottom: 6,
  },
  docNumero: { fontSize: 11, fontWeight: 700 },
  docDate: { fontSize: 8.5, color: MUTED, marginTop: 2 },

  // --- Blocs CLIENT / CHANTIER ---
  blocsRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  bloc: {
    flex: 1,
    border: `1pt solid ${BORDER}`,
    borderRadius: 4,
    padding: 8,
  },
  blocTitre: {
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
    color: PRIMARY,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  blocNom: { fontSize: 10.5, fontWeight: 700, marginBottom: 1 },
  blocLigne: { fontSize: 9 },

  natureRow: { marginBottom: 8 },
  natureLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
    color: PRIMARY,
    letterSpacing: 0.8,
  },

  // --- Tableau ---
  table: { borderTop: `1pt solid ${BORDER}` },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f6f7f9",
    borderBottom: `1pt solid ${BORDER}`,
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
    color: MUTED,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottom: `1pt solid ${BORDER}`,
  },
  colDesignation: { flex: 1, paddingRight: 8 },
  colQte: { width: 46, textAlign: "right" },
  colPu: { width: 68, textAlign: "right" },
  colTotal: { width: 74, textAlign: "right" },

  sectionTitreRow: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottom: `1pt solid ${BORDER}`,
    backgroundColor: "#f6f7f9",
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
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottom: `1pt solid ${BORDER}`,
  },
  sousTotalLabel: { fontWeight: 700, fontSize: 8.5, color: MUTED },
  sousTotalValue: { fontWeight: 700, width: 74, textAlign: "right" },

  // --- Totaux ---
  totalsBlock: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10 },
  totalsTable: { width: 250 },
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
    paddingVertical: 7,
    borderTop: `1pt solid ${BORDER}`,
    marginTop: 3,
  },
  totalFinalLabel: { fontSize: 11, fontWeight: 700 },
  totalFinalValue: {
    fontSize: 13,
    fontWeight: 700,
    color: PRIMARY,
    textAlign: "right",
  },
  mentionTva: { fontSize: 7.5, color: MUTED, textAlign: "right", marginTop: 4 },
  resteAcharge: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#f6fbf8",
    marginTop: 4,
    borderRadius: 3,
  },

  // --- Encadrés ---
  encadre: {
    marginTop: 12,
    padding: 9,
    backgroundColor: "#f6fbf8",
    border: `1pt solid #cfe7d9`,
    borderRadius: 4,
  },
  encadreNeutre: {
    marginTop: 12,
    padding: 9,
    border: `1pt solid ${BORDER}`,
    borderRadius: 4,
  },
  encadreDashed: {
    marginTop: 12,
    padding: 9,
    border: `1pt dashed #cfd4dc`,
    borderRadius: 4,
  },
  encadreTitle: {
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
    color: PRIMARY,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  conditionRow: { flexDirection: "row", marginBottom: 2 },
  conditionLabel: { width: 120, color: MUTED },
  conditionValeur: { flex: 1 },
  clause: { fontSize: 8.5, marginTop: 3 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: "32%", marginBottom: 4 },
  cellLabel: { fontSize: 8, color: MUTED },
  cellValue: { fontSize: 9.5 },

  assuranceCol: { marginBottom: 5 },
  assuranceTitre: { fontWeight: 700, fontSize: 9 },
  assuranceLigne: { fontSize: 8.5, color: MUTED },

  // --- Acceptation ---
  acceptation: {
    marginTop: 14,
    border: `1pt solid ${PRIMARY}`,
    borderRadius: 4,
    padding: 10,
  },
  acceptationTitre: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    color: PRIMARY,
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  acceptationTexte: { fontSize: 8.5, marginBottom: 8 },
  acceptationRow: { flexDirection: "row", gap: 16 },
  acceptationChamp: { flex: 1 },
  acceptationLabel: { fontSize: 8, color: MUTED, marginBottom: 2 },
  acceptationTrait: {
    borderBottom: `1pt solid ${BORDER}`,
    height: 14,
  },
  zoneSignature: {
    marginTop: 8,
    border: `1pt solid ${BORDER}`,
    borderRadius: 4,
    height: 96,
    padding: 6,
  },

  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 22,
    fontSize: 7,
    color: MUTED,
    paddingTop: 6,
    borderTop: `1pt solid ${BORDER}`,
    lineHeight: 1.4,
    textAlign: "center",
  },
  pageNumber: {
    position: "absolute",
    fontSize: 7.5,
    bottom: 9,
    right: 36,
    color: MUTED,
  },
});

/**
 * Modèle de devis v2 — appliqué UNIQUEMENT aux devis dont
 * `pdf_template_version` vaut 2, c'est-à-dire ceux créés après la
 * migration. Les devis antérieurs continuent d'être rendus par le
 * modèle v1, à l'identique de ce que le client a reçu.
 *
 * Différences avec le v1 :
 * - en-tête sobre (nom de l'entreprise, le détail passe en pied) ;
 * - blocs CLIENT et ADRESSE DU CHANTIER distincts ;
 * - tableau à 4 colonnes, sans aucune notion de TVA ;
 * - TOTAL HT puis NET À PAYER, mention de franchise en petit dessous ;
 * - sections CONDITIONS DE L'OFFRE, GESTION DES DÉCHETS, ASSURANCES
 *   (cette dernière imprimée une seule fois, plus en pied de page) ;
 * - bloc ACCEPTATION DU DEVIS insécable.
 *
 * Convention maison : appelé comme une fonction, DevisPdfV2({...}).
 */
export function DevisPdfV2({
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
  // Mentions émetteur figées à l'émission (SIRET historisé).
  const profil = profilEffectif(profilCourant, devis.emetteur);

  const entrepriseNom =
    profil?.nom_commercial ||
    [profil?.prenom, profil?.nom].filter(Boolean).join(" ") ||
    "Auto-entrepreneur";
  // « EI » : mention obligatoire de l'entrepreneur individuel, accolée
  // au nom (loi du 14 février 2022). Jamais dupliquée si déjà saisie.
  const enseigne = /\bEI\b/.test(entrepriseNom)
    ? entrepriseNom
    : `${entrepriseNom} EI`;

  const totalHt = Number(devis.total_ht);
  // Lignes nettoyées (préfixes « 2x » redondants, main-d'œuvre à 0 €)
  // puis découpées en sections titrées — les totaux ne changent pas.
  const lignesRendu = lignesPourRendu(lignes);
  const { sections } = computeSections(lignesRendu);

  const acompte = acompteDevis(
    totalHt,
    devis.acompte_pct !== null ? Number(devis.acompte_pct) : null,
    devis.acompte_montant !== null ? Number(devis.acompte_montant) : null,
  );

  const validiteJours =
    devis.date_emission && devis.date_validite
      ? Math.round(
          (new Date(devis.date_validite).getTime() -
            new Date(devis.date_emission).getTime()) /
            (24 * 3600 * 1000),
        )
      : null;

  const conditions = conditionsOffre({
    delaiIntervention: profil?.delai_intervention_default,
    dureeEstimeeJours: devis.duree_estimee_jours,
    dateDebutTravaux: devis.date_debut_travaux,
    fraisDeplacement: profil?.frais_deplacement_default,
    validiteJours,
    formatDate: formatDateFr,
  });

  const assurances = blocsAssurance(profil);
  const gestionDechets = (profil?.gestion_dechets_default ?? "").trim();

  const aides = (devis.aides_financieres ?? {}) as Record<string, unknown>;
  const aidesEntries = Object.entries(aides).filter(
    ([, v]) => typeof v === "number" && (v as number) > 0,
  );
  const totalAides = aidesEntries.reduce((s, [, v]) => s + (v as number), 0);
  const resteAcharge = Math.max(0, totalHt - totalAides);

  const equip = (devis.equipement_info ?? {}) as Record<string, unknown>;
  const isClimPac =
    devis.type_activite === "installation_clim" ||
    devis.type_activite === "installation_pac";

  const mediateur =
    client?.type === "particulier"
      ? mentionMediateur({
          nom: profil?.mediateur_nom,
          siteWeb: profil?.mediateur_site_web,
          adresse: profil?.mediateur_adresse,
        })
      : null;

  const adresseChantier = (devis.adresse_chantier ?? "").trim();
  const lignesChantier = adresseChantier
    ? adresseChantier.split(/\r?\n/).filter((l) => l.trim())
    : [];

  const pied = [
    enseigne,
    profil?.siret ? `SIRET ${formatSiret(profil.siret)}` : null,
    profil?.code_ape ? `APE ${profil.code_ape}` : null,
    profil?.email_pro,
    profil?.telephone,
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <Document
      title={`Devis ${devis.numero}`}
      author={enseigne}
      creator="Facture AE"
    >
      <Page size="A4" style={styles.page}>
        {/* En-tête sobre */}
        <View style={styles.header}>
          <View style={styles.brand}>
            {logoData ? (
              /* eslint-disable-next-line jsx-a11y/alt-text -- API react-pdf */
              <Image src={logoData} style={styles.logo} />
            ) : null}
            <View>
              <Text style={styles.entrepriseNom}>{enseigne}</Text>
              {(profil?.code_postal || profil?.ville) && (
                <Text style={styles.entrepriseLigne}>
                  {profil?.code_postal} {profil?.ville}
                </Text>
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
              Valable jusqu&apos;au {formatDateFr(devis.date_validite)}
              {validiteJours ? ` (${validiteJours} jours)` : ""}
            </Text>
            <Text style={[styles.docDate, { color: PRIMARY, fontWeight: 700 }]}>
              {MENTION_DEVIS_GRATUIT}
            </Text>
          </View>
        </View>

        {/* CLIENT + ADRESSE DU CHANTIER */}
        <View style={styles.blocsRow}>
          <View style={styles.bloc}>
            <Text style={styles.blocTitre}>Client</Text>
            <Text style={styles.blocNom}>
              {client?.raison_sociale || client?.nom || "Client"}
            </Text>
            {client?.raison_sociale && client.nom !== client.raison_sociale && (
              <Text style={styles.blocLigne}>{client.nom}</Text>
            )}
            {client?.adresse_ligne1 && (
              <Text style={styles.blocLigne}>{client.adresse_ligne1}</Text>
            )}
            {client?.adresse_ligne2 && (
              <Text style={styles.blocLigne}>{client.adresse_ligne2}</Text>
            )}
            {(client?.code_postal || client?.ville) && (
              <Text style={styles.blocLigne}>
                {client?.code_postal} {client?.ville}
              </Text>
            )}
            {client?.siret && (
              <Text style={[styles.blocLigne, { marginTop: 3 }]}>
                SIRET : {formatSiret(client.siret)}
              </Text>
            )}
          </View>
          <View style={styles.bloc}>
            <Text style={styles.blocTitre}>Adresse du chantier</Text>
            {lignesChantier.length > 0 ? (
              lignesChantier.map((l, i) => (
                <Text key={i} style={styles.blocLigne}>
                  {l}
                </Text>
              ))
            ) : (
              <>
                <Text style={styles.blocLigne}>
                  Identique à l&apos;adresse du client
                </Text>
                {client?.adresse_ligne1 && (
                  <Text style={[styles.blocLigne, { color: MUTED }]}>
                    {client.adresse_ligne1}
                    {client?.ville ? `, ${client.ville}` : ""}
                  </Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* Nature de la prestation */}
        <View style={styles.natureRow}>
          <Text style={styles.natureLabel}>Nature de la prestation</Text>
          <Text>
            {LABELS_TYPE_ACTIVITE[
              devis.type_activite as keyof typeof LABELS_TYPE_ACTIVITE
            ] ?? devis.type_activite}
          </Text>
        </View>

        {/* Tableau : DÉSIGNATION / Qté / P.U. HT / TOTAL HT — aucune TVA */}
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={styles.colDesignation}>Désignation</Text>
            <Text style={styles.colQte}>Qté</Text>
            <Text style={styles.colPu}>P.U. HT</Text>
            <Text style={styles.colTotal}>Total HT</Text>
          </View>
          {sections.map((section, si) => (
            <View key={si}>
              {section.titre !== null && (
                // minPresenceAhead : un titre de section n'est jamais
                // imprimé seul en bas de page, sa première ligne suit.
                <View
                  style={styles.sectionTitreRow}
                  wrap={false}
                  minPresenceAhead={40}
                >
                  <Text style={styles.sectionTitreText}>{section.titre}</Text>
                </View>
              )}
              {section.lignes.map((l, li) => {
                const ligne = l as unknown as Ligne;
                return (
                  <View
                    key={ligne.id ?? `${si}-${li}`}
                    style={styles.tableRow}
                    wrap={false}
                    // Empêche qu'une seule ligne bascule sur une page
                    // quasi vide : sans place pour elle ET un peu de
                    // suite, la coupure se fait avant.
                    minPresenceAhead={30}
                  >
                    <Text style={styles.colDesignation}>
                      {ligne.designation}
                    </Text>
                    <Text style={styles.colQte}>
                      {Number(ligne.quantite).toLocaleString("fr-FR", {
                        maximumFractionDigits: 3,
                      })}
                    </Text>
                    <Text style={styles.colPu}>
                      {formatEuros(Number(ligne.prix_unitaire_ht))}
                    </Text>
                    <Text style={styles.colTotal}>
                      {formatEuros(Number(ligne.total_ht))}
                    </Text>
                  </View>
                );
              })}
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

        {/* TOTAUX — jamais coupés */}
        <View style={styles.totalsBlock} wrap={false}>
          <View style={styles.totalsTable}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL HT</Text>
              <Text style={styles.totalValue}>{formatEuros(totalHt)}</Text>
            </View>
            <View style={styles.totalFinal}>
              <Text style={styles.totalFinalLabel}>NET À PAYER</Text>
              <Text style={styles.totalFinalValue}>{formatEuros(totalHt)}</Text>
            </View>
            {/* Mention de franchise : valeur calculée par l'application
                selon la date d'émission (bascule CGI → CIBS gérée dans
                lib/legal-text) — jamais écrite en dur ici. */}
            <Text style={styles.mentionTva}>
              {mentionTvaFranchise(devis.date_emission)}
            </Text>
            {totalAides > 0 && (
              <>
                <View style={[styles.totalRow, { paddingTop: 6 }]}>
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

        {/* Modalités de paiement */}
        {acompte && (
          <View style={styles.encadre} wrap={false}>
            <Text style={styles.encadreTitle}>Modalités de paiement</Text>
            <Text style={{ fontWeight: 700 }}>{acompte.phrase}</Text>
            {(profil?.iban || profil?.bic) && (
              <View style={{ marginTop: 4 }}>
                {profil?.banque_nom && (
                  <Text style={{ fontSize: 8.5 }}>
                    Banque : {profil.banque_nom}
                  </Text>
                )}
                {profil?.iban && (
                  <Text style={{ fontSize: 8.5 }}>
                    IBAN : {formatIban(profil.iban)}
                  </Text>
                )}
                {profil?.bic && (
                  <Text style={{ fontSize: 8.5 }}>BIC : {profil.bic}</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* CONDITIONS DE L'OFFRE */}
        <View style={styles.encadreNeutre} wrap={false}>
          <Text style={styles.encadreTitle}>Conditions de l&apos;offre</Text>
          {conditions.map((c) => (
            <View key={c.label} style={styles.conditionRow}>
              <Text style={styles.conditionLabel}>{c.label}</Text>
              <Text style={styles.conditionValeur}>{c.valeur}</Text>
            </View>
          ))}
          <Text style={styles.clause}>• {CLAUSE_MATERIEL_DISPO}</Text>
          <Text style={styles.clause}>• {CLAUSE_TRAVAUX_SUPPLEMENTAIRES}</Text>
          {devis.conditions && (
            <Text style={[styles.clause, { marginTop: 5 }]}>
              {devis.conditions}
            </Text>
          )}
        </View>

        {/* Gestion des déchets */}
        {gestionDechets && (
          <View style={styles.encadreNeutre} wrap={false}>
            <Text style={styles.encadreTitle}>Gestion des déchets</Text>
            <Text style={{ fontSize: 8.5 }}>{gestionDechets}</Text>
          </View>
        )}

        {/* Équipement clim/PAC */}
        {isClimPac && Object.keys(equip).length > 0 && (
          <View style={styles.encadre} wrap={false}>
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
              {(equip.fluide_frigo_type as string) && (
                <View style={styles.cell}>
                  <Text style={styles.cellLabel}>Fluide frigorigène</Text>
                  <Text style={styles.cellValue}>
                    {equip.fluide_frigo_type as string}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Aides financières */}
        {aidesEntries.length > 0 && (
          <View style={styles.encadreDashed} wrap={false}>
            <Text style={styles.encadreTitle}>Aides financières estimées</Text>
            {aidesEntries.map(([k, v]) => (
              <Text key={k} style={{ fontSize: 8.5 }}>
                {labelAide(k)} : {formatEuros(v as number)}
              </Text>
            ))}
            <Text style={{ fontSize: 8, color: MUTED, marginTop: 4 }}>
              Estimations à confirmer auprès des organismes concernés.
            </Text>
          </View>
        )}

        {/* ASSURANCES — une seule fois, plus en pied de page répété */}
        {assurances.length > 0 && (
          <View style={styles.encadreNeutre} wrap={false}>
            <Text style={styles.encadreTitle}>
              Assurances et qualifications
            </Text>
            {assurances.map((bloc) => (
              <View key={bloc.titre} style={styles.assuranceCol}>
                <Text style={styles.assuranceTitre}>{bloc.titre}</Text>
                {bloc.lignes.map((l, i) => (
                  <Text key={i} style={styles.assuranceLigne}>
                    {l}
                  </Text>
                ))}
              </View>
            ))}
            {mediateur && (
              <Text style={[styles.assuranceLigne, { marginTop: 2 }]}>
                {mediateur}
              </Text>
            )}
          </View>
        )}

        {/* ACCEPTATION DU DEVIS — jamais coupée */}
        <View style={styles.acceptation} wrap={false}>
          <Text style={styles.acceptationTitre}>Acceptation du devis</Text>
          <Text style={styles.acceptationTexte}>
            Je reconnais avoir pris connaissance du présent devis, des
            prestations décrites et des conditions de l&apos;offre, et
            j&apos;en accepte les termes. Le devis signé vaut commande.
          </Text>
          <View style={styles.acceptationRow}>
            <View style={styles.acceptationChamp}>
              <Text style={styles.acceptationLabel}>Nom du client</Text>
              <Text style={styles.acceptationTrait}>
                {signatureData
                  ? client?.raison_sociale || client?.nom || ""
                  : ""}
              </Text>
            </View>
            <View style={styles.acceptationChamp}>
              <Text style={styles.acceptationLabel}>Date</Text>
              <Text style={styles.acceptationTrait}>
                {signatureData && devis.date_signature
                  ? formatDateFr(devis.date_signature)
                  : ""}
              </Text>
            </View>
          </View>
          <View style={styles.zoneSignature}>
            <Text style={styles.acceptationLabel}>
              Signature précédée de la mention « Bon pour accord »
            </Text>
            {signatureData ? (
              /* eslint-disable-next-line jsx-a11y/alt-text -- API react-pdf */
              <Image
                src={signatureData}
                style={{
                  width: 190,
                  height: 62,
                  objectFit: "contain",
                  marginTop: 4,
                }}
              />
            ) : null}
          </View>
        </View>

        {/* Droit de rétractation (devis signé au domicile) */}
        {devis.signe_a_domicile && (
          <View style={styles.encadreDashed} wrap={false}>
            <Text style={styles.encadreTitle}>
              Droit de rétractation (art. L221-18 du Code de la consommation)
            </Text>
            <Text style={{ fontSize: 8 }}>{MENTION_RETRACTATION_L221_18}</Text>
            <View
              style={{
                marginTop: 6,
                paddingTop: 5,
                borderTop: "1pt dashed #9ca3af",
              }}
            >
              {FORMULAIRE_RETRACTATION_LIGNES.map((ligne, i) => (
                <Text
                  key={i}
                  style={{
                    fontSize: 8,
                    fontWeight: i === 0 ? 700 : 400,
                    marginBottom: 3,
                  }}
                >
                  {ligne}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Pied de page : identité + franchise, deux lignes maximum */}
        <View style={styles.footer} fixed>
          <Text>{pied}</Text>
          <Text>{mentionTvaFranchise(devis.date_emission)}</Text>
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
