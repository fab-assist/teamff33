#!/bin/bash

echo "========================================"
echo "   BUILD TEAMFF 33 POUR NETLIFY"
echo "========================================"
echo ""

echo "[1/2] Installation des dépendances..."
npm install
echo ""

echo "[2/2] Build de l'application..."
npm run build
echo ""

echo "========================================"
echo "   BUILD TERMINÉ !"
echo "========================================"
echo ""
echo "Le dossier 'dist' est prêt pour Netlify"
echo ""
echo "PROCHAINE ÉTAPE :"
echo "1. Va sur https://app.netlify.com"
echo "2. Clique sur ton site TeamFF 33"
echo "3. Onglet 'Deploys'"
echo "4. Glisse-dépose le dossier 'dist' dans la zone de drop"
echo ""
