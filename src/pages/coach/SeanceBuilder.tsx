import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GripVertical,
  Clock,
  Dumbbell,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  X,
  Copy,
  Link2,
  FileText,
  Users,
  Calendar,
  Repeat,
  Loader2,
  Star,
  Info,
  AlertCircle,
  Package,
  Flame,
  Heart,
  Zap,
  Target,
  Activity
} from 'lucide-react';

// Options pour les types et zones
const TYPES_SEANCE = [
  { value: 'force', label: 'Force', icon: Dumbbell },
  { value: 'cardio', label: 'Cardio', icon: Heart },
  { value: 'hiit', label: 'HIIT', icon: Flame },
  { value: 'circuit', label: 'Circuit', icon: Activity },
  { value: 'mobilite', label: 'Mobilité', icon: Zap },
  { value: 'stretching', label: 'Stretching', icon: Target },
];

const ZONES_MUSCULAIRES = [
  { value: 'full_body', label: 'Full Body' },
  { value: 'haut_corps', label: 'Haut du corps' },
  { value: 'bas_corps', label: 'Bas du corps' },
  { value: 'core', label: 'Core / Abdos' },
  { value: 'pectoraux', label: 'Pectoraux' },
  { value: 'dos', label: 'Dos' },
  { value: 'bras', label: 'Bras' },
  { value: 'jambes', label: 'Jambes' },
  { value: 'epaules', label: 'Épaules' },
];

const NIVEAUX = [
  { value: 'debutant', label: 'Débutant' },
  { value: 'intermediaire', label: 'Intermédiaire' },
  { value: 'avance', label: 'Avancé' },
];

// Types
interface Categorie {
  id: string;
  slug: string;
  nom_fr: string;
  emoji: string;
}

interface Exercice {
  id: string;
  nom_fr: string;
  nom_en: string;
  nom_fichier?: string;
  gif_url: string;
  categorie_id: string;
  categorie?: Categorie;
}

interface Adherent {
  id: string;
  prenom: string;
  nom: string;
  email: string;
}

interface ExerciceSeance {
  id: string;
  exercice_id: string;
  exercice: Exercice;
  ordre: number;
  groupe_circuit: number | null;
  series: number;
  repetitions: string;
  charge_prescrite: number | null;
  temps_repos: number;
  temps_serie: number; // Durée d'une série en secondes
  tempo: string | null;
  notes_coach: string | null;
  // Valeurs réalisées (modifiables après séance)
  charge_realisee?: number | null;
  repetitions_realisees?: string | null;
  series_realisees?: number | null;
  notes_adherent?: string | null;
}

interface SeanceForm {
  titre: string;
  description: string;
  date_seance: string;
  adherent_id: string | null;
  nombre_passages: number; // Nombre de répétitions du circuit
  mode_seance: 'presentiel' | 'distanciel'; // Mode de la séance
  exercices: ExerciceSeance[];
}

export default function SeanceBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  // Params URL
  const adherentIdParam = searchParams.get('adherent');
  const seanceIdParam = searchParams.get('seance');
  const templateIdParam = searchParams.get('template');
  const fromTemplateIdParam = searchParams.get('from_template'); // Utiliser un template comme base
  const fromSeanceIdParam = searchParams.get('from_seance'); // Reprendre une séance comme base
  const dateParam = searchParams.get('date');

  // États principaux
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seanceForm, setSeanceForm] = useState<SeanceForm>({
    titre: '',
    description: '',
    date_seance: dateParam || new Date().toISOString().split('T')[0],
    adherent_id: adherentIdParam,
    nombre_passages: 1,
    mode_seance: 'presentiel', // Par défaut présentiel
    exercices: []
  });

  // Données
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [adherents, setAdherents] = useState<Adherent[]>([]);
  const [favoris, setFavoris] = useState<Set<string>>(new Set());

  // Filtres exercices
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategorie, setSelectedCategorie] = useState<string>('all');
  const [showFavorisOnly, setShowFavorisOnly] = useState(false);

  // UI States
  const [showExercicesPanel, setShowExercicesPanel] = useState(true);
  const [expandedExercices, setExpandedExercices] = useState<Set<string>>(new Set());
  
  // Drag & Drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Modal Template
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateType, setTemplateType] = useState('');
  const [templateZone, setTemplateZone] = useState('');
  const [templateNiveau, setTemplateNiveau] = useState('');

  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Afficher une notification
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Charger les données initiales
  useEffect(() => {
    loadInitialData();
  }, [user]);

  const loadInitialData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Charger les catégories
      const { data: catData } = await supabase
        .from('categories_exercices')
        .select('*')
        .order('ordre');
      if (catData) setCategories(catData);

      // Charger TOUS les exercices (2 requêtes car limite Supabase de 1000)
      const [batch1, batch2] = await Promise.all([
        supabase
          .from('exercices')
          .select('*, categorie:categories_exercices(*)')
          .order('nom_fr')
          .range(0, 999),
        supabase
          .from('exercices')
          .select('*, categorie:categories_exercices(*)')
          .order('nom_fr')
          .range(1000, 1999)
      ]);
      const exData = [...(batch1.data || []), ...(batch2.data || [])];
      if (exData) setExercices(exData);

      // Charger les favoris
      const { data: favData } = await supabase
        .from('exercices_favoris')
        .select('exercice_id')
        .eq('user_id', user.id);
      if (favData) setFavoris(new Set(favData.map(f => f.exercice_id)));

      // Charger les adhérents du coach
      const { data: adhData } = await supabase
        .from('adherents')
        .select('id, prenom, nom, email')
        .eq('coach_id', user.id)
        .order('nom');
      if (adhData) setAdherents(adhData);

      // Si on édite une séance existante
      if (seanceIdParam) {
        await loadSeance(seanceIdParam);
      }
      // Si on utilise un template (édition du template)
      else if (templateIdParam) {
        await loadTemplate(templateIdParam);
      }
      // Si on crée une séance depuis un template (nouvelle séance basée sur template)
      else if (fromTemplateIdParam) {
        await loadTemplate(fromTemplateIdParam);
        // On garde l'adhérent si spécifié
        if (adherentIdParam) {
          const adherent = adhData?.find(a => a.id === adherentIdParam);
          if (adherent) {
            setSeanceForm(prev => ({
              ...prev,
              adherent_id: adherentIdParam
            }));
          }
        }
      }
      // Si on reprend une séance existante comme base
      else if (fromSeanceIdParam) {
        await loadSeanceAsBase(fromSeanceIdParam);
      }
      // Sinon on prépare l'adhérent si spécifié
      else if (adherentIdParam) {
        const adherent = adhData?.find(a => a.id === adherentIdParam);
        if (adherent) {
          setSeanceForm(prev => ({
            ...prev,
            titre: `Séance ${adherent.prenom}`,
            adherent_id: adherentIdParam
          }));
        }
      }

    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSeance = async (seanceId: string) => {
    const { data: seance } = await supabase
      .from('seances')
      .select(`
        *,
        exercices:seances_exercices(
          *,
          exercice:exercices(*, categorie:categories_exercices(*))
        )
      `)
      .eq('id', seanceId)
      .single();

    if (seance) {
      setSeanceForm({
        titre: seance.titre,
        description: seance.description || '',
        date_seance: seance.date_seance,
        adherent_id: seance.adherent_id,
        nombre_passages: seance.nombre_passages || 1,
        mode_seance: seance.mode_seance || 'presentiel',
        exercices: seance.exercices?.map((e: any) => ({
          id: e.id,
          exercice_id: e.exercice_id,
          exercice: e.exercice,
          ordre: e.ordre,
          groupe_circuit: e.groupe_circuit,
          series: e.series,
          repetitions: e.repetitions,
          charge_prescrite: e.charge_prescrite,
          temps_repos: e.temps_repos,
          temps_serie: e.temps_serie || 45,
          tempo: e.tempo,
          notes_coach: e.notes_coach,
          charge_realisee: e.charge_realisee,
          repetitions_realisees: e.repetitions_realisees,
          series_realisees: e.series_realisees,
          notes_adherent: e.notes_adherent
        })).sort((a: any, b: any) => a.ordre - b.ordre) || []
      });
    }
  };

  const loadTemplate = async (templateId: string) => {
    const { data: template } = await supabase
      .from('templates_seances')
      .select(`
        *,
        exercices:templates_seances_exercices(
          *,
          exercice:exercices(*, categorie:categories_exercices(*))
        )
      `)
      .eq('id', templateId)
      .single();

    if (template) {
      setSeanceForm(prev => ({
        ...prev,
        titre: template.titre,
        description: template.description || '',
        nombre_passages: template.nombre_passages || 1,
        exercices: template.exercices?.map((e: any, index: number) => ({
          id: `temp-${index}`,
          exercice_id: e.exercice_id,
          exercice: e.exercice,
          ordre: e.ordre,
          groupe_circuit: e.groupe_circuit,
          series: e.series,
          repetitions: e.repetitions,
          charge_prescrite: e.charge_prescrite,
          temps_repos: e.temps_repos,
          temps_serie: e.temps_serie || 45,
          tempo: e.tempo,
          notes_coach: e.notes_coach
        })).sort((a: any, b: any) => a.ordre - b.ordre) || []
      }));
    }
  };

  // Charger une séance existante comme base pour une nouvelle
  const loadSeanceAsBase = async (seanceId: string) => {
    const { data: seance } = await supabase
      .from('seances')
      .select(`
        *,
        exercices:seances_exercices(
          *,
          exercice:exercices(*, categorie:categories_exercices(*))
        )
      `)
      .eq('id', seanceId)
      .single();

    if (seance) {
      // On reprend les exercices mais avec une nouvelle date et le même adhérent
      setSeanceForm({
        titre: seance.titre,
        description: seance.description || '',
        date_seance: new Date().toISOString().split('T')[0],
        adherent_id: adherentIdParam || seance.adherent_id,
        nombre_passages: seance.nombre_passages || 1,
        mode_seance: seance.mode_seance || 'presentiel',
        exercices: seance.exercices?.map((e: any, index: number) => ({
          id: `temp-${index}`,
          exercice_id: e.exercice_id,
          exercice: e.exercice,
          ordre: e.ordre,
          groupe_circuit: e.groupe_circuit,
          series: e.series,
          repetitions: e.repetitions,
          charge_prescrite: e.charge_prescrite,
          temps_repos: e.temps_repos,
          temps_serie: e.temps_serie || 45,
          tempo: e.tempo,
          notes_coach: e.notes_coach
        })).sort((a: any, b: any) => a.ordre - b.ordre) || []
      });
    }
  };

  // Fonction pour normaliser le texte (enlever les accents)
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  // Fonction pour dédupliquer les exercices par nom
  const deduplicateExercices = (exercicesList: Exercice[]): Exercice[] => {
    const seen = new Map<string, Exercice>();
    for (const ex of exercicesList) {
      const key = normalizeText(ex.nom_fr);
      if (!seen.has(key)) {
        seen.set(key, ex);
      }
    }
    return Array.from(seen.values());
  };

  // Filtrer les exercices
  const filteredExercices = deduplicateExercices(exercices.filter(ex => {
    // Filtre catégorie
    if (selectedCategorie !== 'all' && ex.categorie_id !== selectedCategorie) return false;
    // Filtre favoris
    if (showFavorisOnly && !favoris.has(ex.id)) return false;
    // Filtre recherche (cherche dans nom_fr, nom_en ET nom_fichier)
    if (searchQuery) {
      const normalizedSearch = normalizeText(searchQuery);
      const normalizedNomFr = normalizeText(ex.nom_fr);
      const normalizedNomEn = normalizeText(ex.nom_en);
      const normalizedNomFichier = normalizeText(ex.nom_fichier || '');
      return normalizedNomFr.includes(normalizedSearch) || 
             normalizedNomEn.includes(normalizedSearch) ||
             normalizedNomFichier.includes(normalizedSearch);
    }
    return true;
  }));

  // Ajouter un exercice à la séance
  const addExerciceToSeance = (exercice: Exercice) => {
    // Récupérer le temps de repos global si des exercices existent déjà
    const tempsReposGlobal = seanceForm.exercices.length > 0 ? seanceForm.exercices[0].temps_repos : 90;
    
    const newExercice: ExerciceSeance = {
      id: `new-${Date.now()}-${Math.random()}`,
      exercice_id: exercice.id,
      exercice: exercice,
      ordre: seanceForm.exercices.length,
      groupe_circuit: null,
      series: 3,
      repetitions: '12',
      charge_prescrite: null,
      temps_repos: tempsReposGlobal,
      temps_serie: 45, // 45 secondes par série par défaut
      tempo: null,
      notes_coach: null
    };

    setSeanceForm(prev => ({
      ...prev,
      exercices: [...prev.exercices, newExercice]
    }));

    // Ouvrir automatiquement les paramètres
    setExpandedExercices(prev => new Set(prev).add(newExercice.id));
  };

  // Supprimer un exercice
  const removeExercice = (id: string) => {
    setSeanceForm(prev => ({
      ...prev,
      exercices: prev.exercices.filter(e => e.id !== id).map((e, i) => ({ ...e, ordre: i }))
    }));
  };

  // Modifier un exercice
  const updateExercice = (id: string, updates: Partial<ExerciceSeance>) => {
    setSeanceForm(prev => ({
      ...prev,
      exercices: prev.exercices.map(e => e.id === id ? { ...e, ...updates } : e)
    }));
  };

  // Dupliquer un exercice
  const duplicateExercice = (exercice: ExerciceSeance) => {
    const newExercice: ExerciceSeance = {
      ...exercice,
      id: `new-${Date.now()}-${Math.random()}`,
      ordre: seanceForm.exercices.length
    };
    setSeanceForm(prev => ({
      ...prev,
      exercices: [...prev.exercices, newExercice]
    }));
  };

  // Créer/Modifier un circuit (super-set)
  const toggleCircuit = (exerciceId: string) => {
    const exercice = seanceForm.exercices.find(e => e.id === exerciceId);
    if (!exercice) return;

    if (exercice.groupe_circuit !== null) {
      // Retirer du circuit
      updateExercice(exerciceId, { groupe_circuit: null });
    } else {
      // Trouver le prochain numéro de groupe
      const maxGroupe = Math.max(0, ...seanceForm.exercices.map(e => e.groupe_circuit || 0));
      updateExercice(exerciceId, { groupe_circuit: maxGroupe + 1 });
    }
  };

  // Grouper avec l'exercice précédent (même circuit)
  const groupWithPrevious = (exerciceId: string) => {
    const index = seanceForm.exercices.findIndex(e => e.id === exerciceId);
    if (index <= 0) return;

    const previousExercice = seanceForm.exercices[index - 1];
    const currentGroupe = previousExercice.groupe_circuit;

    if (currentGroupe !== null) {
      updateExercice(exerciceId, { groupe_circuit: currentGroupe });
    } else {
      // Créer un nouveau groupe avec les deux
      const newGroupe = Math.max(0, ...seanceForm.exercices.map(e => e.groupe_circuit || 0)) + 1;
      updateExercice(previousExercice.id, { groupe_circuit: newGroupe });
      updateExercice(exerciceId, { groupe_circuit: newGroupe });
    }
  };

  // Déplacer un exercice (drag & drop simulation simple)
  const moveExercice = (fromIndex: number, toIndex: number) => {
    const newExercices = [...seanceForm.exercices];
    const [moved] = newExercices.splice(fromIndex, 1);
    newExercices.splice(toIndex, 0, moved);
    
    setSeanceForm(prev => ({
      ...prev,
      exercices: newExercices.map((e, i) => ({ ...e, ordre: i }))
    }));
  };

  // Calculer la durée estimée
  const calculateDuration = useCallback(() => {
    let totalParPassage = 0;
    seanceForm.exercices.forEach(ex => {
      // Temps par série + repos entre séries
      totalParPassage += ex.series * (ex.temps_serie + ex.temps_repos);
    });
    // Multiplier par le nombre de passages du circuit
    const total = totalParPassage * seanceForm.nombre_passages;
    return Math.ceil(total / 60); // En minutes
  }, [seanceForm.exercices, seanceForm.nombre_passages]);

  // Ouvrir le modal pour sauvegarder dans la banque
  const openSaveAsTemplateModal = () => {
    if (seanceForm.exercices.length === 0) {
      showNotification('error', 'Ajoutez au moins un exercice avant de sauvegarder');
      return;
    }
    if (!seanceForm.titre.trim()) {
      showNotification('error', 'Donnez un titre à la séance');
      return;
    }
    setTemplateName(seanceForm.titre);
    setShowTemplateModal(true);
  };

  // Sauvegarder la séance
  const handleSave = async () => {
    if (!user) return;
    if (!seanceForm.titre.trim()) {
      showNotification('error', 'Veuillez donner un titre à la séance');
      return;
    }

    setSaving(true);

    try {
      let seanceId = seanceIdParam;

      if (seanceIdParam) {
        // Mise à jour
        const { error } = await supabase
          .from('seances')
          .update({
            titre: seanceForm.titre,
            description: seanceForm.description || null,
            date_seance: seanceForm.date_seance,
            duree_estimee: calculateDuration(),
            nombre_passages: seanceForm.nombre_passages || 1,
            adherent_id: seanceForm.adherent_id || null,
            mode_seance: seanceForm.mode_seance
          })
          .eq('id', seanceIdParam);

        if (error) throw error;

        // Supprimer les anciens exercices
        await supabase
          .from('seances_exercices')
          .delete()
          .eq('seance_id', seanceIdParam);

      } else {
        // Création
        const { data, error } = await supabase
          .from('seances')
          .insert({
            coach_id: user.id,
            titre: seanceForm.titre,
            description: seanceForm.description || null,
            date_seance: seanceForm.date_seance,
            duree_estimee: calculateDuration(),
            nombre_passages: seanceForm.nombre_passages || 1,
            adherent_id: seanceForm.adherent_id || null,
            mode_seance: seanceForm.mode_seance,
            statut: 'planifie'
          })
          .select()
          .single();

        if (error) throw error;
        seanceId = data.id;
      }

      // Ajouter les exercices
      if (seanceForm.exercices.length > 0 && seanceId) {
        const exercicesToInsert = seanceForm.exercices.map((ex, index) => ({
          seance_id: seanceId,
          exercice_id: ex.exercice_id,
          ordre: index,
          groupe_circuit: ex.groupe_circuit,
          series: ex.series,
          repetitions: ex.repetitions,
          charge_prescrite: ex.charge_prescrite,
          temps_repos: ex.temps_repos,
          temps_serie: ex.temps_serie,
          tempo: ex.tempo,
          notes_coach: ex.notes_coach,
          charge_realisee: ex.charge_realisee || null,
          repetitions_realisees: ex.repetitions_realisees || null,
          series_realisees: ex.series_realisees || null,
          notes_adherent: ex.notes_adherent || null
        }));

        const { error } = await supabase
          .from('seances_exercices')
          .insert(exercicesToInsert);

        if (error) throw error;
      }

      // Rediriger vers la liste des séances
      navigate('/coach/seances');

    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      showNotification('error', 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Ouvrir le modal pour sauvegarder comme template
  const openTemplateModal = () => {
    if (!seanceForm.titre.trim()) {
      showNotification('error', 'Veuillez donner un titre à la séance');
      return;
    }
    setTemplateName(seanceForm.titre);
    setShowTemplateModal(true);
  };

  // Sauvegarder comme template (après confirmation du modal)
  const handleSaveAsTemplate = async () => {
    if (!user) return;
    if (!templateName.trim()) {
      showNotification('error', 'Veuillez entrer un nom pour le template');
      return;
    }

    setShowTemplateModal(false);
    setSaving(true);

    try {
      // Créer le template (compatible avec ou sans les nouvelles colonnes)
      const templateData: any = {
        coach_id: user.id,
        titre: templateName.trim(),
        description: seanceForm.description || null,
        duree_estimee: calculateDuration(),
        nombre_passages: seanceForm.nombre_passages || 1
      };

      // Ajouter les champs optionnels seulement s'ils ont une valeur
      if (templateType) templateData.type_seance = templateType;
      if (templateZone) templateData.zone_musculaire = templateZone;
      if (templateNiveau) templateData.niveau = templateNiveau;

      const { data: template, error } = await supabase
        .from('templates_seances')
        .insert(templateData)
        .select()
        .single();

      if (error) throw error;

      // Ajouter les exercices
      if (seanceForm.exercices.length > 0) {
        const exercicesToInsert = seanceForm.exercices.map((ex, index) => ({
          template_id: template.id,
          exercice_id: ex.exercice_id,
          ordre: index,
          groupe_circuit: ex.groupe_circuit,
          series: ex.series,
          repetitions: ex.repetitions,
          charge_prescrite: ex.charge_prescrite,
          temps_repos: ex.temps_repos,
          temps_serie: ex.temps_serie,
          tempo: ex.tempo,
          notes_coach: ex.notes_coach
        }));

        const { error: exError } = await supabase
          .from('templates_seances_exercices')
          .insert(exercicesToInsert);

        if (exError) throw exError;
      }

      // Reset des champs du modal
      setTemplateName('');
      setTemplateType('');
      setTemplateZone('');
      setTemplateNiveau('');

      showNotification('success', 'Séance sauvegardée dans votre banque !');

    } catch (error) {
      console.error('Erreur sauvegarde template:', error);
      showNotification('error', 'Erreur lors de la sauvegarde du template');
    } finally {
      setSaving(false);
    }
  };

  // Toggle expand exercice
  const toggleExpandExercice = (id: string) => {
    setExpandedExercices(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Grouper les exercices par circuit
  const getCircuitGroups = () => {
    const groups: { [key: number]: ExerciceSeance[] } = {};
    seanceForm.exercices.forEach(ex => {
      if (ex.groupe_circuit !== null) {
        if (!groups[ex.groupe_circuit]) groups[ex.groupe_circuit] = [];
        groups[ex.groupe_circuit].push(ex);
      }
    });
    return groups;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/coach/seances')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {seanceIdParam ? 'Modifier la séance' : 'Nouvelle séance'}
            </h1>
            <p className="text-slate-500 text-sm">
              {seanceForm.exercices.length} exercice{seanceForm.exercices.length > 1 ? 's' : ''} • 
              ~{calculateDuration()} min estimées
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openTemplateModal}
            disabled={saving || seanceForm.exercices.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            Sauver en template
          </button>
          {/* Bouton Sauvegarder dans la banque */}
          <button
            onClick={openSaveAsTemplateModal}
            disabled={saving || seanceForm.exercices.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-medium hover:from-purple-600 hover:to-purple-700 transition-all disabled:opacity-50"
            title="Sauvegarder dans votre banque de séances"
          >
            <FileText className="w-4 h-4" />
            Dans ma banque
          </button>

          {/* Bouton Enregistrer séance planifiée */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {seanceIdParam ? 'Mettre à jour' : 'Planifier'}
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Panel principal - Séance */}
        <div className="flex-1 space-y-6">
          {/* Infos de base */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Titre */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Titre de la séance *</label>
                <input
                  type="text"
                  value={seanceForm.titre}
                  onChange={(e) => setSeanceForm(prev => ({ ...prev, titre: e.target.value }))}
                  placeholder="Ex: Séance Pectoraux - Niveau Intermédiaire"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Adhérent */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Users className="w-4 h-4 inline mr-1" />
                  Adhérent
                </label>
                <select
                  value={seanceForm.adherent_id || ''}
                  onChange={(e) => setSeanceForm(prev => ({ ...prev, adherent_id: e.target.value || null }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Aucun adhérent --</option>
                  {adherents.map(adh => (
                    <option key={adh.id} value={adh.id}>
                      {adh.prenom} {adh.nom}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date
                </label>
                <input
                  type="date"
                  value={seanceForm.date_seance}
                  onChange={(e) => setSeanceForm(prev => ({ ...prev, date_seance: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Durée - calculée automatiquement */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Durée estimée
                </label>
                <div className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-medium">
                  ~{calculateDuration()} min
                </div>
              </div>

              {/* Mode de séance */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Mode de séance *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSeanceForm(prev => ({ ...prev, mode_seance: 'presentiel' }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      seanceForm.mode_seance === 'presentiel'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-slate-800 flex items-center gap-2">
                      🏋️ Présentiel
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Vous êtes avec l'adhérent. Il ne verra la séance qu'après.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeanceForm(prev => ({ ...prev, mode_seance: 'distanciel' }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      seanceForm.mode_seance === 'distanciel'
                        ? 'border-green-500 bg-green-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-slate-800 flex items-center gap-2">
                      🏠 Distanciel
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      L'adhérent fait seul. Il voit la séance à l'avance.
                    </p>
                  </button>
                </div>
              </div>
            </div>

            {/* Temps de repos global */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <label className="block text-sm font-medium text-blue-800 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Temps de repos entre les séries (secondes)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={seanceForm.exercices.length > 0 ? seanceForm.exercices[0].temps_repos : ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  const numVal = val === '' ? 0 : parseInt(val);
                  setSeanceForm(prev => ({
                    ...prev,
                    exercices: prev.exercices.map(ex => ({ ...ex, temps_repos: numVal }))
                  }));
                }}
                placeholder="90"
                className="w-32 px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
              />
              <span className="ml-2 text-sm text-blue-600">Appliqué à tous les exercices</span>
            </div>

            {/* Description / Notes coach */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                <FileText className="w-4 h-4 inline mr-1" />
                Instructions générales
              </label>
              <textarea
                value={seanceForm.description}
                onChange={(e) => setSeanceForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Instructions générales pour la séance (échauffement, objectifs, conseils...)"
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Liste des exercices */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-blue-600" />
                  Exercices de la séance
                  <span className="text-sm font-normal text-slate-500">
                    ({seanceForm.exercices.length})
                  </span>
                </h2>
                
                {/* Nombre de passages du circuit */}
                {seanceForm.exercices.length > 0 && (
                  <div className="flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-lg border border-purple-200">
                    <Repeat className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-purple-700">Passages :</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={seanceForm.nombre_passages === 0 ? '' : seanceForm.nombre_passages}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setSeanceForm(prev => ({ ...prev, nombre_passages: val === '' ? 0 : parseInt(val) }));
                      }}
                      onBlur={(e) => {
                        // Si vide ou 0 au blur, remettre 1 par défaut
                        if (!seanceForm.nombre_passages || seanceForm.nombre_passages === 0) {
                          setSeanceForm(prev => ({ ...prev, nombre_passages: 1 }));
                        }
                      }}
                      placeholder="1"
                      className="w-12 px-2 py-1 border border-purple-300 rounded text-center text-sm font-medium"
                    />
                    <span className="text-xs text-purple-500">× le circuit</span>
                  </div>
                )}
              </div>
            </div>

            {seanceForm.exercices.length === 0 ? (
              <div className="p-12 text-center">
                <Dumbbell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-600 mb-2">Aucun exercice</h3>
                <p className="text-slate-500 mb-4">
                  Glissez des exercices depuis le panel de droite ou cliquez sur "+" pour en ajouter
                </p>
                <button
                  onClick={() => setShowExercicesPanel(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter des exercices
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {seanceForm.exercices.map((exercice, index) => {
                  const isExpanded = expandedExercices.has(exercice.id);
                  const circuitGroups = getCircuitGroups();
                  const isInCircuit = exercice.groupe_circuit !== null;
                  const circuitColor = isInCircuit 
                    ? ['bg-purple-100 border-purple-300', 'bg-orange-100 border-orange-300', 'bg-green-100 border-green-300', 'bg-pink-100 border-pink-300'][exercice.groupe_circuit! % 4]
                    : '';
                  const isDragging = draggedIndex === index;
                  const isDragOver = dragOverIndex === index;

                  return (
                    <div 
                      key={exercice.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedIndex(index);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
                          moveExercice(draggedIndex, dragOverIndex);
                        }
                        setDraggedIndex(null);
                        setDragOverIndex(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedIndex !== null && draggedIndex !== index) {
                          setDragOverIndex(index);
                        }
                      }}
                      onDragLeave={() => {
                        setDragOverIndex(null);
                      }}
                      className={`p-4 transition-all ${isInCircuit ? circuitColor + ' border-l-4' : ''} ${
                        isDragging ? 'opacity-50 bg-blue-50' : 'hover:bg-slate-50'
                      } ${isDragOver ? 'border-t-2 border-blue-500' : ''}`}
                    >
                      {/* Ligne principale - cliquable pour déplier */}
                      <div className="flex items-center gap-3">
                        {/* Handle drag */}
                        <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600">
                          <GripVertical className="w-5 h-5" />
                        </div>

                        {/* Zone cliquable principale */}
                        <div 
                          className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
                          onClick={() => toggleExpandExercice(exercice.id)}
                        >
                          {/* Numéro */}
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                            {index + 1}
                          </div>

                          {/* GIF miniature - plus grand pour meilleure visibilité */}
                          <div className="w-24 h-24 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 shadow-sm">
                            <img 
                              src={exercice.exercice.gif_url} 
                              alt={exercice.exercice.nom_fr}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          {/* Infos */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-800 truncate">
                              {exercice.exercice.nom_fr}
                            </h4>
                            <p className="text-sm text-slate-500">
                              {exercice.series}×{exercice.repetitions} 
                              {exercice.charge_prescrite && ` @ ${exercice.charge_prescrite}kg`}
                              {' • '}{exercice.temps_serie}s/série
                            </p>
                            {exercice.notes_coach && (
                              <p className="text-xs text-blue-600 mt-1 truncate">
                                📝 {exercice.notes_coach}
                              </p>
                            )}
                          </div>

                          {/* Indicateur expand/collapse */}
                          <div className="text-slate-400">
                            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                          </div>
                        </div>

                        {/* Actions - ne pas propager le click */}
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          {/* Toggle circuit */}
                          <button
                            onClick={() => groupWithPrevious(exercice.id)}
                            disabled={index === 0}
                            className={`p-2 rounded-lg transition-colors ${
                              isInCircuit 
                                ? 'bg-purple-100 text-purple-600' 
                                : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                            } disabled:opacity-30`}
                            title="Grouper avec précédent (super-set)"
                          >
                            <Link2 className="w-4 h-4" />
                          </button>

                          {/* Dupliquer */}
                          <button
                            onClick={() => duplicateExercice(exercice)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                            title="Dupliquer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          {/* Supprimer */}
                          <button
                            onClick={() => removeExercice(exercice.id)}
                            className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Paramètres détaillés */}
                      {isExpanded && (
                        <div className="mt-4 ml-11 pl-4 border-l-2 border-slate-200">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Séries</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={exercice.series || ''}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  updateExercice(exercice.id, { series: val === '' ? 0 : parseInt(val) });
                                }}
                                placeholder="3"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-center"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Répétitions</label>
                              <input
                                type="text"
                                value={exercice.repetitions}
                                onChange={(e) => updateExercice(exercice.id, { repetitions: e.target.value })}
                                placeholder="12, 8-12, max..."
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-center"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Charge (kg)</label>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={exercice.charge_prescrite || ''}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
                                  updateExercice(exercice.id, { charge_prescrite: val ? parseFloat(val) : null });
                                }}
                                placeholder="Optionnel"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-center"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Durée série (sec)</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={exercice.temps_serie || ''}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  updateExercice(exercice.id, { temps_serie: val === '' ? 0 : parseInt(val) });
                                }}
                                placeholder="45"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-center"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Tempo (optionnel)
                                <span className="text-slate-400 ml-1" title="Excentrique-Pause-Concentrique-Pause">?</span>
                              </label>
                              <input
                                type="text"
                                value={exercice.tempo || ''}
                                onChange={(e) => updateExercice(exercice.id, { tempo: e.target.value || null })}
                                placeholder="Ex: 3-1-2-0"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Notes pour cet exercice
                              </label>
                              <input
                                type="text"
                                value={exercice.notes_coach || ''}
                                onChange={(e) => updateExercice(exercice.id, { notes_coach: e.target.value || null })}
                                placeholder="Instructions spécifiques..."
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Panel latéral - Exercices disponibles */}
        {showExercicesPanel && (
          <div className="w-[480px] flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 sticky top-4 max-h-[calc(100vh-120px)] flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800">Exercices</h3>
                  <button
                    onClick={() => setShowExercicesPanel(false)}
                    className="p-1 hover:bg-slate-100 rounded"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {/* Recherche */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>

                {/* Filtres */}
                <div className="flex gap-2">
                  <select
                    value={selectedCategorie}
                    onChange={(e) => setSelectedCategorie(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="all">Toutes catégories</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.emoji} {cat.nom_fr}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowFavorisOnly(!showFavorisOnly)}
                    className={`p-2 rounded-lg border transition-colors ${
                      showFavorisOnly 
                        ? 'bg-yellow-50 border-yellow-300 text-yellow-600' 
                        : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${showFavorisOnly ? 'fill-yellow-500' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Liste des exercices */}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-2 gap-3">
                  {filteredExercices.slice(0, 100).map(exercice => (
                    <button
                      key={exercice.id}
                      onClick={() => addExerciceToSeance(exercice)}
                      className="flex flex-col rounded-xl hover:bg-blue-50 border-2 border-slate-100 hover:border-blue-300 transition-all text-left group overflow-hidden"
                    >
                      {/* GIF grand format */}
                      <div className="w-full aspect-square bg-slate-100 relative">
                        <img 
                          src={exercice.gif_url} 
                          alt={exercice.nom_fr}
                          className="w-full h-full object-cover"
                        />
                        {/* Bouton + overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg">
                            <Plus className="w-6 h-6" />
                          </div>
                        </div>
                      </div>
                      {/* Infos */}
                      <div className="p-2">
                        <h4 className="font-medium text-slate-800 text-xs group-hover:text-blue-700 line-clamp-2 leading-tight">
                          {exercice.nom_fr}
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {exercice.categorie?.emoji} {exercice.categorie?.nom_fr}
                        </p>
                      </div>
                    </button>
                  ))}

                </div>

                {filteredExercices.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aucun exercice trouvé</p>
                  </div>
                )}

                {filteredExercices.length > 100 && (
                  <p className="text-center text-xs text-slate-400 py-2">
                    + {filteredExercices.length - 100} autres exercices (utilisez la recherche)
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bouton pour rouvrir le panel */}
        {!showExercicesPanel && (
          <button
            onClick={() => setShowExercicesPanel(true)}
            className="fixed right-4 bottom-4 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Modal Sauvegarder comme Template */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Sauvegarder dans ma banque
              </h3>
              <p className="text-blue-100 text-sm mt-1">
                Cette séance sera ajoutée à votre banque de séances
              </p>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Nom */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nom de la séance *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Ex: Circuit Full Body Débutant"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              {/* Type et Zone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Type de séance
                  </label>
                  <select
                    value={templateType}
                    onChange={(e) => setTemplateType(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Non défini</option>
                    {TYPES_SEANCE.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Zone musculaire
                  </label>
                  <select
                    value={templateZone}
                    onChange={(e) => setTemplateZone(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Non défini</option>
                    {ZONES_MUSCULAIRES.map(zone => (
                      <option key={zone.value} value={zone.value}>{zone.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Niveau */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Niveau
                </label>
                <div className="flex gap-2">
                  {NIVEAUX.map(niveau => (
                    <button
                      key={niveau.value}
                      type="button"
                      onClick={() => setTemplateNiveau(templateNiveau === niveau.value ? '' : niveau.value)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        templateNiveau === niveau.value
                          ? niveau.value === 'debutant' ? 'bg-green-100 text-green-700 ring-2 ring-green-500'
                          : niveau.value === 'intermediaire' ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-500'
                          : 'bg-red-100 text-red-700 ring-2 ring-red-500'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {niveau.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Résumé */}
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-600">
                  <span className="font-medium">{seanceForm.exercices.length}</span> exercice{seanceForm.exercices.length > 1 ? 's' : ''} • 
                  <span className="font-medium ml-1">~{calculateDuration()} min</span>
                  {seanceForm.nombre_passages > 1 && (
                    <span className="ml-1">• <span className="font-medium">{seanceForm.nombre_passages}</span> passages</span>
                  )}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setTemplateName('');
                  setTemplateType('');
                  setTemplateZone('');
                  setTemplateNiveau('');
                }}
                className="px-5 py-2.5 text-slate-700 hover:bg-slate-200 rounded-xl transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveAsTemplate}
                disabled={!templateName.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg ${
            notification.type === 'success' ? 'bg-green-600 text-white' :
            notification.type === 'error' ? 'bg-red-600 text-white' :
            'bg-blue-600 text-white'
          }`}>
            {notification.type === 'success' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {notification.type === 'error' && (
              <AlertCircle className="w-5 h-5" />
            )}
            {notification.type === 'info' && (
              <Info className="w-5 h-5" />
            )}
            <span className="font-medium">{notification.message}</span>
            <button 
              onClick={() => setNotification(null)}
              className="ml-2 hover:opacity-75"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

