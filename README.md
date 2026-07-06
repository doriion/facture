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

## Lancer en local

```bash
npm install
cp .env.example .env.local  # remplir les valeurs Supabase
npm run dev
```

## Déploiement

Auto-déployé sur Vercel à chaque push sur `main`. Variables d'env requises :
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
