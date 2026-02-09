import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users, 
  UserPlus, 
  AlertCircle, 
  CheckCircle, 
  X, 
  Search,
  Phone,
  Mail,
  Calendar,
  Activity,
  Dumbbell,
  Building2,
  Eye,
  Heart,
  FileText,
  MessageCircle,
  Plus,
  Clock,
  ChevronRight,
  History,
  Repeat,
  Loader2,
  Star,
  MessageSquare,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

// Liste des conditions médicales (doit correspondre à AdherentSignup)
const MEDICAL_CONDITIONS: Record<string, string> = {
  cardiaque: 'Problèmes cardiaques',
  hypertension: 'Hypertension artérielle',
  diabete: 'Diabète',
  asthme: 'Asthme / Problèmes respiratoires',
  dos: 'Problèmes de dos (hernie, sciatique, etc.)',
  articulations: 'Problèmes articulaires (genoux, épaules, etc.)',
  epilepsie: 'Épilepsie',
  grossesse: 'Grossesse',
  chirurgie_recente: 'Chirurgie récente (< 6 mois)',
  medicaments: 'Prise de médicaments régulière',
};

interface Adherent {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  date_naissance: string | null;
  sexe: string | null;
  type_adhesion: string;
  historique_medical: Record<string, boolean> | null;
  blessures: string | null;
  coach_id: string | null;
  created_at: string;
  coach?: {
    prenom: string;
    nom: string;
  } | null;
}

interface Coach {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  nom_club: string | null;
}

interface ExerciceModification {
  nom_fr: string;
  series: number;
  repetitions: string;
  charge_prescrite: number | null;
  series_realisees: number | null;
  repetitions_realisees: string | null;
  charge_realisee: number | null;
  notes_adherent: string | null;
}

interface SeanceHistorique {
  id: string;
  titre: string;
  date_seance: string;
  duree_estimee: number | null;
  statut: string;
  exercices_count: number;
  mode_seance: string | null;
  // Feedback adhérent
  note_ressenti: number | null;
  difficulte_percue: number | null;
  note_adherent: string | null;
  date_completion: string | null;
  // Modifications
  exercicesModifies: ExerciceModification[];
}

export default function MesAdherents() {
  const { user, coachStatus } = useAuth();
  const navigate = useNavigate();
  
  const [adherentsEnAttente, setAdherentsEnAttente] = useState<Adherent[]>([]);
  const [mesAdherentsCoaching, setMesAdherentsCoaching] = useState<Adherent[]>([]);
  const [adherentsClub, setAdherentsClub] = useState<Adherent[]>([]);
  const [tousLesAdherents, setTousLesAdherents] = useState<Adherent[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [selectedAdherent, setSelectedAdherent] = useState<Adherent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailAdherent, setDetailAdherent] = useState<Adherent | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Suppression adhérent (Super Admin only)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [adherentToDelete, setAdherentToDelete] = useState<Adherent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Historique séances adhérent
  const [seancesHistorique, setSeancesHistorique] = useState<SeanceHistorique[]>([]);
  const [loadingSeances, setLoadingSeances] = useState(false);

  useEffect(() => {
    loadData();
  }, [user, coachStatus]);

  // Charger les séances d'un adhérent
  const loadSeancesAdherent = async (adherentId: string) => {
    setLoadingSeances(true);
    try {
      const { data, error } = await supabase
        .from('seances')
        .select(`
          id,
          titre,
          date_seance,
          duree_estimee,
          statut,
          mode_seance,
          note_ressenti,
          difficulte_percue,
          note_adherent,
          date_completion,
          exercices:seances_exercices(
            id,
            series,
            repetitions,
            charge_prescrite,
            series_realisees,
            repetitions_realisees,
            charge_realisee,
            notes_adherent,
            exercice:exercices(nom_fr)
          )
        `)
        .eq('adherent_id', adherentId)
        .order('date_seance', { ascending: false })
        .limit(10);

      if (error) throw error;

      setSeancesHistorique((data || []).map(s => {
        // Filtrer les exercices qui ont des modifications
        const exercicesModifies = (s.exercices || [])
          .filter((ex: any) => 
            ex.series_realisees !== null || 
            ex.repetitions_realisees !== null || 
            ex.charge_realisee !== null ||
            ex.notes_adherent !== null
          )
          .map((ex: any) => ({
            nom_fr: ex.exercice?.nom_fr || 'Exercice',
            series: ex.series,
            repetitions: ex.repetitions,
            charge_prescrite: ex.charge_prescrite,
            series_realisees: ex.series_realisees,
            repetitions_realisees: ex.repetitions_realisees,
            charge_realisee: ex.charge_realisee,
            notes_adherent: ex.notes_adherent
          }));

        return {
          ...s,
          exercices_count: s.exercices?.length || 0,
          mode_seance: s.mode_seance || 'presentiel',
          exercicesModifies
        };
      }));
    } catch (error) {
      console.error('Erreur chargement séances:', error);
    } finally {
      setLoadingSeances(false);
    }
  };

  // Ouvrir le modal de détail avec chargement des séances
  const openDetailModal = async (adherent: Adherent) => {
    setDetailAdherent(adherent);
    setShowDetailModal(true);
    setSeancesHistorique([]);
    loadSeancesAdherent(adherent.id);
  };

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Charger les coaches disponibles (pour l'affectation)
      if (coachStatus.is_super_admin) {
        const { data: coachesData } = await supabase
          .from('coaches')
          .select('id, prenom, nom, email, nom_club')
          .eq('status', 'approved');
        
        setCoaches(coachesData || []);

        // Adhérents en attente d'affectation (tous ceux qui ont besoin d'un coach, sans coach assigné)
        const { data: enAttente } = await supabase
          .from('adherents')
          .select('*')
          .is('coach_id', null)
          .in('type_adhesion', ['coaching_individuel', 'club_et_coaching', 'coaching_et_collectifs', 'tous', 'les_deux'])
          .order('created_at', { ascending: false });

        setAdherentsEnAttente(enAttente || []);

        // TOUS les adhérents (Super Admin uniquement) avec infos du coach
        const { data: allAdherents } = await supabase
          .from('adherents')
          .select(`
            *,
            coach:coaches(prenom, nom)
          `)
          .order('nom', { ascending: true });

        setTousLesAdherents(allAdherents || []);
      }

      // Mes adhérents en coaching individuel (assignés à moi)
      const { data: mesCoaching } = await supabase
        .from('adherents')
        .select('*')
        .eq('coach_id', user.id)
        .in('type_adhesion', ['coaching_individuel', 'club_et_coaching', 'coaching_et_collectifs', 'tous', 'les_deux'])
        .order('nom', { ascending: true });

      setMesAdherentsCoaching(mesCoaching || []);

      // Adhérents Club (tous ceux qui ont accès au club dans leur type d'adhésion)
      // Types incluant le club : club, club_et_coaching, club_et_collectifs, tous, les_deux
      const clubTypes = ['club', 'club_et_coaching', 'club_et_collectifs', 'tous', 'les_deux'];
      
      let clubQuery = supabase
        .from('adherents')
        .select('*')
        .in('type_adhesion', clubTypes)
        .order('nom', { ascending: true });

      if (!coachStatus.is_super_admin) {
        // Coach normal : voir uniquement ses adhérents club
        clubQuery = clubQuery.eq('coach_id', user.id);
      }

      const { data: clubData } = await clubQuery;
      setAdherentsClub(clubData || []);

    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignCoach = async (coachId: string) => {
    if (!selectedAdherent) return;
    
    setAssigning(true);
    try {
      const { error } = await supabase
        .from('adherents')
        .update({ coach_id: coachId })
        .eq('id', selectedAdherent.id);

      if (error) throw error;

      // Rafraîchir les données
      await loadData();
      setShowModal(false);
      setSelectedAdherent(null);
    } catch (error) {
      console.error('Erreur affectation:', error);
      alert('Erreur lors de l\'affectation du coach');
    } finally {
      setAssigning(false);
    }
  };

  const getTypeAdhesionBadge = (type: string) => {
    switch (type) {
      case 'club':
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">🏋️ Club FA</span>;
      case 'coaching_individuel':
        return <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">🎯 Coaching Indiv.</span>;
      case 'cours_collectifs':
        return <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">👥 Cours Collectifs</span>;
      case 'tous':
        return <span className="px-2 py-1 bg-gradient-to-r from-purple-100 to-orange-100 text-purple-700 text-xs font-medium rounded-full">⭐ Formule Complète</span>;
      // Legacy - anciennes combinaisons (rétrocompatibilité)
      case 'club_et_coaching':
        return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Club + Coaching</span>;
      case 'club_et_collectifs':
        return <span className="px-2 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded-full">Club + Cours Coll.</span>;
      case 'coaching_et_collectifs':
        return <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">Coaching + Cours Coll.</span>;
      case 'les_deux':
        return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Club + Coaching</span>;
      default:
        return null;
    }
  };

  // Fonction de suppression complète d'un adhérent (Super Admin only)
  const handleDeleteAdherent = async () => {
    if (!adherentToDelete || !coachStatus.is_super_admin) return;
    if (deleteConfirmText !== adherentToDelete.email) return;

    setDeleting(true);
    try {
      const adherentId = adherentToDelete.id;

      // 1. Supprimer les exercices des séances
      const { data: seancesData } = await supabase
        .from('seances')
        .select('id')
        .eq('adherent_id', adherentId);

      if (seancesData && seancesData.length > 0) {
        const seanceIds = seancesData.map(s => s.id);
        await supabase
          .from('exercices_seance')
          .delete()
          .in('seance_id', seanceIds);
      }

      // 2. Supprimer les séances
      await supabase
        .from('seances')
        .delete()
        .eq('adherent_id', adherentId);

      // 3. Supprimer les inscriptions aux cours collectifs
      await supabase
        .from('inscriptions_cours')
        .delete()
        .eq('adherent_id', adherentId);

      // 4. Supprimer les messages (conversations)
      await supabase
        .from('messages')
        .delete()
        .or(`sender_id.eq.${adherentId},receiver_id.eq.${adherentId}`);

      await supabase
        .from('conversations')
        .delete()
        .or(`adherent_id.eq.${adherentId}`);

      // 5. Supprimer les statuts de messages de groupe
      await supabase
        .from('groupes_messages_status')
        .delete()
        .eq('user_id', adherentId);

      // 6. Supprimer les membres de groupes
      await supabase
        .from('groupes_membres')
        .delete()
        .eq('membre_id', adherentId);

      // 7. Supprimer les enfants
      await supabase
        .from('enfants')
        .delete()
        .eq('parent_id', adherentId);

      // 8. Supprimer l'adhérent
      const { error: deleteError } = await supabase
        .from('adherents')
        .delete()
        .eq('id', adherentId);

      if (deleteError) throw deleteError;

      // 9. Supprimer l'utilisateur Auth (via fonction admin ou RPC)
      // Note: La suppression de auth.users nécessite des droits admin
      // On laisse Supabase Auth gérer cela ou on utilise une fonction edge

      // Fermer le modal et recharger les données
      setShowDeleteModal(false);
      setAdherentToDelete(null);
      setDeleteConfirmText('');
      await loadData();

    } catch (error) {
      console.error('Erreur suppression adhérent:', error);
      alert('Erreur lors de la suppression. Vérifiez la console.');
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteModal = (adherent: Adherent) => {
    setAdherentToDelete(adherent);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const calculateAge = (dateNaissance: string | null) => {
    if (!dateNaissance) return null;
    const today = new Date();
    const birth = new Date(dateNaissance);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const filterAdherents = (adherents: Adherent[]) => {
    if (!searchTerm) return adherents;
    const term = searchTerm.toLowerCase();
    return adherents.filter(a => 
      a.nom.toLowerCase().includes(term) ||
      a.prenom.toLowerCase().includes(term) ||
      a.email.toLowerCase().includes(term)
    );
  };

  const AdherentCard = ({ adherent, showAssignButton = false, showCoach = false }: { adherent: Adherent; showAssignButton?: boolean; showCoach?: boolean }) => {
    const age = calculateAge(adherent.date_naissance);
    const hasMedicalHistory = (adherent.historique_medical && Object.values(adherent.historique_medical).some(v => v)) || adherent.blessures;
    
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-slate-800">
              {adherent.prenom} {adherent.nom}
            </h3>
            <p className="text-sm text-slate-500">{adherent.email}</p>
            {showCoach && (
              <p className="text-xs mt-1">
                {adherent.coach ? (
                  <span className="text-indigo-600 font-medium">
                    👤 Coach : {adherent.coach.prenom} {adherent.coach.nom}
                  </span>
                ) : (
                  <span className="text-orange-500 font-medium">
                    ⚠️ Non affecté
                  </span>
                )}
              </p>
            )}
          </div>
          {getTypeAdhesionBadge(adherent.type_adhesion)}
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 mb-3">
          {adherent.telephone && (
            <div className="flex items-center gap-1">
              <Phone className="w-4 h-4 text-slate-400" />
              {adherent.telephone}
            </div>
          )}
          {age && (
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-slate-400" />
              {age} ans
            </div>
          )}
          {adherent.sexe && (
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4 text-slate-400" />
              {adherent.sexe === 'homme' ? '👨 Homme' : '👩 Femme'}
            </div>
          )}
        </div>

        {/* Indicateurs médicaux - cliquable */}
        {hasMedicalHistory ? (
          <button
            onClick={() => openDetailModal(adherent)}
            className="w-full mb-3 p-2 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-amber-700 text-xs font-medium">
                <Activity className="w-3 h-3" />
                Antécédents médicaux signalés
              </div>
              <Eye className="w-4 h-4 text-amber-600" />
            </div>
          </button>
        ) : null}

        {/* Bouton voir détails */}
        <button
          onClick={() => openDetailModal(adherent)}
          className="w-full mb-2 border border-slate-200 text-slate-600 py-2 px-4 rounded-lg font-medium hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
        >
          <Eye className="w-4 h-4" />
          Voir la fiche complète
        </button>

        {showAssignButton && (
          <button
            onClick={() => {
              setSelectedAdherent(adherent);
              setShowModal(true);
            }}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Affecter un coach
          </button>
        )}

        {/* Bouton suppression - Super Admin uniquement */}
        {coachStatus.is_super_admin && (
          <button
            onClick={() => openDeleteModal(adherent)}
            className="w-full mt-2 border-2 border-red-300 text-red-600 py-2 px-4 rounded-lg font-medium hover:bg-red-50 transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Supprimer
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          {coachStatus.is_super_admin ? 'Gestion des Adhérents' : 'Mes Adhérents'}
        </h1>
        <p className="text-slate-600">
          {coachStatus.is_super_admin 
            ? 'Gérez tous les adhérents du club et affectez-les aux coaches'
            : 'Vos adhérents en coaching individuel'
          }
        </p>
      </div>

      {/* Barre de recherche */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher un adhérent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Section 0: Tous les adhérents (Super Admin only) - Juste après la recherche */}
      {coachStatus.is_super_admin && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-gradient-to-r from-indigo-100 to-purple-100 p-2 rounded-lg">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                Tous les adhérents
              </h2>
              <p className="text-sm text-slate-500">
                {tousLesAdherents.length} adhérent{tousLesAdherents.length > 1 ? 's' : ''} au total dans le club
              </p>
            </div>
          </div>

          {filterAdherents(tousLesAdherents).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterAdherents(tousLesAdherents).map((adherent) => (
                <AdherentCard key={adherent.id} adherent={adherent} showCoach={true} />
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-6 text-center">
              <Users className="w-12 h-12 text-slate-400 mx-auto mb-2" />
              <p className="text-slate-500">Aucun adhérent dans le club</p>
            </div>
          )}
        </div>
      )}

      {/* Section 1: Adhérents en attente d'affectation (Super Admin only) */}
      {coachStatus.is_super_admin && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-orange-100 p-2 rounded-lg">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                Adhérents en attente d'affectation
              </h2>
              <p className="text-sm text-slate-500">
                {adherentsEnAttente.length} adhérent{adherentsEnAttente.length > 1 ? 's' : ''} à affecter
              </p>
            </div>
          </div>

          {filterAdherents(adherentsEnAttente).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterAdherents(adherentsEnAttente).map((adherent) => (
                <AdherentCard 
                  key={adherent.id} 
                  adherent={adherent} 
                  showAssignButton={true}
                />
              ))}
            </div>
          ) : (
            <div className="bg-green-50 rounded-xl p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="text-green-700 font-medium">Tous les adhérents sont affectés !</p>
            </div>
          )}
        </div>
      )}

      {/* Section 2: Mes adhérents coaching individuel */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Dumbbell className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Coaching Individuel
            </h2>
            <p className="text-sm text-slate-500">
              {mesAdherentsCoaching.length} adhérent{mesAdherentsCoaching.length > 1 ? 's' : ''} en suivi personnalisé
            </p>
          </div>
        </div>

        {filterAdherents(mesAdherentsCoaching).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterAdherents(mesAdherentsCoaching).map((adherent) => (
              <AdherentCard key={adherent.id} adherent={adherent} />
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-6 text-center">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-2" />
            <p className="text-slate-500">Aucun adhérent en coaching individuel</p>
          </div>
        )}
      </div>

      {/* Section 3: Adhérents Club */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Adhérents Club
            </h2>
            <p className="text-sm text-slate-500">
              {adherentsClub.length} adhérent{adherentsClub.length > 1 ? 's' : ''} en séances collectives
            </p>
          </div>
        </div>

        {filterAdherents(adherentsClub).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterAdherents(adherentsClub).map((adherent) => (
              <AdherentCard key={adherent.id} adherent={adherent} />
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-6 text-center">
            <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-2" />
            <p className="text-slate-500">Aucun adhérent club</p>
          </div>
        )}
      </div>

      {/* Modal d'affectation */}
      {showModal && selectedAdherent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">Affecter un coach</h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedAdherent(null);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Info adhérent */}
              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <p className="text-sm text-slate-500 mb-1">Adhérent à affecter :</p>
                <p className="font-semibold text-slate-800">
                  {selectedAdherent.prenom} {selectedAdherent.nom}
                </p>
                <p className="text-sm text-slate-600">{selectedAdherent.email}</p>
                <div className="mt-2">
                  {getTypeAdhesionBadge(selectedAdherent.type_adhesion)}
                </div>
              </div>

              {/* Liste des coaches */}
              <p className="text-sm font-medium text-slate-700 mb-3">Sélectionnez un coach :</p>
              <div className="space-y-2">
                {coaches.map((coach) => (
                  <button
                    key={coach.id}
                    onClick={() => handleAssignCoach(coach.id)}
                    disabled={assigning}
                    className="w-full p-4 border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-800">
                          {coach.prenom} {coach.nom}
                        </p>
                        <p className="text-sm text-slate-500">{coach.email}</p>
                        {coach.nom_club && (
                          <p className="text-xs text-blue-600 mt-1">{coach.nom_club}</p>
                        )}
                      </div>
                      {assigning ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      ) : (
                        <CheckCircle className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de détails adhérent */}
      {showDetailModal && detailAdherent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <h3 className="text-2xl font-bold">
                    {detailAdherent.prenom} {detailAdherent.nom}
                  </h3>
                  <p className="text-blue-100">{detailAdherent.email}</p>
                </div>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setDetailAdherent(null);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Informations générales */}
              <div>
                <h4 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  Informations générales
                </h4>
                <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Type d'adhésion</p>
                    <div className="mt-1">{getTypeAdhesionBadge(detailAdherent.type_adhesion)}</div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Sexe</p>
                    <p className="font-medium text-slate-800">
                      {detailAdherent.sexe === 'homme' ? '👨 Homme' : detailAdherent.sexe === 'femme' ? '👩 Femme' : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Âge</p>
                    <p className="font-medium text-slate-800">
                      {calculateAge(detailAdherent.date_naissance) ? `${calculateAge(detailAdherent.date_naissance)} ans` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Date de naissance</p>
                    <p className="font-medium text-slate-800">
                      {detailAdherent.date_naissance ? new Date(detailAdherent.date_naissance).toLocaleDateString('fr-FR') : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Téléphone</p>
                    <p className="font-medium text-slate-800">{detailAdherent.telephone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Inscrit le</p>
                    <p className="font-medium text-slate-800">
                      {new Date(detailAdherent.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Antécédents médicaux */}
              <div>
                <h4 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-500" />
                  Antécédents médicaux
                </h4>
                
                {detailAdherent.historique_medical && Object.entries(detailAdherent.historique_medical).some(([_, v]) => v) ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(detailAdherent.historique_medical)
                        .filter(([_, isChecked]) => isChecked)
                        .map(([key, _]) => (
                          <div key={key} className="flex items-center gap-2 text-amber-800">
                            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <span className="text-sm">{MEDICAL_CONDITIONS[key] || key}</span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="w-5 h-5" />
                      <span>Aucun antécédent médical signalé</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Blessures */}
              <div>
                <h4 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-orange-500" />
                  Blessures
                </h4>
                
                {detailAdherent.blessures ? (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <p className="text-orange-800 whitespace-pre-wrap">{detailAdherent.blessures}</p>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="w-5 h-5" />
                      <span>Aucune blessure signalée</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Section Coaching Individuel */}
              {(detailAdherent.type_adhesion.includes('coaching') || 
                detailAdherent.type_adhesion === 'les_deux' || 
                detailAdherent.type_adhesion === 'tous') && (
                <div>
                  <h4 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <Dumbbell className="w-5 h-5 text-purple-500" />
                    Coaching Individuel
                  </h4>
                  
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-4">
                    {/* Actions principales */}
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/coach/seances/builder?adherent=${detailAdherent.id}`}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Nouvelle séance
                      </Link>
                      <Link
                        to={`/coach/seances`}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-purple-300 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
                      >
                        <Calendar className="w-4 h-4" />
                        Ma banque
                      </Link>
                    </div>

                    {/* Historique des séances */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <History className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-700">Dernières séances</span>
                      </div>

                      {loadingSeances ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                        </div>
                      ) : seancesHistorique.length > 0 ? (
                        <div className="space-y-2">
                          {seancesHistorique.slice(0, 5).map(seance => (
                            <div 
                              key={seance.id}
                              className={`p-3 bg-white rounded-lg border ${seance.statut === 'termine' && seance.note_ressenti ? 'border-green-200' : 'border-purple-100'}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-slate-800 truncate">{seance.titre}</p>
                                    {seance.statut === 'termine' && (
                                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                        Terminée
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(seance.date_seance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Dumbbell className="w-3 h-3" />
                                      {seance.exercices_count} exo{seance.exercices_count > 1 ? 's' : ''}
                                    </span>
                                    {seance.duree_estimee && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {seance.duree_estimee} min
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      setShowDetailModal(false);
                                      navigate(`/coach/seances/${seance.id}`);
                                    }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors"
                                    title="Voir le détail de la séance"
                                  >
                                    <Eye className="w-3 h-3" />
                                    Détail
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowDetailModal(false);
                                      navigate(`/coach/seances/builder?adherent=${detailAdherent.id}&from_seance=${seance.id}`);
                                    }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-200 transition-colors"
                                    title="Reprendre cette séance comme base"
                                  >
                                    <Repeat className="w-3 h-3" />
                                    Reprendre
                                  </button>
                                </div>
                              </div>

                              {/* Feedback adhérent */}
                              {seance.statut === 'termine' && seance.note_ressenti && (
                                <div className="mt-2 pt-2 border-t border-slate-100">
                                  <div className="flex items-center gap-4 text-xs">
                                    {/* Ressenti */}
                                    <div className="flex items-center gap-1">
                                      <span className="text-slate-500">Ressenti:</span>
                                      <div className="flex">
                                        {[1, 2, 3, 4, 5].map(star => (
                                          <Star 
                                            key={star} 
                                            className={`w-3 h-3 ${star <= seance.note_ressenti! ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                    
                                    {/* Difficulté */}
                                    {seance.difficulte_percue && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-slate-500">Difficulté:</span>
                                        <span className="font-medium text-slate-700">{seance.difficulte_percue}/10</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Commentaire */}
                                  {seance.note_adherent && (
                                    <div className="mt-1.5 flex items-start gap-1.5">
                                      <MessageSquare className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                                      <p className="text-xs text-slate-600 italic">"{seance.note_adherent}"</p>
                                    </div>
                                  )}
                                  
                                  {/* Modifications exercices */}
                                  {seance.exercicesModifies && seance.exercicesModifies.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-green-100">
                                      <p className="text-xs font-medium text-green-700 mb-1">
                                        📝 {seance.exercicesModifies.length} modification(s)
                                      </p>
                                      <div className="space-y-1">
                                        {seance.exercicesModifies.slice(0, 2).map((ex, idx) => (
                                          <div key={idx} className="text-xs bg-green-50 rounded px-2 py-1">
                                            <span className="font-medium text-slate-700">{ex.nom_fr}: </span>
                                            {/* Séries×Reps : n'afficher que si vraiment différent */}
                                            {(ex.series_realisees !== null && ex.series_realisees !== ex.series) || 
                                             (ex.repetitions_realisees && ex.repetitions_realisees !== ex.repetitions) ? (
                                              <span className="text-slate-500">
                                                {ex.series_realisees !== null && ex.series_realisees !== ex.series ? (
                                                  <><span className="line-through text-red-500">{ex.series}</span>→<span className="text-green-600">{ex.series_realisees}</span></>
                                                ) : (
                                                  <span className="text-green-600">{ex.series}</span>
                                                )}
                                                ×
                                                {ex.repetitions_realisees && ex.repetitions_realisees !== ex.repetitions ? (
                                                  <><span className="line-through text-red-500">{ex.repetitions}</span>→<span className="text-green-600">{ex.repetitions_realisees}</span></>
                                                ) : (
                                                  <span className="text-green-600">{ex.repetitions}</span>
                                                )}
                                              </span>
                                            ) : null}
                                            {/* Charge : n'afficher que si vraiment différent */}
                                            {ex.charge_realisee !== null && ex.charge_realisee !== ex.charge_prescrite && (
                                              <span className="text-slate-500 ml-1">
                                                <span className="line-through text-red-500">{ex.charge_prescrite || '-'}kg</span>
                                                →<span className="text-green-600">{ex.charge_realisee}kg</span>
                                              </span>
                                            )}
                                            {ex.notes_adherent && (
                                              <span className="text-slate-500 italic ml-1">"{ex.notes_adherent}"</span>
                                            )}
                                          </div>
                                        ))}
                                        {seance.exercicesModifies.length > 2 && (
                                          <p className="text-xs text-green-600">
                                            +{seance.exercicesModifies.length - 2} autre(s)
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-sm text-slate-500">
                          Aucune séance planifiée pour le moment
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    // TODO: Ouvrir la messagerie avec cet adhérent
                    alert('Messagerie à venir !');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Message
                </button>
                <a
                  href={`mailto:${detailAdherent.email}`}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Envoyer un email
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation de suppression */}
      {showDeleteModal && adherentToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header rouge */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-6">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-3 rounded-full">
                  <AlertTriangle className="w-8 h-8 text-white" />
                </div>
                <div className="text-white">
                  <h2 className="text-xl font-bold">Supprimer cet adhérent ?</h2>
                  <p className="text-red-100 text-sm">Cette action est irréversible</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="font-medium text-red-800 mb-2">
                  {adherentToDelete.prenom} {adherentToDelete.nom}
                </p>
                <p className="text-sm text-red-700">{adherentToDelete.email}</p>
              </div>

              <div className="text-sm text-slate-600 mb-4">
                <p className="font-medium text-slate-800 mb-2">⚠️ Seront supprimés :</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>Toutes ses séances et exercices</li>
                  <li>Ses inscriptions aux cours</li>
                  <li>Ses messages et conversations</li>
                  <li>Ses enfants enregistrés</li>
                  <li>Son compte adhérent</li>
                </ul>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Pour confirmer, tapez l'email de l'adhérent :
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={adherentToDelete.email}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setAdherentToDelete(null);
                    setDeleteConfirmText('');
                  }}
                  className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteAdherent}
                  disabled={deleting || deleteConfirmText !== adherentToDelete.email}
                  className="flex-1 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Suppression...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Supprimer définitivement
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



