# Simulateur Flux Logistique MTO/MTS

Application web statique pour tester le bon mix **Make To Order / Make To Stock** sur une chaîne logistique multi-niveaux.

## Fonctionnalités

- Génération d’une nomenclature aléatoire multi-couches.
- Paramétrage cellule par cellule : MTO/MTS, stocks amont/aval, seuils, capacité, lead time, setup, quantité par parent.
- Déclenchement MTO par commande client : la commande du produit fini explose la nomenclature et crée les besoins enfants.
- MTS par point de commande : consommation du stock aval, puis réapprovisionnement selon seuil/cible.
- Cellules du rang le plus bas avec stock aval infini.
- Simulation continue : relance automatique dès qu’un produit fini est terminé.
- Arrêt en cas de rupture ou saturation stock/WIP.
- Interface sans points animés, avec flux lisibles par statut.

## Lancer en local

Ouvre simplement `index.html` dans un navigateur.

Optionnel avec un petit serveur local :

```bash
python3 -m http.server 8080
```

Puis ouvre `http://localhost:8080`.

## Déploiement GitHub Pages

1. Crée un repository GitHub, par exemple `logistics-mto-mts-simulator`.
2. Ajoute les fichiers `index.html`, `style.css`, `app.js`, `README.md`.
3. Va dans **Settings > Pages**.
4. Dans **Build and deployment**, choisis :
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Sauvegarde.

L’application sera disponible quelques instants après via l’URL GitHub Pages du repository.

## Structure

```text
.
├── index.html
├── style.css
├── app.js
└── README.md
```

## Règles métier importantes

- Une cellule **MTO** ne produit que lorsqu’un besoin aval existe.
- Une cellule **MTS** sert d’abord depuis son stock aval. Si le stock passe sous le point de commande, elle relance pour revenir au stock cible.
- Les pièces personnalisables sont recommandées en MTO.
- Le produit fini est recommandé en MTO pour refléter la commande client.
- Les cellules du dernier rang sont assimilées à des sources disponibles : stock aval infini.
