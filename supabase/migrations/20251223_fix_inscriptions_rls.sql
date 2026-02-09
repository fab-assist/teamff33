-- =====================================================
-- FIX: Permettre aux adhérents de voir le nombre d'inscrits aux cours
-- =====================================================

-- Supprimer l'ancienne politique de lecture
DROP POLICY IF EXISTS "Adherents can view their own inscriptions" ON inscriptions_cours;
DROP POLICY IF EXISTS "inscriptions_cours_select" ON inscriptions_cours;
DROP POLICY IF EXISTS "Coaches can view all inscriptions" ON inscriptions_cours;

-- Nouvelle politique : 
-- Les adhérents peuvent voir TOUTES les inscriptions d'un cours (pour voir les places disponibles)
-- mais ils ne peuvent modifier que les leurs
CREATE POLICY "inscriptions_cours_select" ON inscriptions_cours
FOR SELECT USING (
  -- Tout utilisateur authentifié peut voir les inscriptions (pour compter les places)
  auth.uid() IS NOT NULL
);

-- Les adhérents peuvent créer leurs propres inscriptions
DROP POLICY IF EXISTS "Adherents can create inscriptions" ON inscriptions_cours;
CREATE POLICY "inscriptions_cours_insert" ON inscriptions_cours
FOR INSERT WITH CHECK (
  adherent_id = auth.uid()
  OR EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid())
);

-- Les adhérents peuvent modifier/supprimer leurs propres inscriptions
DROP POLICY IF EXISTS "Adherents can update their inscriptions" ON inscriptions_cours;
CREATE POLICY "inscriptions_cours_update" ON inscriptions_cours
FOR UPDATE USING (
  adherent_id = auth.uid()
  OR EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Adherents can delete their inscriptions" ON inscriptions_cours;
CREATE POLICY "inscriptions_cours_delete" ON inscriptions_cours
FOR DELETE USING (
  adherent_id = auth.uid()
  OR EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid())
);


