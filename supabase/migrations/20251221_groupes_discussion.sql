-- =====================================================
-- GROUPES DE DISCUSSION (AJOUT - ne modifie rien d'existant)
-- =====================================================

-- 1. Table des groupes
CREATE TABLE IF NOT EXISTS groupes_discussion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL DEFAULT 'discussion' CHECK (type IN ('annonces', 'discussion')),
  is_general BOOLEAN DEFAULT false,
  created_by UUID REFERENCES coaches(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table des membres
CREATE TABLE IF NOT EXISTS groupes_membres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  groupe_id UUID NOT NULL REFERENCES groupes_discussion(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL,
  membre_type VARCHAR(20) NOT NULL CHECK (membre_type IN ('coach', 'adherent')),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES coaches(id),
  UNIQUE(groupe_id, membre_id, membre_type)
);

-- 3. Table des messages de groupe
CREATE TABLE IF NOT EXISTS groupes_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  groupe_id UUID NOT NULL REFERENCES groupes_discussion(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('coach', 'adherent')),
  contenu TEXT NOT NULL,
  date_envoi TIMESTAMPTZ DEFAULT NOW(),
  supprime BOOLEAN DEFAULT false
);

-- 4. Table des statuts de lecture
CREATE TABLE IF NOT EXISTS groupes_messages_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES groupes_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('coach', 'adherent')),
  lu BOOLEAN DEFAULT false,
  lu_at TIMESTAMPTZ,
  UNIQUE(message_id, user_id, user_type)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_groupes_membres_groupe ON groupes_membres(groupe_id);
CREATE INDEX IF NOT EXISTS idx_groupes_membres_membre ON groupes_membres(membre_id, membre_type);
CREATE INDEX IF NOT EXISTS idx_groupes_messages_groupe ON groupes_messages(groupe_id);
CREATE INDEX IF NOT EXISTS idx_groupes_messages_status_user ON groupes_messages_status(user_id, user_type);

-- RLS
ALTER TABLE groupes_discussion ENABLE ROW LEVEL SECURITY;
ALTER TABLE groupes_membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE groupes_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE groupes_messages_status ENABLE ROW LEVEL SECURITY;

-- Supprimer les policies existantes si elles existent
DROP POLICY IF EXISTS "groupes_discussion_select" ON groupes_discussion;
DROP POLICY IF EXISTS "groupes_discussion_insert" ON groupes_discussion;
DROP POLICY IF EXISTS "groupes_discussion_update" ON groupes_discussion;
DROP POLICY IF EXISTS "groupes_discussion_delete" ON groupes_discussion;
DROP POLICY IF EXISTS "groupes_membres_select" ON groupes_membres;
DROP POLICY IF EXISTS "groupes_membres_insert" ON groupes_membres;
DROP POLICY IF EXISTS "groupes_membres_delete" ON groupes_membres;
DROP POLICY IF EXISTS "groupes_messages_select" ON groupes_messages;
DROP POLICY IF EXISTS "groupes_messages_insert" ON groupes_messages;
DROP POLICY IF EXISTS "groupes_messages_update" ON groupes_messages;
DROP POLICY IF EXISTS "groupes_messages_status_select" ON groupes_messages_status;
DROP POLICY IF EXISTS "groupes_messages_status_insert" ON groupes_messages_status;
DROP POLICY IF EXISTS "groupes_messages_status_update" ON groupes_messages_status;

-- Policies groupes_discussion
CREATE POLICY "groupes_discussion_select" ON groupes_discussion FOR SELECT USING (
  is_general = true 
  OR EXISTS (SELECT 1 FROM groupes_membres WHERE groupe_id = groupes_discussion.id AND membre_id = auth.uid())
  OR EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid() AND is_super_admin = true)
);

CREATE POLICY "groupes_discussion_insert" ON groupes_discussion FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid() AND is_super_admin = true)
);

CREATE POLICY "groupes_discussion_update" ON groupes_discussion FOR UPDATE USING (
  EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid() AND is_super_admin = true)
);

CREATE POLICY "groupes_discussion_delete" ON groupes_discussion FOR DELETE USING (
  EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid() AND is_super_admin = true)
);

-- Policies groupes_membres
CREATE POLICY "groupes_membres_select" ON groupes_membres FOR SELECT USING (
  EXISTS (SELECT 1 FROM groupes_membres gm WHERE gm.groupe_id = groupes_membres.groupe_id AND gm.membre_id = auth.uid())
  OR EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid() AND is_super_admin = true)
);

CREATE POLICY "groupes_membres_insert" ON groupes_membres FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid() AND is_super_admin = true)
);

CREATE POLICY "groupes_membres_delete" ON groupes_membres FOR DELETE USING (
  EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid() AND is_super_admin = true)
);

-- Policies groupes_messages
CREATE POLICY "groupes_messages_select" ON groupes_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM groupes_membres WHERE groupe_id = groupes_messages.groupe_id AND membre_id = auth.uid())
  OR EXISTS (SELECT 1 FROM groupes_discussion WHERE id = groupes_messages.groupe_id AND is_general = true)
  OR EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid() AND is_super_admin = true)
);

CREATE POLICY "groupes_messages_insert" ON groupes_messages FOR INSERT WITH CHECK (
  (
    EXISTS (SELECT 1 FROM groupes_membres WHERE groupe_id = groupes_messages.groupe_id AND membre_id = auth.uid())
    AND (
      EXISTS (SELECT 1 FROM groupes_discussion WHERE id = groupes_messages.groupe_id AND type = 'discussion')
      OR EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid())
    )
  )
  OR EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid() AND is_super_admin = true)
);

CREATE POLICY "groupes_messages_update" ON groupes_messages FOR UPDATE USING (
  sender_id = auth.uid()
);

-- Policies groupes_messages_status
CREATE POLICY "groupes_messages_status_select" ON groupes_messages_status FOR SELECT USING (
  user_id = auth.uid()
);

CREATE POLICY "groupes_messages_status_insert" ON groupes_messages_status FOR INSERT WITH CHECK (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid())
);

CREATE POLICY "groupes_messages_status_update" ON groupes_messages_status FOR UPDATE USING (
  user_id = auth.uid()
);

-- Créer le canal d'annonces générales
INSERT INTO groupes_discussion (nom, description, type, is_general, created_by)
SELECT 
  'Annonces du club',
  'Annonces officielles visibles par tous',
  'annonces',
  true,
  (SELECT id FROM coaches WHERE is_super_admin = true LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM groupes_discussion WHERE is_general = true);

