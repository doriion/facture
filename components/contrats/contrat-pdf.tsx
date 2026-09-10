import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { formatDateFr, formatEuros, formatSiret } from "@/lib/format";
import {
  blocsVisibles,
  blocVisible,
  getTemplateContrat,
  netAPayer,
  remplirTexte,
  LABELS_QUALITE,
  type ContexteAffichage,
} from "@/lib/contrats/logic";
import {
  adresseAffichagePrestataire,
  equipementsDe,
  nomAffichagePrestataire,
  valeursTemplate,
  type ClientSnapshot,
  type ContratRow,
  type PrestataireSnapshot,
} from "@/lib/contrats/rendu";
import type { BlocContrat } from "@/lib/contrats/types";

const PRIMARY = "#2A7D5B";
const TEXT = "#1c1f24";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    // Réserve du pied de page FIXE (2 lignes de mentions + pagination) —
    // même précaution que devis-pdf/facture-pdf.
    paddingBottom: 78,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: TEXT,
    lineHeight: 1.45,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottom: `1pt solid ${BORDER}`,
  },
  brand: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  logo: { width: 48, height: 48, objectFit: "contain" },
  entrepriseNom: { fontSize: 12, fontWeight: 700, marginBottom: 2 },
  entrepriseLine: { color: MUTED, fontSize: 8.5 },
  docBlock: { alignItems: "flex-end" },
  docTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: PRIMARY,
    letterSpacing: 1,
    lineHeight: 1.1,
  },
  docSousTitre: { fontSize: 9, color: MUTED, marginTop: 2 },
  docNumero: { fontSize: 11, fontWeight: 700, marginTop: 6 },

  partiesRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  partieBox: {
    flex: 1,
    border: `1pt solid ${BORDER}`,
    borderRadius: 4,
    padding: 8,
  },
  partieTitre: {
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
    color: PRIMARY,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  partieNom: { fontSize: 10.5, fontWeight: 700, marginBottom: 1 },
  petit: { fontSize: 8.5 },

  encart: {
    border: `1pt solid ${BORDER}`,
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
  },

  articleTitre: {
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottom: `0.75pt solid ${BORDER}`,
  },
  h3: { fontSize: 9.5, fontWeight: 700, marginTop: 6, marginBottom: 2 },
  p: { marginBottom: 4, textAlign: "justify" },
  note: { marginBottom: 4, color: MUTED, fontSize: 8.5 },
  formule: { textAlign: "center", fontWeight: 700, marginVertical: 4 },
  liRow: { flexDirection: "row", marginBottom: 2, paddingLeft: 8 },
  liPuce: { width: 10 },
  liTexte: { flex: 1, textAlign: "justify" },

  table: { border: `1pt solid ${BORDER}`, marginVertical: 6 },
  tr: { flexDirection: "row", borderBottom: `0.75pt solid ${BORDER}` },
  trLast: { flexDirection: "row" },
  th: {
    padding: 4,
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
    color: MUTED,
    backgroundColor: "#f6f7f9",
    borderRight: `0.75pt solid ${BORDER}`,
  },
  td: {
    padding: 4,
    fontSize: 8.5,
    borderRight: `0.75pt solid ${BORDER}`,
  },

  signaturesRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  signatureBox: {
    flex: 1,
    border: `1pt solid ${BORDER}`,
    borderRadius: 4,
    padding: 8,
    minHeight: 110,
  },
  signatureImg: {
    width: 150,
    height: 60,
    objectFit: "contain",
    marginTop: 4,
  },

  preuveTitre: {
    fontSize: 14,
    fontWeight: 700,
    color: PRIMARY,
    marginBottom: 12,
  },
  preuveRow: { flexDirection: "row", marginBottom: 6 },
  preuveLabel: { width: 170, fontWeight: 700, fontSize: 9 },
  preuveValeur: { flex: 1, fontSize: 9 },

  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 22,
    fontSize: 7.5,
    color: MUTED,
    paddingTop: 8,
    borderTop: `1pt solid ${BORDER}`,
    lineHeight: 1.4,
    textAlign: "center",
  },
  pageNumber: {
    position: "absolute",
    fontSize: 8,
    bottom: 8,
    right: 36,
    color: MUTED,
  },
});

export type PreuveSignature = {
  signataireNom: string;
  signataireQualite?: string | null;
  signeLeText: string; // horodatage formaté Europe/Paris
  ip: string;
  userAgent: string;
  /** Empreinte SHA-256 du document contractuel (pages hors preuve) */
  sha256: string | null;
};

/**
 * PDF du contrat d'entretien — fidèle au modèle papier : en-tête,
 * parties encadrées, 12 articles (sections conditionnelles), tableaux
 * encadrés, bloc signatures (image de la signature client), annexe
 * rétractation le cas échéant, pied de page avec mentions légales et
 * pagination « Page X / Y ». Avec `preuve`, une dernière page
 * « Preuve de signature électronique » est ajoutée.
 *
 * Convention maison : appelé comme une fonction, ContratPdf({...}).
 */
export function ContratPdf({
  contrat,
  prestataire,
  clientSnapshot,
  logoData,
  signatureData,
  preuve,
}: {
  contrat: ContratRow;
  prestataire: PrestataireSnapshot;
  clientSnapshot: ClientSnapshot;
  logoData?: string | null;
  /** data URI PNG de la signature manuscrite du client */
  signatureData?: string | null;
  preuve?: PreuveSignature | null;
}) {
  const template = getTemplateContrat(contrat.template_version);
  const ctx: ContexteAffichage = {
    qualiteClient:
      contrat.qualite_client === "professionnel"
        ? "professionnel"
        : "particulier",
    modeConclusion:
      contrat.mode_conclusion === "presentiel"
        ? "presentiel"
        : contrat.mode_conclusion === "hors_etablissement"
          ? "hors_etablissement"
          : "distance",
  };
  const valeurs = valeursTemplate({ contrat, prestataire });
  const equipements = equipementsDe(contrat);
  const net = netAPayer(Number(contrat.redevance), Number(contrat.remise));

  const nomPresta = nomAffichagePrestataire(prestataire);
  const adressePresta = adresseAffichagePrestataire(prestataire);
  const footerLigne1 = `${nomPresta} — Entreprise individuelle — ${adressePresta || "……"}`;
  const footerLigne2 = `SIRET ${prestataire.siret ? formatSiret(prestataire.siret) : "……"} — APE ${prestataire.code_ape ?? "……"} — TVA non applicable, art. 293 B du CGI${prestataire.email_pro ? ` — ${prestataire.email_pro}` : ""}`;

  const renderBloc = (bloc: BlocContrat, i: number) => {
    switch (bloc.kind) {
      case "h3":
        return (
          <Text key={i} style={styles.h3}>
            {remplirTexte(bloc.texte, valeurs)}
          </Text>
        );
      case "p":
        return (
          <Text key={i} style={styles.p}>
            {remplirTexte(bloc.texte, valeurs)}
          </Text>
        );
      case "note":
        return (
          <Text key={i} style={styles.note}>
            {remplirTexte(bloc.texte, valeurs)}
          </Text>
        );
      case "formule":
        return (
          <Text key={i} style={styles.formule}>
            {bloc.texte}
          </Text>
        );
      case "li":
        return (
          <View key={i} style={{ marginBottom: 4 }}>
            {bloc.items.map((item, j) => (
              <View key={j} style={styles.liRow}>
                <Text style={styles.liPuce}>•</Text>
                <Text style={styles.liTexte}>
                  {remplirTexte(item, valeurs)}
                </Text>
              </View>
            ))}
          </View>
        );
      case "table-equipements": {
        const largeurs = ["22%", "26%", "20%", "13%", "19%"] as const;
        const entetes = [
          "Type d'équipement",
          "Marque / Modèle",
          "N° de série",
          "Puissance (kW)",
          "Fluide / charge",
        ];
        const lignes = equipements.length
          ? equipements
          : [
              {
                type: "",
                marque_modele: "",
                num_serie: "",
                puissance_kw: "",
                fluide_charge: "",
              },
            ];
        return (
          <View key={i} style={styles.table} wrap={false}>
            <View style={styles.tr}>
              {entetes.map((e, j) => (
                <Text key={j} style={[styles.th, { width: largeurs[j]! }]}>
                  {e}
                </Text>
              ))}
            </View>
            {lignes.map((e, j) => (
              <View
                key={j}
                style={j === lignes.length - 1 ? styles.trLast : styles.tr}
              >
                {[
                  e.type,
                  e.marque_modele,
                  e.num_serie,
                  e.puissance_kw,
                  e.fluide_charge,
                ].map((cell, k) => (
                  <Text key={k} style={[styles.td, { width: largeurs[k]! }]}>
                    {cell || " "}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        );
      }
      case "table-prix":
        return (
          <View key={i} style={[styles.table, { width: 300 }]} wrap={false}>
            <View style={styles.tr}>
              <Text style={[styles.td, { width: "70%" }]}>
                Redevance annuelle forfaitaire (net)
              </Text>
              <Text
                style={[styles.td, { width: "30%", textAlign: "right" }]}
              >
                {formatEuros(Number(contrat.redevance))}
              </Text>
            </View>
            <View style={styles.tr}>
              <Text style={[styles.td, { width: "70%" }]}>
                Remise éventuelle
              </Text>
              <Text
                style={[styles.td, { width: "30%", textAlign: "right" }]}
              >
                {Number(contrat.remise) > 0
                  ? `- ${formatEuros(Number(contrat.remise))}`
                  : "—"}
              </Text>
            </View>
            <View style={styles.trLast}>
              <Text
                style={[styles.td, { width: "70%", fontWeight: 700 }]}
              >
                NET À PAYER PAR VISITE ANNUELLE
              </Text>
              <Text
                style={[
                  styles.td,
                  { width: "30%", textAlign: "right", fontWeight: 700 },
                ]}
              >
                {formatEuros(net)}
              </Text>
            </View>
          </View>
        );
    }
  };

  const nomClient =
    clientSnapshot.raison_sociale || clientSnapshot.nom || "……";

  return (
    <Document
      title={`Contrat d'entretien ${contrat.numero ?? ""}`.trim()}
      author={nomPresta}
    >
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <View style={styles.brand}>
            {logoData ? (
              /* eslint-disable-next-line jsx-a11y/alt-text -- API react-pdf */
              <Image src={logoData} style={styles.logo} />
            ) : null}
            <View>
              <Text style={styles.entrepriseNom}>{nomPresta}</Text>
              <Text style={styles.entrepriseLine}>
                Plomberie · Chauffage · Climatisation
              </Text>
              {adressePresta ? (
                <Text style={styles.entrepriseLine}>{adressePresta}</Text>
              ) : null}
              {prestataire.telephone ? (
                <Text style={styles.entrepriseLine}>
                  Tél. : {prestataire.telephone}
                </Text>
              ) : null}
              {prestataire.email_pro ? (
                <Text style={styles.entrepriseLine}>
                  {prestataire.email_pro}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.docBlock}>
            <Text style={styles.docTitle}>{template.titre}</Text>
            <Text style={styles.docSousTitre}>{template.sousTitre}</Text>
            <Text style={styles.docNumero}>
              Contrat n° {contrat.numero ?? "……"}
            </Text>
            {contrat.date_effet ? (
              <Text style={styles.entrepriseLine}>
                Date d'effet : {formatDateFr(contrat.date_effet)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Parties */}
        <Text style={[styles.p, { fontWeight: 700 }]}>
          Entre les soussignés :
        </Text>
        <View style={styles.partiesRow}>
          <View style={styles.partieBox}>
            <Text style={styles.partieTitre}>Le prestataire</Text>
            <Text style={styles.partieNom}>{nomPresta}</Text>
            <Text style={styles.petit}>
              Entreprise individuelle — plomberie, chauffage, climatisation
            </Text>
            <Text style={styles.petit}>{adressePresta || "……"}</Text>
            <Text style={styles.petit}>
              SIRET{" "}
              {prestataire.siret ? formatSiret(prestataire.siret) : "……"} —
              APE {prestataire.code_ape ?? "……"}
            </Text>
            {prestataire.telephone ? (
              <Text style={styles.petit}>Tél. : {prestataire.telephone}</Text>
            ) : null}
            {prestataire.email_pro ? (
              <Text style={styles.petit}>{prestataire.email_pro}</Text>
            ) : null}
          </View>
          <View style={styles.partieBox}>
            <Text style={styles.partieTitre}>Le client</Text>
            <Text style={styles.partieNom}>{nomClient}</Text>
            <Text style={styles.petit}>
              {clientSnapshot.adresse || "Adresse : ……"}
            </Text>
            <Text style={styles.petit}>
              Tél. : {clientSnapshot.telephone || "……"}
            </Text>
            <Text style={styles.petit}>
              E-mail : {clientSnapshot.email || "……"}
            </Text>
            {contrat.qualite_client === "professionnel" ? (
              <Text style={styles.petit}>
                SIRET : {clientSnapshot.siret || "……"}
              </Text>
            ) : null}
            <Text style={[styles.petit, { marginTop: 3 }]}>
              Qualité :{" "}
              {LABELS_QUALITE[
                contrat.qualite_client as keyof typeof LABELS_QUALITE
              ] ?? contrat.qualite_client}
              {contrat.occupant
                ? ` — Occupant : ${contrat.occupant === "proprietaire" ? "propriétaire" : "locataire"}`
                : ""}
            </Text>
            {contrat.contact_site ? (
              <Text style={styles.petit}>
                Contact sur site : {contrat.contact_site}
              </Text>
            ) : null}
          </View>
        </View>

        {contrat.adresse_site ? (
          <View style={styles.encart}>
            <Text style={styles.partieTitre}>
              Adresse du site d'intervention (si différente de l'adresse du
              client)
            </Text>
            <Text style={styles.petit}>{contrat.adresse_site}</Text>
          </View>
        ) : null}

        <Text style={[styles.p, { fontWeight: 700 }]}>
          {template.preambule}
        </Text>

        {/* Articles */}
        {template.articles.map((article) => {
          const blocs = blocsVisibles(article.blocs, ctx);
          if (blocs.length === 0) return null;
          return (
            <View key={article.numero}>
              <Text style={styles.articleTitre}>
                Article {article.numero} — {article.titre}
              </Text>
              {blocs.map(renderBloc)}
            </View>
          );
        })}

        {/* Signatures */}
        <View style={styles.signaturesRow} wrap={false}>
          <View style={styles.signatureBox}>
            <Text style={styles.partieTitre}>Le client</Text>
            {signatureData ? (
              <>
                <Text style={styles.petit}>
                  {preuve?.signataireNom ?? nomClient}
                  {preuve?.signataireQualite
                    ? ` — ${preuve.signataireQualite}`
                    : ""}
                </Text>
                <Text style={styles.petit}>
                  Signé électroniquement
                  {contrat.signed_at
                    ? ` le ${formatDateFr(contrat.signed_at.slice(0, 10))}`
                    : ""}
                  {" "}— « Lu et approuvé, bon pour accord »
                </Text>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- API react-pdf */}
                <Image src={signatureData} style={styles.signatureImg} />
              </>
            ) : (
              <>
                <Text style={styles.petit}>
                  Fait à ................................ le
                  ....../....../..........
                </Text>
                <Text style={styles.petit}>
                  Mention manuscrite « Lu et approuvé, bon pour accord »,
                  précédée des nom, prénom et qualité du signataire.
                </Text>
              </>
            )}
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.partieTitre}>Le prestataire</Text>
            <Text style={styles.petit}>{nomPresta}</Text>
            <Text style={styles.petit}>
              {contrat.sent_at
                ? `Validé électroniquement le ${formatDateFr(contrat.sent_at.slice(0, 10))} — l'envoi du présent contrat vaut engagement du prestataire.`
                : "Fait à ................................ le ....../....../.........."}
            </Text>
          </View>
        </View>

        {/* Annexe rétractation */}
        {blocVisible(template.annexe.visible, ctx) ? (
          <View break>
            <Text style={styles.articleTitre}>{template.annexe.titre}</Text>
            {template.annexe.blocs.map(renderBloc)}
          </View>
        ) : null}

        {/* Page de preuve */}
        {preuve ? (
          <View break>
            <Text style={styles.preuveTitre}>
              Preuve de signature électronique
            </Text>
            <Text style={styles.p}>
              Le présent contrat a été signé électroniquement (signature
              électronique simple) au moyen du lien sécurisé transmis au
              client par courrier électronique. Les éléments techniques
              suivants ont été enregistrés au moment de la validation et
              constituent le faisceau de preuves associé à cette signature.
            </Text>
            <View style={{ marginTop: 10 }}>
              <View style={styles.preuveRow}>
                <Text style={styles.preuveLabel}>Contrat</Text>
                <Text style={styles.preuveValeur}>
                  Contrat d'entretien n° {contrat.numero ?? "……"}
                </Text>
              </View>
              <View style={styles.preuveRow}>
                <Text style={styles.preuveLabel}>Signataire</Text>
                <Text style={styles.preuveValeur}>
                  {preuve.signataireNom}
                  {preuve.signataireQualite
                    ? ` (${preuve.signataireQualite})`
                    : ""}
                </Text>
              </View>
              <View style={styles.preuveRow}>
                <Text style={styles.preuveLabel}>Horodatage serveur</Text>
                <Text style={styles.preuveValeur}>{preuve.signeLeText}</Text>
              </View>
              <View style={styles.preuveRow}>
                <Text style={styles.preuveLabel}>Adresse IP</Text>
                <Text style={styles.preuveValeur}>{preuve.ip}</Text>
              </View>
              <View style={styles.preuveRow}>
                <Text style={styles.preuveLabel}>Navigateur (user-agent)</Text>
                <Text style={styles.preuveValeur}>{preuve.userAgent}</Text>
              </View>
              <View style={styles.preuveRow}>
                <Text style={styles.preuveLabel}>Consentements</Text>
                <Text style={styles.preuveValeur}>
                  « J'ai lu et j'accepte les termes du contrat » : coché.
                  {retractationVisible(ctx)
                    ? " « J'ai pris connaissance de mon droit de rétractation de 14 jours » : coché."
                    : ""}
                </Text>
              </View>
              {preuve.sha256 ? (
                <View style={styles.preuveRow}>
                  <Text style={styles.preuveLabel}>
                    Empreinte SHA-256 du document contractuel
                  </Text>
                  <Text style={[styles.preuveValeur, { fontSize: 7.5 }]}>
                    {preuve.sha256}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.note, { marginTop: 10 }]}>
              L'empreinte SHA-256 identifie le contenu contractuel (pages
              précédant la présente page de preuve) tel qu'il a été présenté
              au signataire ; elle est également conservée dans le système du
              prestataire. L'image de la signature manuscrite est archivée
              dans un espace de stockage à écriture unique.
            </Text>
          </View>
        ) : null}

        {/* Pied de page */}
        <View style={styles.footer} fixed>
          <Text>{footerLigne1}</Text>
          <Text>{footerLigne2}</Text>
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

function retractationVisible(ctx: ContexteAffichage): boolean {
  return ctx.qualiteClient === "particulier" && ctx.modeConclusion !== "presentiel";
}
