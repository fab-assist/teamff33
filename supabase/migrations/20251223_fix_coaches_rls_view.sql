-- =====================================================
-- FIX: Permettre aux coaches de voir les infos de base des autres coaches
-- =====================================================

-- Supprimer l'ancienne politique de lecture
DROP POLICY IF EXISTS "Coaches peuvent voir tous les coaches approuvés" ON coaches;
DROP POLICY IF EXISTS "coaches_select_approved" ON coaches;
DROP POLICY IF EXISTS "Coaches can view their own profile" ON coaches;

-- Créer une nouvelle politique qui permet :
-- 1. A chaque coach de voir son propre profil complet
-- 2. A tous les coaches approuvés de voir les infos de base des autres coaches approuvés
CREATE POLICY "coaches_can_view_approved_coaches" ON coaches
FOR SELECT USING (
  -- Soit c'est mon propre profil
  id = auth.uid()
  -- Soit c'est un coach approuvé (visible par tous les utilisateurs authentifiés)
  OR (status = 'approved' AND auth.uid() IS NOT NULL)
);

-- Note: Cette politique permet à tous les utilisateurs authentifiés (coaches ET adhérents)
-- de voir les coaches approuvés. C'est nécessaire pour afficher le nom du coach
-- dans les cours collectifs, les messages, etc.


