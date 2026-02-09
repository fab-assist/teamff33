@echo off
echo ========================================
echo    BUILD TEAMFF 33 POUR NETLIFY
echo ========================================
echo.

echo [1/2] Installation des dependances...
call npm install
echo.

echo [2/2] Build de l'application...
call npm run build
echo.

echo ========================================
echo    BUILD TERMINE !
echo ========================================
echo.
echo Le dossier "dist" est pret pour Netlify
echo.
echo PROCHAINE ETAPE :
echo 1. Va sur https://app.netlify.com
echo 2. Clique sur ton site TeamFF 33
echo 3. Onglet "Deploys"
echo 4. Glisse-depose le dossier "dist" dans la zone de drop
echo.
pause
