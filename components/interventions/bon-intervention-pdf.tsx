/* eslint-disable jsx-a11y/alt-text -- Image de react-pdf : pas d'attribut alt (document PDF, pas DOM). */
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { formatDateFr } from "@/lib/format";
import * as PALETTE from "@/lib/theme";

/**
 * Bon d'intervention : récapitulatif remis au client à la fin des
 * travaux (travaux réalisés, équipement, fluides, photos, signatures).
 * Ce n'est ni une facture ni un devis : aucun montant, aucune mention
 * de prix. Données figées dans `BonInterventionData` (snapshot archivé
 * avec le PDF, lib/actions/bons-intervention).
 */
export type BonPhoto = {
  legende: string | null;
  moment: string | null;
  /** data URI JPEG/PNG, null si l'image n'a pas pu être chargée */
  imageDataUrl: string | null;
};

export type BonSignature = {
  nom: string;
  qualite: string | null;
  date: string;
  imageDataUrl: string | null;
} | null;

export type BonInterventionData = {
  entreprise: {
    nom: string;
    adresse: string[];
    telephone: string | null;
    email: string | null;
    piedDePage: string;
  };
  client: {
    nom: string;
    adresse: string[];
    telephone: string | null;
    email: string | null;
  } | null;
  dateIntervention: string;
  dateFin: string | null;
  heureDebut: string | null;
  heureFin: string | null;
  dureeMinutes: number | null;
  typeLabel: string;
  description: string | null;
  equipement: { marque: string | null; modele: string | null; numSerie: string | null };
  fluides: {
    type: string | null;
    kgAjoute: number | null;
    kgRecupere: number | null;
    etancheiteControle: boolean | null;
    fuite: boolean | null;
    observations: string | null;
  } | null;
  factureNumero: string | null;
  genereLe: string;
};

const MOMENT_LABELS: Record<string, string> = {
  avant: "Avant",
  pendant: "Pendant",
  apres: "Après",
  autre: "Photo",
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    paddingBottom: 56,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: PALETTE.TEXTE,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: PALETTE.PRINCIPAL,
  },
  brand: { flexDirection: "row", gap: 10, alignItems: "flex-start", maxWidth: "55%" },
  logo: { width: 48, height: 48, objectFit: "contain" },
  entrepriseNom: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  muted: { color: PALETTE.TEXTE_DOUX, fontSize: 9 },
  titreBlock: { alignItems: "flex-end" },
  titre: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: PALETTE.PRINCIPAL,
    lineHeight: 1.1,
    marginBottom: 4,
  },
  sousTitre: { fontSize: 9, color: PALETTE.TEXTE_DOUX, textAlign: "right" },
  row: { flexDirection: "row", gap: 16, marginBottom: 10 },
  col: { flex: 1 },
  blockTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: PALETTE.PRINCIPAL,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  box: {
    borderWidth: 1,
    borderColor: PALETTE.BORDURE,
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: "31%" },
  cellLabel: { fontSize: 8, color: PALETTE.TEXTE_DOUX },
  cellValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  description: { fontSize: 10, lineHeight: 1.5 },
  photosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoCell: { width: "31%" },
  photo: { width: "100%", height: 110, objectFit: "cover", borderRadius: 3 },
  photoLegende: { fontSize: 8, color: PALETTE.TEXTE_DOUX, marginTop: 2 },
  signatures: { flexDirection: "row", gap: 12, marginTop: 6 },
  signatureBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: PALETTE.BORDURE,
    borderRadius: 4,
    padding: 8,
    minHeight: 92,
  },
  signatureTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  signatureImage: { height: 44, objectFit: "contain", marginTop: 3, alignSelf: "flex-start" },
  signatureMeta: { fontSize: 8, color: PALETTE.TEXTE_DOUX, marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: PALETTE.BORDURE,
    paddingTop: 5,
    fontSize: 7.5,
    color: PALETTE.TEXTE_DOUX,
    textAlign: "center",
  },
  pageNumber: {
    position: "absolute",
    bottom: 10,
    right: 36,
    fontSize: 7.5,
    color: PALETTE.TEXTE_DOUX,
  },
});

function heures(data: BonInterventionData): string | null {
  if (data.heureDebut && data.heureFin) return `${data.heureDebut} – ${data.heureFin}`;
  if (data.heureDebut) return `à partir de ${data.heureDebut}`;
  return null;
}

function duree(min: number | null): string | null {
  if (!min || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h${m > 0 ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
}

function kg(v: number | null): string {
  return v === null ? "—" : `${v.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} kg`;
}

export function BonInterventionPdf({
  data,
  photos,
  signatureOperateur,
  signatureClient,
  logoData,
}: {
  data: BonInterventionData;
  photos: BonPhoto[];
  signatureOperateur: BonSignature;
  signatureClient: BonSignature;
  logoData?: string | null;
}) {
  const periode =
    data.dateFin && data.dateFin !== data.dateIntervention
      ? `du ${formatDateFr(data.dateIntervention)} au ${formatDateFr(data.dateFin)}`
      : `le ${formatDateFr(data.dateIntervention)}`;
  const plage = heures(data);
  const dureeText = duree(data.dureeMinutes);
  const equip = data.equipement;
  const aEquipement = Boolean(equip.marque || equip.modele || equip.numSerie);
  const photosAffichees = photos.filter((p) => p.imageDataUrl).slice(0, 6);

  return (
    <Document title={`Bon d'intervention ${formatDateFr(data.dateIntervention)}`} author={data.entreprise.nom}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            {logoData ? <Image src={logoData} style={styles.logo} /> : null}
            <View>
              <Text style={styles.entrepriseNom}>{data.entreprise.nom}</Text>
              {data.entreprise.adresse.map((l, i) => (
                <Text key={i} style={styles.muted}>
                  {l}
                </Text>
              ))}
              {data.entreprise.telephone && <Text style={styles.muted}>{data.entreprise.telephone}</Text>}
              {data.entreprise.email && <Text style={styles.muted}>{data.entreprise.email}</Text>}
            </View>
          </View>
          <View style={styles.titreBlock}>
            <Text style={styles.titre}>BON D&apos;INTERVENTION</Text>
            <Text style={styles.sousTitre}>Intervention {periode}</Text>
            {plage && <Text style={styles.sousTitre}>Horaires : {plage}</Text>}
            {dureeText && <Text style={styles.sousTitre}>Durée : {dureeText}</Text>}
            <Text style={styles.sousTitre}>{data.typeLabel}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.blockTitle}>Client</Text>
            {data.client ? (
              <>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.client.nom}</Text>
                {data.client.adresse.map((l, i) => (
                  <Text key={i}>{l}</Text>
                ))}
                {data.client.telephone && <Text>{data.client.telephone}</Text>}
                {data.client.email && <Text>{data.client.email}</Text>}
              </>
            ) : (
              <Text style={styles.muted}>Client non renseigné</Text>
            )}
          </View>
          <View style={styles.col}>
            <Text style={styles.blockTitle}>Intervenant</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.entreprise.nom}</Text>
            {data.factureNumero && <Text>Facturé sur la facture n° {data.factureNumero}</Text>}
            <Text style={styles.muted}>Bon établi le {formatDateFr(data.genereLe)}</Text>
          </View>
        </View>

        <View style={styles.box}>
          <Text style={styles.blockTitle}>Travaux réalisés</Text>
          <Text style={styles.description}>
            {data.description?.trim() || "Aucun descriptif saisi."}
          </Text>
        </View>

        {aEquipement && (
          <View style={styles.box}>
            <Text style={styles.blockTitle}>Équipement</Text>
            <View style={styles.grid}>
              {equip.marque && (
                <View style={styles.cell}>
                  <Text style={styles.cellLabel}>Marque</Text>
                  <Text style={styles.cellValue}>{equip.marque}</Text>
                </View>
              )}
              {equip.modele && (
                <View style={styles.cell}>
                  <Text style={styles.cellLabel}>Modèle</Text>
                  <Text style={styles.cellValue}>{equip.modele}</Text>
                </View>
              )}
              {equip.numSerie && (
                <View style={styles.cell}>
                  <Text style={styles.cellLabel}>N° de série</Text>
                  <Text style={styles.cellValue}>{equip.numSerie}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {data.fluides && (
          <View style={styles.box}>
            <Text style={styles.blockTitle}>Fluide frigorigène</Text>
            <View style={styles.grid}>
              <View style={styles.cell}>
                <Text style={styles.cellLabel}>Fluide</Text>
                <Text style={styles.cellValue}>{data.fluides.type ?? "—"}</Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.cellLabel}>Chargé</Text>
                <Text style={styles.cellValue}>{kg(data.fluides.kgAjoute)}</Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.cellLabel}>Récupéré</Text>
                <Text style={styles.cellValue}>{kg(data.fluides.kgRecupere)}</Text>
              </View>
              {data.fluides.etancheiteControle !== null && (
                <View style={styles.cell}>
                  <Text style={styles.cellLabel}>Contrôle d&apos;étanchéité</Text>
                  <Text style={styles.cellValue}>
                    {data.fluides.etancheiteControle
                      ? data.fluides.fuite
                        ? "Réalisé — fuite détectée"
                        : "Réalisé — aucune fuite"
                      : "Non réalisé"}
                  </Text>
                </View>
              )}
            </View>
            {data.fluides.observations && (
              <Text style={{ marginTop: 4 }}>{data.fluides.observations}</Text>
            )}
            <Text style={[styles.muted, { marginTop: 4 }]}>
              La fiche d&apos;intervention fluides (CERFA 15497) est établie séparément.
            </Text>
          </View>
        )}

        {photosAffichees.length > 0 && (
          <View style={styles.box} wrap={false}>
            <Text style={styles.blockTitle}>Photos</Text>
            <View style={styles.photosGrid}>
              {photosAffichees.map((p, i) => (
                <View key={i} style={styles.photoCell}>
                  <Image src={p.imageDataUrl!} style={styles.photo} />
                  <Text style={styles.photoLegende}>
                    {MOMENT_LABELS[p.moment ?? "autre"] ?? "Photo"}
                    {p.legende ? ` — ${p.legende}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View wrap={false}>
          <Text style={styles.blockTitle}>Signatures</Text>
          <View style={styles.signatures}>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureTitle}>L&apos;intervenant</Text>
              {signatureOperateur ? (
                <>
                  {signatureOperateur.imageDataUrl && (
                    <Image src={signatureOperateur.imageDataUrl} style={styles.signatureImage} />
                  )}
                  <Text style={styles.signatureMeta}>
                    {signatureOperateur.nom}
                    {signatureOperateur.qualite ? ` — ${signatureOperateur.qualite}` : ""}
                  </Text>
                  <Text style={styles.signatureMeta}>
                    Signé le {formatDateFr(signatureOperateur.date.slice(0, 10))}
                  </Text>
                </>
              ) : (
                <Text style={styles.signatureMeta}>Non signé</Text>
              )}
            </View>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureTitle}>Le client — travaux réalisés, bon pour accord</Text>
              {signatureClient ? (
                <>
                  {signatureClient.imageDataUrl && (
                    <Image src={signatureClient.imageDataUrl} style={styles.signatureImage} />
                  )}
                  <Text style={styles.signatureMeta}>
                    {signatureClient.nom}
                    {signatureClient.qualite ? ` — ${signatureClient.qualite}` : ""}
                  </Text>
                  <Text style={styles.signatureMeta}>
                    Signé le {formatDateFr(signatureClient.date.slice(0, 10))}
                  </Text>
                </>
              ) : (
                <Text style={styles.signatureMeta}>Non signé</Text>
              )}
            </View>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {data.entreprise.piedDePage}
        </Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
