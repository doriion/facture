# Facture AE

Application web personnelle de gestion de **factures et devis** pour
auto-entrepreneur BTP français (plomberie + climatisation/PAC).

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + Auth + Storage)
- shadcn/ui · react-hook-form + Zod · @react-pdf/renderer · Recharts · Resend

## Fonctionnalités

- **Factures** numérotées chronologiquement avec mentions légales BTP
  (franchise TVA art. L.223-3 CIBS, assurance décennale, médiateur conso…)
- **Devis** avec performances énergétiques COP/SCOP/SEER, aides MaPrimeRénov'/CEE
- **Section équipement clim/PAC** avec traçabilité fluides frigorigènes (F-Gas)
- **PDF auto-générés** conformes aux exigences légales françaises
- **CRUD clients** (particulier/pro/syndic) + catalogue prestations
- Conversion **devis → facture** en 1 clic
- **Hors ligne** (PWA) : les écrans déjà ouverts et les principaux
  (préchauffés après connexion) restent lisibles sans réseau, photos
  comprises. Cocher une tâche, créer une tâche ou un rendez-vous,
  enregistrer un paiement ou ajouter des photos d'intervention sans
  réseau met la modification en file d'attente (IndexedDB) ; elle part
  toute seule au retour du réseau, sans doublon (identifiant choisi par
  le téléphone). Un bandeau montre ce qui attend ou a été refusé.

## Lancer en local

```bash
npm install
cp .env.example .env.local  # remplir les valeurs Supabase
npm run dev
```

## Déploiement

Auto-déployé sur Vercel à chaque push sur `main`. Les variables d'environnement
sont listées et commentées dans `.env.example` (Supabase, Resend, URL publique,
secrets des tâches planifiées, clé service role, clés VAPID des notifications,
Sentry) — un test compare cette liste aux `process.env.*` réellement lus par le
code. Le cron quotidien a deux déclencheurs (Vercel Cron et pg_cron), voir
`docs/rappels-push.md`. La restauration d'une sauvegarde dans un projet vierge
est décrite dans `docs/restauration.md` (`npm run restaurer`).
