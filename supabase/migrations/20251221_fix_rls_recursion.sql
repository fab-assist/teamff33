-- =====================================================
-- CORRECTION RECURSION RLS - Exécuter ce fichier
-- =====================================================

-- Supprimer les policies problématiques
DROP POLICY IF EXISTS "groupes_membres_select" ON groupes_membres;
DROP POLICY IF EXISTS "groupes_messages_select" ON groupes_messages;
DROP POLICY IF EXISTS "groupes_messages_insert" ON groupes_messages;

-- Nouvelle policy groupes_membres_select SANS récursion
-- Un utilisateur peut voir les membres si:
-- 1. Il est lui-même membre du groupe (vérifié par membre_id directement)
-- 2. Il est super admin
CREATE POLICY "groupes_membres_select" ON groupes_membres FOR SELECT USING (
  membre_id = auth.uid()
  OR EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid() AND is_super_admin = true)
);

-- Nouvelle policy groupes_messages_select
-- Un utilisateur peut voir les messages si:
-- 1. Il est membre du groupe
-- 2. Le groupe est général
-- 3. Il est super admin
CREATE POLICY "groupes_messages_select" ON groupes_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM groupes_membres 
    WHERE groupes_membres.groupe_id = groupes_messages.groupe_id 
    AND groupes_membres.membre_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM groupes_discussion 
    WHERE groupes_discussion.id = groupes_messages.groupe_id 
    AND groupes_discussion.is_general = true
  )
  OR EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid() AND is_super_admin = true)
);

-- Nouvelle policy groupes_messages_insert
-- Un utilisateur peut poster si:
-- 1. Il est membre ET (groupe = discussion OU il est coach)
-- 2. Il est super admin
CREATE POLICY "groupes_messages_insert" ON groupes_messages FOR INSERT WITH CHECK (
  (
    EXISTS (
      SELECT 1 FROM groupes_membres 
      WHERE groupes_membres.groupe_id = groupes_messages.groupe_id 
      AND groupes_membres.membre_id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM groupes_discussion 
        WHERE groupes_discussion.id = groupes_messages.groupe_id 
        AND groupes_discussion.type = 'discussion'
      )
      OR EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid())
    )
  )
  OR EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid() AND is_super_admin = true)
);



