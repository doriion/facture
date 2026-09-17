# Rappels push (notification avant un rendez-vous)

Une notification sur le téléphone `N` minutes avant chaque rendez-vous
horodaté (30 min par défaut), et la veille à 18 h pour une « journée
entière ». Envoyée par l'app installée (Web Push), sans dépendre de
l'abonnement calendrier de l'iPhone. **Désactivé par défaut.** Rien
n'est envoyé aux clients.

## Comment ça marche

1. Paramètres → « Rappels sur le téléphone » : interrupteur + délai
   (réglage du compte, `profil_entreprise.auto_rappels_push_active`,
   `rappels_push_delai_minutes`).
2. Sur chaque appareil : « Recevoir les rappels sur cet appareil » →
   permission du navigateur → abonnement Web Push enregistré dans
   `push_abonnements` (un par appareil, RLS propriétaire).
3. Toutes les 5 minutes, pg_cron (Supabase) appelle
   `/api/cron/rappels-push` via pg_net avec `Authorization: Bearer
   PUSH_CRON_SECRET`. La route cherche, pour chaque utilisateur actif
   avec au moins un appareil, les rendez-vous d'aujourd'hui et de demain
   dont l'instant de rappel vient de passer (fenêtre de 30 min, jamais
   en retard au-delà), les marque `rappel_push_envoye_le` (un seul
   rappel par rendez-vous, même si deux appels se chevauchent) et envoie
   la notification à chaque appareil. Un abonnement expiré (404 / 410)
   est retiré.
4. Le service worker (`public/sw.js`) affiche la notification ; un tap
   ouvre l'agenda sur le jour du rendez-vous.

Logique pure et testée : `lib/rappels-push.ts` (instant de rappel en
heure de Paris, passage d'heure compris ; rappels dus ; contenu).

## Variables Vercel (Production ET Preview)

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | clé publique VAPID (lue aussi par le navigateur) |
| `VAPID_PRIVATE_KEY` | clé privée VAPID (serveur seulement) |
| `VAPID_SUBJECT` | contact VAPID : `https://facture-green.vercel.app` ou `mailto:…` |
| `PUSH_CRON_SECRET` | secret attendu par `/api/cron/rappels-push` |

Générer une paire VAPID : `npx web-push generate-vapid-keys`.
Sans ces variables, la carte des réglages le signale et rien ne part.

## Déclencheur pg_cron (à exécuter une fois, hors dépôt)

La migration `20260923000000_add_rappels_push.sql` active `pg_cron` et
`pg_net`. La planification contient le secret, elle se fait dans
l'éditeur SQL Supabase (pas dans le dépôt) :

```sql
select cron.schedule(
  'rappels-push',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://facture-green.vercel.app/api/cron/rappels-push',
    headers := jsonb_build_object('Authorization', 'Bearer <PUSH_CRON_SECRET>')
  );
  $$
);
```

Vérifier : `select * from cron.job;` puis `select * from cron.job_run_details order by start_time desc limit 10;`.
Arrêter : `select cron.unschedule('rappels-push');`.

## iPhone

Les notifications Web Push ne fonctionnent que depuis l'app **ajoutée
à l'écran d'accueil** (iOS 16.4+) : Safari → Partager → « Sur l'écran
d'accueil », ouvrir NG Gestion depuis l'icône, puis Paramètres →
« Recevoir les rappels sur cet appareil ». Le bouton doit être touché
par l'utilisateur (iOS refuse une demande de permission automatique).
