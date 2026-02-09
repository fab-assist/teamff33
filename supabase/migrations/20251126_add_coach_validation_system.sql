/*
  # Système de validation des coachs
  
  ## Modifications
  
  1. **Table coaches** - Ajout des champs :
     - status: 'pending' | 'approved' | 'rejected' (défaut: 'pending')
     - is_super_admin: boolean (défaut: false)
  
  2. **Nouvelle table coach_validation_tokens**
     - Stocke les tokens de validation envoyés par email
     - Expire après 7 jours
  
  3. **Mise à jour du trigger de création de coach**
     - Les nouveaux coachs ont status = 'pending' par défaut
  
  ## Sécurité
  - Seuls les super admins peuvent voir les tokens
  - Les coachs ne peuvent se connecter que si status = 'approved'
*/

-- Ajouter le champ status à la table coaches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coaches' AND column_name = 'status'
  ) THEN
    ALTER TABLE coaches ADD COLUMN status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Ajouter le champ is_super_admin à la table coaches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coaches' AND column_name = 'is_super_admin'
  ) THEN
    ALTER TABLE coaches ADD COLUMN is_super_admin boolean DEFAULT false;
  END IF;
END $$;

-- Ajouter le champ email à la table coaches s'il n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coaches' AND column_name = 'email'
  ) THEN
    ALTER TABLE coaches ADD COLUMN email text;
  END IF;
END $$;

-- Créer la table des tokens de validation
CREATE TABLE IF NOT EXISTS coach_validation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  action text NOT NULL CHECK (action IN ('approve', 'reject')),
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

-- Index pour recherche rapide par token
CREATE INDEX IF NOT EXISTS idx_validation_tokens_token ON coach_validation_tokens(token);

-- RLS pour coach_validation_tokens
ALTER TABLE coach_validation_tokens ENABLE ROW LEVEL SECURITY;

-- Politique : Seuls les super admins peuvent voir les tokens (via service role)
-- Les tokens sont validés via Edge Function avec service_role key

-- Mettre à jour le trigger pour inclure l'email et le status
CREATE OR REPLACE FUNCTION public.handle_new_coach_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only create coach profile if role is 'coach'
  IF NEW.raw_user_meta_data->>'role' = 'coach' THEN
    INSERT INTO public.coaches (
      id,
      prenom,
      nom,
      email,
      telephone,
      nom_club,
      mode_coaching,
      status,
      is_super_admin
    ) VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'prenom',
      NEW.raw_user_meta_data->>'nom',
      NEW.email,
      NEW.raw_user_meta_data->>'telephone',
      NEW.raw_user_meta_data->>'nom_club',
      COALESCE(NEW.raw_user_meta_data->>'mode_coaching', 'gestion_club'),
      'pending',
      false
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Fonction pour générer un token de validation
CREATE OR REPLACE FUNCTION public.generate_validation_token(p_coach_id uuid, p_action text)
RETURNS text
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_token text;
BEGIN
  -- Générer un token unique
  v_token := encode(gen_random_bytes(32), 'hex');
  
  -- Insérer le token
  INSERT INTO coach_validation_tokens (coach_id, token, action)
  VALUES (p_coach_id, v_token, p_action);
  
  RETURN v_token;
END;
$$;

-- Fonction pour valider un coach via token
CREATE OR REPLACE FUNCTION public.validate_coach_token(p_token text)
RETURNS json
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_token_record record;
  v_coach record;
BEGIN
  -- Récupérer le token
  SELECT * INTO v_token_record
  FROM coach_validation_tokens
  WHERE token = p_token
    AND used = false
    AND expires_at > now();
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Token invalide ou expiré');
  END IF;
  
  -- Récupérer le coach
  SELECT * INTO v_coach
  FROM coaches
  WHERE id = v_token_record.coach_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Coach non trouvé');
  END IF;
  
  -- Mettre à jour le status du coach
  UPDATE coaches
  SET status = CASE WHEN v_token_record.action = 'approve' THEN 'approved' ELSE 'rejected' END
  WHERE id = v_token_record.coach_id;
  
  -- Marquer le token comme utilisé
  UPDATE coach_validation_tokens
  SET used = true
  WHERE id = v_token_record.id;
  
  RETURN json_build_object(
    'success', true,
    'action', v_token_record.action,
    'coach', json_build_object(
      'id', v_coach.id,
      'prenom', v_coach.prenom,
      'nom', v_coach.nom,
      'email', v_coach.email
    )
  );
END;
$$;

-- Fonction pour récupérer les infos du super admin
CREATE OR REPLACE FUNCTION public.get_super_admin_email()
RETURNS text
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT email FROM coaches WHERE is_super_admin = true LIMIT 1;
$$;

