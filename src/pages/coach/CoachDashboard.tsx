import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Calendar, AlertCircle, UsersRound, MessageSquare, Star, ChevronRight, MessageCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NotificationPrompt } from '../../components/NotificationPrompt';

interface ExerciceModifie {
  id: string;
  nom_fr: string;
  series: number;
  repetitions: string;
  charge_prescrite: number | null;
  series_realisees: number | null;
  repetitions_realisees: string | null;
  charge_realisee: number | null;
  notes_adherent: string | null;
  hasModification: boolean;
}

interface FeedbackSeance {
  id: string;
  titre: string;
  date_seance: string;
  date_completion: string;
  note_ressenti: number;
  difficulte_percue: number;
  note_adherent: string | null;
  mode_seance: string;
  adherent: {
    id: string;
    prenom: string;
    nom: string;
  };
  exercicesModifies: ExerciceModifie[];
}

interface FormuleEcheance {
  id: string;
  prenom: string;
  nom: string;
  date_fin_formule: string;
  duree_formule_mois: number;
  jours_restants: number;
}

export default function CoachDashboard() {
  const { user, coachStatus } = useAuth();
  const [coachData, setCoachData] = useState<any>(null);
  const [stats, setStats] = useState({
    totalAdherents: 0,
    seancesThisMonth: 0,
  });
  const [adherentsEnAttente, setAdherentsEnAttente] = useState(0);
  const [coursCollectifsStats, setCoursCollectifsStats] = useState({
    coursCetteSemaine: 0,
    inscriptionsTotales: 0,
    prochainCours: null as { titre: string; date: string; heure: string; coach: string } | null,
    mesProchainsCoursItems: [] as { titre: string; date: string; heure: string }[],
  });
  const [recentFeedbacks, setRecentFeedbacks] = useState<FeedbackSeance[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [formulesEcheance, setFormulesEcheance] = useState<FormuleEcheance[]>([]);

  useEffect(() => {
    if (user) {
      loadCoachData();
      loadStats();
      loadCoursCollectifsStats();
      loadRecentFeedbacks();
      loadUnreadMessages();
      loadFormulesEcheance();
      // Charger les adhérents en attente uniquement pour le Super Admin
      if (coachStatus.is_super_admin) {
        loadAdherentsEnAttente();
      }
    }
  }, [user, coachStatus.is_super_admin]);

  const loadCoachData = async () => {
    const { data } = await supabase
      .from('coaches')
      .select('*')
      .eq('id', user!.id)
      .maybeSingle();

    setCoachData(data);
  };

  const loadStats = async () => {
    const { data: adherents } = await supabase
      .from('adherents')
      .select('id')
      .eq('coach_id', user!.id);

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const { data: seances } = await supabase
      .from('seances')
      .select('id')
      .eq('coach_id', user!.id)
      .gte('date_seance', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`);

    setStats({
      totalAdherents: adherents?.length || 0,
      seancesThisMonth: seances?.length || 0,
    });
  };

  const loadAdherentsEnAttente = async () => {
    // Adhérents qui ont choisi un type avec coaching ET qui n'ont pas de coach assigné
    const { data } = await supabase
      .from('adherents')
      .select('id')
      .is('coach_id', null)
      .in('type_adhesion', ['coaching_individuel', 'club_et_coaching', 'coaching_et_collectifs', 'tous', 'les_deux']);

    setAdherentsEnAttente(data?.length || 0);
  };

  const loadFormulesEcheance = async () => {
    if (!user) return;

    try {
      // Calculer la date dans 15 jours
      const today = new Date();
      const dans15Jours = new Date(today);
      dans15Jours.setDate(today.getDate() + 15);

      // Requête pour les adhérents dont la formule expire dans les 15 prochains jours
      let query = supabase
        .from('adherents')
        .select('id, prenom, nom, date_fin_formule, duree_formule_mois')
        .not('date_fin_formule', 'is', null)
        .lte('date_fin_formule', dans15Jours.toISOString().split('T')[0])
        .gte('date_fin_formule', today.toISOString().split('T')[0])
        .order('date_fin_formule', { ascending: true });

      // Si pas super admin, filtrer par coach_id
      if (!coachStatus.is_super_admin) {
        query = query.eq('coach_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const formulesAvecJours = data.map(adherent => {
          const dateEcheance = new Date(adherent.date_fin_formule);
          const diffTime = dateEcheance.getTime() - today.getTime();
          const joursRestants = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return {
            ...adherent,
            jours_restants: joursRestants
          };
        });
        setFormulesEcheance(formulesAvecJours);
      }
    } catch (error) {
      console.error('Erreur chargement formules à échéance:', error);
    }
  };

  const loadCoursCollectifsStats = async () => {
    // Calculer les dates de la semaine
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const formatDate = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Cours cette semaine
    const { data: coursSemaine } = await supabase
      .from('cours_collectifs')
      .select('id, titre, date_cours, heure_debut')
      .eq('statut', 'planifie')
      .gte('date_cours', formatDate(startOfWeek))
      .lte('date_cours', formatDate(endOfWeek));

    // Inscriptions totales cette semaine
    let inscriptionsTotales = 0;
    if (coursSemaine && coursSemaine.length > 0) {
      const { count } = await supabase
        .from('inscriptions_cours')
        .select('*', { count: 'exact', head: true })
        .in('cours_id', coursSemaine.map(c => c.id))
        .eq('statut', 'inscrit');
      inscriptionsTotales = count || 0;
    }

    // MES prochains cours (ceux que j'anime) - jusqu'à 5 cours
    const { data: mesProchainsCours } = await supabase
      .from('cours_collectifs')
      .select('titre, date_cours, heure_debut')
      .eq('statut', 'planifie')
      .eq('coach_id', user!.id)
      .gte('date_cours', formatDate(today))
      .order('date_cours')
      .order('heure_debut')
      .limit(5);

    // Prochain cours du club (celui que je N'anime PAS) avec info coach
    const { data: prochainCoursData } = await supabase
      .from('cours_collectifs')
      .select('titre, date_cours, heure_debut, coach_id')
      .eq('statut', 'planifie')
      .neq('coach_id', user!.id)
      .gte('date_cours', formatDate(today))
      .order('date_cours')
      .order('heure_debut')
      .limit(1);

    // Récupérer le nom du coach pour le prochain cours
    let coachNom = '';
    if (prochainCoursData?.[0]?.coach_id) {
      const { data: coachInfo } = await supabase
        .from('coaches')
        .select('prenom, nom')
        .eq('id', prochainCoursData[0].coach_id)
        .single();
      if (coachInfo) {
        coachNom = `${coachInfo.prenom} ${coachInfo.nom}`;
      }
    }

    setCoursCollectifsStats({
      coursCetteSemaine: coursSemaine?.length || 0,
      inscriptionsTotales,
      prochainCours: prochainCoursData?.[0] ? {
        titre: prochainCoursData[0].titre,
        date: prochainCoursData[0].date_cours,
        heure: prochainCoursData[0].heure_debut,
        coach: coachNom
      } : null,
      mesProchainsCoursItems: mesProchainsCours?.map(c => ({
        titre: c.titre,
        date: c.date_cours,
        heure: c.heure_debut
      })) || [],
    });
  };

  const loadUnreadMessages = async () => {
    if (!user) return;
    try {
      // Trouver les conversations du coach
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('coach_id', user.id);

      if (conversations && conversations.length > 0) {
        const conversationIds = conversations.map(c => c.id);
        
        // Compter les messages non lus (envoyés par les adhérents)
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', conversationIds)
          .eq('read', false)
          .neq('sender_id', user.id);

        setUnreadMessagesCount(count || 0);
      }
    } catch (error) {
      console.error('Erreur chargement messages non lus:', error);
    }
  };

  const loadRecentFeedbacks = async () => {
    if (!user) return;

    try {
      // Charger les séances terminées avec feedback
      const { data: seancesData, error } = await supabase
        .from('seances')
        .select('id, titre, date_seance, date_completion, note_ressenti, difficulte_percue, note_adherent, adherent_id, mode_seance')
        .eq('coach_id', user.id)
        .eq('statut', 'termine')
        .order('date_completion', { ascending: false })
        .limit(5);

      if (error) throw error;

      if (seancesData && seancesData.length > 0) {
        // Charger les infos des adhérents
        const adherentIds = [...new Set(seancesData.map(s => s.adherent_id).filter(Boolean))];
        
        let adherentsMap: Record<string, { id: string; prenom: string; nom: string }> = {};
        if (adherentIds.length > 0) {
          const { data: adherentsData } = await supabase
            .from('adherents')
            .select('id, prenom, nom')
            .in('id', adherentIds);
          
          if (adherentsData) {
            adherentsData.forEach(a => {
              adherentsMap[a.id] = a;
            });
          }
        }

        // Charger les exercices modifiés pour chaque séance
        const seanceIds = seancesData.map(s => s.id);
        const { data: exercicesData } = await supabase
          .from('seances_exercices')
          .select('seance_id, series, repetitions, charge_prescrite, series_realisees, repetitions_realisees, charge_realisee, notes_adherent, exercice:exercices(nom_fr)')
          .in('seance_id', seanceIds);

        // Grouper les exercices par séance et filtrer ceux avec modifications
        const exercicesParSeance: Record<string, ExerciceModifie[]> = {};
        if (exercicesData) {
          exercicesData.forEach((ex: any) => {
            const hasModification = 
              ex.series_realisees !== null || 
              ex.repetitions_realisees !== null || 
              ex.charge_realisee !== null ||
              ex.notes_adherent !== null;

            if (!exercicesParSeance[ex.seance_id]) {
              exercicesParSeance[ex.seance_id] = [];
            }
            
            exercicesParSeance[ex.seance_id].push({
              id: ex.id,
              nom_fr: ex.exercice?.nom_fr || 'Exercice',
              series: ex.series,
              repetitions: ex.repetitions,
              charge_prescrite: ex.charge_prescrite,
              series_realisees: ex.series_realisees,
              repetitions_realisees: ex.repetitions_realisees,
              charge_realisee: ex.charge_realisee,
              notes_adherent: ex.notes_adherent,
              hasModification
            });
          });
        }

        const feedbacksWithAdherents = seancesData
          .filter(s => s.adherent_id && adherentsMap[s.adherent_id])
          .map(s => ({
            ...s,
            mode_seance: s.mode_seance || 'presentiel',
            adherent: adherentsMap[s.adherent_id],
            exercicesModifies: (exercicesParSeance[s.id] || []).filter(ex => ex.hasModification)
          }));

        setRecentFeedbacks(feedbacksWithAdherents);
      } else {
        setRecentFeedbacks([]);
      }
    } catch (error) {
      console.error('Erreur chargement feedbacks:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Notification Push Prompt */}
      <NotificationPrompt />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          Bienvenue, {coachData?.prenom || 'Coach'} !
        </h1>
        <p className="text-slate-600">
          Voici un aperçu de votre club
          {coachData?.nom_club && ` - ${coachData.nom_club}`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-2xl font-bold text-slate-800">{stats.totalAdherents}</span>
          </div>
          <h3 className="text-sm font-medium text-slate-600">Coachings indiv.</h3>
        </div>

        <Link 
          to="/coach/seances?tab=planned&view=calendar" 
          className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 hover:border-green-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-2xl font-bold text-slate-800">{stats.seancesThisMonth}</span>
          </div>
          <h3 className="text-sm font-medium text-slate-600">Séances planifiées</h3>
          <p className="text-xs text-green-600 mt-1">Voir le calendrier →</p>
        </Link>

        <Link to="/coach/cours-collectifs" className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 hover:border-orange-300 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-orange-100 p-3 rounded-lg">
              <UsersRound className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-2xl font-bold text-slate-800">{coursCollectifsStats.coursCetteSemaine}</span>
          </div>
          <h3 className="text-sm font-medium text-slate-600">Cours collectifs (semaine)</h3>
          <p className="text-xs text-orange-600 mt-1">{coursCollectifsStats.inscriptionsTotales} inscriptions</p>
        </Link>

        <Link 
          to="/coach/messages" 
          className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all relative"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <MessageCircle className="w-6 h-6 text-purple-600" />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Actions rapides</h2>
          <div className="space-y-3">
            {coachStatus.is_super_admin ? (
              <Link
                to="/coach/adherents"
                className={`block p-4 rounded-lg transition-colors ${
                  adherentsEnAttente > 0 
                    ? 'bg-orange-50 hover:bg-orange-100 border-2 border-orange-300' 
                    : 'bg-blue-50 hover:bg-blue-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`font-medium mb-1 ${adherentsEnAttente > 0 ? 'text-orange-900' : 'text-blue-900'}`}>
                      {adherentsEnAttente > 0 ? (
                        <span className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5" />
                          Adhérents en attente d'affectation
                        </span>
                      ) : (
                        'Gérer les adhérents'
                      )}
                    </h3>
                    <p className={`text-sm ${adherentsEnAttente > 0 ? 'text-orange-700' : 'text-blue-700'}`}>
                      {adherentsEnAttente > 0 
                        ? `${adherentsEnAttente} adhérent${adherentsEnAttente > 1 ? 's' : ''} à affecter à un coach`
                        : 'Voir tous les adhérents du club'
                      }
                    </p>
                  </div>
                  {adherentsEnAttente > 0 && (
                    <span className="bg-orange-500 text-white text-lg font-bold px-3 py-1 rounded-full">
                      {adherentsEnAttente}
                    </span>
                  )}
                </div>
              </Link>
            ) : (
            <Link
                to="/coach/adherents"
              className="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
                <h3 className="font-medium text-blue-900 mb-1">Mes adhérents</h3>
                <p className="text-sm text-blue-700">Voir mes adhérents en coaching individuel</p>
            </Link>
            )}
            <Link
              to="/coach/seances/builder"
              className="block p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
            >
              <h3 className="font-medium text-green-900 mb-1">Planifier une séance</h3>
              <p className="text-sm text-green-700">Créer une nouvelle séance d'entraînement</p>
            </Link>
            <Link
              to="/coach/seances"
              className="block p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <h3 className="font-medium text-purple-900 mb-1">Mes séances</h3>
              <p className="text-sm text-purple-700">Voir et gérer toutes les séances planifiées</p>
            </Link>
            <Link
              to="/coach/cours-collectifs"
              className="block p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
            >
              <h3 className="font-medium text-orange-900 mb-1">Cours collectifs</h3>
              <p className="text-sm text-orange-700">Planifier et gérer les cours collectifs</p>
            </Link>

            {/* Widget Formules à échéance - Toujours visible */}
            <div className={`p-4 rounded-lg border-2 ${
              formulesEcheance.length > 0 
                ? 'bg-red-50 border-red-300' 
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <Clock className={`w-5 h-5 ${formulesEcheance.length > 0 ? 'text-red-600' : 'text-slate-400'}`} />
                <h3 className={`font-medium ${formulesEcheance.length > 0 ? 'text-red-900' : 'text-slate-700'}`}>
                  Formules à échéance (15j)
                </h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  formulesEcheance.length > 0 
                    ? 'bg-red-500 text-white' 
                    : 'bg-slate-300 text-slate-600'
                }`}>
                  {formulesEcheance.length}
                </span>
              </div>
              {formulesEcheance.length > 0 ? (
                <div className="space-y-2">
                  {formulesEcheance.slice(0, 3).map((adherent) => (
                    <Link
                      key={adherent.id}
                      to={`/coach/adherents`}
                      className="flex items-center justify-between text-sm bg-white p-2 rounded hover:bg-red-100 transition-colors"
                    >
                      <span className="font-medium text-slate-700">
                        {adherent.prenom} {adherent.nom}
                      </span>
                      <span className={`font-bold ${adherent.jours_restants <= 7 ? 'text-red-600' : 'text-orange-600'}`}>
                        {adherent.jours_restants === 0 
                          ? "Aujourd'hui !" 
                          : adherent.jours_restants === 1 
                            ? "Demain" 
                            : `${adherent.jours_restants}j`}
                      </span>
                    </Link>
                  ))}
                  {formulesEcheance.length > 3 && (
                    <p className="text-xs text-red-600 text-center">
                      + {formulesEcheance.length - 3} autre(s)
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-2">
                  ✅ Aucune formule n'expire dans les 15 prochains jours
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Cours collectifs</h2>
          
          {/* Mes prochains cours (ceux que j'anime) */}
          {coursCollectifsStats.mesProchainsCoursItems.length > 0 && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded">VOUS ANIMEZ</span>
              </div>
              {coursCollectifsStats.mesProchainsCoursItems.map((cours, index) => (
                <Link key={index} to="/coach/cours-collectifs" className="block">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 hover:bg-blue-100 transition-colors">
                    <h3 className="font-bold text-blue-900 text-sm">{cours.titre}</h3>
                    <p className="text-xs text-blue-700">
                      {new Date(cours.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {cours.heure.slice(0, 5)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Prochain cours du club (animé par un autre coach) */}
          {coursCollectifsStats.prochainCours && (
            <Link to="/coach/cours-collectifs" className="block">
              <div className="bg-orange-50 rounded-lg p-4 hover:bg-orange-100 transition-colors">
                <div className="text-xs text-orange-600 font-medium mb-1">
                  Prochain cours par {coursCollectifsStats.prochainCours.coach || 'Autre coach'}
                </div>
                <h3 className="font-bold text-orange-900">{coursCollectifsStats.prochainCours.titre}</h3>
                <p className="text-sm text-orange-700 mt-1">
                  {new Date(coursCollectifsStats.prochainCours.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-sm text-orange-600">
                  à {coursCollectifsStats.prochainCours.heure.slice(0, 5)}
                </p>
              </div>
            </Link>
          )}

          {/* Aucun cours */}
          {!coursCollectifsStats.prochainCours && coursCollectifsStats.mesProchainsCoursItems.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <UsersRound className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucun cours planifié</p>
              <Link to="/coach/cours-collectifs" className="text-orange-600 hover:text-orange-700 text-sm mt-2 inline-block">
                Planifier un cours
            </Link>
          </div>
          )}
        </div>
      </div>

      {/* Widget Feedbacks récents */}
      <div className="mt-6 bg-white rounded-xl shadow-sm p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-rose-600" />
            Retours des adhérents
          </h2>
          <Link to="/coach/seances" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            Voir tout
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {recentFeedbacks.length > 0 ? (
          <div className="space-y-3">
            {recentFeedbacks.map(feedback => (
              <Link 
                key={feedback.id}
                to={`/coach/seances/${feedback.id}`}
                className="block bg-gradient-to-r from-rose-50 to-pink-50 rounded-xl p-4 border border-rose-100 hover:border-rose-300 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                        {feedback.adherent.prenom[0]}{feedback.adherent.nom[0]}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 text-sm">
                          {feedback.adherent.prenom} {feedback.adherent.nom}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(feedback.date_completion).toLocaleDateString('fr-FR', { 
                            day: 'numeric', 
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Séance */}
                    <p className="text-sm text-slate-700 font-medium mb-2">
                      {feedback.titre}
                    </p>

                    {/* Ratings */}
                    <div className="flex flex-wrap items-center gap-4">
                      {/* Ressenti */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">Ressenti:</span>
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map(star => (
                            <Star 
                              key={star} 
                              className={`w-4 h-4 ${star <= feedback.note_ressenti ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Difficulté */}
                      {feedback.difficulte_percue && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Difficulté:</span>
                          <div className="flex items-center gap-1">
                            <div className="w-16 bg-slate-200 rounded-full h-1.5">
                              <div 
                                className="bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 h-1.5 rounded-full"
                                style={{ width: `${feedback.difficulte_percue * 10}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-600">{feedback.difficulte_percue}/10</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Commentaire */}
                    {feedback.note_adherent && (
                      <p className="mt-2 text-sm text-slate-600 italic bg-white/50 p-2 rounded-lg">
                        "{feedback.note_adherent}"
                      </p>
                    )}

                    {/* Modifications exercices */}
                    {feedback.exercicesModifies && feedback.exercicesModifies.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-rose-200">
                        <p className="text-xs font-medium text-rose-700 mb-2 flex items-center gap-1">
                          📝 Modifications signalées ({feedback.exercicesModifies.length})
                        </p>
                        <div className="space-y-1.5">
                          {feedback.exercicesModifies.slice(0, 3).map((ex, idx) => (
                            <div key={idx} className="bg-white/70 rounded-lg p-2 text-xs">
                              <span className="font-medium text-slate-700">{ex.nom_fr}</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {/* Séries×Reps : n'afficher que si vraiment différent */}
                                {(ex.series_realisees !== null && ex.series_realisees !== ex.series) || 
                                 (ex.repetitions_realisees && ex.repetitions_realisees !== ex.repetitions) ? (
                                  <span className="text-slate-500">
                                    {ex.series_realisees !== null && ex.series_realisees !== ex.series ? (
                                      <><span className="line-through text-red-500">{ex.series}</span>→<span className="text-green-600 font-medium">{ex.series_realisees}</span></>
                                    ) : (
                                      <span className="text-green-600 font-medium">{ex.series}</span>
                                    )}
                                    ×
                                    {ex.repetitions_realisees && ex.repetitions_realisees !== ex.repetitions ? (
                                      <><span className="line-through text-red-500">{ex.repetitions}</span>→<span className="text-green-600 font-medium">{ex.repetitions_realisees}</span></>
                                    ) : (
                                      <span className="text-green-600 font-medium">{ex.repetitions}</span>
                                    )}
                                  </span>
                                ) : null}
                                {/* Charge : n'afficher que si vraiment différent */}
                                {ex.charge_realisee !== null && ex.charge_realisee !== ex.charge_prescrite && (
                                  <span className="text-slate-500">
                                    <span className="line-through text-red-500">{ex.charge_prescrite || '-'}kg</span>
                                    →<span className="text-green-600 font-medium">{ex.charge_realisee}kg</span>
                                  </span>
                                )}
                              </div>
                              {ex.notes_adherent && (
                                <p className="text-slate-500 italic mt-1">"{ex.notes_adherent}"</p>
                              )}
                            </div>
                          ))}
                          {feedback.exercicesModifies.length > 3 && (
                            <p className="text-xs text-rose-600">
                              + {feedback.exercicesModifies.length - 3} autre(s) modification(s)
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Aucun retour d'adhérent</p>
            <p className="text-sm text-slate-400 mt-1">
              Les feedbacks apparaîtront ici quand vos adhérents auront terminé leurs séances
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
