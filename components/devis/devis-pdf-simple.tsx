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
  MENTION_DEVIS_RECU_AVANT_TRAVAUX,
  mentionRetractation,
  FORMULAIRE_RETRACTATION_LIGNES,
} from "@/lib/legal-text";
import { profilEffectif } from "@/lib/emetteur";
import { computeSections } from "@/lib/sections";
import {
  coordonneesEmetteur,
  enseigneEmetteur,
  joursDeValidite,
  ligneAcompte,
  ligneePiedDePage,
  lignesReglementairesDevis,
} from "@/lib/devis-modele";
import type { Database } from "@/types/database";
import type { LignePdf } from "@/lib/pdf-payload";
import * as PALETTE from "@/lib/theme";

type Devis = Database["public"]["Tables"]["devis"]["Row"];
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
    padding: 40,
    // Pied de page tenu sur UNE ligne : une réserve courte suffit, et
    // le devis court tient d'autant mieux sur une seule page.
    paddingBottom: 46,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: TEXT,
    lineHeight: 1.4,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  brand: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  logo: { width: 44, height: 44, objectFit: "contain" },
  enseigne: { fontSize: 14, fontWeight: 700, marginBottom: 3 },
  coordonnee: { fontSize: 9, color: MUTED },
  docBlock: { alignItems: "flex-end" },
  docTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: PRIMARY,
    letterSpacing: 1.5,
    lineHeight: 1,
    marginBottom: 6,
  },
  docNumero: { fontSize: 11, fontWeight: 700 },
  docDate: { fontSize: 9, color: MUTED, marginTop: 2 },

  clientBloc: {
    alignSelf: "flex-end",
    width: 250,
    border: `1pt solid ${BORDER}`,
    borderRadius: 4,
    padding: 9,
    marginBottom: 12,
  },
  clientTitre: {
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
    color: PRIMARY,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  clientNom: { fontSize: 11, fontWeight: 700, marginBottom: 1 },
  clientLigne: { fontSize: 9.5 },

  nature: { marginBottom: 8 },
  natureLabel: { fontSize: 9, color: MUTED },

  table: { borderTop: `1pt solid ${BORDER}` },
  tableHeader: {
    flexDirection: "row",
    borderBottom: `1pt solid ${BORDER}`,
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: MUTED,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    // Interligne serré : un devis d'une douzaine de lignes tient ainsi
    // sur une seule page, en-tête, totaux et accord compris.
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottom: `1pt solid ${BORDER}`,
  },
  colDesignation: { flex: 1, paddingRight: 10 },
  colQte: { width: 44, textAlign: "right" },
  colPu: { width: 72, textAlign: "right" },
  colTotal: { width: 78, textAlign: "right" },

  sectionTitreRow: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottom: `1pt solid ${BORDER}`,
  },
  sectionTitreText: {
    fontWeight: 700,
    fontSize: 9.5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: PRIMARY,
  },

  totaux: { alignSelf: "flex-end", width: 250, marginTop: 10 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalLabel: { color: MUTED },
  netRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTop: `1pt solid ${BORDER}`,
    marginTop: 3,
  },
  netLabel: { fontSize: 12, fontWeight: 700 },
  netValue: { fontSize: 14, fontWeight: 700, color: PRIMARY },
  mentionTva: {
    fontSize: 7.5,
    color: MUTED,
    textAlign: "right",
    marginTop: 5,
  },

  acompteLigne: {
    marginTop: 8,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderLeft: `2pt solid ${PRIMARY}`,
    fontSize: 9.5,
  },

  bas: { flexDirection: "row", gap: 14, marginTop: 12 },
  rib: {
    width: 215,
    border: `1pt solid ${BORDER}`,
    borderRadius: 4,
    padding: 9,
  },
  ribTitre: {
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
    color: PRIMARY,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  ribLigne: { fontSize: 8.5 },
  accord: {
    flex: 1,
    border: `1pt solid ${PRIMARY}`,
    borderRadius: 4,
    padding: 9,
    // Hauteur mini : laisse un espace blanc réellement signable sous la
    // date. Ne pas réduire pour gagner une ligne de tableau — le cadre
    // deviendrait trop bas pour une signature manuscrite.
    minHeight: 96,
  },
  accordTitre: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: PRIMARY,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  accordMention: { fontSize: 8.5, color: MUTED, marginBottom: 6 },
  accordDate: { fontSize: 9, marginBottom: 4 },

  encadreDashed: {
    marginTop: 14,
    padding: 9,
    border: `1pt dashed #cfd4dc`,
    borderRadius: 4,
  },

  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 20,
    fontSize: 7,
    color: MUTED,
    paddingTop: 6,
    borderTop: `1pt solid ${BORDER}`,
    textAlign: "center",
  },
  pageNumber: {
    position: "absolute",
    fontSize: 7.5,
    bottom: 8,
    right: 40,
    color: MUTED,
  },
});

/**
 * Modèle de devis SIMPLE, style artisan — appliqué uniquement aux devis
 * dont `pdf_template_version` vaut 2, c'est-à-dire ceux créés après la
 * migration. Les devis antérieurs restent rendus par le modèle
 * historique, à l'identique de ce que le client a reçu.
 *
 * Contenu volontairement court : en-tête et coordonnées, bloc client,
 * nature de la prestation, un seul tableau sans aucune TVA, Total HT
 * puis Net à payer, mention de franchise en petit, RIB, bon pour
 * accord, pied de page d'une ligne. Rien d'autre.
 *
 * Seule exception : le formulaire de rétractation, imprimé uniquement
 * quand le devis est signé au domicile du client. C'est une obligation
 * légale (art. L221-18 du Code de la consommation), pas une condition
 * commerciale.
 *
 * Convention maison : appelé comme une fonction, DevisPdfSimple({...}).
 */
export function DevisPdfSimple({
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

  const enseigne = enseigneEmetteur(profil);
  const coordonnees = coordonneesEmetteur(profil);
  const pied = ligneePiedDePage(profil, devis.date_emission);
  // Mentions imposées par la loi selon l'activité et le client
  // (fluides, RGE, RM, médiateur) : une par ligne sous le pied, et une
  // réserve de page calculée sur ce qui est imprimé.
  const lignesPied = [
    pied || null,
    ...lignesReglementairesDevis(profil, {
      typeActivite: devis.type_activite,
      typeClient: client?.type,
      dateDocument: devis.date_emission,
    }),
  ].filter((m): m is string => Boolean(m));
  const reservePied = 30 + lignesPied.reduce((h, m) => h + (m.length > 120 ? 20 : 10), 0);
  const modeConclusion =
    (devis as { mode_conclusion?: string | null }).mode_conclusion ??
    (devis.signe_a_domicile ? "hors_etablissement" : "etablissement");
  const texteRetractation = mentionRetractation(modeConclusion);
  const adresseChantier = (devis as { adresse_chantier?: string | null }).adresse_chantier ?? null;
  const validiteJours = joursDeValidite(devis.date_emission, devis.date_validite);
  const totalHt = Number(devis.total_ht);
  // null quand aucun acompte n'est renseigné : rien n'est imprimé,
  // pas même une ligne vide.
  const acompte = ligneAcompte(
    totalHt,
    devis.acompte_pct !== null ? Number(devis.acompte_pct) : null,
    devis.acompte_montant !== null ? Number(devis.acompte_montant) : null,
  );
  const { sections } = computeSections(lignes);

  return (
    <Document
      title={`Devis ${devis.numero}`}
      author={enseigne}
      creator="Facture AE"
    >
      <Page size="A4" style={[styles.page, { paddingBottom: reservePied }]}>
        {/* En-tête : identité + coordonnées, puis le devis à droite */}
        <View style={styles.header}>
          <View style={styles.brand}>
            {logoData ? (
              /* eslint-disable-next-line jsx-a11y/alt-text -- API react-pdf */
              <Image src={logoData} style={styles.logo} />
            ) : null}
            <View>
              <Text style={styles.enseigne}>{enseigne}</Text>
              {coordonnees.map((l, i) => (
                <Text key={i} style={styles.coordonnee}>
                  {l}
                </Text>
              ))}
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

        {/* Client */}
        <View style={styles.clientBloc}>
          <Text style={styles.clientTitre}>Client</Text>
          <Text style={styles.clientNom}>
            {client?.raison_sociale || client?.nom || "Client"}
          </Text>
          {client?.raison_sociale && client.nom !== client.raison_sociale && (
            <Text style={styles.clientLigne}>{client.nom}</Text>
          )}
          {client?.adresse_ligne1 && (
            <Text style={styles.clientLigne}>{client.adresse_ligne1}</Text>
          )}
          {client?.adresse_ligne2 && (
            <Text style={styles.clientLigne}>{client.adresse_ligne2}</Text>
          )}
          {(client?.code_postal || client?.ville) && (
            <Text style={styles.clientLigne}>
              {client?.code_postal} {client?.ville}
            </Text>
          )}
          {client?.siret && (
            <Text style={[styles.clientLigne, { marginTop: 3 }]}>
              SIRET : {formatSiret(client.siret)}
            </Text>
          )}
          {adresseChantier && (
            <Text style={[styles.clientLigne, { marginTop: 3 }]}>
              Lieu des travaux : {adresseChantier}
            </Text>
          )}
        </View>

        {/* Nature de la prestation */}
        <View style={styles.nature}>
          <Text style={styles.natureLabel}>Nature de la prestation</Text>
          <Text style={{ fontWeight: 700 }}>
            {LABELS_TYPE_ACTIVITE[
              devis.type_activite as keyof typeof LABELS_TYPE_ACTIVITE
            ] ?? devis.type_activite}
          </Text>
        </View>

        {/* Tableau unique : aucune colonne ni ligne de TVA */}
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={styles.colDesignation}>Désignation</Text>
            <Text style={styles.colQte}>Qté</Text>
            <Text style={styles.colPu}>PU HT</Text>
            <Text style={styles.colTotal}>Total HT</Text>
          </View>
          {sections.map((section, si) => (
            <View key={si}>
              {section.titre !== null && (
                // minPresenceAhead : un titre n'est jamais imprimé seul
                // en bas de page, sa première ligne le suit.
                <View
                  style={styles.sectionTitreRow}
                  wrap={false}
                  minPresenceAhead={40}
                >
                  <Text style={styles.sectionTitreText}>{section.titre}</Text>
                </View>
              )}
              {section.lignes.map((ligne, li) => (
                <View
                  key={ligne.id ?? `${si}-${li}`}
                  style={styles.tableRow}
                  wrap={false}
                  minPresenceAhead={30}
                >
                  <Text style={styles.colDesignation}>{ligne.designation}</Text>
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
              ))}
            </View>
          ))}
        </View>

        {/* Totaux, RIB et bon pour accord forment UN bloc insécable :
            ils ne se séparent jamais d'une page à l'autre. */}
        <View wrap={false}>
        <View style={styles.totaux}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text>{formatEuros(totalHt)}</Text>
          </View>
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net à payer</Text>
            <Text style={styles.netValue}>{formatEuros(totalHt)}</Text>
          </View>
          {/* Mention de franchise : valeur calculée par l'application
              selon la date d'émission (bascule gérée dans
              lib/legal-text) — jamais écrite en dur ici. */}
          <Text style={styles.mentionTva}>
            {mentionTvaFranchise(devis.date_emission)}
          </Text>
        </View>

        {acompte && (
          <View style={styles.acompteLigne}>
            <Text>{acompte}</Text>
          </View>
        )}

        <View style={styles.bas}>
          {(profil?.iban || profil?.bic) && (
            <View style={styles.rib}>
              <Text style={styles.ribTitre}>Règlement par virement</Text>
              {profil?.banque_nom && (
                <Text style={styles.ribLigne}>{profil.banque_nom}</Text>
              )}
              {profil?.iban && (
                <Text style={styles.ribLigne}>
                  IBAN {formatIban(profil.iban)}
                </Text>
              )}
              {profil?.bic && (
                <Text style={styles.ribLigne}>BIC {profil.bic}</Text>
              )}
            </View>
          )}
          <View style={styles.accord}>
            <Text style={styles.accordTitre}>Bon pour accord</Text>
            <Text style={styles.accordMention}>
              Date et signature du client, précédées de la mention
              « Bon pour accord ».
            </Text>
            <Text style={styles.accordMention}>{MENTION_DEVIS_RECU_AVANT_TRAVAUX}</Text>
            {signatureData ? (
              <>
                <Text style={styles.accordDate}>
                  Le{" "}
                  {devis.date_signature
                    ? formatDateFr(devis.date_signature)
                    : "…"}
                </Text>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- API react-pdf */}
                <Image
                  src={signatureData}
                  style={{ width: 170, height: 58, objectFit: "contain" }}
                />
              </>
            ) : (
              <Text style={styles.accordDate}>
                Le ……………………………
              </Text>
            )}
          </View>
        </View>

        </View>

        {/* Rétractation : obligation légale quand le devis est signé au
            domicile du client, pas une condition commerciale. */}
        {texteRetractation && (
          <View style={styles.encadreDashed} wrap={false}>
            <Text style={styles.ribTitre}>
              Droit de rétractation (art. L221-18 du Code de la consommation)
            </Text>
            <Text style={{ fontSize: 8 }}>{texteRetractation}</Text>
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

        {/* Pied de page discret : SIRET + assurance sur une ligne,
            mentions réglementaires (fluides, RGE, RM, médiateur) sur
            une seconde, seulement quand elles s'appliquent */}
        {lignesPied.length > 0 && (
          <View style={styles.footer} fixed>
            {lignesPied.map((m, i) => (
              <Text key={i} style={i > 0 ? { marginTop: 2 } : undefined}>
                {m}
              </Text>
            ))}
          </View>
        )}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `${pageNumber} / ${totalPages}` : ""
          }
          fixed
        />
      </Page>
    </Document>
  );
}
