/*
  # Ajout du support des 3 modes de coaching
  
  ## Modifications
  
  1. **Table coaches** - Ajout du champ `mode_coaching`
     - coaching_individuel : Coaching personnel 1-to-1
     - gestion_club : Gestion de club de Force Athlétique
     - coaching_structure : Coaching pour entreprises
  
  2. **Table structures** - Nouvelle table pour les structures/entreprises
     - Informations sur l'entreprise/organisation
     - Nombre de personnes, moyenne d'âge
     - Type de structure
  
  ## Notes
  - Un coach peut avoir un seul mode à la fois
  - Les adhérents sont liés aux coaches en mode "gestion_club"
  - Les structures sont liées aux coaches en mode "coaching_structure"
*/

-- Ajouter le champ mode_coaching à la table coaches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coaches' AND column_name = 'mode_coaching'
  ) THEN
    ALTER TABLE coaches ADD COLUMN mode_coaching text DEFAULT 'gestion_club';
  END IF;
END $$;

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
