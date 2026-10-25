# 🚀 Mettre Étincelle en ligne

L'application est un simple serveur Node.js sans dépendance : elle se déploie presque partout. Voici les options, de la plus simple à la plus pro.

---

## Option 1 — Test rapide : exposer ton PC (5 minutes)

Pour faire essayer l'app à un·e ami·e sans hébergement :

1. Lance l'app : `node server.js`
2. Installe un tunnel local, par exemple [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) :
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
   (alternatives : `npx localtunnel --port 3000`, ngrok)
3. Tu obtiens une URL publique HTTPS à partager.

⚠️ Ton PC doit rester allumé. Pour un vrai service, passe à l'option 2.

---

## Option 2 — Hébergement gratuit/low-cost géré (recommandé pour débuter)

Des plateformes comme **Render**, **Railway**, **Fly.io** ou **Koyeb** hébergent des apps Node.js :

1. Pousse le dossier `app-rencontres` sur un dépôt **GitHub**
2. Sur la plateforme : « New Web Service » → connecte le dépôt
3. Réglages :
   - **Build command** : *(aucun — pas de dépendances !)*
   - **Start command** : `node server.js` (ou `npm start`)
   - La plateforme fournit `PORT` automatiquement — le serveur lit déjà `process.env.PORT` ✅
4. HTTPS est fourni automatiquement.

⚠️ **Important — données** : sur ces plateformes, le système de fichiers est souvent **effacé au redémarrage** (plan gratuit). `data.json` et `public/uploads/` seraient perdus. Deux solutions :
- **Plan payant avec disque persistant** (Render « Persistent Disk », Railway volumes, Fly.io volumes)
- **Migrer vers une vraie base** (voir option 4)

---

## Option 3 — VPS (contrôle total, ~4-6 €/mois)

Chez OVH, Hetzner, Scaleway…

```bash
# Sur le serveur (Ubuntu/Debian)
sudo apt update && sudo apt install -y nodejs nginx
# Copier le dossier app-rencontres, puis :
cd app-rencontres
npm i -g pm2          # gestionnaire de processus
pm2 start server.js --name etincelle
pm2 save && pm2 startup
```

Puis **nginx** en reverse proxy (il gère HTTPS avec certbot) :
```nginx
server {
    server_name ton-domaine.be;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection "";    # indispensable pour le SSE !
        proxy_buffering off;               # idem : SSE en temps réel
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d ton-domaine.be   # HTTPS gratuit
```

💡 **Ne pas oublier les deux lignes `Connection ""` et `proxy_buffering off`** : sans elles, le chat temps réel (SSE) casse derrière un proxy.

---

## Option 4 — Aller vers la production (quand il y a de vrais utilisateurs)

À ce stade, il faudra :

| Sujet | État actuel | À faire |
|---|---|---|
| Base de données | fichier `data.json` | migrer vers SQLite/PostgreSQL |
| Sessions | en mémoire (`db.sessions`) | cookies httpOnly + store persistant |
| Uploads | disque local | stockage objet (S3/Cloudflare R2) |
| HTTPS | selon hébergeur | obligatoire (la géolocalisation exige HTTPS en production !) |
| Modération | — | signalement, blocage, suppression de comptes |
| RGPD | — | page confidentialité, export/suppression des données |
| Sauvegardes | — | backup régulier de la base |

💡 **La géolocalisation ne fonctionne que sur HTTPS** (sauf `localhost`) — un argument de plus pour déployer correctement.

---

## 📌 Résumé

| Besoin | Solution |
|---|---|
| Essayer avec des amis ce soir | Cloudflare Tunnel / ngrok (option 1) |
| Première vraie mise en ligne | Render/Railway + disque persistant (option 2) |
| Service sérieux, maîtrise totale | VPS + nginx + pm2 + certbot (option 3) |
| Croissance | Option 3 ou 4 + base de données |
