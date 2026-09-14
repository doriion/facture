# Charte graphique

## Où vivent les couleurs

Deux fichiers, et deux seulement :

| Support | Source | Format |
| --- | --- | --- |
| Interface web | `app/globals.css` | variables CSS en HSL, lues par Tailwind |
| PDF, e-mails, graphiques | `lib/theme.ts` | hexadécimal |

`lib/theme.test.ts` compare les deux : une valeur changée d'un côté et
oubliée de l'autre fait échouer la CI. Le même test refuse toute
couleur de marque réécrite en dur dans un composant.

**Pour changer la charte, ces deux fichiers suffisent.** Ne jamais
écrire une couleur de marque ailleurs.

## Palette

| Rôle | Valeur | Contraste sur blanc | Emploi |
| --- | --- | --- | --- |
| Marine | `#003DA8` | 9,40:1 — AAA | texte fort, liens, titres de PDF |
| Principal | `#0165D9` | 5,43:1 — AA | boutons (texte blanc), filets, en-têtes |
| Signature | `#0194FB` | 3,17:1 | gros texte uniquement |
| Accent | `#00B1FC` | 2,42:1 | décor, séries de graphique |
| Clair | `#98EEFB` | 1,32:1 | fonds de badge et d'encadré |

Les trois dernières **ne peuvent pas porter de texte sur blanc**. Sur
un fond clair, écrire en marine (7,15:1) ou en texte courant.

## Le vert n'a pas disparu

Il n'est plus une couleur de marque, mais reste le signal des états de
**succès** : facture payée, montant encaissé, tâche faite, devis
accepté. Tout passer au bleu aurait fait perdre la lecture immédiate
d'une liste de factures.

## Logo

Le fichier va dans **`public/logo.png`**.

- Interface : `components/logo-marque.tsx` l'affiche dans la barre
  latérale, la barre du haut et le menu mobile. Sans fichier, il
  retombe sur le monogramme « F ».
- Documents : le logo déposé dans **Paramètres** reste prioritaire —
  c'est celui de l'entreprise, archivé avec le profil.
  `public/logo.png` sert de repli (`lib/logo-app.ts`).

Le composant part du monogramme et ne bascule sur l'image qu'une fois
son chargement confirmé. Ce n'est pas un détour : un `<img>` rendu
côté serveur déclenche son erreur de chargement avant que React ne
s'attache au DOM, et un `onError` sur la balise laissait l'icône
d'image cassée à l'écran.

### Reste à faire une fois le fichier déposé

Les icônes PNG (`icon-192`, `icon-512`, `icon-maskable-512`,
`apple-touch-icon`) et `favicon.svg` portent encore le monogramme sur
fond bleu. Elles doivent être régénérées depuis le logo pour que la
marque soit cohérente jusque sur l'écran d'accueil du téléphone.

## Documents déjà émis

Les PDF de **devis** et de **factures** sont régénérés à chaque
téléchargement : un document ancien re-téléchargé sort donc aux
nouvelles couleurs. C'est inhérent au fonctionnement de l'application,
pas un effet de bord du changement de charte.

Les **contrats signés** ont leur PDF archivé avec son empreinte : ils
ne changent pas.
