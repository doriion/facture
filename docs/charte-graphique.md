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

## Logo et icônes

La vague vit dans **`public/logo.svg`** — un tracé vectoriel redessiné
d'après le logo original. Pour revenir au dessin d'origine, remplacer
ce fichier puis relancer `node scripts/icones.mjs`, qui régénère toutes
les icônes à partir de lui.

Où elle apparaît, et nulle part ailleurs :

- **Barre latérale, barre du haut, menu mobile** : `components/logo-marque.tsx`,
  la vague seule, le nom « NG Gestion » écrit en HTML à côté.
- **Icône d'accueil** (iPhone, Android), favicon, manifeste PWA :
  `public/icones/` et `public/favicon.ico`.

Les **documents** n'y touchent pas : le logo qui y figure est celui
déposé dans **Paramètres**, archivé avec le profil. `lib/logo-app.ts`
cherche un `public/logo.png` de repli qui n'existe pas — c'est voulu,
les PDF restent hors périmètre.

### Pourquoi les icônes ont changé de nom

Un téléphone garde l'icône d'accueil en cache tant que son URL ne
change pas. Redessiner `icon-192.png` ne suffisait pas : il fallait
que l'ancienne adresse **disparaisse**. D'où `public/icones/vague-*`
et la suppression des anciens fichiers. Un test vérifie qu'ils ne
reviennent pas.

Piège rencontré : **`app/favicon.ico`**. L'App Router sert ce fichier
à `/favicon.ico` automatiquement, avant `public/`. Il portait
l'ancienne icône et n'apparaissait dans aucune recherche limitée à
`public/`. Le même test interdit sa réapparition.

## Documents déjà émis

Les PDF de **devis** et de **factures** sont régénérés à chaque
téléchargement : un document ancien re-téléchargé sort donc aux
nouvelles couleurs. C'est inhérent au fonctionnement de l'application,
pas un effet de bord du changement de charte.

Les **contrats signés** ont leur PDF archivé avec son empreinte : ils
ne changent pas.

## Mode sombre

Les deux jeux de couleurs vivent dans `app/globals.css` ; Tailwind
bascule sur la classe `.dark` posée sur `<html>`.

Le choix se fait dans le menu du compte, en haut à droite : **Clair**,
**Sombre**, ou **Système** (le défaut — l'application suit alors le
réglage de l'ordinateur, et bascule avec lui en direct).

La préférence est retenue dans le navigateur (`facture-ae:theme`).
Elle est donc propre à chaque appareil, ce qui est le comportement
attendu : on peut vouloir le sombre sur le portable du soir et le
clair sur le poste du bureau.

`lib/theme-mode.ts` porte toute la logique, testée. Le script
anti-scintillement en fait partie : il s'exécute dans le `<head>`
avant le premier affichage, sinon la page s'ouvrirait en clair puis
basculerait — un éclair blanc. Vérifié en mesurant la couleur de fond
au `DOMContentLoaded`.

Contrastes du mode sombre, tous conformes :

| Paire | Ratio |
| --- | --- |
| Texte courant sur le fond | 17,76:1 — AAA |
| Texte secondaire sur une carte | 6,80:1 — AA |
| Texte du bouton sur le primaire | 6,57:1 — AA |
| Texte sur fond accent | 9,17:1 — AAA |
