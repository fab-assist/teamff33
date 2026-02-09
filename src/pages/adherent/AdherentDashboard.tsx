import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, TrendingUp, Target, MessageCircle, User, Dumbbell, Clock, UsersRound, ChevronRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NotificationPrompt } from '../../components/NotificationPrompt';

interface AdherentData {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  date_naissance?: string;
  sexe?: string;
  type_adhesion: string;
  coach_id?: string;
  coach?: {
    prenom: string;
    nom: string;
  };
}

interface Seance {
  id: string;
  titre: string;
  date_seance: string;
  duree_estimee: number;
  statut: string;
  exercices_count?: number;
  coach?: {
    prenom: string;
    nom: string;
  };
}

export default function AdherentDashboard() {
  const { user } = useAuth();
  const [adherentData, setAdherentData] = useState<AdherentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upcomingSeances, setUpcomingSeances] = useState<Seance[]>([]);
  const [recentSeances, setRecentSeances] = useState<Seance[]>([]);
  const [seancesThisMonth, setSeancesThisMonth] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [firstUnreadGroupeId, setFirstUnreadGroupeId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadAdherentData();
      loadSeances();
      loadUnreadMessages();
    }
  }, [user]);

  const loadUnreadMessages = async () => {
    if (!user) return;
    try {
      let totalUnread = 0;
      let firstGroupId: string | null = null;

      // 1. Messages individuels avec le coach
      const { data: adherent } = await supabase
        .from('adherents')
        .select('coach_id')
        .eq('id', user.id)
        .single();

      if (adherent?.coach_id) {
        const { data: conversation } = await supabase
          .from('conversations')
          .select('id')
          .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${adherent.coach_id}),and(participant1_id.eq.${adherent.coach_id},participant2_id.eq.${user.id})`)
          .maybeSingle();

        if (conversation) {
          const { count: indivCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conversation.id)
            .eq('sender_type', 'coach')
            .eq('lu', false);

          totalUnread += indivCount || 0;
        }
      }

      // 2. Messages de groupe non lus - récupérer aussi le premier groupe_id
      const { data: groupStatusData, count: groupCount } = await supabase
        .from('groupes_messages_status')
        .select('message_id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('user_type', 'adherent')
        .eq('lu', false)
        .limit(1);

      totalUnread += groupCount || 0;

      // Récupérer l'ID du groupe du premier message non lu
      if (groupStatusData && groupStatusData.length > 0) {
        const { data: msgData } = await supabase
          .from('groupes_messages')
          .select('groupe_id')
          .eq('id', groupStatusData[0].message_id)
          .single();
        
        if (msgData) {
          firstGroupId = msgData.groupe_id;
        }
      }

      setUnreadMessagesCount(totalUnread);
      setFirstUnreadGroupeId(firstGroupId);
    } catch (error) {
      console.error('Erreur chargement messages non lus:', error);
    }
  };

  const loadAdherentData = async () => {
    const { data } = await supabase
      .from('adherents')
      .select(`
        *,
        coach:coaches(prenom, nom)
      `)
      .eq('id', user!.id)
      .single();

    setAdherentData(data);
    setLoading(false);
  };

  const loadSeances = async () => {
    if (!user) return;

    try {
      // Séances à venir (prochaines 3)
      const today = new Date().toISOString().split('T')[0];
      const { data: upcoming } = await supabase
        .from('seances')
        .select('*')
        .eq('adherent_id', user.id)
        .eq('statut', 'planifie')
        .gte('date_seance', today)
        .order('date_seance', { ascending: true })
        .limit(3);

      // Séances terminées récentes (3 dernières)
      const { data: recent } = await supabase
        .from('seances')
        .select('*')
        .eq('adherent_id', user.id)
        .eq('statut', 'termine')
        .order('date_seance', { ascending: false })
        .limit(3);

      // Compter séances ce mois
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      firstDayOfMonth.setHours(0, 0, 0, 0);
      
      const { count } = await supabase
        .from('seances')
        .select('*', { count: 'exact', head: true })
        .eq('adherent_id', user.id)
        .gte('date_seance', firstDayOfMonth.toISOString());

      // Charger les infos des coachs
      const allSeances = [...(upcoming || []), ...(recent || [])];
      const coachIds = [...new Set(allSeances.map(s => s.coach_id).filter(Boolean))];
      
      let coachesMap: Record<string, { prenom: string; nom: string }> = {};
      if (coachIds.length > 0) {
        const { data: coaches } = await supabase
          .from('coaches')
          .select('id, prenom, nom')
          .in('id', coachIds);
        
        if (coaches) {
          coaches.forEach(c => {
            coachesMap[c.id] = { prenom: c.prenom, nom: c.nom };
          });
        }
      }

      // Compter exercices par séance
      const seanceIds = allSeances.map(s => s.id);
      let countMap: Record<string, number> = {};
      if (seanceIds.length > 0) {
        const { data: exercicesCount } = await supabase
          .from('seances_exercices')
          .select('seance_id')
          .in('seance_id', seanceIds);

        if (exercicesCount) {
          exercicesCount.forEach(e => {
            countMap[e.seance_id] = (countMap[e.seance_id] || 0) + 1;
          });
        }
      }

      const enrichSeance = (s: any) => ({
        ...s,
        coach: coachesMap[s.coach_id] || null,
        exercices_count: countMap[s.id] || 0
      });

      setUpcomingSeances((upcoming || []).map(enrichSeance));
      setRecentSeances((recent || []).map(enrichSeance));
      setSeancesThisMonth(count || 0);

    } catch (error) {
      console.error('Erreur chargement séances:', error);
    }
  };

  const calculateAge = (dateNaissance: string) => {
    const birthDate = new Date(dateNaissance);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getTypeAdhesionLabel = (type: string) => {
    switch (type) {
      case 'club': return '🏋️ Club Force Athlétique';
      case 'coaching_individuel': return '🎯 Coaching Individuel';
      case 'cours_collectifs': return '👥 Cours Collectifs';
      case 'tous': return '⭐ Formule Complète';
      // Legacy
      case 'club_et_coaching': return 'Club + Coaching';
      case 'club_et_collectifs': return 'Club + Cours Collectifs';
      case 'coaching_et_collectifs': return 'Coaching + Cours Collectifs';
      case 'les_deux': return 'Club + Coaching';
      default: return type;
    }
  };

  const getTypeAdhesionColor = (type: string) => {
    switch (type) {
      case 'club': return 'bg-amber-100 text-amber-800';
      case 'coaching_individuel': return 'bg-purple-100 text-purple-800';
      case 'cours_collectifs': return 'bg-orange-100 text-orange-800';
      case 'tous': return 'bg-gradient-to-r from-purple-100 to-orange-100 text-purple-800';
      // Legacy
      case 'club_et_coaching': return 'bg-green-100 text-green-800';
      case 'club_et_collectifs': return 'bg-teal-100 text-teal-800';
      case 'coaching_et_collectifs': return 'bg-indigo-100 text-indigo-800';
      case 'les_deux': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Types qui nécessitent un coach
  const needsCoach = (type: string) => {
    return ['coaching_individuel', 'club_et_coaching', 'coaching_et_collectifs', 'tous', 'les_deux'].includes(type);
  };

  // Types qui donnent accès aux cours collectifs
  const hasCoursAccess = (type: string) => {
    return ['cours_collectifs', 'club_et_collectifs', 'coaching_et_collectifs', 'tous'].includes(type);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Notification Push Prompt */}
      <NotificationPrompt />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          Bienvenue, {adherentData?.prenom || 'Adhérent'} ! 👋
        </h1>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTypeAdhesionColor(adherentData?.type_adhesion || 'club')}`}>
            {getTypeAdhesionLabel(adherentData?.type_adhesion || 'club')}
          </span>
          {adherentData?.date_naissance && (
            <span className="text-slate-500 text-sm">
              {calculateAge(adherentData.date_naissance)} ans
            </span>
          )}
        </div>
      </div>

      {/* Coach Info (si affecté) */}
      {adherentData?.coach ? (
        <div className="bg-gradient-to-r from-rose-500 to-pink-600 rounded-xl p-6 text-white mb-8">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <User className="w-8 h-8" />
            </div>
            <div>
              <p className="text-rose-100 text-sm">Votre coach</p>
              <p className="text-2xl font-bold">{adherentData.coach.prenom} {adherentData.coach.nom}</p>
            </div>
          </div>
        </div>
      ) : needsCoach(adherentData?.type_adhesion || '') ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="bg-amber-100 p-3 rounded-lg">
              <User className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <p className="text-amber-800 font-medium">Coach en attente d'affectation</p>
              <p className="text-amber-700 text-sm">
                Un coach vous sera bientôt attribué pour votre suivi personnalisé.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-rose-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-rose-600" />
            </div>
            <span className="text-2xl font-bold text-slate-800">{seancesThisMonth}</span>
          </div>
          <h3 className="text-sm font-medium text-slate-600">Séances ce mois</h3>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-2xl font-bold text-slate-800">-</span>
          </div>
          <h3 className="text-sm font-medium text-slate-600">Progression</h3>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-2xl font-bold text-slate-800">0</span>
          </div>
          <h3 className="text-sm font-medium text-slate-600">Objectifs actifs</h3>
        </div>

        <Link 
          to={firstUnreadGroupeId ? `/adherent/messages?groupe=${firstUnreadGroupeId}` : '/adherent/messages'} 
          className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all relative"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <MessageCircle className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-2xl font-bold text-slate-800">{unreadMessagesCount}</span>
          </div>
          <h3 className="text-sm font-medium text-slate-600">Messages non lus</h3>
          {unreadMessagesCount > 0 && (
            <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              Nouveau
            </span>
          )}
        </Link>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prochaines séances */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-rose-600" />
              Prochaines séances
            </h2>
            <Link to="/adherent/seances" className="text-sm text-rose-600 hover:text-rose-700 font-medium">
              Voir tout →
            </Link>
          </div>
          
          {upcomingSeances.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Dumbbell className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucune séance planifiée</p>
              <p className="text-sm text-slate-400 mt-1">
                Votre coach planifiera vos prochaines séances
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingSeances.map(seance => {
                const date = new Date(seance.date_seance);
                const isToday = date.toDateString() === new Date().toDateString();
                const isTomorrow = date.toDateString() === new Date(Date.now() + 86400000).toDateString();
                const dateLabel = isToday ? "Aujourd'hui" : isTomorrow ? "Demain" : date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

                return (
                  <Link
                    key={seance.id}
                    to={`/adherent/seances/${seance.id}`}
                    className="block p-4 bg-gradient-to-r from-rose-50 to-pink-50 hover:from-rose-100 hover:to-pink-100 rounded-xl transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isToday ? 'bg-rose-600 text-white' : 'bg-rose-200 text-rose-700'}`}>
                            {dateLabel}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-800 group-hover:text-rose-600 transition-colors">
                          {seance.titre}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {seance.duree_estimee} min
                          </span>
                          <span className="flex items-center gap-1">
                            <Dumbbell className="w-3 h-3" />
                            {seance.exercices_count || 0} ex.
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-rose-500 transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Historique récent */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Séances terminées
            </h2>
            <Link to="/adherent/seances" className="text-sm text-rose-600 hover:text-rose-700 font-medium">
              Voir tout →
            </Link>
          </div>
          
          {recentSeances.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucune séance terminée</p>
              <p className="text-sm text-slate-400 mt-1">
                Vos séances complétées apparaîtront ici
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSeances.map(seance => {
                const date = new Date(seance.date_seance);
                return (
                  <Link
                    key={seance.id}
                    to={`/adherent/seances/${seance.id}`}
                    className="block p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-green-600">
                            {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </div>
                        <h3 className="font-bold text-slate-800 group-hover:text-green-700 transition-colors">
                          {seance.titre}
                        </h3>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-green-500 transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Records personnels (pour la force athlétique) */}
      <div className="mt-6 bg-white rounded-xl shadow-sm p-6 border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          🏆 Records personnels
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4 text-center">
            <p className="text-slate-500 text-sm mb-1">Squat</p>
            <p className="text-2xl font-bold text-slate-800">- kg</p>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4 text-center">
            <p className="text-slate-500 text-sm mb-1">Développé couché</p>
            <p className="text-2xl font-bold text-slate-800">- kg</p>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4 text-center">
            <p className="text-slate-500 text-sm mb-1">Soulevé de terre</p>
            <p className="text-2xl font-bold text-slate-800">- kg</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 text-center">
          <p className="text-slate-500 text-sm">Total : <span className="font-bold text-slate-800">- kg</span></p>
        </div>
      </div>
    </div>
  );
}





