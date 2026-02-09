# 🚀 GUIDE DE DÉPLOIEMENT - TeamFF 33

## 📋 PRÉREQUIS (À faire UNE SEULE FOIS)

### 1. Configurer Supabase Production

1. Va sur https://supabase.com et crée un nouveau projet pour la PRODUCTION
2. Récupère les clés API (Settings > API) :
   - Project URL
   - anon public key

3. **Modifie le fichier `.env.production`** dans ton projet avec TES vraies valeurs :
   ```
   VITE_SUPABASE_URL=https://TON-PROJET.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ_TA_VRAIE_CLE_ICI
   ```

4. Exécute le SQL de migration dans Supabase (SQL Editor) - voir section en bas

### 2. Créer le site sur Netlify (PREMIÈRE FOIS SEULEMENT)

1. Va sur https://app.netlify.com
2. Clique sur **"Add new site"** > **"Deploy manually"**
3. Tu verras une zone de "drop" - **NE FAIS RIEN ENCORE**
4. Note le nom temporaire de ton site (ex: `random-name-123.netlify.app`)

---

## 🔄 DÉPLOYER / METTRE À JOUR L'APPLICATION

### Étape 1 : Builder l'application

Ouvre un terminal dans le dossier du projet et lance :

```bash
npm run build
```

✅ Après quelques secondes, un dossier `dist` sera créé avec tous les fichiers de production.

### Étape 2 : Déployer sur Netlify

**Méthode A : Via l'interface web (SIMPLE)**

1. Va sur https://app.netlify.com
2. Clique sur ton site "TeamFF 33" (ou le nom que tu lui as donné)
3. Va dans l'onglet **"Deploys"**
4. **Glisse-déposse** le dossier `dist` directement dans la zone qui dit "Need to update your site? Drag and drop your site output folder here"
5. ⏳ Attends 30 secondes max
6. ✅ C'est en ligne !

**Méthode B : Via Netlify CLI (RAPIDE)**

Si tu as installé Netlify CLI (`npm install -g netlify-cli`) :

```bash
netlify deploy --prod --dir=dist
```

---

## 🎯 RÉCAPITULATIF RAPIDE

**Pour chaque mise à jour future :**

1. Build : `npm run build`
2. Glisse le dossier `dist` sur Netlify
3. C'est tout ! ✅

---

## 🗄️ SQL DE MIGRATION SUPABASE (À COPIER LA PREMIÈRE FOIS)

Va dans Supabase > SQL Editor > New query, et exécute ce SQL :

```sql
/*
  # Ajout du support des 3 modes de coaching

  ## Modifications

  1. **Table coaches** - Ajout du champ `mode_coaching`
     - coaching_individuel : Coaching personnel 1-to-1
     - gestion_club : Gestion de club de Force Athlétique
     - coaching_structure : Coaching pour entreprises

  2. **Table structures** - Nouvelle table pour les structures/entreprises

  ## Notes
  - Un coach peut avoir un seul mode à la fois
  - Les adhérents sont liés aux coaches en mode "gestion_club"
  - Les structures sont liées aux coaches en mode "coaching_structure"
*/

-- Créer la table coaches
CREATE TABLE IF NOT EXISTS coaches (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prenom text NOT NULL,
  nom text NOT NULL,
  email text,
  telephone text,
  nom_club text DEFAULT 'TeamFF 33',
  mode_coaching text DEFAULT 'gestion_club',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own data"
  ON coaches FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Coaches can update own data"
  ON coaches FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Créer la table adherents
CREATE TABLE IF NOT EXISTS adherents (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES coaches(id) ON DELETE CASCADE,
  prenom text NOT NULL,
  nom text NOT NULL,
  email text NOT NULL,
  telephone text,
  date_naissance date,
  sexe text,
  photo_url text,
  poids_actuel decimal,
  taille decimal,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE adherents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Adherents can view own data"
  ON adherents FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Coaches can view their adherents"
  ON adherents FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches can manage their adherents"
  ON adherents FOR ALL
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Créer la table structures pour le coaching d'entreprise
CREATE TABLE IF NOT EXISTS structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  nom_structure text NOT NULL,
  type_structure text,
  nombre_personnes integer,
  moyenne_age integer,
  adresse text,
  telephone text,
  email text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE structures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own structures"
  ON structures FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches can insert own structures"
  ON structures FOR INSERT
  TO authenticated
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update own structures"
  ON structures FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can delete own structures"
  ON structures FOR DELETE
  TO authenticated
  USING (coach_id = auth.uid());

-- Table pour les clients en coaching individuel
CREATE TABLE IF NOT EXISTS clients_individuels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  prenom text NOT NULL,
  nom text NOT NULL,
  date_naissance date,
  sexe text,
  email text NOT NULL,
  telephone text,
  photo_url text,
  poids_actuel decimal,
  taille decimal,
  objectif_principal text,
  mode_coaching text DEFAULT 'presentiel',
  historique_medical text,
  disponibilite text,
  contraintes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clients_individuels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own clients"
  ON clients_individuels FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches can insert own clients"
  ON clients_individuels FOR INSERT
  TO authenticated
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update own clients"
  ON clients_individuels FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can delete own clients"
  ON clients_individuels FOR DELETE
  TO authenticated
  USING (coach_id = auth.uid());

-- Table pour les participants dans les structures
CREATE TABLE IF NOT EXISTS participants_structure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  prenom text,
  nom text,
  email text,
  telephone text,
  age integer,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE participants_structure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view participants of their structures"
  ON participants_structure FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM structures
      WHERE structures.id = participants_structure.structure_id
      AND structures.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can manage participants"
  ON participants_structure FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM structures
      WHERE structures.id = participants_structure.structure_id
      AND structures.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM structures
      WHERE structures.id = participants_structure.structure_id
      AND structures.coach_id = auth.uid()
    )
  );
```

---

## 📱 CONFIGURER LES VARIABLES D'ENVIRONNEMENT SUR NETLIFY

**IMPORTANT :** Pour que ton site en production utilise la bonne base de données Supabase, tu dois configurer les variables d'environnement sur Netlify :

1. Va sur https://app.netlify.com
2. Clique sur ton site "TeamFF 33"
3. Va dans **Site settings** > **Environment variables**
4. Clique sur **"Add a variable"** et ajoute :

   **Variable 1 :**
   - Key: `VITE_SUPABASE_URL`
   - Value: `https://TON-PROJET.supabase.co`

   **Variable 2 :**
   - Key: `VITE_SUPABASE_ANON_KEY`
   - Value: `eyJ_TA_VRAIE_CLE_ANON_ICI`

5. **Redéploie** ton site après avoir ajouté les variables

---

## ❓ BESOIN D'AIDE ?

- Site ne fonctionne pas ? Vérifie que les variables d'environnement sont bien configurées sur Netlify
- Erreurs de base de données ? Vérifie que tu as bien exécuté le SQL sur ton Supabase de production
- Le build échoue ? Lance `npm run build` en local et regarde les erreurs
