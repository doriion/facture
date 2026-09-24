# Restaurer une sauvegarde

Une sauvegarde qu'on n'a jamais restaurée n'est pas une sauvegarde. Cette
page décrit comment repartir de zéro à partir du fichier JSON produit par
« Paramètres → Exporter mes données » ou par la sauvegarde mensuelle
reçue par email (`sauvegarde-facture-ae-AAAA-MM-JJ.json`).

## Ce que contient la sauvegarde

- Toutes les tables métier (liste unique `TABLES_SAUVEGARDE`, vérifiée
  par un test contre les migrations) : profil, clients, catalogue,
  factures et lignes, devis et lignes, paiements, relances, déclarations,
  tâches, contrats, interventions (photos, signatures, CERFA, bons),
  numérotation, agenda, barème, séries, RDV importés, abonnements push.
- Les **identifiants** (UUID) sont conservés : les liens entre documents
  restent valides après restauration.
- Elle **ne contient pas** les fichiers du Storage (logo, photos,
  signatures manuscrites, PDF archivés) — seulement leurs chemins.
  Téléchargez les PDF archivés depuis les fiches si vous voulez les
  conserver hors de l'application.

## Procédure (projet vierge)

1. Créer un nouveau projet Supabase et y appliquer **toutes** les
   migrations, dans l'ordre : `supabase db push` (CLI) ou copie de chaque
   fichier de `supabase/migrations` dans l'éditeur SQL.
2. Créer le compte utilisateur (Authentication → Users → Add user, ou
   inscription depuis l'application pointée sur ce projet). Relever son
   UUID.
3. Répétition à blanc (rien n'est écrit) :

   ```bash
   node scripts/restaurer-sauvegarde.mjs \
     --fichier sauvegarde-facture-ae-2026-09-01.json \
     --url https://<projet>.supabase.co \
     --service-role <clé service role du projet cible> \
     --utilisateur <uuid du compte>
   ```

   Le script contrôle le format du fichier, compte les lignes par table
   et vérifie que le compte cible est vide. Il refuse de continuer si une
   table contient déjà des lignes : on restaure dans le vide, jamais
   par-dessus des données.

4. Exécution réelle : même commande avec `--executer`. Les tables sont
   insérées dans l'ordre des clés étrangères ; les liens circulaires
   (facture ↔ devis, facture d'origine d'un acompte) sont posés en fin de
   restauration.
5. Pointer l'application sur le nouveau projet (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) et
   vérifier : liste des factures, une facture avec ses lignes et
   paiements, le tableau de bord, la numérotation (Paramètres).
6. Recréer le logo dans Paramètres. Les photos et signatures d'origine ne
   sont pas restaurables sans les fichiers du Storage.

## Exercice périodique

Une fois par an, refaire les étapes 1 à 5 sur un projet jetable (offre
gratuite Supabase), puis le supprimer. Le test
`lib/restauration.test.ts` exerce la logique du script à chaque CI
(ordre des tables, remplacement du compte, liens différés, refus d'un
compte non vide), mais seule une restauration réelle prouve que la
sauvegarde du jour se relit.

## Sécurité

- La clé service role contourne la RLS : ne l'utiliser que sur le projet
  cible, depuis votre poste, et ne jamais la coller dans l'application.
- La sauvegarde contient les coûts d'achat et les fournisseurs : fichier
  privé, à ne jamais transmettre à un client.
