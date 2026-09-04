# Contrats d'entretien — cycle de vie et maintenance du texte

Module « contrats d'entretien signés en ligne » : l'artisan prépare un
contrat pré-rempli, l'envoie par email, le client le lit et le signe
depuis son téléphone via un lien public (sans compte), et les deux
parties reçoivent le PDF signé avec sa page de preuve.

## Cycle de vie d'un contrat

```
brouillon ──envoyer──▶ envoye ──signature client──▶ signe ──▶ actif
    │                    │                                     │
 (modifiable,        (figé ; lien 30 j,                   resilie / expire
  supprimable)        révocable, renvoyable)
```

| Statut      | Comment on y arrive | Ce qui est possible |
|-------------|--------------------|---------------------|
| `brouillon` | Création (`/contrats/nouveau`) | Modifier, supprimer, aperçu PDF |
| `envoye`    | « Envoyer au client » : fige les snapshots prestataire + client, attribue le numéro (`2026-001`, une seule fois), génère `access_token` (32 octets base64url, 30 jours) et envoie l'email avec le lien `/c/{token}` | Renvoyer (nouveau token, l'ancien meurt), révoquer le lien, aperçu PDF |
| `signe`     | Le client valide sur la page publique | Passer en actif, résilier, PDF signé |
| `actif`     | Action manuelle (mise en service) | Résilier, marquer expiré |
| `resilie` / `expire` | Actions manuelles | Consultation seulement |

Un contrat envoyé n'est **jamais** modifiable ni supprimable : c'est un
document émis. Les coordonnées des deux parties sont des snapshots
JSONB (`prestataire`, `client_snapshot`) figés à l'envoi — un
changement d'adresse ou de SIRET du prestataire ne touche aucun
contrat existant (même mécanique que l'émetteur figé des factures).

## La signature côté client (page publique)

- `/c/{token}` et `/api/public/contrats/…` sont les seuls chemins
  publics du middleware. La table `contrats` reste en RLS
  propriétaire ; le token est résolu **côté serveur uniquement** avec
  le client service role (`lib/contrats/public.ts`).
- Le client complète ses coordonnées, coche « j'ai lu et j'accepte »
  et, quand la rétractation s'applique (particulier + contrat à
  distance ou hors établissement), une seconde case dédiée. Il signe
  au doigt (`SignaturePad`, Pointer Events).
- À la validation, la route `POST /api/public/contrats/{token}/signer`
  enregistre le faisceau de preuves : horodatage serveur, IP,
  user-agent, PNG de la signature dans le bucket **immuable**
  `signatures` (policies select + insert uniquement), puis passe le
  contrat en `signe` avec une garde anti double-signature.
- Le PDF signé est rendu en **deux passes** : d'abord le document
  contractuel seul, dont l'empreinte SHA-256 est calculée, puis le
  document final dont la page « Preuve de signature électronique »
  reprend cette empreinte. Le fichier est archivé dans le bucket
  `pdfs` (`{user_id}/contrats/{id}/…`), l'empreinte dans
  `contrats.pdf_sha256`. Emails avec pièce jointe aux deux parties.
- Après signature, le même token ne sert plus qu'à afficher la
  confirmation et à télécharger le PDF signé — plus aucune écriture.

Prérequis d'exploitation : `SUPABASE_SERVICE_ROLE_KEY` et les
variables Resend dans Vercel, et la Deployment Protection Vercel en
mode « Only Preview Deployments » (sinon les clients tombent sur
l'écran d'authentification Vercel avant l'app).

## Le texte du contrat est versionné dans le code

- `lib/contrats/template-v1.ts` : les 12 articles + l'annexe de
  rétractation, repris à l'identique du modèle de référence. Ce
  fichier est **figé**.
- Chaque contrat stocke `template_version` ; le rendu (page publique,
  aperçu admin, PDF) passe par `getTemplateContrat(version)`.
  Regénérer en 2030 le PDF d'un contrat signé en 2026 redonne
  exactement le même texte.
- Les valeurs variables (n° d'attestation fluides, assureur, médiateur,
  plafond de pièces, date d'effet…) sont des espaces réservés
  `{commeCeci}` remplis depuis le contrat et le snapshot prestataire —
  aucune coordonnée en dur dans le template.
- Conditions d'affichage (`visible`) : `particulier` /
  `professionnel` / `retractation` / `sans-retractation`. Règles
  verrouillées par les tests (`lib/contrats/logic.test.ts`) : clause
  Chatel (art. 7) pour les particuliers, article 8 complet ou constat
  d'inapplicabilité, tribunal de commerce de Grenoble (pros) vs
  médiateur de la consommation (particuliers) à l'article 12.

## Publier une v2 du texte

1. Créer `lib/contrats/template-v2.ts` (copie de v1, modifiée) avec
   `version: 2`. **Ne pas toucher v1.**
2. L'ajouter au registre `TEMPLATES` de `lib/contrats/logic.ts` et
   passer `TEMPLATE_VERSION_COURANTE` à `2`.
3. Adapter les tests si les règles conditionnelles changent.
4. C'est tout : les nouveaux contrats partent en v2, les contrats
   existants (brouillons compris, tant qu'ils portent 1) restent
   rendus avec v1.

## Phase 2 prévue (non implémentée)

Les colonnes existent déjà, prêtes à brancher sur le cron quotidien
(`lib/cron/registre.ts`, même patron que relances/rappels) :

- `rappel_chatel_envoye_pour` : email loi Chatel au client
  particulier, à envoyer entre 3 mois et 1 mois avant
  `date_echeance` (obligation L. 215-1 — viser J-60) ; anti-doublon
  par échéance, `date_echeance` avancée d'un an à chaque reconduction.
- `rappel_visite_envoye_pour` : rappel interne de planification de la
  visite annuelle.
- Après signature, le bouton « Passer en actif » peut être complété
  par la création d'un `contrats_maintenance` lié (`maintenance_id`)
  pour brancher l'échéancier de visites et la facturation annuelle
  existants.
