# Étincelle 💜

Application de rencontres et d'amitiés pensée pour les personnes **asexuelles, peu sexuelles et sur le spectre ace** (gris-A, démi, ace-flux, questioning…).

> 🧭 Philosophie : la connexion d'abord, sans pression. Les profils affichent l'identité ace, les intentions de relation (romantique sans sexe, queerplatonique, amitié…) et les personnes aro peuvent chercher uniquement des amitiés.

## 🚀 Lancer l'application

```bash
cd app-rencontres
node server.js
```

Puis ouvrir **http://localhost:3000** dans ton navigateur.

⚠️ Nécessite uniquement **Node.js ≥ 22.5** (base SQLite intégrée) — aucune dépendance à installer (`npm install` inutile).

💾 **Persistance** : toutes les données (comptes, matchs, messages, signalements) sont dans `etincelle.db` (SQLite). Les sessions et comptes survivent aux redémarrages. Un ancien `data.json` est migré automatiquement au premier lancement. Pour un hébergement avec disque persistant, monte le dossier de l'app (ou définis `DATA_DIR`) et tout est conservé.

## 🧪 Comptes de démo

8 profils fictifs sont créés au premier lancement (mot de passe : **demo1234**) :

Léa · Thomas · Sofia · Maxime · Camille · Nadia · Karim · Julie

Compte de **modération** : **Modo / modo1234** (change ce mot de passe avant mise en ligne !)

👉 **Pour tester le chat en temps réel** : ouvre deux fenêtres du navigateur, connecte-toi avec deux comptes différents, matche-les mutuellement et discute — les messages arrivent instantanément (SSE).

## ✨ Fonctionnalités

- **Comptes** : inscription, connexion, mots de passe hashés (scrypt + sel), sessions persistantes
- **Découverte** : swipe à droite 💜 / à gauche ✖️, filtres par intention (amitiés, romantique sans sexe, queerplatonique, discussions)
- **Galerie photo** : jusqu'à 6 photos par profil, **recadrage automatique au carré** (canvas côté navigateur), sélection de la photo principale ★, suppression ✕, navigation entre photos sur la carte (tap/clic)
- **Filtres par identité** : asexuel·le, gris-A, démisexuel·le, ace-flux, aromantique, questioning
- **Filtres de recherche** : âge min/max, **distance max** en km (via géolocalisation du navigateur, ou coordonnées déduites de la ville : Bruxelles, Namur, Gand, Anvers, Liège…), identité du spectre (multi-sélection)
- **Matchs réciproques** en temps réel (notification instantanée sur l'autre appareil)
- **Chat temps réel** (Server-Sent Events) — les deux personnes voient les messages apparaître en direct
- **Phrases d'accroche** proposées pour briser la glace sans pression
- **Profil éditable** : identité sur le spectre, intentions, bio, centres d'intérêt, emoji d'avatar
- **Persistance** : base SQLite (`etincelle.db`) — comptes, sessions, matchs, messages et signalements survivent aux redémarrages
- **Signalement 🚩** : depuis chaque conversation, avec motif et détails ; la modération est notifiée en temps réel
- **Blocage 🚫** : depuis chaque conversation ; la personne disparaît de la découverte, la conversation est supprimée, impossible de re-contacter ; liste de blocage gérable dans le Profil
- **Modération 🛡️** : onglet réservé aux modérateurs — signalements (bannir, effacer les photos, classer), liste des comptes avec bannissement/débannissement ; les comptes bannis ne peuvent plus se connecter

## 🗂️ Structure

```
app-rencontres/
├── server.js          # Serveur Node.js (API + SSE + fichiers statiques)
├── public/index.html  # Interface client
├── public/uploads/    # Photos de profil
├── data.json          # Base de données (créée au 1er lancement)
└── README.md
```

## 🔒 Respect & limites

- C'est un prototype local : les données restent sur ta machine (`data.json`).
- Le chat ne filtre pas encore le contenu, et il n'y a pas de photos ni de signalement — des étapes naturelles pour une vraie mise en production.
