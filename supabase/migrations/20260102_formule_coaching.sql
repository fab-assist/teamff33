-- Ajout des colonnes pour la gestion des formules coaching individuel
-- duree_formule_mois : durée choisie (1, 4 ou 8 mois)
-- date_fin_formule : date de fin calculée automatiquement

ALTER TABLE adherents 
ADD COLUMN IF NOT EXISTS duree_formule_mois INTEGER DEFAULT NULL;

ALTER TABLE adherents 
ADD COLUMN IF NOT EXISTS date_fin_formule DATE DEFAULT NULL;

-- Commentaires pour documentation
COMMENT ON COLUMN adherents.duree_formule_mois IS 'Durée de la formule coaching en mois (1, 4 ou 8)';
COMMENT ON COLUMN adherents.date_fin_formule IS 'Date de fin de la formule coaching';

-- ============================================
-- AJOUT MODE SEANCE (présentiel / distanciel)
-- ============================================

ALTER TABLE seances 
ADD COLUMN IF NOT EXISTS mode_seance VARCHAR(20) DEFAULT 'presentiel';

COMMENT ON COLUMN seances.mode_seance IS 'Mode de la séance: presentiel ou distanciel';

-- ============================================
-- COLONNES POUR LES VALEURS RÉALISÉES
-- ============================================

-- Charge réellement effectuée (peut différer de charge_prescrite)
ALTER TABLE seances_exercices 
ADD COLUMN IF NOT EXISTS charge_realisee DECIMAL(10,2) DEFAULT NULL;

-- Répétitions réellement effectuées (peut différer de repetitions)
ALTER TABLE seances_exercices 
ADD COLUMN IF NOT EXISTS repetitions_realisees VARCHAR(50) DEFAULT NULL;

-- Séries réellement effectuées (peut différer de series)
ALTER TABLE seances_exercices 
ADD COLUMN IF NOT EXISTS series_realisees INTEGER DEFAULT NULL;

-- Notes de l'adhérent sur l'exercice
ALTER TABLE seances_exercices 
ADD COLUMN IF NOT EXISTS notes_adherent TEXT DEFAULT NULL;

COMMENT ON COLUMN seances_exercices.charge_realisee IS 'Charge réellement soulevée par l''adhérent';
COMMENT ON COLUMN seances_exercices.repetitions_realisees IS 'Répétitions réellement effectuées';
COMMENT ON COLUMN seances_exercices.series_realisees IS 'Séries réellement effectuées';
COMMENT ON COLUMN seances_exercices.notes_adherent IS 'Notes de l''adhérent sur l''exercice';
