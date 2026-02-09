import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Dumbbell, 
  User, 
  CheckCircle2,
  RefreshCw,
  MessageSquare,
  Star,
  Play,
  X,
  ChevronDown,
  ChevronUp,
  Timer,
  Edit2,
  Save,
  Check
} from 'lucide-react';

interface Exercice {
  id: string;
  ordre: number;
  series: number;
  repetitions: number;
  temps_repos: number;
  temps_serie?: number;
  charge_prescrite?: number;
  notes_coach?: string;
  groupe_circuit?: string;
  // Valeurs réalisées
  charge_realisee?: number;
  repetitions_realisees?: string;
  series_realisees?: number;
  notes_adherent?: string;
  exercice: {
    id: string;
    nom_fr: string;
    nom_en?: string;
    gif_url?: string;
    categorie?: {
      nom: string;
    };
  };
}

interface Seance {
  id: string;
  titre: string;
  description?: string;
  date_seance: string;
  duree_estimee: number;
  statut: 'planifie' | 'en_cours' | 'termine' | 'annule';
  notes_coach?: string;
  nombre_passages: number;
  temps_repos_global: number;
  type_seance?: string;
  zone_musculaire?: string;
  niveau?: string;
  date_completion?: string;
  note_adherent?: string;
  difficulte_percue?: number;
  note_ressenti?: number;
  mode_seance?: 'presentiel' | 'distanciel';
  coach_id: string;
  coach?: {
    prenom: string;
    nom: string;
  };
}

export default function SeanceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [seance, setSeance] = useState<Seance | null>(null);
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedExercice, setExpandedExercice] = useState<string | null>(null);
  const [zoomedGif, setZoomedGif] = useState<string | null>(null);
  
  // Feedback form
  const [commentaire, setCommentaire] = useState('');
  const [noteRessenti, setNoteRessenti] = useState(0);
  const [noteDifficulte, setNoteDifficulte] = useState(5);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  
  // Édition des valeurs réalisées (distanciel)
  const [editingExercice, setEditingExercice] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    charge_realisee: string;
    repetitions_realisees: string;
    series_realisees: string;
    notes_adherent: string;
  }>({ charge_realisee: '', repetitions_realisees: '', series_realisees: '', notes_adherent: '' });

  useEffect(() => {
    if (user && id) {
      loadSeance();
    }
  }, [user, id]);

  const loadSeance = async () => {
    if (!user || !id) return;
    setLoading(true);

    try {
      // Charger la séance
      const { data: seanceData, error: seanceError } = await supabase
        .from('seances')
        .select('*')
        .eq('id', id)
        .eq('adherent_id', user.id)
        .single();

      if (seanceError) throw seanceError;

      // Charger les infos du coach
      if (seanceData.coach_id) {
        const { data: coachData } = await supabase
          .from('coaches')
          .select('prenom, nom')
          .eq('id', seanceData.coach_id)
          .single();

        seanceData.coach = coachData || null;
      }

      setSeance({
        ...seanceData,
        statut: seanceData.statut || 'planifie'
      });
      setCommentaire(seanceData.note_adherent || '');
      setNoteRessenti(seanceData.note_ressenti || 0);
      setNoteDifficulte(seanceData.difficulte_percue || 5);

      // Charger les exercices de la séance
      const { data: seanceExercicesData, error: exercicesError } = await supabase
        .from('seances_exercices')
        .select('*')
        .eq('seance_id', id)
        .order('ordre');

      if (exercicesError) throw exercicesError;

      // Charger les détails des exercices séparément
      if (seanceExercicesData && seanceExercicesData.length > 0) {
        const exerciceIds = seanceExercicesData.map(se => se.exercice_id);
        
        const { data: exercicesDetails } = await supabase
          .from('exercices')
          .select('id, nom_fr, nom_en, gif_url, categorie_id')
          .in('id', exerciceIds);

        // Charger les catégories
        const categorieIds = [...new Set((exercicesDetails || []).map(e => e.categorie_id).filter(Boolean))];
        let categoriesMap: Record<string, { nom: string }> = {};
        
        if (categorieIds.length > 0) {
          const { data: categories } = await supabase
            .from('categories_exercices')
            .select('id, nom')
            .in('id', categorieIds);
          
          if (categories) {
            categories.forEach(c => {
              categoriesMap[c.id] = { nom: c.nom };
            });
          }
        }

        // Créer un map des exercices
        const exercicesMap: Record<string, any> = {};
        if (exercicesDetails) {
          exercicesDetails.forEach(ex => {
            exercicesMap[ex.id] = {
              ...ex,
              categorie: categoriesMap[ex.categorie_id] || null
            };
          });
        }

        // Combiner les données
        const enrichedExercices = seanceExercicesData.map(se => ({
          ...se,
          exercice: exercicesMap[se.exercice_id] || { id: se.exercice_id, nom_fr: 'Exercice inconnu' }
        }));

        setExercices(enrichedExercices);
      } else {
        setExercices([]);
      }

    } catch (error) {
      console.error('Erreur chargement séance:', error);
      navigate('/adherent/seances');
    } finally {
      setLoading(false);
    }
  };

  const markAsCompleted = async () => {
    if (!seance || !user) return;
    
    if (noteRessenti === 0) {
      setShowFeedbackForm(true);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('seances')
        .update({
          statut: 'termine',
          date_completion: new Date().toISOString(),
          note_adherent: commentaire || null,
          note_ressenti: noteRessenti,
          difficulte_percue: noteDifficulte
        })
        .eq('id', seance.id)
        .eq('adherent_id', user.id);

      if (error) throw error;

      // Rediriger vers le dashboard après succès
      navigate('/adherent/dashboard');
    } catch (error) {
      console.error('Erreur:', error);
      setSaving(false);
    }
  };

  const saveFeedback = async () => {
    if (!seance || !user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('seances')
        .update({
          note_adherent: commentaire || null,
          note_ressenti: noteRessenti || null,
          difficulte_percue: noteDifficulte || null
        })
        .eq('id', seance.id)
        .eq('adherent_id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setSaving(false);
    }
  };

  // Ouvrir l'édition d'un exercice
  const openEditExercice = (ex: Exercice) => {
    setEditingExercice(ex.id);
    setEditValues({
      charge_realisee: ex.charge_realisee?.toString() || ex.charge_prescrite?.toString() || '',
      repetitions_realisees: ex.repetitions_realisees || ex.repetitions?.toString() || '',
      series_realisees: ex.series_realisees?.toString() || ex.series?.toString() || '',
      notes_adherent: ex.notes_adherent || ''
    });
  };

  // Sauvegarder les valeurs réalisées d'un exercice
  const saveExerciceValues = async (exerciceId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('seances_exercices')
        .update({
          charge_realisee: editValues.charge_realisee ? parseFloat(editValues.charge_realisee) : null,
          repetitions_realisees: editValues.repetitions_realisees || null,
          series_realisees: editValues.series_realisees ? parseInt(editValues.series_realisees) : null,
          notes_adherent: editValues.notes_adherent || null
        })
        .eq('id', exerciceId);

      if (error) throw error;

      // Mettre à jour localement
      setExercices(prev => prev.map(ex => 
        ex.id === exerciceId 
          ? {
              ...ex,
              charge_realisee: editValues.charge_realisee ? parseFloat(editValues.charge_realisee) : undefined,
              repetitions_realisees: editValues.repetitions_realisees || undefined,
              series_realisees: editValues.series_realisees ? parseInt(editValues.series_realisees) : undefined,
              notes_adherent: editValues.notes_adherent || undefined
            }
          : ex
      ));

      setEditingExercice(null);
    } catch (error) {
      console.error('Erreur sauvegarde exercice:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getTypeLabel = (type?: string) => {
    const types: Record<string, string> = {
      'force': '💪 Force',
      'cardio': '🏃 Cardio',
      'hiit': '⚡ HIIT',
      'mobilite': '🧘 Mobilité',
      'stretching': '🤸 Stretching',
      'circuit': '🔄 Circuit'
    };
    return types[type || ''] || type || '';
  };

  const getZoneLabel = (zone?: string) => {
    const zones: Record<string, string> = {
      'full_body': 'Full Body',
      'haut_corps': 'Haut du corps',
      'bas_corps': 'Bas du corps',
      'core': 'Core',
      'bras': 'Bras',
      'jambes': 'Jambes',
      'dos': 'Dos',
      'pectoraux': 'Pectoraux'
    };
    return zones[zone || ''] || zone || '';
  };

  const getNiveauLabel = (niveau?: string) => {
    const niveaux: Record<string, string> = {
      'debutant': '🟢 Débutant',
      'intermediaire': '🟡 Intermédiaire',
      'avance': '🔴 Avancé'
    };
    return niveaux[niveau || ''] || niveau || '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-rose-600 animate-spin" />
      </div>
    );
  }

  if (!seance) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Séance introuvable</p>
        <Link to="/adherent/seances" className="text-rose-600 hover:underline mt-2 inline-block">
          Retour à mes séances
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-1 sm:px-0">
      {/* Header avec retour */}
      <div className="mb-4 sm:mb-6">
        <Link 
          to="/adherent/seances"
          className="inline-flex items-center gap-1.5 sm:gap-2 text-slate-600 hover:text-rose-600 transition-colors mb-3 sm:mb-4 text-sm sm:text-base"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="sm:hidden">Retour</span>
          <span className="hidden sm:inline">Retour à mes séances</span>
        </Link>

        {/* Titre et statut */}
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-slate-800 mb-2">
            {seance.titre}
          </h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
            <span className="flex items-center gap-1 text-rose-600 font-medium capitalize">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {formatDate(seance.date_seance)}
            </span>
            {seance.statut === 'termine' ? (
              <span className="bg-green-100 text-green-700 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Terminée
              </span>
            ) : (
              <span className="bg-blue-100 text-blue-700 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                Planifiée
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Infos principales */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-4">
          <div className="text-center p-2 sm:p-3 bg-slate-50 rounded-lg">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 mx-auto mb-0.5 sm:mb-1" />
            <p className="text-lg sm:text-2xl font-bold text-slate-800">{seance.duree_estimee}</p>
            <p className="text-[10px] sm:text-xs text-slate-500">min</p>
          </div>
          <div className="text-center p-2 sm:p-3 bg-slate-50 rounded-lg">
            <Dumbbell className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 mx-auto mb-0.5 sm:mb-1" />
            <p className="text-lg sm:text-2xl font-bold text-slate-800">{exercices.length}</p>
            <p className="text-[10px] sm:text-xs text-slate-500">exos</p>
          </div>
          <div className="text-center p-2 sm:p-3 bg-slate-50 rounded-lg">
            <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 mx-auto mb-0.5 sm:mb-1" />
            <p className="text-lg sm:text-2xl font-bold text-slate-800">{seance.nombre_passages || 1}</p>
            <p className="text-[10px] sm:text-xs text-slate-500">tour{(seance.nombre_passages || 1) > 1 ? 's' : ''}</p>
          </div>
          <div className="text-center p-2 sm:p-3 bg-slate-50 rounded-lg">
            <Timer className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 mx-auto mb-0.5 sm:mb-1" />
            <p className="text-lg sm:text-2xl font-bold text-slate-800">{seance.temps_repos_global || 90}</p>
            <p className="text-[10px] sm:text-xs text-slate-500">sec</p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
          {seance.type_seance && (
            <span className="bg-rose-50 text-rose-700 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium">
              {getTypeLabel(seance.type_seance)}
            </span>
          )}
          {seance.zone_musculaire && (
            <span className="bg-blue-50 text-blue-700 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium">
              {getZoneLabel(seance.zone_musculaire)}
            </span>
          )}
          {seance.niveau && (
            <span className="bg-purple-50 text-purple-700 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium">
              {getNiveauLabel(seance.niveau)}
            </span>
          )}
        </div>

        {/* Coach */}
        {seance.coach && (
          <div className="flex items-center gap-2 text-slate-600 mb-3 sm:mb-4 text-sm sm:text-base">
            <User className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Coach : <strong>{seance.coach.prenom}</strong></span>
          </div>
        )}

        {/* Notes du coach */}
        {seance.notes_coach && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-medium text-amber-800 mb-1 flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Notes du coach
            </p>
            <p className="text-amber-700 text-sm sm:text-base">{seance.notes_coach}</p>
          </div>
        )}
      </div>

      {/* Liste des exercices */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4 sm:mb-6">
        <div className="bg-gradient-to-r from-rose-500 to-pink-600 px-4 sm:px-6 py-3 sm:py-4">
          <h2 className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
            <Dumbbell className="w-5 h-5 sm:w-6 sm:h-6" />
            Programme ({exercices.length} exercices)
            {seance.mode_seance === 'presentiel' && seance.statut !== 'termine' && (
              <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded-full">
                🏋️ Présentiel
              </span>
            )}
            {seance.mode_seance === 'distanciel' && (
              <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded-full">
                🏠 Distanciel
              </span>
            )}
          </h2>
        </div>

        {/* Message si présentiel et pas terminé - masquer les exercices */}
        {seance.mode_seance === 'presentiel' && seance.statut !== 'termine' ? (
          <div className="p-8 text-center">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 max-w-md mx-auto">
              <div className="text-4xl mb-4">🏋️</div>
              <h3 className="text-lg font-semibold text-blue-800 mb-2">
                Séance en présentiel
              </h3>
              <p className="text-blue-700 text-sm">
                Votre coach vous guidera pendant cette séance. 
                Les exercices seront visibles une fois la séance terminée.
              </p>
            </div>
          </div>
        ) : (
        <div className="divide-y divide-slate-100">
          {exercices.map((ex, index) => (
            <div 
              key={ex.id}
              className="p-3 sm:p-4 hover:bg-slate-50 transition-colors active:bg-slate-100"
            >
              <div 
                className="flex items-start gap-2 sm:gap-4 cursor-pointer"
                onClick={() => setExpandedExercice(expandedExercice === ex.id ? null : ex.id)}
              >
                {/* Numéro */}
                <div className="bg-rose-100 text-rose-600 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 text-sm sm:text-base">
                  {index + 1}
                </div>

                {/* GIF Aperçu - Plus grand sur mobile pour mieux voir */}
                <div 
                  className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (ex.exercice.gif_url) setZoomedGif(ex.exercice.gif_url);
                  }}
                >
                  {ex.exercice.gif_url ? (
                    <img 
                      src={ex.exercice.gif_url} 
                      alt={ex.exercice.nom_fr}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Dumbbell className="w-6 h-6 sm:w-8 sm:h-8 text-slate-300" />
                    </div>
                  )}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 text-sm sm:text-lg leading-tight">
                    {ex.exercice.nom_fr}
                  </h3>
                  {ex.exercice.categorie?.nom && (
                    <p className="text-xs sm:text-sm text-slate-500 truncate">{ex.exercice.categorie.nom}</p>
                  )}
                  {/* Badges compacts sur mobile */}
                  <div className="flex flex-wrap gap-1 sm:gap-2 mt-1.5 sm:mt-2">
                    {/* Valeurs prescrites */}
                    <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs sm:text-sm font-medium ${
                      ex.series_realisees || ex.repetitions_realisees 
                        ? 'bg-slate-100 text-slate-500 line-through' 
                        : 'bg-blue-50 text-blue-700'
                    }`}>
                      {ex.series}×{ex.repetitions}
                    </span>
                    {ex.temps_repos > 0 && (
                      <span className="bg-orange-50 text-orange-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs sm:text-sm font-medium">
                        {ex.temps_repos}s
                      </span>
                    )}
                    {ex.charge_prescrite && (
                      <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs sm:text-sm font-medium ${
                        ex.charge_realisee 
                          ? 'bg-slate-100 text-slate-500 line-through' 
                          : 'bg-purple-50 text-purple-700'
                      }`}>
                        {ex.charge_prescrite}kg
                      </span>
                    )}
                    
                    {/* Valeurs réalisées (si différentes) */}
                    {(ex.series_realisees || ex.repetitions_realisees) && (
                      <span className="bg-green-100 text-green-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs sm:text-sm font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        {ex.series_realisees || ex.series}×{ex.repetitions_realisees || ex.repetitions}
                      </span>
                    )}
                    {ex.charge_realisee && (
                      <span className="bg-green-100 text-green-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs sm:text-sm font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        {ex.charge_realisee}kg
                      </span>
                    )}
                  </div>
                  
                  {/* Bouton modifier (distanciel uniquement, séance non terminée) */}
                  {seance.mode_seance === 'distanciel' && seance.statut !== 'termine' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditExercice(ex);
                      }}
                      className="mt-2 text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Modifier les valeurs réalisées
                    </button>
                  )}
                </div>

                {/* Expand icon */}
                <div className="flex-shrink-0 ml-1">
                  {expandedExercice === ex.id ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Expanded content - Pleine largeur sur mobile */}
              {expandedExercice === ex.id && (
                <div className="mt-3 sm:mt-4 sm:ml-14 space-y-3 sm:space-y-4">
                  {/* GIF en grand - Pleine largeur sur mobile */}
                  {ex.exercice.gif_url && (
                    <div 
                      className="bg-slate-900 rounded-xl overflow-hidden cursor-pointer"
                      onClick={() => setZoomedGif(ex.exercice.gif_url!)}
                    >
                      <img 
                        src={ex.exercice.gif_url} 
                        alt={ex.exercice.nom_fr}
                        className="w-full h-auto max-h-[50vh] object-contain"
                      />
                    </div>
                  )}

                  {/* Notes du coach pour cet exercice */}
                  {ex.notes_coach && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs sm:text-sm font-medium text-amber-800 mb-1">💡 Conseil du coach</p>
                      <p className="text-amber-700 text-xs sm:text-sm">{ex.notes_coach}</p>
                    </div>
                  )}

                  {/* Détails supplémentaires */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                    {ex.temps_serie && (
                      <div className="bg-slate-50 p-2 sm:p-3 rounded-lg">
                        <p className="text-slate-500">Durée série</p>
                        <p className="font-bold text-slate-800">{ex.temps_serie}s</p>
                      </div>
                    )}
                    {ex.groupe_circuit && (
                      <div className="bg-slate-50 p-2 sm:p-3 rounded-lg">
                        <p className="text-slate-500">Circuit</p>
                        <p className="font-bold text-slate-800">{ex.groupe_circuit}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Section Feedback */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-3 sm:mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />
          {seance.statut === 'termine' ? 'Votre feedback' : 'Après la séance'}
        </h2>

        {seance.statut === 'termine' ? (
          <div className="space-y-3 sm:space-y-4">
            {/* Ressenti */}
            {seance.note_ressenti && (
              <div>
                <p className="text-xs sm:text-sm text-slate-500 mb-1">Votre ressenti</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star 
                      key={star} 
                      className={`w-5 h-5 sm:w-6 sm:h-6 ${star <= seance.note_ressenti! ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Difficulté */}
            {seance.difficulte_percue && (
              <div>
                <p className="text-xs sm:text-sm text-slate-500 mb-1">Difficulté : {seance.difficulte_percue}/10</p>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 h-2 rounded-full transition-all"
                    style={{ width: `${seance.difficulte_percue * 10}%` }}
                  />
                </div>
              </div>
            )}

            {/* Commentaire */}
            {seance.note_adherent && (
              <div>
                <p className="text-xs sm:text-sm text-slate-500 mb-1">Votre commentaire</p>
                <p className="text-slate-700 bg-slate-50 p-2 sm:p-3 rounded-lg text-sm sm:text-base">{seance.note_adherent}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            {/* Ressenti - Étoiles plus grandes et espacées sur mobile pour le touch */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Comment vous sentez-vous ?
              </label>
              <div className="flex justify-center gap-3 sm:gap-2 sm:justify-start">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setNoteRessenti(star)}
                    className="focus:outline-none transition-transform active:scale-95 p-1"
                  >
                    <Star 
                      className={`w-10 h-10 sm:w-10 sm:h-10 ${star <= noteRessenti ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulté - Slider plus grand sur mobile */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Difficulté : <span className="text-rose-600 font-bold">{noteDifficulte}/10</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={noteDifficulte}
                onChange={(e) => setNoteDifficulte(parseInt(e.target.value))}
                className="w-full h-3 sm:h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>😊 Facile</span>
                <span>🔥 Difficile</span>
              </div>
            </div>

            {/* Commentaire */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Un commentaire ? <span className="text-slate-400 font-normal">(optionnel)</span>
              </label>
              <textarea
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Super séance !"
                rows={2}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm sm:text-base"
              />
            </div>

            {/* Bouton terminer - Plus grand et sticky sur mobile */}
            <button
              onClick={markAsCompleted}
              disabled={saving || noteRessenti === 0}
              className={`w-full py-4 sm:py-4 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                noteRessenti > 0
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {saving ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                  Terminer la séance
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Modal zoom GIF */}
      {/* Modal d'édition des valeurs réalisées */}
      {editingExercice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-rose-500 to-pink-600 p-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Edit2 className="w-5 h-5" />
                  Valeurs réalisées
                </h3>
                <button
                  onClick={() => setEditingExercice(null)}
                  className="text-white/80 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Modifiez les valeurs que vous avez réellement effectuées
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Séries</label>
                  <input
                    type="number"
                    value={editValues.series_realisees}
                    onChange={(e) => setEditValues(prev => ({ ...prev, series_realisees: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                    placeholder="Ex: 3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Répétitions</label>
                  <input
                    type="text"
                    value={editValues.repetitions_realisees}
                    onChange={(e) => setEditValues(prev => ({ ...prev, repetitions_realisees: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                    placeholder="Ex: 12 ou 10-12"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Charge (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  value={editValues.charge_realisee}
                  onChange={(e) => setEditValues(prev => ({ ...prev, charge_realisee: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  placeholder="Ex: 20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optionnel)</label>
                <textarea
                  value={editValues.notes_adherent}
                  onChange={(e) => setEditValues(prev => ({ ...prev, notes_adherent: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  rows={2}
                  placeholder="Ex: Trop lourd, j'ai réduit à 15kg"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingExercice(null)}
                  className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  onClick={() => saveExerciceValues(editingExercice)}
                  className="flex-1 py-2 bg-rose-500 text-white rounded-lg font-medium hover:bg-rose-600 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {zoomedGif && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setZoomedGif(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-rose-400 transition-colors"
            onClick={() => setZoomedGif(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img 
            src={zoomedGif} 
            alt="Exercice" 
            className="max-w-full max-h-[90vh] rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

