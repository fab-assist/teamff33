import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Calendar,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  User,
  Info,
  X,
  MapPin
} from 'lucide-react';

interface TypeCours {
  id: string;
  nom: string;
  description: string | null;
  duree_minutes: number;
  couleur: string;
}

interface Coach {
  prenom: string;
  nom: string;
}

interface CoursCollectif {
  id: string;
  titre: string;
  description: string | null;
  date_cours: string;
  heure_debut: string;
  heure_fin: string;
  places_max: number;
  statut: 'planifie' | 'annule' | 'termine';
  type_cours?: TypeCours;
  type_cours_id?: string;
  coach?: Coach;
  coach_id?: string;
  places_disponibles?: number;
  est_inscrit?: boolean;
  inscription_id?: string;
  est_recurrent?: boolean;
}

interface AdherentData {
  type_adhesion: string;
}

export default function MesCoursCollectifs() {
  const { user } = useAuth();
  const [cours, setCours] = useState<CoursCollectif[]>([]);
  const [mesInscriptions, setMesInscriptions] = useState<CoursCollectif[]>([]);
  const [adherentData, setAdherentData] = useState<AdherentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedCours, setSelectedCours] = useState<CoursCollectif | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'inscription' | 'desinscription' | null>(null);
  const [pendingCours, setPendingCours] = useState<CoursCollectif | null>(null);
  const [showTooLateModal, setShowTooLateModal] = useState(false);
  const [tooLateCours, setTooLateCours] = useState<CoursCollectif | null>(null);

  // Tous les adhérents ont accès aux cours collectifs (pour voir le planning)
  // Seuls certains types peuvent s'inscrire (géré par RLS)
  const TOUS_ACCES = true;

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, selectedWeek]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Charger les infos de l'adhérent
      const { data: adherent } = await supabase
        .from('adherents')
        .select('type_adhesion')
        .eq('id', user!.id)
        .single();

      setAdherentData(adherent);

      // Calculer les dates de la semaine
      const startOfWeek = getStartOfWeek(selectedWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);

      // Formater les dates en local (évite les problèmes de timezone)
      const formatDateLocal = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startStr = formatDateLocal(startOfWeek);
      const endStr = formatDateLocal(endOfWeek);

      // Charger les cours de la semaine avec type
      const { data: coursData } = await supabase
        .from('cours_collectifs')
        .select(`
          *,
          type_cours:types_cours(*)
        `)
        .eq('statut', 'planifie')
        .gte('date_cours', startStr)
        .lte('date_cours', endStr)
        .order('date_cours')
        .order('heure_debut');
      
      // Charger les coaches séparément (pour éviter les problèmes RLS)
      const { data: coachesData } = await supabase
        .from('coaches')
        .select('id, prenom, nom')
        .eq('status', 'approved');

      // Charger mes inscriptions
      const { data: inscriptionsData } = await supabase
        .from('inscriptions_cours')
        .select('cours_id, id, statut')
        .eq('adherent_id', user!.id)
        .eq('statut', 'inscrit');

      const inscriptionsMap = new Map(
        inscriptionsData?.map(i => [i.cours_id, i.id]) || []
      );

      // Calculer les places disponibles et si inscrit
      if (coursData) {
        const coursWithInfo = await Promise.all(
          coursData.map(async (c) => {
            const { count } = await supabase
              .from('inscriptions_cours')
              .select('*', { count: 'exact', head: true })
              .eq('cours_id', c.id)
              .eq('statut', 'inscrit');

            // Trouver le coach dans la liste
            const coach = coachesData?.find(co => co.id === c.coach_id);

            return {
              ...c,
              coach: coach ? { prenom: coach.prenom, nom: coach.nom } : null,
              places_disponibles: c.places_max - (count || 0),
              est_inscrit: inscriptionsMap.has(c.id),
              inscription_id: inscriptionsMap.get(c.id)
            };
          })
        );
        setCours(coursWithInfo);
      }

      // Charger mes prochains cours (inscrit)
      const { data: mesCoursData } = await supabase
        .from('inscriptions_cours')
        .select(`
          id,
          cours:cours_collectifs(
            *,
            type_cours:types_cours(*),
            coach:coaches(prenom, nom)
          )
        `)
        .eq('adherent_id', user!.id)
        .eq('statut', 'inscrit');

      if (mesCoursData) {
        const futursCours = mesCoursData
          .filter(i => i.cours && new Date(i.cours.date_cours) >= new Date())
          .map(i => ({ ...i.cours, inscription_id: i.id, est_inscrit: true }))
          .sort((a, b) => new Date(a.date_cours).getTime() - new Date(b.date_cours).getTime());
        
        setMesInscriptions(futursCours as CoursCollectif[]);
      }

    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setSelectedWeek(newDate);
  };

  const formatWeekRange = () => {
    const start = getStartOfWeek(selectedWeek);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  const getDaysOfWeek = () => {
    const start = getStartOfWeek(selectedWeek);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getCoursForDay = (date: Date) => {
    // Utiliser le format local pour éviter les problèmes de timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return cours.filter(c => c.date_cours === dateStr);
  };

  // Ouvrir le modal de confirmation d'inscription
  const openInscriptionConfirm = (c: CoursCollectif) => {
    setPendingCours(c);
    setConfirmAction('inscription');
    setShowConfirmModal(true);
  };

  // Ouvrir le modal de confirmation de désinscription
  const openDesinscriptionConfirm = (c: CoursCollectif) => {
    // Vérifier si annulation possible (24h avant)
    const coursDateTime = new Date(`${c.date_cours}T${c.heure_debut}`);
    const now = new Date();
    const diff = coursDateTime.getTime() - now.getTime();
    const hoursUntilCours = diff / (1000 * 60 * 60);

    if (hoursUntilCours < 24) {
      setTooLateCours(c);
      setShowTooLateModal(true);
      return;
    }

    setPendingCours(c);
    setConfirmAction('desinscription');
    setShowConfirmModal(true);
  };

  const handleInscription = async (c: CoursCollectif, forAll: boolean = false) => {
    setActionLoading(c.id);
    setShowConfirmModal(false);
    try {
      if (forAll && c.est_recurrent) {
        // Inscrire à tous les cours de la récurrence
        const { data: allCours } = await supabase
          .from('cours_collectifs')
          .select('id')
          .eq('titre', c.titre)
          .eq('type_cours_id', c.type_cours_id)
          .eq('coach_id', c.coach_id)
          .eq('est_recurrent', true)
          .eq('statut', 'planifie')
          .gte('date_cours', new Date().toISOString().split('T')[0]);

        if (allCours) {
          for (const cours of allCours) {
            // Vérifier si déjà inscrit
            const { data: existing } = await supabase
              .from('inscriptions_cours')
              .select('id, statut')
              .eq('cours_id', cours.id)
              .eq('adherent_id', user!.id)
              .maybeSingle();

            if (existing) {
              if (existing.statut !== 'inscrit') {
                await supabase
                  .from('inscriptions_cours')
                  .update({ statut: 'inscrit', date_annulation: null })
                  .eq('id', existing.id);
              }
            } else {
              await supabase
                .from('inscriptions_cours')
                .insert([{ cours_id: cours.id, adherent_id: user!.id, statut: 'inscrit' }]);
            }
          }
        }
      } else {
        // Inscrire à ce cours uniquement
        const { data: existingInscription } = await supabase
          .from('inscriptions_cours')
          .select('id, statut')
          .eq('cours_id', c.id)
          .eq('adherent_id', user!.id)
          .maybeSingle();

        if (existingInscription) {
          if (existingInscription.statut !== 'inscrit') {
            const { error } = await supabase
              .from('inscriptions_cours')
              .update({ statut: 'inscrit', date_annulation: null })
              .eq('id', existingInscription.id);
            if (error) throw error;
          }
        } else {
          const { error } = await supabase
            .from('inscriptions_cours')
            .insert([{ cours_id: c.id, adherent_id: user!.id, statut: 'inscrit' }]);
          if (error) throw error;
        }
      }

      // Fermer tous les modals et recharger
      setShowDetailModal(false);
      setSelectedCours(null);
      await loadData();
    } catch (error) {
      console.error('Erreur inscription:', error);
      alert('Erreur lors de l\'inscription');
    } finally {
      setActionLoading(null);
      setPendingCours(null);
    }
  };

  const handleDesinscription = async (c: CoursCollectif, forAll: boolean = false) => {
    setActionLoading(c.id);
    setShowConfirmModal(false);
    
    try {
      if (forAll && c.est_recurrent) {
        // Désinscrire de tous les cours de la récurrence
        const { data: allCours } = await supabase
          .from('cours_collectifs')
          .select('id')
          .eq('titre', c.titre)
          .eq('type_cours_id', c.type_cours_id)
          .eq('coach_id', c.coach_id)
          .eq('est_recurrent', true)
          .eq('statut', 'planifie')
          .gte('date_cours', new Date().toISOString().split('T')[0]);

        if (allCours) {
          for (const cours of allCours) {
            await supabase
              .from('inscriptions_cours')
              .update({ statut: 'annule', date_annulation: new Date().toISOString() })
              .eq('cours_id', cours.id)
              .eq('adherent_id', user!.id);
          }
        }
      } else {
        // Désinscrire de ce cours uniquement
        if (!c.inscription_id) {
          alert('Erreur: inscription non trouvée');
          setActionLoading(null);
          return;
        }
        
        const { error } = await supabase
          .from('inscriptions_cours')
          .update({ statut: 'annule', date_annulation: new Date().toISOString() })
          .eq('id', c.inscription_id);

        if (error) throw error;
      }
      
      // Fermer tous les modals et recharger
      setShowDetailModal(false);
      setSelectedCours(null);
      await loadData();
    } catch (error) {
      console.error('Erreur désinscription:', error);
      alert('Erreur lors de la désinscription');
    } finally {
      setActionLoading(null);
      setPendingCours(null);
    }
  };

  // Tous les adhérents peuvent voir les cours collectifs
  const canAccessCours = TOUS_ACCES;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div>
      </div>
    );
  }

  // Tous les adhérents ont maintenant accès aux cours collectifs

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          Cours Collectifs
        </h1>
        <p className="text-slate-600">
          Inscrivez-vous aux cours collectifs de votre choix
        </p>
      </div>

      {/* Mes prochaines inscriptions */}
      {mesInscriptions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Mes prochains cours
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mesInscriptions.slice(0, 6).map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-xl shadow-sm border border-green-200 p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-800">{c.titre}</h3>
                    <p className="text-sm text-slate-500">
                      {c.type_cours?.nom}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    Inscrit
                  </span>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {new Date(c.date_cours).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    {c.heure_debut.slice(0, 5)} - {c.heure_fin.slice(0, 5)}
                  </div>
                  {c.coach && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      Coach {c.coach.prenom} {c.coach.nom}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleDesinscription(c)}
                  disabled={actionLoading === c.id}
                  className="mt-4 w-full py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-all disabled:opacity-50"
                >
                  {actionLoading === c.id ? 'Annulation...' : 'Se désinscrire'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation semaine */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateWeek(-1)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-rose-500" />
            <span className="font-semibold text-slate-800">{formatWeekRange()}</span>
            <button
              onClick={() => setSelectedWeek(new Date())}
              className="text-sm text-rose-600 hover:text-rose-700"
            >
              Cette semaine
            </button>
          </div>

          <button
            onClick={() => navigateWeek(1)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Grille de la semaine avec créneaux horaires */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="max-h-[550px] overflow-y-auto">
          {/* En-tête des jours - sticky */}
          <div className="grid grid-cols-8 border-b border-slate-200 sticky top-0 z-10 bg-white">
            <div className="p-3 text-center border-r border-slate-200 bg-slate-50">
              <div className="text-xs text-slate-500 font-medium">Heure</div>
            </div>
            {getDaysOfWeek().map((day, idx) => {
              const isToday = day.toDateString() === new Date().toDateString();
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const dayStart = new Date(day);
              dayStart.setHours(0, 0, 0, 0);
              const isPast = dayStart < today;
              return (
                <div 
                  key={idx}
                  className={`p-3 text-center border-r border-slate-200 last:border-r-0 ${
                    isToday 
                      ? 'bg-rose-100 border-b-2 border-b-rose-500' 
                      : isPast 
                        ? 'bg-slate-100' 
                        : 'bg-white'
                  }`}
                >
                  <div className={`text-xs uppercase ${isPast ? 'text-slate-400' : 'text-slate-500'}`}>
                    {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                  </div>
                  <div className={`text-lg font-bold ${
                    isToday ? 'text-rose-600' : isPast ? 'text-slate-400' : 'text-slate-800'
                  }`}>
                    {day.getDate()}
                  </div>
                  {isPast && <div className="text-[10px] text-slate-400">Passé</div>}
                </div>
              );
            })}
          </div>

          {/* Grille des créneaux horaires (6h à 22h) */}
          {Array.from({ length: 17 }, (_, i) => i + 6).map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b border-slate-100 min-h-[70px]">
              {/* Colonne heure */}
              <div className="p-2 border-r border-slate-200 bg-slate-50 text-center flex items-center justify-center">
                <span className="text-xs font-medium text-slate-600">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
              
              {/* Colonnes des jours */}
              {getDaysOfWeek().map((day, dayIdx) => {
                const isToday = day.toDateString() === new Date().toDateString();
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dayStart = new Date(day);
                dayStart.setHours(0, 0, 0, 0);
                const isPast = dayStart < today;
                const dayCours = getCoursForDay(day);
                
                // Filtrer les cours qui commencent à cette heure
                const coursAtHour = dayCours.filter(c => {
                  const startHour = parseInt(c.heure_debut.split(':')[0]);
                  return startHour === hour;
                });

                return (
                  <div 
                    key={dayIdx}
                    className={`p-1 border-r border-slate-200 last:border-r-0 ${
                      isToday ? 'bg-rose-50/30' : isPast ? 'bg-slate-50/30' : ''
                    }`}
                  >
                    {coursAtHour.map((c) => {
                      const complet = (c.places_disponibles || 0) <= 0;
                      const placesRestantes = c.places_disponibles || 0;

                      return (
                        <div
                          key={c.id}
                          onClick={() => { setSelectedCours(c); setShowDetailModal(true); }}
                          className={`p-2 rounded-lg border transition-all mb-1 cursor-pointer ${
                            c.est_inscrit
                              ? 'bg-green-50 border-green-300 hover:shadow-md'
                              : complet
                                ? 'bg-gray-100 border-gray-300 opacity-60'
                                : 'bg-white border-slate-200 hover:border-rose-300 hover:shadow-md'
                          }`}
                          style={{ borderLeftColor: c.type_cours?.couleur, borderLeftWidth: '3px' }}
                        >
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {c.titre}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {c.heure_debut.slice(0, 5)} - {c.heure_fin.slice(0, 5)}
                          </div>
                          
                          {/* Affichage des places disponibles */}
                          {complet ? (
                            <div className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                              <XCircle className="w-3 h-3" />
                              Complet
                            </div>
                          ) : (
                            <div className={`text-xs font-medium flex items-center gap-1 mt-1 ${
                              placesRestantes <= 3 ? 'text-orange-600' : 'text-green-600'
                            }`}>
                              <Users className="w-3 h-3" />
                              {placesRestantes} place{placesRestantes > 1 ? 's' : ''} dispo
                            </div>
                          )}

                          {c.est_inscrit && (
                            <div className="text-xs text-green-700 font-bold mt-1 flex items-center gap-1 bg-green-100 rounded px-1 py-0.5">
                              <CheckCircle className="w-3 h-3" />
                              Inscrit
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Info annulation */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800">Information</h4>
            <p className="text-sm text-blue-700">
              Vous pouvez vous désinscrire d'un cours jusqu'à 24h avant son début.
              Passé ce délai, l'inscription ne peut plus être annulée.
            </p>
          </div>
        </div>
      </div>

      {/* Modal détails du cours */}
      {showDetailModal && selectedCours && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header avec couleur du type */}
            <div 
              className="p-4 rounded-t-xl text-white relative flex-shrink-0"
              style={{ backgroundColor: selectedCours.type_cours?.couleur || '#6366f1' }}
            >
              <button
                onClick={() => { setShowDetailModal(false); setSelectedCours(null); }}
                className="absolute top-3 right-3 p-2 bg-white/20 rounded-full hover:bg-white/40 transition-colors z-10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-sm opacity-90">{selectedCours.type_cours?.nom}</div>
              <h2 className="text-xl font-bold mt-1">{selectedCours.titre}</h2>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Date et heure */}
              <div className="flex items-center gap-3 text-slate-700">
                <Calendar className="w-5 h-5 text-slate-400" />
                <div>
                  <div className="font-medium">
                    {new Date(selectedCours.date_cours).toLocaleDateString('fr-FR', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="text-sm text-slate-500">
                    {selectedCours.heure_debut.slice(0, 5)} - {selectedCours.heure_fin.slice(0, 5)}
                  </div>
                </div>
              </div>

              {/* Coach */}
              <div className="flex items-center gap-3 text-slate-700">
                <User className="w-5 h-5 text-slate-400" />
                <div>
                  <div className="text-sm text-slate-500">Animé par</div>
                  <div className="font-medium">
                    {selectedCours.coach ? `${selectedCours.coach.prenom} ${selectedCours.coach.nom}` : 'Coach non assigné'}
                  </div>
                </div>
              </div>

              {/* Places */}
              <div className="flex items-center gap-3 text-slate-700">
                <Users className="w-5 h-5 text-slate-400" />
                <div>
                  <div className="text-sm text-slate-500">Places disponibles</div>
                  <div className={`font-medium ${
                    (selectedCours.places_disponibles || 0) <= 0 
                      ? 'text-red-600' 
                      : (selectedCours.places_disponibles || 0) <= 3 
                        ? 'text-orange-600' 
                        : 'text-green-600'
                  }`}>
                    {(selectedCours.places_disponibles || 0) <= 0 
                      ? 'Complet' 
                      : `${selectedCours.places_disponibles} / ${selectedCours.places_max}`}
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedCours.description && (
                <div className="pt-3 border-t border-slate-200">
                  <h4 className="text-sm font-medium text-slate-500 mb-2">Description</h4>
                  <p className="text-slate-700">{selectedCours.description}</p>
                </div>
              )}

              {/* Statut inscription */}
              {selectedCours.est_inscrit && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-800">Vous êtes inscrit à ce cours</span>
                </div>
              )}

              {/* Boutons d'action */}
              <div className="pt-4 border-t border-slate-200 space-y-2">
                {selectedCours.est_inscrit ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); openDesinscriptionConfirm(selectedCours); }}
                    disabled={actionLoading === selectedCours.id}
                    className="w-full py-3 border-2 border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-all disabled:opacity-50"
                  >
                    {actionLoading === selectedCours.id ? 'Traitement...' : "Se désinscrire"}
                  </button>
                ) : (selectedCours.places_disponibles || 0) > 0 ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); openInscriptionConfirm(selectedCours); }}
                    disabled={actionLoading === selectedCours.id}
                    className="w-full py-3 bg-rose-500 text-white rounded-lg font-medium hover:bg-rose-600 transition-all disabled:opacity-50"
                  >
                    {actionLoading === selectedCours.id ? 'Traitement...' : "S'inscrire à ce cours"}
                  </button>
                ) : (
                  <div className="w-full py-3 bg-slate-100 text-slate-500 rounded-lg font-medium text-center">
                    Cours complet
                  </div>
                )}
                
                <button
                  onClick={() => { setShowDetailModal(false); setSelectedCours(null); }}
                  className="w-full py-2 text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation inscription/désinscription */}
      {showConfirmModal && pendingCours && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className={`p-5 text-white ${
              confirmAction === 'inscription' 
                ? 'bg-gradient-to-r from-rose-500 to-rose-600' 
                : 'bg-gradient-to-r from-orange-500 to-orange-600'
            }`}>
              <div className="flex items-center gap-3">
                {confirmAction === 'inscription' ? (
                  <CheckCircle className="w-8 h-8" />
                ) : (
                  <XCircle className="w-8 h-8" />
                )}
                <div>
                  <h3 className="text-xl font-bold">
                    {confirmAction === 'inscription' ? "S'inscrire" : "Se désinscrire"}
                  </h3>
                  <p className="text-white/80 text-sm">{pendingCours.titre}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-slate-800">
                    {new Date(pendingCours.date_cours).toLocaleDateString('fr-FR', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long' 
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-600">
                    {pendingCours.heure_debut.slice(0, 5)} - {pendingCours.heure_fin.slice(0, 5)}
                  </span>
                </div>
                {pendingCours.est_recurrent && (
                  <div className="flex items-center gap-2 mt-2 text-blue-600 text-sm">
                    <Info className="w-4 h-4" />
                    Ce cours fait partie d'une série récurrente
                  </div>
                )}
              </div>

              {/* Si cours récurrent - proposer le choix */}
              {pendingCours.est_recurrent ? (
                <div className="space-y-3">
                  <p className="text-slate-600 text-sm">
                    {confirmAction === 'inscription' 
                      ? "Souhaitez-vous vous inscrire à :"
                      : "Souhaitez-vous vous désinscrire de :"
                    }
                  </p>
                  
                  {/* Option 1 - Ce cours uniquement */}
                  <button
                    onClick={() => {
                      if (confirmAction === 'inscription') {
                        handleInscription(pendingCours, false);
                      } else {
                        handleDesinscription(pendingCours, false);
                      }
                    }}
                    disabled={actionLoading === pendingCours.id}
                    className="w-full p-4 border-2 border-slate-200 rounded-xl hover:border-rose-400 hover:bg-rose-50 transition-all text-left group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-100 group-hover:bg-rose-100 p-3 rounded-lg transition-colors">
                        <Calendar className="w-5 h-5 text-slate-600 group-hover:text-rose-600" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">Ce cours uniquement</div>
                        <div className="text-sm text-slate-500">
                          Le {new Date(pendingCours.date_cours).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Option 2 - Toute la récurrence */}
                  <button
                    onClick={() => {
                      if (confirmAction === 'inscription') {
                        handleInscription(pendingCours, true);
                      } else {
                        handleDesinscription(pendingCours, true);
                      }
                    }}
                    disabled={actionLoading === pendingCours.id}
                    className="w-full p-4 border-2 border-slate-200 rounded-xl hover:border-rose-400 hover:bg-rose-50 transition-all text-left group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-100 group-hover:bg-rose-100 p-3 rounded-lg transition-colors">
                        <Users className="w-5 h-5 text-slate-600 group-hover:text-rose-600" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">Toute la série</div>
                        <div className="text-sm text-slate-500">
                          Tous les cours futurs de cette récurrence
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              ) : (
                /* Cours non récurrent - bouton simple */
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowConfirmModal(false);
                      setPendingCours(null);
                      setConfirmAction(null);
                    }}
                    className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      if (confirmAction === 'inscription') {
                        handleInscription(pendingCours, false);
                      } else {
                        handleDesinscription(pendingCours, false);
                      }
                    }}
                    disabled={actionLoading === pendingCours.id}
                    className={`flex-1 py-3 text-white rounded-lg font-medium transition-all disabled:opacity-50 ${
                      confirmAction === 'inscription'
                        ? 'bg-rose-500 hover:bg-rose-600'
                        : 'bg-orange-500 hover:bg-orange-600'
                    }`}
                  >
                    {actionLoading === pendingCours.id ? 'Traitement...' : 'Confirmer'}
                  </button>
                </div>
              )}

              {/* Bouton Annuler pour cours récurrent */}
              {pendingCours.est_recurrent && (
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setPendingCours(null);
                    setConfirmAction(null);
                  }}
                  className="w-full py-2 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal "Trop tard pour se désinscrire" */}
      {showTooLateModal && tooLateCours && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8" />
                <div>
                  <h3 className="text-xl font-bold">Délai dépassé</h3>
                  <p className="text-white/80 text-sm">{tooLateCours.titre}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-800 font-medium">
                  Vous ne pouvez plus vous désinscrire moins de 24h avant le cours.
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-slate-800">
                    {new Date(tooLateCours.date_cours).toLocaleDateString('fr-FR', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long' 
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-600">
                    {tooLateCours.heure_debut.slice(0, 5)} - {tooLateCours.heure_fin.slice(0, 5)}
                  </span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800">
                  <span className="font-medium">Merci d'envoyer un message privé au coach qui anime la séance :</span>
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <User className="w-5 h-5 text-blue-600" />
                  <span className="font-bold text-blue-900">
                    {tooLateCours.coach ? `${tooLateCours.coach.prenom} ${tooLateCours.coach.nom}` : 'Coach non assigné'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowTooLateModal(false);
                  setTooLateCours(null);
                }}
                className="w-full py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition-all"
              >
                J'ai compris
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

