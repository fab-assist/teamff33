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
  Star,
  MessageSquare,
  Edit2,
  Home,
  Video,
  AlertCircle
} from 'lucide-react';

interface ExerciceDetail {
  id: string;
  ordre: number;
  series: number;
  repetitions: string;
  charge_prescrite: number | null;
  temps_repos: number;
  notes_coach: string | null;
  // Valeurs réalisées
  series_realisees: number | null;
  repetitions_realisees: string | null;
  charge_realisee: number | null;
  notes_adherent: string | null;
  // Exercice info
  exercice: {
    id: string;
    nom_fr: string;
    gif_url: string | null;
  };
}

interface SeanceDetail {
  id: string;
  titre: string;
  description: string | null;
  date_seance: string;
  duree_estimee: number | null;
  statut: string;
  mode_seance: string;
  note_ressenti: number | null;
  difficulte_percue: number | null;
  note_adherent: string | null;
  date_completion: string | null;
  adherent: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
  } | null;
}

export default function SeanceDetailCoach() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [seance, setSeance] = useState<SeanceDetail | null>(null);
  const [exercices, setExercices] = useState<ExerciceDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      loadSeance();
    }
  }, [user, id]);

  const loadSeance = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // Charger la séance
      const { data: seanceData, error: seanceError } = await supabase
        .from('seances')
        .select(`
          id, titre, description, date_seance, duree_estimee, statut, mode_seance,
          note_ressenti, difficulte_percue, note_adherent, date_completion,
          adherent:adherents(id, prenom, nom, email)
        `)
        .eq('id', id)
        .single();

      if (seanceError) throw seanceError;
      setSeance(seanceData);

      // Charger les exercices
      const { data: exercicesData, error: exercicesError } = await supabase
        .from('seances_exercices')
        .select(`
          id, ordre, series, repetitions, charge_prescrite, temps_repos, notes_coach,
          series_realisees, repetitions_realisees, charge_realisee, notes_adherent,
          exercice:exercices(id, nom_fr, gif_url)
        `)
        .eq('seance_id', id)
        .order('ordre');

      if (exercicesError) throw exercicesError;
      setExercices(exercicesData || []);

    } catch (error) {
      console.error('Erreur chargement séance:', error);
      navigate('/coach/seances');
    } finally {
      setLoading(false);
    }
  };

  const hasModification = (ex: ExerciceDetail) => {
    return ex.series_realisees !== null || 
           ex.repetitions_realisees !== null || 
           ex.charge_realisee !== null ||
           ex.notes_adherent !== null;
  };

  const countModifications = () => {
    return exercices.filter(hasModification).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!seance) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Séance non trouvée</p>
        <Link to="/coach/seances" className="text-blue-600 hover:underline mt-2 block">
          Retour aux séances
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{seance.titre}</h1>
            {seance.adherent && (
              <p className="text-slate-600 mt-1">
                👤 {seance.adherent.prenom} {seance.adherent.nom}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {seance.mode_seance === 'distanciel' ? (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
                <Home className="w-4 h-4" />
                Distanciel
              </span>
            ) : (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-1">
                <Dumbbell className="w-4 h-4" />
                Présentiel
              </span>
            )}
            {seance.statut === 'termine' && (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Terminée
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Infos générales */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-slate-500">Date</p>
            <p className="font-medium text-slate-800 flex items-center gap-1">
              <Calendar className="w-4 h-4 text-slate-400" />
              {new Date(seance.date_seance).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Durée estimée</p>
            <p className="font-medium text-slate-800 flex items-center gap-1">
              <Clock className="w-4 h-4 text-slate-400" />
              {seance.duree_estimee || '-'} min
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Exercices</p>
            <p className="font-medium text-slate-800 flex items-center gap-1">
              <Dumbbell className="w-4 h-4 text-slate-400" />
              {exercices.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Modifications</p>
            <p className={`font-medium flex items-center gap-1 ${countModifications() > 0 ? 'text-orange-600' : 'text-slate-800'}`}>
              <Edit2 className="w-4 h-4" />
              {countModifications()}
            </p>
          </div>
        </div>

        {seance.description && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-600">{seance.description}</p>
          </div>
        )}
      </div>

      {/* Feedback adhérent */}
      {seance.statut === 'termine' && (seance.note_ressenti || seance.note_adherent) && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Feedback de l'adhérent
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {seance.note_ressenti && (
              <div>
                <p className="text-sm text-green-700 mb-1">Ressenti global</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star 
                      key={star} 
                      className={`w-6 h-6 ${star <= seance.note_ressenti! ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {seance.difficulte_percue && (
              <div>
                <p className="text-sm text-green-700 mb-1">Difficulté perçue</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 h-3 rounded-full"
                      style={{ width: `${seance.difficulte_percue * 10}%` }}
                    />
                  </div>
                  <span className="font-bold text-green-800">{seance.difficulte_percue}/10</span>
                </div>
              </div>
            )}
          </div>

          {seance.note_adherent && (
            <div className="mt-4 pt-4 border-t border-green-200">
              <p className="text-sm text-green-700 mb-1">Commentaire</p>
              <p className="text-green-800 italic bg-white/50 p-3 rounded-lg">
                "{seance.note_adherent}"
              </p>
            </div>
          )}

          {seance.date_completion && (
            <p className="text-xs text-green-600 mt-4">
              Terminée le {new Date(seance.date_completion).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
        </div>
      )}

      {/* Liste des exercices */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Dumbbell className="w-6 h-6" />
            Détail des exercices
          </h2>
        </div>

        <div className="divide-y divide-slate-100">
          {exercices.map((ex, index) => {
            const modified = hasModification(ex);
            
            return (
              <div 
                key={ex.id}
                className={`p-4 ${modified ? 'bg-orange-50' : ''}`}
              >
                <div className="flex items-start gap-4">
                  {/* Numéro */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                    modified ? 'bg-orange-200 text-orange-700' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {index + 1}
                  </div>

                  {/* GIF */}
                  <div className="w-20 h-20 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                    {ex.exercice.gif_url ? (
                      <img 
                        src={ex.exercice.gif_url} 
                        alt={ex.exercice.nom_fr}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Dumbbell className="w-8 h-8 text-slate-300" />
                      </div>
                    )}
                  </div>

                  {/* Infos */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800">{ex.exercice.nom_fr}</h3>
                      {modified && (
                        <span className="px-2 py-0.5 bg-orange-200 text-orange-700 rounded-full text-xs font-medium">
                          Modifié
                        </span>
                      )}
                    </div>

                    {/* Valeurs prescrites vs réalisées */}
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Séries */}
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-xs text-slate-500">Séries</p>
                        <div className="flex items-center gap-1">
                          {ex.series_realisees !== null && ex.series_realisees !== ex.series ? (
                            <>
                              <span className="text-red-500 line-through text-sm">{ex.series}</span>
                              <span className="text-green-600 font-bold">→ {ex.series_realisees}</span>
                            </>
                          ) : (
                            <span className="font-bold text-green-600">{ex.series_realisees ?? ex.series}</span>
                          )}
                        </div>
                      </div>

                      {/* Répétitions */}
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-xs text-slate-500">Répétitions</p>
                        <div className="flex items-center gap-1">
                          {ex.repetitions_realisees && ex.repetitions_realisees !== ex.repetitions ? (
                            <>
                              <span className="text-red-500 line-through text-sm">{ex.repetitions}</span>
                              <span className="text-green-600 font-bold">→ {ex.repetitions_realisees}</span>
                            </>
                          ) : (
                            <span className="font-bold text-green-600">{ex.repetitions_realisees || ex.repetitions}</span>
                          )}
                        </div>
                      </div>

                      {/* Charge */}
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-xs text-slate-500">Charge</p>
                        <div className="flex items-center gap-1">
                          {ex.charge_realisee !== null && ex.charge_realisee !== ex.charge_prescrite ? (
                            <>
                              <span className="text-red-500 line-through text-sm">{ex.charge_prescrite || '-'}kg</span>
                              <span className="text-green-600 font-bold">→ {ex.charge_realisee}kg</span>
                            </>
                          ) : (
                            <span className="font-bold text-green-600">{ex.charge_realisee ?? ex.charge_prescrite ?? '-'} kg</span>
                          )}
                        </div>
                      </div>

                      {/* Repos */}
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-xs text-slate-500">Repos</p>
                        <span className="font-bold text-green-600">{ex.temps_repos}s</span>
                      </div>
                    </div>

                    {/* Notes coach */}
                    {ex.notes_coach && (
                      <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs font-medium text-blue-700 mb-0.5">💡 Note du coach</p>
                        <p className="text-sm text-blue-800">{ex.notes_coach}</p>
                      </div>
                    )}

                    {/* Notes adhérent */}
                    {ex.notes_adherent && (
                      <div className="mt-2 p-2 bg-orange-100 border border-orange-200 rounded-lg">
                        <p className="text-xs font-medium text-orange-700 mb-0.5">📝 Remarque de l'adhérent</p>
                        <p className="text-sm text-orange-800 italic">"{ex.notes_adherent}"</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <Link
          to={`/coach/seances/builder?seance=${seance.id}`}
          className="flex-1 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors text-center flex items-center justify-center gap-2"
        >
          <Edit2 className="w-4 h-4" />
          Modifier cette séance
        </Link>
        {seance.adherent && (
          <Link
            to={`/coach/seances/builder?adherent=${seance.adherent.id}&from_seance=${seance.id}`}
            className="flex-1 py-3 border-2 border-blue-500 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors text-center"
          >
            Reprendre comme base
          </Link>
        )}
      </div>
    </div>
  );
}
