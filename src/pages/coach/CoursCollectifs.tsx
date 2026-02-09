import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users, 
  Plus, 
  Calendar,
  Clock,
  MapPin,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  AlertCircle,
  CheckCircle,
  Repeat,
  Filter
} from 'lucide-react';

interface TypeCours {
  id: string;
  nom: string;
  description: string | null;
  duree_minutes: number;
  icone: string;
  couleur: string;
}

interface Coach {
  id: string;
  prenom: string;
  nom: string;
}

interface CoursCollectif {
  id: string;
  type_cours_id: string;
  coach_id: string;
  titre: string;
  description: string | null;
  date_cours: string;
  heure_debut: string;
  heure_fin: string;
  places_max: number;
  est_recurrent: boolean;
  recurrence_type: string | null;
  recurrence_jours: number[] | null;
  recurrence_fin: string | null;
  statut: 'planifie' | 'annule' | 'termine';
  type_cours?: TypeCours;
  coach?: Coach;
  inscriptions_count?: number;
}

interface Inscription {
  id: string;
  adherent_id: string;
  statut: string;
  date_inscription: string;
  adherent?: {
    prenom: string;
    nom: string;
    email: string;
  };
}

export default function CoursCollectifs() {
  const { user, coachStatus } = useAuth();
  const isSuperAdmin = coachStatus.is_super_admin;

  const [typesCours, setTypesCours] = useState<TypeCours[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [cours, setCours] = useState<CoursCollectif[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [filterType, setFilterType] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [showInscriptionsModal, setShowInscriptionsModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRecurrenceConfirmModal, setShowRecurrenceConfirmModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [pendingUpdateData, setPendingUpdateData] = useState<any>(null);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<{
    type: 'delete' | 'deleteAll' | 'cancel';
    coursId: string;
    coursData?: CoursCollectif;
  } | null>(null);
  const [editingCours, setEditingCours] = useState<CoursCollectif | null>(null);
  const [selectedCoursInscriptions, setSelectedCoursInscriptions] = useState<CoursCollectif | null>(null);
  const [selectedCoursDetail, setSelectedCoursDetail] = useState<CoursCollectif | null>(null);
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);

  // Formulaire
  const [formData, setFormData] = useState({
    type_cours_id: '',
    coach_id: '',
    titre: '',
    description: '',
    date_cours: '',
    heure_debut: '09:00',
    heure_fin: '10:00',
    places_max: '10', // String pour permettre la saisie libre
    est_recurrent: false,
    recurrence_type: 'hebdomadaire',
    recurrence_jours: [] as number[],
    recurrence_fin: ''
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedWeek]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Charger les types de cours
      const { data: typesData } = await supabase
        .from('types_cours')
        .select('*')
        .order('nom');
      setTypesCours(typesData || []);

      // Charger les coaches
      const { data: coachesData } = await supabase
        .from('coaches')
        .select('id, prenom, nom')
        .eq('status', 'approved')
        .order('nom');
      setCoaches(coachesData || []);

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
      const { data: coursData, error: coursError } = await supabase
        .from('cours_collectifs')
        .select(`
          *,
          type_cours:types_cours(*)
        `)
        .gte('date_cours', startStr)
        .lte('date_cours', endStr)
        .order('date_cours')
        .order('heure_debut');
      
      if (coursError) {
        console.error('Erreur chargement cours:', coursError);
      }

      // Compter les inscriptions et ajouter les infos coach pour chaque cours
      if (coursData) {
        const coursWithCounts = await Promise.all(
          coursData.map(async (c) => {
            const { count } = await supabase
              .from('inscriptions_cours')
              .select('*', { count: 'exact', head: true })
              .eq('cours_id', c.id)
              .eq('statut', 'inscrit');
            // Trouver le coach dans la liste déjà chargée
            const coach = coachesData?.find((co: Coach) => co.id === c.coach_id);
            return { ...c, inscriptions_count: count || 0, coach };
          })
        );
        setCours(coursWithCounts);
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

  const openCreateModal = (date?: string, heure?: string) => {
    setEditingCours(null);
    const defaultDate = date || new Date().toISOString().split('T')[0];
    const defaultHeure = heure || '09:00';
    const type = typesCours[0];
    
    // Calculer l'heure de fin basée sur la durée du type de cours
    let heureFin = '10:00';
    if (type && defaultHeure) {
      const [h, m] = defaultHeure.split(':').map(Number);
      const endMinutes = h * 60 + m + (type.duree_minutes || 60);
      const endH = Math.floor(endMinutes / 60);
      const endM = endMinutes % 60;
      heureFin = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    }
    
    setFormData({
      type_cours_id: type?.id || '',
      coach_id: user?.id || '',
      titre: type?.nom || '',
      description: '',
      date_cours: defaultDate,
      heure_debut: defaultHeure,
      heure_fin: heureFin,
      places_max: '10',
      est_recurrent: false,
      recurrence_type: 'hebdomadaire',
      recurrence_jours: [],
      recurrence_fin: ''
    });
    setShowModal(true);
  };

  const openEditModal = (c: CoursCollectif) => {
    setEditingCours(c);
    setFormData({
      type_cours_id: c.type_cours_id,
      coach_id: c.coach_id,
      titre: c.titre,
      description: c.description || '',
      date_cours: c.date_cours,
      heure_debut: c.heure_debut,
      heure_fin: c.heure_fin,
      places_max: String(c.places_max),
      est_recurrent: c.est_recurrent,
      recurrence_type: c.recurrence_type || 'hebdomadaire',
      recurrence_jours: c.recurrence_jours || [],
      recurrence_fin: c.recurrence_fin || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.type_cours_id || !formData.date_cours || !formData.titre) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setSaving(true);
    try {
      const coursData = {
        type_cours_id: formData.type_cours_id,
        coach_id: formData.coach_id || user?.id,
        titre: formData.titre,
        description: formData.description || null,
        date_cours: formData.date_cours,
        heure_debut: formData.heure_debut,
        heure_fin: formData.heure_fin,
        places_max: parseInt(formData.places_max) || 10,
        est_recurrent: formData.est_recurrent,
        recurrence_type: formData.est_recurrent ? formData.recurrence_type : null,
        recurrence_jours: formData.est_recurrent ? formData.recurrence_jours : null,
        recurrence_fin: formData.est_recurrent ? formData.recurrence_fin : null,
        created_by: user?.id
      };

      if (editingCours) {
        // Mise à jour du cours existant
        const updateData = {
          type_cours_id: formData.type_cours_id,
          coach_id: formData.coach_id || user?.id,
          titre: formData.titre,
          description: formData.description || null,
          heure_debut: formData.heure_debut,
          heure_fin: formData.heure_fin,
          places_max: parseInt(formData.places_max) || 10,
        };

        // Si le cours est récurrent, afficher le modal de choix
        if (editingCours.est_recurrent) {
          setPendingUpdateData({ updateData, editingCours });
          setShowRecurrenceConfirmModal(true);
          setSaving(false);
          return; // On attend la réponse du modal
        } else {
          // Cours non récurrent, mise à jour simple
          const { error: updateError } = await supabase
            .from('cours_collectifs')
            .update(updateData)
            .eq('id', editingCours.id);

          if (updateError) throw updateError;
        }
      } else {
        // Création
        if (formData.est_recurrent && formData.recurrence_jours.length > 0 && formData.recurrence_fin) {
          // Créer les cours récurrents
          const coursToCreate = [];
          const startDate = new Date(formData.date_cours);
          const endDate = new Date(formData.recurrence_fin);
          
          let currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            if (formData.recurrence_jours.includes(dayOfWeek)) {
              const year = currentDate.getFullYear();
              const month = String(currentDate.getMonth() + 1).padStart(2, '0');
              const day = String(currentDate.getDate()).padStart(2, '0');
              coursToCreate.push({
                ...coursData,
                date_cours: `${year}-${month}-${day}`
              });
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }

          if (coursToCreate.length > 0) {
            const { error } = await supabase
              .from('cours_collectifs')
              .insert(coursToCreate);
            if (error) throw error;
          }
        } else {
          // Cours unique
          const { error } = await supabase
            .from('cours_collectifs')
            .insert([coursData]);
          if (error) throw error;
        }
      }

      setShowModal(false);
      await loadData(); // Attendre le rechargement complet
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Ouvrir le modal de confirmation de suppression
  const openDeleteConfirm = (type: 'delete' | 'deleteAll' | 'cancel', coursId: string, coursData?: CoursCollectif) => {
    setPendingDeleteAction({ type, coursId, coursData });
    setShowDeleteConfirmModal(true);
  };

  // Exécuter la suppression/annulation confirmée
  const executeDeleteAction = async () => {
    if (!pendingDeleteAction) return;

    const { type, coursId, coursData } = pendingDeleteAction;

    try {
      if (type === 'deleteAll' && coursData?.est_recurrent) {
        // Supprimer tous les cours de la récurrence
        const { error } = await supabase
          .from('cours_collectifs')
          .delete()
          .eq('titre', coursData.titre)
          .eq('type_cours_id', coursData.type_cours_id)
          .eq('coach_id', coursData.coach_id)
          .eq('est_recurrent', true)
          .gte('date_cours', new Date().toISOString().split('T')[0]);

        if (error) throw error;
      } else if (type === 'delete') {
        // Supprimer uniquement ce cours
        const { error } = await supabase
          .from('cours_collectifs')
          .delete()
          .eq('id', coursId);

        if (error) throw error;
      } else if (type === 'cancel') {
        // Annuler le cours
        const { error } = await supabase
          .from('cours_collectifs')
          .update({ statut: 'annule' })
          .eq('id', coursId);

        if (error) throw error;
      }

      setShowDeleteConfirmModal(false);
      setShowModal(false);
      setPendingDeleteAction(null);
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de l\'opération');
    }
  };

  // Fonctions appelées par les boutons
  const handleDelete = (coursId: string, deleteAll: boolean = false, coursData?: CoursCollectif) => {
    openDeleteConfirm(deleteAll ? 'deleteAll' : 'delete', coursId, coursData);
  };

  const handleCancelCours = (coursId: string) => {
    openDeleteConfirm('cancel', coursId);
  };

  const openInscriptionsModal = async (c: CoursCollectif) => {
    setSelectedCoursInscriptions(c);
    setShowInscriptionsModal(true);

    const { data } = await supabase
      .from('inscriptions_cours')
      .select(`
        *,
        adherent:adherents(prenom, nom, email)
      `)
      .eq('cours_id', c.id)
      .order('date_inscription');

    setInscriptions(data || []);
  };

  const openDetailModal = (c: CoursCollectif) => {
    setSelectedCoursDetail(c);
    setShowDetailModal(true);
  };

  // Confirmer la mise à jour d'un seul cours
  const confirmUpdateSingle = async () => {
    if (!pendingUpdateData) return;
    
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('cours_collectifs')
        .update(pendingUpdateData.updateData)
        .eq('id', pendingUpdateData.editingCours.id);

      if (updateError) throw updateError;
      
      setShowRecurrenceConfirmModal(false);
      setShowModal(false);
      setPendingUpdateData(null);
      await loadData();
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      alert('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  // Confirmer la mise à jour de toute la récurrence
  const confirmUpdateAll = async () => {
    if (!pendingUpdateData) return;
    
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('cours_collectifs')
        .update(pendingUpdateData.updateData)
        .eq('titre', pendingUpdateData.editingCours.titre)
        .eq('type_cours_id', pendingUpdateData.editingCours.type_cours_id)
        .eq('coach_id', pendingUpdateData.editingCours.coach_id)
        .eq('est_recurrent', true)
        .gte('date_cours', new Date().toISOString().split('T')[0]);

      if (updateError) throw updateError;
      
      setShowRecurrenceConfirmModal(false);
      setShowModal(false);
      setPendingUpdateData(null);
      await loadData();
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      alert('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const toggleJourRecurrence = (jour: number) => {
    setFormData(prev => ({
      ...prev,
      recurrence_jours: prev.recurrence_jours.includes(jour)
        ? prev.recurrence_jours.filter(j => j !== jour)
        : [...prev.recurrence_jours, jour]
    }));
  };

  const JOURS_SEMAINE = [
    { value: 1, label: 'Lun' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Mer' },
    { value: 4, label: 'Jeu' },
    { value: 5, label: 'Ven' },
    { value: 6, label: 'Sam' },
    { value: 0, label: 'Dim' }
  ];

  const getCoursColor = (cours: CoursCollectif) => {
    if (cours.statut === 'annule') return 'bg-gray-100 border-gray-300 opacity-50';
    if (cours.statut === 'termine') return 'bg-gray-100 border-gray-300';
    return cours.type_cours?.couleur 
      ? `border-l-4`
      : 'bg-blue-50 border-blue-300';
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
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Cours Collectifs
          </h1>
          <p className="text-slate-600">
            Planifiez et gérez les cours collectifs du club
          </p>
        </div>

        <button
          onClick={() => {
            if (isSuperAdmin) {
              openCreateModal();
            } else {
              alert('Seul le Super Admin peut créer des cours collectifs');
            }
          }}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all shadow-lg ${
            isSuperAdmin 
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700' 
              : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Plus className="w-5 h-5" />
          Nouveau cours
        </button>
      </div>

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
            <Calendar className="w-5 h-5 text-blue-500" />
            <span className="font-semibold text-slate-800">{formatWeekRange()}</span>
            <button
              onClick={() => setSelectedWeek(new Date())}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Aujourd'hui
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
                      ? 'bg-blue-100 border-b-2 border-b-blue-500' 
                      : isPast 
                        ? 'bg-slate-100' 
                        : 'bg-white'
                  }`}
                >
                  <div className={`text-xs uppercase ${isPast ? 'text-slate-400' : 'text-slate-500'}`}>
                    {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                  </div>
                  <div className={`text-lg font-bold ${
                    isToday 
                      ? 'text-blue-600' 
                      : isPast 
                        ? 'text-slate-400' 
                        : 'text-slate-800'
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
            <div key={hour} className="grid grid-cols-8 border-b border-slate-100 min-h-[60px]">
              {/* Colonne heure */}
              <div className="p-2 border-r border-slate-200 bg-slate-50 text-center">
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

                // Formater la date pour le formulaire
                const year = day.getFullYear();
                const month = String(day.getMonth() + 1).padStart(2, '0');
                const dayNum = String(day.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${dayNum}`;
                const heureStr = `${String(hour).padStart(2, '0')}:00`;

                return (
                  <div 
                    key={dayIdx}
                    onDoubleClick={() => {
                      if (isPast) {
                        return; // Ignorer les jours passés
                      }
                      if (isSuperAdmin) {
                        openCreateModal(dateStr, heureStr);
                      } else {
                        alert('Seul le Super Admin peut créer des cours collectifs');
                      }
                    }}
                    className={`p-1 border-r border-slate-200 last:border-r-0 min-h-[60px] ${
                      isToday 
                        ? 'bg-blue-50/50' 
                        : isPast 
                          ? 'bg-slate-50/80 cursor-not-allowed' 
                          : 'hover:bg-blue-50/30 cursor-cell'
                    }`}
                    title={!isPast ? 'Double-cliquez pour créer un cours' : 'Jour passé'}
                  >
                    {coursAtHour.map((c) => {
                      const isMyClass = c.coach_id === user?.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => openDetailModal(c)}
                          className={`p-2 rounded-lg border cursor-pointer hover:shadow-md transition-all mb-1 ${
                            isMyClass 
                              ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300' 
                              : getCoursColor(c)
                          }`}
                          style={{ 
                            borderLeftColor: isMyClass ? '#3B82F6' : c.type_cours?.couleur,
                            borderLeftWidth: '4px'
                          }}
                        >
                          {isMyClass && (
                            <div className="text-[10px] text-blue-700 font-bold mb-1 flex items-center gap-1">
                              <span className="bg-blue-600 text-white px-1 rounded text-[9px]">VOUS</span>
                            </div>
                          )}
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {c.titre}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {c.heure_debut.slice(0, 5)} - {c.heure_fin.slice(0, 5)}
                          </div>
                          <div className="text-xs text-slate-600 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {c.inscriptions_count}/{c.places_max}
                          </div>
                          {c.statut === 'annule' && (
                            <div className="text-xs text-red-600 font-medium">Annulé</div>
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{cours.length}</div>
              <div className="text-sm text-slate-500">Cours cette semaine</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">
                {cours.reduce((acc, c) => acc + (c.inscriptions_count || 0), 0)}
              </div>
              <div className="text-sm text-slate-500">Inscriptions totales</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <CheckCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">
                {cours.filter(c => c.statut === 'planifie').length}
              </div>
              <div className="text-sm text-slate-500">Cours planifiés</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">
                {cours.filter(c => c.statut === 'annule').length}
              </div>
              <div className="text-sm text-slate-500">Cours annulés</div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal création/édition */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">
                  {editingCours ? 'Modifier le cours' : 'Nouveau cours collectif'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Type de cours */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Type de cours *
                </label>
                <select
                  value={formData.type_cours_id}
                  onChange={(e) => {
                    const type = typesCours.find(t => t.id === e.target.value);
                    setFormData({
                      ...formData,
                      type_cours_id: e.target.value,
                      titre: type?.nom || '',
                      heure_fin: type ? 
                        (() => {
                          const [h, m] = formData.heure_debut.split(':').map(Number);
                          const endMinutes = h * 60 + m + type.duree_minutes;
                          const endH = Math.floor(endMinutes / 60);
                          const endM = endMinutes % 60;
                          return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                        })()
                        : formData.heure_fin
                    });
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sélectionner un type...</option>
                  {typesCours.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.nom} ({type.duree_minutes} min)
                    </option>
                  ))}
                </select>
              </div>

              {/* Titre */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Titre du cours *
                </label>
                <input
                  type="text"
                  value={formData.titre}
                  onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Circuit Training du lundi"
                />
              </div>

              {/* Coach */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Coach responsable
                </label>
                <select
                  value={formData.coach_id}
                  onChange={(e) => setFormData({ ...formData, coach_id: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {coaches.map(coach => (
                    <option key={coach.id} value={coach.id}>
                      {coach.prenom} {coach.nom}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date et horaires */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.date_cours}
                    onChange={(e) => setFormData({ ...formData, date_cours: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {!editingCours && (
                    <p className="text-xs text-slate-500 mt-1">Vous ne pouvez pas créer de cours dans le passé</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Heure début *
                  </label>
                  <input
                    type="time"
                    value={formData.heure_debut}
                    onChange={(e) => setFormData({ ...formData, heure_debut: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Heure fin *
                  </label>
                  <input
                    type="time"
                    value={formData.heure_fin}
                    onChange={(e) => setFormData({ ...formData, heure_fin: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Places max */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nombre de places maximum *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.places_max}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setFormData({ ...formData, places_max: val });
                  }}
                  placeholder="Ex: 10"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description (optionnel)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Description du cours..."
                />
              </div>

              {/* Récurrence - seulement pour nouveau cours ou cours récurrent existant */}
              {(!editingCours || editingCours.est_recurrent) && (
                <div className="border-t border-slate-200 pt-6">
                  {editingCours?.est_recurrent ? (
                    // Cours récurrent existant - affichage informatif
                    <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-lg">
                      <Repeat className="w-5 h-5 text-blue-500" />
                      <span className="font-medium text-blue-700">
                        Ce cours fait partie d'une récurrence
                      </span>
                      <span className="text-xs text-blue-500 ml-auto">
                        Les modifications s'appliqueront à tous les cours ou uniquement à celui-ci
                      </span>
                    </div>
                  ) : (
                    // Nouveau cours - option de récurrence
                    <>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.est_recurrent}
                          onChange={(e) => setFormData({ ...formData, est_recurrent: e.target.checked })}
                          className="w-5 h-5 rounded text-blue-500"
                        />
                        <div className="flex items-center gap-2">
                          <Repeat className="w-5 h-5 text-blue-500" />
                          <span className="font-medium text-slate-700">Créer une récurrence</span>
                        </div>
                      </label>

                      {formData.est_recurrent && (
                        <div className="mt-4 pl-8 space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Jours de la semaine
                            </label>
                            <div className="flex gap-2 flex-wrap">
                              {JOURS_SEMAINE.map(jour => (
                                <button
                                  key={jour.value}
                                  type="button"
                                  onClick={() => toggleJourRecurrence(jour.value)}
                                  className={`px-3 py-2 rounded-lg font-medium transition-all ${
                                    formData.recurrence_jours.includes(jour.value)
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  }`}
                                >
                                  {jour.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Date de fin de récurrence
                            </label>
                            <input
                              type="date"
                              value={formData.recurrence_fin}
                              onChange={(e) => setFormData({ ...formData, recurrence_fin: e.target.value })}
                              min={formData.date_cours}
                              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4 pt-4 border-t border-slate-200">
                {editingCours && (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCancelCours(editingCours.id)}
                        className="px-3 py-2 border border-orange-300 text-orange-600 rounded-lg font-medium hover:bg-orange-50 transition-all text-xs"
                        title="Change le statut en 'annulé' mais conserve le cours"
                      >
                        Annuler ce cours
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleDelete(editingCours.id, false);
                          setShowModal(false);
                        }}
                        className="px-3 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all text-xs"
                        title="Supprime définitivement ce cours"
                      >
                        Supprimer ce cours
                      </button>
                    </div>
                    {editingCours.est_recurrent && (
                      <button
                        type="button"
                        onClick={() => {
                          handleDelete(editingCours.id, true, editingCours);
                          setShowModal(false);
                        }}
                        className="px-3 py-2 bg-red-700 text-white rounded-lg font-medium hover:bg-red-800 transition-all text-xs"
                        title="Supprime tous les cours futurs de cette récurrence"
                      >
                        🗑️ Supprimer toute la récurrence
                      </button>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-all"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50"
                >
                  {saving ? 'Enregistrement...' : editingCours ? 'Mettre à jour' : 'Créer le cours'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal inscriptions */}
      {showInscriptionsModal && selectedCoursInscriptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">
                    {selectedCoursInscriptions.titre}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {new Date(selectedCoursInscriptions.date_cours).toLocaleDateString('fr-FR', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long' 
                    })} à {selectedCoursInscriptions.heure_debut.slice(0, 5)}
                  </p>
                </div>
                <button
                  onClick={() => setShowInscriptionsModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-slate-700">
                  Participants ({inscriptions.filter(i => i.statut === 'inscrit').length}/{selectedCoursInscriptions.places_max})
                </h4>
              </div>

              {inscriptions.length > 0 ? (
                <div className="space-y-2">
                  {inscriptions.map(insc => (
                    <div
                      key={insc.id}
                      className={`p-3 rounded-lg border ${
                        insc.statut === 'inscrit' 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-gray-50 border-gray-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {insc.statut === 'inscrit' ? (
                            <UserCheck className="w-5 h-5 text-green-600" />
                          ) : (
                            <UserX className="w-5 h-5 text-gray-400" />
                          )}
                          <div>
                            <div className="font-medium text-slate-800">
                              {insc.adherent?.prenom} {insc.adherent?.nom}
                            </div>
                            <div className="text-xs text-slate-500">
                              {insc.adherent?.email}
                            </div>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          insc.statut === 'inscrit' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {insc.statut === 'inscrit' ? 'Inscrit' : 'Annulé'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Aucune inscription pour ce cours</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal détails du cours */}
      {showDetailModal && selectedCoursDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header avec couleur du type */}
            <div 
              className="p-5 rounded-t-2xl text-white relative flex-shrink-0"
              style={{ backgroundColor: selectedCoursDetail.type_cours?.couleur || '#6366f1' }}
            >
              <button
                onClick={() => { setShowDetailModal(false); setSelectedCoursDetail(null); }}
                className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/40 transition-colors z-10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-sm opacity-90">{selectedCoursDetail.type_cours?.nom}</div>
              <h2 className="text-2xl font-bold mt-1">{selectedCoursDetail.titre}</h2>
              {selectedCoursDetail.coach_id === user?.id && (
                <span className="mt-2 inline-block bg-white/20 text-white text-xs font-bold px-2 py-1 rounded">
                  Vous animez ce cours
                </span>
              )}
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Date et heure */}
              <div className="flex items-center gap-4 text-slate-700">
                <div className="bg-slate-100 p-3 rounded-lg">
                  <Calendar className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800">
                    {new Date(selectedCoursDetail.date_cours).toLocaleDateString('fr-FR', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="text-slate-500">
                    {selectedCoursDetail.heure_debut.slice(0, 5)} - {selectedCoursDetail.heure_fin.slice(0, 5)}
                  </div>
                </div>
              </div>

              {/* Coach */}
              <div className="flex items-center gap-4 text-slate-700">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm text-slate-500">Animé par</div>
                  <div className="font-semibold text-slate-800">
                    {selectedCoursDetail.coach ? 
                      `${selectedCoursDetail.coach.prenom} ${selectedCoursDetail.coach.nom}` : 
                      'Coach non assigné'}
                  </div>
                </div>
              </div>

              {/* Places */}
              <div className="flex items-center gap-4 text-slate-700">
                <div className="bg-green-100 p-3 rounded-lg">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-sm text-slate-500">Inscriptions</div>
                  <div className="font-semibold text-slate-800">
                    {selectedCoursDetail.inscriptions_count} / {selectedCoursDetail.places_max} places
                  </div>
                  <div className={`text-sm ${
                    selectedCoursDetail.inscriptions_count === selectedCoursDetail.places_max 
                      ? 'text-red-600' 
                      : 'text-green-600'
                  }`}>
                    {selectedCoursDetail.inscriptions_count === selectedCoursDetail.places_max 
                      ? 'Complet' 
                      : `${selectedCoursDetail.places_max - (selectedCoursDetail.inscriptions_count || 0)} places disponibles`}
                  </div>
                </div>
              </div>

              {/* Statut */}
              {selectedCoursDetail.statut !== 'planifie' && (
                <div className={`flex items-center gap-3 p-3 rounded-lg ${
                  selectedCoursDetail.statut === 'annule' ? 'bg-red-50' : 'bg-gray-50'
                }`}>
                  <AlertCircle className={`w-5 h-5 ${
                    selectedCoursDetail.statut === 'annule' ? 'text-red-500' : 'text-gray-500'
                  }`} />
                  <span className={`font-medium ${
                    selectedCoursDetail.statut === 'annule' ? 'text-red-700' : 'text-gray-700'
                  }`}>
                    {selectedCoursDetail.statut === 'annule' ? 'Cours annulé' : 'Cours terminé'}
                  </span>
                </div>
              )}

              {/* Description */}
              {selectedCoursDetail.description && (
                <div className="pt-3 border-t border-slate-200">
                  <h4 className="text-sm font-medium text-slate-500 mb-2">Description</h4>
                  <p className="text-slate-700">{selectedCoursDetail.description}</p>
                </div>
              )}

              {/* Boutons d'action */}
              <div className="pt-4 border-t border-slate-200 flex flex-col gap-2">
                <button
                  onClick={() => { 
                    setShowDetailModal(false); 
                    openInscriptionsModal(selectedCoursDetail); 
                  }}
                  className="w-full py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Voir les inscriptions ({selectedCoursDetail.inscriptions_count})
                </button>
                
                {isSuperAdmin && (
                  <button
                    onClick={() => { 
                      setShowDetailModal(false); 
                      openEditModal(selectedCoursDetail); 
                    }}
                    className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Modifier ce cours
                  </button>
                )}
                
                <button
                  onClick={() => { setShowDetailModal(false); setSelectedCoursDetail(null); }}
                  className="w-full py-2 text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation pour modification de récurrence */}
      {showRecurrenceConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-5 text-white">
              <div className="flex items-center gap-3">
                <Repeat className="w-8 h-8" />
                <div>
                  <h3 className="text-xl font-bold">Cours récurrent</h3>
                  <p className="text-blue-100 text-sm">Comment appliquer les modifications ?</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-slate-600">
                Ce cours fait partie d'une série récurrente. Souhaitez-vous modifier :
              </p>

              {/* Option 1 - Ce cours uniquement */}
              <button
                onClick={confirmUpdateSingle}
                disabled={saving}
                className="w-full p-4 border-2 border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 group-hover:bg-blue-100 p-3 rounded-lg transition-colors">
                    <Calendar className="w-6 h-6 text-slate-600 group-hover:text-blue-600" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Uniquement ce cours</div>
                    <div className="text-sm text-slate-500">Modifier seulement le cours du {pendingUpdateData?.editingCours?.date_cours ? new Date(pendingUpdateData.editingCours.date_cours).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : ''}</div>
                  </div>
                </div>
              </button>

              {/* Option 2 - Toute la récurrence */}
              <button
                onClick={confirmUpdateAll}
                disabled={saving}
                className="w-full p-4 border-2 border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 group-hover:bg-blue-100 p-3 rounded-lg transition-colors">
                    <Repeat className="w-6 h-6 text-slate-600 group-hover:text-blue-600" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Toute la récurrence</div>
                    <div className="text-sm text-slate-500">Modifier tous les cours futurs de cette série</div>
                  </div>
                </div>
              </button>

              {/* Annuler */}
              <button
                onClick={() => {
                  setShowRecurrenceConfirmModal(false);
                  setPendingUpdateData(null);
                }}
                className="w-full py-3 text-slate-500 hover:text-slate-700 transition-colors font-medium"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation de suppression/annulation */}
      {showDeleteConfirmModal && pendingDeleteAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className={`p-5 text-white ${
              pendingDeleteAction.type === 'cancel' 
                ? 'bg-gradient-to-r from-orange-500 to-orange-600' 
                : 'bg-gradient-to-r from-red-500 to-red-600'
            }`}>
              <div className="flex items-center gap-3">
                <Trash2 className="w-8 h-8" />
                <div>
                  <h3 className="text-xl font-bold">
                    {pendingDeleteAction.type === 'cancel' 
                      ? 'Annuler ce cours' 
                      : pendingDeleteAction.type === 'deleteAll'
                        ? 'Supprimer la récurrence'
                        : 'Supprimer ce cours'
                    }
                  </h3>
                  <p className="text-white/80 text-sm">Cette action est irréversible</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-slate-600">
                {pendingDeleteAction.type === 'cancel' 
                  ? 'Êtes-vous sûr de vouloir annuler ce cours ? Les participants seront notifiés.'
                  : pendingDeleteAction.type === 'deleteAll'
                    ? 'Êtes-vous sûr de vouloir supprimer TOUS les cours futurs de cette récurrence ?'
                    : 'Êtes-vous sûr de vouloir supprimer définitivement ce cours ?'
                }
              </p>

              {pendingDeleteAction.type === 'deleteAll' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  ⚠️ Cette action supprimera tous les cours futurs de cette série.
                </div>
              )}

              {/* Boutons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowDeleteConfirmModal(false);
                    setPendingDeleteAction(null);
                  }}
                  className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={executeDeleteAction}
                  className={`flex-1 py-3 text-white rounded-lg font-medium transition-all ${
                    pendingDeleteAction.type === 'cancel'
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {pendingDeleteAction.type === 'cancel' ? 'Confirmer l\'annulation' : 'Confirmer la suppression'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

