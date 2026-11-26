# Mon explorateur

Site 100 % statique : aucun serveur, aucune installation.

## Mettre en ligne (GitHub Pages)
1. Crée un dépôt sur GitHub (public avec un compte gratuit).
2. **Add file → Upload files** : dépose le *contenu* de ce dossier (index.html à la racine), puis **Commit**.
3. **Settings → Pages → Deploy from a branch**, branche `main`, dossier `/ (root)`.
4. Après une à deux minutes : `https://TON-COMPTE.github.io/NOM-DU-DEPOT/`

## Première connexion
Ouvre le fichier **Administration**. Code de départ : `1234`. Change-le dans **Sécurité**, puis publie.

## Créer le jeton pour publier
GitHub → Settings (du compte) → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate :
- Repository access : **Only select repositories** → ce dépôt seulement
- Permissions : **Contents → Read and write**
- Choisis une date d'expiration.

Colle le jeton dans Administration → Publication. Ne le mets jamais dans un fichier du dépôt.

Sans jeton : **Télécharger en ZIP**, décompresse, puis envoie `data.json` et le dossier `media` sur GitHub.
(Le ZIP ne contient que ce qui est nouveau ; les fichiers supprimés restent dans le dépôt.)

## Mobile
| Geste | Action |
|---|---|
| Glisser un doigt | Déplacer le curseur |
| Taper | Clic |
| Taper deux fois | Ouvrir |
| Taper, puis retoucher et glisser | Attraper une fenêtre ou une barre du lecteur |
| Deux doigts | Faire défiler |

Le bouton **Souris** (barre du bas) active ou coupe ce mode. L'administration et la saisie du code
restent en tactile normal.

## À savoir
- Le code d'accès masque l'administration ; il ne rend rien privé. Tout fichier publié est public,
  et reste dans l'historique Git même après suppression.
- Les changements sont d'abord un brouillon sur l'appareil, visibles en ligne après publication.
- Fichiers : 90 Mo maximum chacun depuis l'administration ; vise un site total de moins de 1 Go.
- MP3 et M4A sont les formats audio les plus sûrs sur mobile.

## Tester sur ordinateur
`python -m http.server` dans le dossier, puis http://localhost:8000 (un double-clic sur index.html ne marche pas).

## Modifier le code
| Fichier | Rôle |
|---|---|
| `css/player.css`, `js/player.js` | Lecteur audio (apparence, comportement) |
| `css/style.css`, `js/icons.js` | Habillage et icônes |
| `js/explorer.js`, `js/windows.js` | Explorateur et fenêtres |
| `js/viewer.js` | Photos et textes |
| `js/trackpad.js` | Curseur tactile |
| `js/admin.js`, `js/publish.js` | Administration et publication |
| `data.json` | Contenu et réglages |
