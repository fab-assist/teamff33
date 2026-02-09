import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  Dumbbell, 
  User, 
  CheckCircle2, 
  Circle,
  ChevronRight,
  Filter,
  Search,
  RefreshCw
} from 'lucide-react';

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
  coach?: {
    prenom: string;
    nom: string;
  };
  exercices_count?: number;
}

type TabType = 'upcoming' | 'completed' | 'all';

export default function MesSeances() {
  const { user } = useAuth();
  const [seances, setSeances] = useState<Seance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      loadSeances();
    }
  }, [user, activeTab]);

  const loadSeances = async () => {
    if (!user) return;
    setLoading(true);

    try {
      let query = supabase
        .from('seances')
        .select('*')
        .eq('adherent_id', user.id)
        .order('date_seance', { ascending: activeTab === 'upcoming' });

      // Filtrer par statut selon l'onglet
      if (activeTab === 'upcoming') {
        query = query.eq('statut', 'planifie');
      } else if (activeTab === 'completed') {
        query = query.eq('statut', 'termine');
      }

      const { data: seancesData, error } = await query;

      if (error) throw error;

      // Charger les infos des coachs séparément
      if (seancesData && seancesData.length > 0) {
        const coachIds = [...new Set(seancesData.map(s => s.coach_id).filter(Boolean))];
        
        let coachesMap: Record<string, { prenom: string; nom: string }> = {};
        if (coachIds.length > 0) {
          const { data: coachesData } = await supabase
            .from('coaches')
            .select('id, prenom, nom')
            .in('id', coachIds);
          
          if (coachesData) {
            coachesData.forEach(c => {
              coachesMap[c.id] = { prenom: c.prenom, nom: c.nom };
            });
          }
        }

        // Compter les exercices pour chaque séance
        const seanceIds = seancesData.map(s => s.id);
        const { data: exercicesCount } = await supabase
          .from('seances_exercices')
          .select('seance_id')
          .in('seance_id', seanceIds);

        const countMap: Record<string, number> = {};
        if (exercicesCount) {
          exercicesCount.forEach(e => {
            countMap[e.seance_id] = (countMap[e.seance_id] || 0) + 1;
          });
        }

        const enrichedSeances = seancesData.map(s => ({
          ...s,
          statut: s.statut || 'planifie',
          coach: coachesMap[s.coach_id] || null,
          exercices_count: countMap[s.id] || 0
        }));

        setSeances(enrichedSeances);
      } else {
        setSeances([]);
      }
    } catch (error) {
      console.error('Erreur chargement séances:', error);
      setSeances([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) {
      return "Aujourd'hui";
    } else if (isTomorrow) {
      return "Demain";
    } else {
      return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
    }
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

  const filteredSeances = seances.filter(s => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      s.titre.toLowerCase().includes(search) ||
      s.coach?.prenom?.toLowerCase().includes(search) ||
      s.coach?.nom?.toLowerCase().includes(search)
    );
  });

  const tabs = [
    { id: 'upcoming' as TabType, label: 'À venir', icon: Calendar },
    { id: 'completed' as TabType, label: 'Terminées', icon: CheckCircle2 },
    { id: 'all' as TabType, label: 'Toutes', icon: Dumbbell }
  ];

  return (
    <div className="max-w-4xl mx-auto px-1 sm:px-0">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-1 sm:mb-2 flex items-center gap-2 sm:gap-3">
          <Dumbbell className="w-6 h-6 sm:w-8 sm:h-8 text-rose-600" />
          Mes Séances
        </h1>
        <p className="text-sm sm:text-base text-slate-600">
          Vos séances planifiées par votre coach
        </p>
      </div>

      {/* Tabs - Plus compact sur mobile */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1.5 sm:p-2 mb-4 sm:mb-6">
        <div className="flex gap-1 sm:gap-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const count = tab.id === 'upcoming' 
              ? seances.filter(s => s.statut === 'planifie').length
              : tab.id === 'completed'
              ? seances.filter(s => s.statut === 'termine').length
              : seances.length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base ${
                  activeTab === tab.id
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden xs:inline sm:inline">{tab.label}</span>
                {activeTab === tab.id && count > 0 && (
                  <span className="bg-white/20 px-1.5 sm:px-2 py-0.5 rounded-full text-xs sm:text-sm">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 sm:mb-6">
        <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm sm:text-base"
        />
      </div>

      {/* Liste des séances */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-rose-600 animate-spin" />
        </div>
      ) : filteredSeances.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 sm:p-12 text-center">
          <div className="bg-slate-100 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Dumbbell className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" />
          </div>
          <h3 className="text-base sm:text-lg font-medium text-slate-800 mb-2">
            {activeTab === 'upcoming' 
              ? 'Aucune séance à venir'
              : activeTab === 'completed'
              ? 'Aucune séance terminée'
              : 'Aucune séance'}
          </h3>
          <p className="text-sm sm:text-base text-slate-500">
            {activeTab === 'upcoming'
              ? 'Votre coach planifiera bientôt vos prochaines séances'
              : 'Les séances apparaîtront ici'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {filteredSeances.map(seance => (
            <Link
              key={seance.id}
              to={`/adherent/seances/${seance.id}`}
              className="block bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 hover:shadow-md hover:border-rose-200 transition-all group active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {/* Date */}
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-rose-600 font-medium mb-1.5 sm:mb-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="capitalize">{formatDate(seance.date_seance)}</span>
                    </span>
                    {seance.statut === 'termine' && (
                      <span className="bg-green-100 text-green-700 px-1.5 sm:px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span className="hidden sm:inline">Terminée</span>
                        <span className="sm:hidden">✓</span>
                      </span>
                    )}
                  </div>

                  {/* Titre */}
                  <h3 className="text-base sm:text-xl font-bold text-slate-800 mb-1.5 sm:mb-2 group-hover:text-rose-600 transition-colors truncate">
                    {seance.titre}
                  </h3>

                  {/* Infos - Version mobile compacte */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {seance.duree_estimee}'
                    </span>
                    <span className="flex items-center gap-1">
                      <Dumbbell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {seance.exercices_count || 0} ex.
                    </span>
                    {seance.nombre_passages > 1 && (
                      <span className="flex items-center gap-1">
                        <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        {seance.nombre_passages}x
                      </span>
                    )}
                    {seance.coach && (
                      <span className="hidden sm:flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {seance.coach.prenom}
                      </span>
                    )}
                  </div>

                  {/* Tags - Masqués sur très petit mobile */}
                  {(seance.type_seance || seance.zone_musculaire) && (
                    <div className="hidden sm:flex flex-wrap gap-2 mt-2 sm:mt-3">
                      {seance.type_seance && (
                        <span className="bg-rose-50 text-rose-700 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium">
                          {getTypeLabel(seance.type_seance)}
                        </span>
                      )}
                      {seance.zone_musculaire && (
                        <span className="bg-blue-50 text-blue-700 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium">
                          {getZoneLabel(seance.zone_musculaire)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Note coach - Masquée sur mobile */}
                  {seance.notes_coach && (
                    <p className="hidden sm:block mt-3 text-sm text-slate-500 italic line-clamp-2">
                      📝 "{seance.notes_coach}"
                    </p>
                  )}

                  {/* Ressenti adhérent (si terminée) */}
                  {seance.statut === 'termine' && seance.note_ressenti && (
                    <div className="mt-2 sm:mt-3 flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <span key={star} className={`text-sm sm:text-base ${star <= seance.note_ressenti! ? 'text-yellow-400' : 'text-slate-200'}`}>
                          ★
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chevron */}
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-slate-300 group-hover:text-rose-500 transition-colors flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

