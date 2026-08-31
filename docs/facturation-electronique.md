# Facturation électronique — note d'étude (avant tout code)

> Étude réalisée le 28/08/2026. Les faits « en vigueur » et « annoncés »
> sont distingués ; méthode identique à `DATE_BASCULE_MENTION_CIBS` :
> en cas d'incertitude réglementaire, retenir l'option qui reste valide
> dans les deux scénarios. À re-vérifier avant chaque phase de mise en
> œuvre (le paysage des plateformes bouge vite).

## 1. Calendrier applicable à une micro-entreprise

| Échéance | Obligation | Statut |
|---|---|---|
| **1ᵉʳ sept. 2026** | **Réception** : pouvoir recevoir les factures électroniques de ses fournisseurs via une plateforme agréée (PA). Concerne TOUTES les entreprises assujetties, y compris micro en franchise de TVA. | **En vigueur** (dans 4 jours) |
| 1ᵉʳ sept. 2027 | **Émission** B2B : émettre ses factures aux clients professionnels au format électronique via une PA, + e-reporting des transactions B2C et des données de paiement. | En vigueur (échéance ferme, votée) |
| — | Sanction annoncée en LF 2026 : 50 € par facture non conforme, plafond 15 000 €/an. | Annoncé (à confirmer par les décrets d'application) |

Points structurants pour NOTRE cas :

- Le **portail public de facturation (PPF)** n'est plus une plateforme
  d'échange gratuite : il ne reste qu'annuaire + concentrateur de
  données. **Passer par une PA est donc inévitable.**
- Les clients **particuliers** (B2C) ne reçoivent PAS de factures
  électroniques : pour eux, le PDF actuel reste le document remis. En
  revanche le **e-reporting** des ventes B2C s'appliquera (sept. 2027).
- La **réception** (sept. 2026) ne passe pas par cette application :
  c'est une inscription à faire chez une PA (voir §2). Aucun code à
  écrire, mais à faire **maintenant**.

## 2. Plateformes agréées (PA)

~156–166 PA immatriculées par la DGFiP (liste officielle sur
impots.gouv.fr, régulièrement mise à jour). Constats au 28/08/2026 :

- **Des offres à 0 €** existent et suffisent pour une micro : au moins
  9 PA ont un plan gratuit ; **Tiime, Indy, Qonto et Shine** proposent
  émission + réception gratuites et illimitées (Qonto/Shine étant
  aussi des banques pro — synergie possible avec le compte existant).
- Grille tarifaire générale du marché : 0 à ~500 €/mois selon volume
  et services (nous sommes à l'extrême bas du spectre : quelques
  dizaines de factures B2B par an).
- **API** : les PA « tech » (Qonto, Pennylane, éditeurs spécialisés
  type FacturX API) exposent des API REST d'émission/réception. Les
  offres gratuites grand public (Tiime, Indy) sont d'abord des UI —
  l'accès API peut être payant ou absent : **critère n° 1 du choix**
  si on veut que Facture AE pousse les factures automatiquement.

### Décision à prendre (par Nathan, pas par le code)

1. **Tout de suite (réception, sans code)** : ouvrir un compte sur une
   PA gratuite et s'y inscrire comme récepteur. Zéro impact sur l'app.
2. **Pour 2027 (émission)** : choisir la PA en fonction de
   (a) gratuité/coût à notre volume, (b) existence d'une **API
   d'émission documentée**, (c) pérennité. À re-comparer début 2027 —
   le marché se consolidera après sept. 2026.

## 3. Format : Factur-X

- **Factur-X** = PDF/A-3 (lisible humain) + XML CII embarqué (lisible
  machine). Un PDF/A-3 sans XML n'est PAS un Factur-X.
- **Profils** (cumulatifs) : MINIMUM → BASIC WL → BASIC → EN 16931 →
  EXTENDED. Le minimum admis par la réforme est **BASIC WL** (sans
  lignes). **Recommandation : viser EN 16931** — c'est le profil
  conforme à la norme européenne, le plus accepté, et nous avons déjà
  toutes les données de lignes ; BASIC en repli si la validation
  Schematron s'avère trop contraignante.
- Champs exigés par la réforme au-delà de nos données actuelles :
  **SIREN du client** (B2B), **catégorie d'opération**
  (livraison de biens / prestation de services / mixte — notre
  `nature_fiscale` par ligne s'en approche déjà), **option de paiement
  de la TVA** (sans objet en franchise : mention d'exonération dédiée
  dans le XML, code VATEX-FR-FRANCHISE / catégorie E selon le profil).

## 4. Contraintes techniques identifiées

1. **`@react-pdf/renderer` ne produit pas de PDF/A-3.** Deux voies :
   - *Post-traitement* : générer le PDF actuel puis le convertir
     PDF/A-3 + embarquer le XML. La lib Node
     `@stafyniaksacha/facturx` (Node ≥ 20.11, ESM, 5 profils) fait
     l'embarquement + métadonnées XMP ; des retours de terrain (dev.to,
     nov. 2025) confirment la faisabilité PDF/A-3 + CII 100 % Node,
     validable par veraPDF — compatible Vercel (pas de Ghostscript).
   - *Service externe* : API de génération Factur-X (ex. facturxapi.com)
     ou laisser la PA convertir (certaines acceptent un PDF + données
     structurées et fabriquent le Factur-X elles-mêmes). **Si la PA
     retenue le fait, notre chantier se réduit à un connecteur API.**
2. **`clients` n'a pas de champ SIREN/SIRET fiable pour le B2B** : la
   colonne `siret` existe mais libre. Il faudra : validation Luhn
   (helper `lib/siret.ts` désormais disponible), champ requis pour
   émettre en B2B, et distinction B2B/B2C déjà présente
   (`clients.type`).
3. **Catégorie d'opération + option TVA** : à dériver de
   `nature_fiscale` des lignes (prestations/ventes → catégorie) + une
   mention franchise TVA structurée. Colonnes à prévoir sur `factures`
   si la dérivation automatique ne suffit pas.
4. **Numérotation, mentions, émetteur figé** : déjà conformes (lots
   précédents) — le XML CII se nourrira du snapshot `emetteur`.

## 5. Recommandation chiffrée

**Ne pas coder avant le choix de la PA.** Ensuite, en trois phases :

| Phase | Contenu | Estimation |
|---|---|---|
| 0 — immédiat (sans code) | Inscription réception chez une PA gratuite (Tiime/Indy/Qonto/Shine) ; re-comparaison des PA avec API début 2027 | 1–2 h de démarches |
| 1 — données (dès maintenant possible) | SIREN client B2B (validation Luhn, requis à l'émission B2B), catégorie d'opération dérivée de `nature_fiscale`, migration additive | ~1 jour de dev |
| 2 — génération Factur-X | XML CII profil EN 16931 (repli BASIC) + conversion PDF/A-3 + embarquement via `@stafyniaksacha/facturx`, validation veraPDF/Schematron en CI, tests | ~3–4 jours de dev |
| 3 — connecteur PA | Envoi API vers la PA retenue, suivi des statuts (déposée/rejetée/encaissée), e-reporting B2C | ~2–3 jours de dev, dépend à 100 % de la PA choisie |

Coût récurrent visé : **0 €/mois** (PA gratuite) à ~15 €/mois si l'API
impose un palier payant. Échéance réelle de mise en production de
l'émission : avant le **01/09/2027** — planifier la phase 2 au
printemps 2027 pour roder le système sur quelques factures réelles.

## Sources (consultées le 28/08/2026)

- impots.gouv.fr — liste officielle des plateformes agréées
- data.gouv.fr — « Facturation électronique gratuite : quelles
  plateformes agréées sans frais ? (2026) »
- comparatif-facture-electronique.fr — comparatif des 156–166 PA,
  offres gratuites, grille 0–500 €/mois
- fnfe-mpe.org — spécification Factur-X (profils, PDF/A-3 + CII)
- facturxapi.com / invoicing.plus — guides de choix de profil
  (BASIC WL minimum réforme, EN 16931 recommandé)
- github.com/stafyniaksacha/facturx — lib Node (5 profils)
- dev.to/erwanbargain — « Factur-X EN 16931 from scratch: PDF/A-3 +
  CII XML in Node.js » (faisabilité sans Ghostscript)
- pennylane.com / qonto.com / portail-autoentrepreneur.fr — calendrier
  micro (réception 09/2026, émission 09/2027, sanctions LF 2026)
