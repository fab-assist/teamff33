import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Baby,
  Plus,
  Calendar,
  Clock,
  Users,
  Edit2,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  User,
  Phone,
  Heart,
  ChevronRight,
  ChevronLeft,
  XCircle
} from 'lucide-react';

interface Enfant {
  id: string;
  prenom: string;
  nom: string;
  date_naissance: string;
  sexe: 'homme' | 'femme' | 'autre' | null;
  allergies: string | null;
  informations_medicales: string | null;
  contact_urgence: string | null;
  telephone_urgence: string | null;
}

interface TypeCours {
  id: string;
  nom: string;
  couleur: string;
}

interface CoursCollectif {
  id: string;
  titre: string;
  description: string | null;
  date_cours: string;
  heure_debut: string;
  heure_fin: string;
  places_max: number;
  type_cours?: TypeCours;
  places_disponibles?: number;
}

interface InscriptionEnfant {
  id: string;
  cours: CoursCollectif;
  enfant_id: string;
}

export default function MesEnfants() {
  const { user } = useAuth();
  const [enfants, setEnfants] = useState<Enfant[]>([]);
  const [inscriptions, setInscriptions] = useState<InscriptionEnfant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCoursModal, setShowCoursModal] = useState(false);
  const [editingEnfant, setEditingEnfant] = useState<Enfant | null>(null);
  const [selectedEnfant, setSelectedEnfant] = useState<Enfant | null>(null);
  const [coursDisponibles, setCoursDisponibles] = useState<CoursCollectif[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [enfantToDelete, setEnfantToDelete] = useState<Enfant | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(new Date());

  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    date_naissance: '',
    sexe: '' as 'homme' | 'femme' | 'autre' | '',
    allergies: '',
    informations_medicales: '',
    contact_urgence: '',
    telephone_urgence: ''
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Charger les enfants
      const { data: enfantsData } = await supabase
        .from('enfants')
        .select('*')
        .eq('parent_id', user!.id)
        .order('prenom');

      setEnfants(enfantsData || []);

      // Charger les inscriptions des enfants aux cours
      if (enfantsData && enfantsData.length > 0) {
        const enfantIds = enfantsData.map(e => e.id);
        const { data: inscriptionsData } = await supabase
          .from('inscriptions_cours')
          .select(`
            id,
            enfant_id,
            cours:cours_collectifs(
              *,
              type_cours:types_cours(*)
            )
          `)
          .in('enfant_id', enfantIds)
          .eq('statut', 'inscrit')
          .gte('cours.date_cours', new Date().toISOString().split('T')[0]);

        setInscriptions((inscriptionsData || []).filter(i => i.cours) as InscriptionEnfant[]);
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
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

  const formatWeekRange = () => {
    const start = getStartOfWeek(selectedWeek);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setSelectedWeek(newDate);
  };

  const loadCoursDisponibles = async () => {
    // Calculer les dates de la semaine
    const startOfWeek = getStartOfWeek(selectedWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const formatDateLocal = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const startStr = formatDateLocal(startOfWeek);
    const endStr = formatDateLocal(endOfWeek);

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

    if (coursData) {
      const coursWithPlaces = await Promise.all(
        coursData.map(async (c) => {
          const { count } = await supabase
            .from('inscriptions_cours')
            .select('*', { count: 'exact', head: true })
            .eq('cours_id', c.id)
            .eq('statut', 'inscrit');

          return {
            ...c,
            places_disponibles: c.places_max - (count || 0)
          };
        })
      );
      setCoursDisponibles(coursWithPlaces);
    }
  };

  // Recharger les cours quand la semaine change
  useEffect(() => {
    if (showCoursModal && selectedEnfant) {
      loadCoursDisponibles();
    }
  }, [selectedWeek, showCoursModal]);

  const getCoursForDay = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return coursDisponibles.filter(c => c.date_cours === dateStr);
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

  const openAddModal = () => {
    setEditingEnfant(null);
    setFormData({
      prenom: '',
      nom: '',
      date_naissance: '',
      sexe: '',
      allergies: '',
      informations_medicales: '',
      contact_urgence: '',
      telephone_urgence: ''
    });
    setShowModal(true);
  };

  const openEditModal = (enfant: Enfant) => {
    setEditingEnfant(enfant);
    setFormData({
      prenom: enfant.prenom,
      nom: enfant.nom,
      date_naissance: enfant.date_naissance,
      sexe: enfant.sexe || '',
      allergies: enfant.allergies || '',
      informations_medicales: enfant.informations_medicales || '',
      contact_urgence: enfant.contact_urgence || '',
      telephone_urgence: enfant.telephone_urgence || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.prenom.trim() || !formData.nom.trim() || !formData.date_naissance) {
      alert('Veuillez remplir les champs obligatoires');
      return;
    }

    setActionLoading('save');
    try {
      const enfantData = {
        parent_id: user!.id,
        prenom: formData.prenom.trim(),
        nom: formData.nom.trim(),
        date_naissance: formData.date_naissance,
        sexe: formData.sexe || null,
        allergies: formData.allergies.trim() || null,
        informations_medicales: formData.informations_medicales.trim() || null,
        contact_urgence: formData.contact_urgence.trim() || null,
        telephone_urgence: formData.telephone_urgence.trim() || null
      };

      if (editingEnfant) {
        const { error } = await supabase
          .from('enfants')
          .update(enfantData)
          .eq('id', editingEnfant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('enfants')
          .insert([enfantData]);
        if (error) throw error;
      }

      setShowModal(false);
      await loadData();
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!enfantToDelete) return;

    setActionLoading('delete');
    try {
      const { error } = await supabase
        .from('enfants')
        .delete()
        .eq('id', enfantToDelete.id);

      if (error) throw error;

      setShowDeleteConfirm(false);
      setEnfantToDelete(null);
      await loadData();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    } finally {
      setActionLoading(null);
    }
  };

  const openCoursModal = (enfant: Enfant) => {
    setSelectedEnfant(enfant);
    loadCoursDisponibles();
    setShowCoursModal(true);
  };

  const handleInscriptionEnfant = async (cours: CoursCollectif) => {
    if (!selectedEnfant) return;

    setActionLoading(cours.id);
    try {
      // Vérifier si déjà inscrit
      const { data: existing } = await supabase
        .from('inscriptions_cours')
        .select('id, statut')
        .eq('cours_id', cours.id)
        .eq('adherent_id', user!.id)
        .eq('enfant_id', selectedEnfant.id)
        .maybeSingle();

      if (existing) {
        if (existing.statut !== 'inscrit') {
          await supabase
            .from('inscriptions_cours')
            .update({ statut: 'inscrit', date_annulation: null })
            .eq('id', existing.id);
        } else {
          alert('Cet enfant est déjà inscrit à ce cours');
          setActionLoading(null);
          return;
        }
      } else {
        const { error } = await supabase
          .from('inscriptions_cours')
          .insert([{
            cours_id: cours.id,
            adherent_id: user!.id,
            enfant_id: selectedEnfant.id,
            statut: 'inscrit'
          }]);
        if (error) throw error;
      }

      // Recharger les cours disponibles et les inscriptions
      await loadCoursDisponibles();
      await loadData();
    } catch (error) {
      console.error('Erreur inscription:', error);
      alert('Erreur lors de l\'inscription');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDesinscriptionEnfant = async (inscription: InscriptionEnfant) => {
    // Vérifier si annulation possible (24h avant)
    const coursDateTime = new Date(`${inscription.cours.date_cours}T${inscription.cours.heure_debut}`);
    const now = new Date();
    const diff = coursDateTime.getTime() - now.getTime();
    const hoursUntilCours = diff / (1000 * 60 * 60);

    if (hoursUntilCours < 24) {
      alert('Vous ne pouvez plus désinscrire votre enfant moins de 24h avant le cours.');
      return;
    }

    setActionLoading(inscription.id);
    try {
      const { error } = await supabase
        .from('inscriptions_cours')
        .update({ statut: 'annule', date_annulation: new Date().toISOString() })
        .eq('id', inscription.id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Erreur désinscription:', error);
      alert('Erreur lors de la désinscription');
    } finally {
      setActionLoading(null);
    }
  };

  const getEnfantInscriptions = (enfantId: string) => {
    return inscriptions.filter(i => i.enfant_id === enfantId);
  };

  const isEnfantInscrit = (enfantId: string, coursId: string) => {
    return inscriptions.some(i => i.enfant_id === enfantId && i.cours.id === coursId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2 flex items-center gap-3">
              <Baby className="w-8 h-8 text-rose-500" />
              Mes Enfants
            </h1>
            <p className="text-slate-600">
              Gérez les profils de vos enfants et inscrivez-les aux cours collectifs
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            Ajouter un enfant
          </button>
        </div>
      </div>

      {/* Liste des enfants */}
      {enfants.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Baby className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Aucun enfant enregistré</h3>
          <p className="text-slate-500 mb-6">
            Ajoutez vos enfants pour les inscrire aux cours collectifs du club
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 bg-rose-500 text-white px-6 py-3 rounded-lg hover:bg-rose-600 transition-all"
          >
            <Plus className="w-5 h-5" />
            Ajouter mon premier enfant
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {enfants.map((enfant) => {
            const enfantInscriptions = getEnfantInscriptions(enfant.id);
            const age = calculateAge(enfant.date_naissance);
            
            return (
              <div key={enfant.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* En-tête enfant */}
                <div className="bg-gradient-to-r from-rose-500 to-pink-600 p-4 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 p-3 rounded-full">
                        <Baby className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{enfant.prenom} {enfant.nom}</h3>
                        <p className="text-white/80">{age} ans</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(enfant)}
                        className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setEnfantToDelete(enfant); setShowDeleteConfirm(true); }}
                        className="p-2 bg-white/20 rounded-lg hover:bg-red-500 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Contenu */}
                <div className="p-4 space-y-4">
                  {/* Infos médicales */}
                  {(enfant.allergies || enfant.informations_medicales) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-amber-800 font-medium mb-1">
                        <Heart className="w-4 h-4" />
                        Informations médicales
                      </div>
                      {enfant.allergies && (
                        <p className="text-sm text-amber-700">Allergies: {enfant.allergies}</p>
                      )}
                      {enfant.informations_medicales && (
                        <p className="text-sm text-amber-700">{enfant.informations_medicales}</p>
                      )}
                    </div>
                  )}

                  {/* Contact urgence */}
                  {enfant.contact_urgence && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span>Contact urgence: {enfant.contact_urgence}</span>
                      {enfant.telephone_urgence && <span>({enfant.telephone_urgence})</span>}
                    </div>
                  )}

                  {/* Prochains cours */}
                  <div className="border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-slate-800 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-rose-500" />
                        Prochains cours
                      </h4>
                      <button
                        onClick={() => openCoursModal(enfant)}
                        className="text-sm text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
                      >
                        Inscrire à un cours
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {enfantInscriptions.length === 0 ? (
                      <p className="text-slate-400 text-sm py-2">Aucune inscription</p>
                    ) : (
                      <div className="space-y-2">
                        {enfantInscriptions.slice(0, 3).map((insc) => (
                          <div
                            key={insc.id}
                            className="flex items-center justify-between bg-slate-50 rounded-lg p-3"
                          >
                            <div>
                              <p className="font-medium text-slate-800">{insc.cours.titre}</p>
                              <p className="text-sm text-slate-500">
                                {new Date(insc.cours.date_cours).toLocaleDateString('fr-FR', { 
                                  weekday: 'short', 
                                  day: 'numeric', 
                                  month: 'short' 
                                })} à {insc.cours.heure_debut.slice(0, 5)}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDesinscriptionEnfant(insc)}
                              disabled={actionLoading === insc.id}
                              className="text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
                            >
                              {actionLoading === insc.id ? '...' : 'Annuler'}
                            </button>
                          </div>
                        ))}
                        {enfantInscriptions.length > 3 && (
                          <p className="text-sm text-slate-400 text-center">
                            +{enfantInscriptions.length - 3} autre(s) cours
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal ajout/modification enfant */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-500 to-pink-600 p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Baby className="w-6 h-6" />
                  <h2 className="text-xl font-bold">
                    {editingEnfant ? 'Modifier l\'enfant' : 'Ajouter un enfant'}
                  </h2>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Formulaire */}
            <div className="p-6 space-y-4 max-h-[calc(90vh-120px)] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Prénom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    placeholder="Prénom"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    placeholder="Nom"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date de naissance <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date_naissance}
                    onChange={(e) => setFormData({ ...formData, date_naissance: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sexe</label>
                  <select
                    value={formData.sexe}
                    onChange={(e) => setFormData({ ...formData, sexe: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  >
                    <option value="">Non spécifié</option>
                    <option value="homme">Garçon</option>
                    <option value="femme">Fille</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500" />
                  Informations médicales (optionnel)
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Allergies</label>
                    <input
                      type="text"
                      value={formData.allergies}
                      onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                      placeholder="Ex: Arachides, Gluten..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Autres informations</label>
                    <textarea
                      value={formData.informations_medicales}
                      onChange={(e) => setFormData({ ...formData, informations_medicales: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                      rows={2}
                      placeholder="Informations importantes à connaître..."
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-rose-500" />
                  Contact d'urgence (optionnel)
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nom du contact</label>
                    <input
                      type="text"
                      value={formData.contact_urgence}
                      onChange={(e) => setFormData({ ...formData, contact_urgence: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                      placeholder="Ex: Grand-mère"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
                    <input
                      type="tel"
                      value={formData.telephone_urgence}
                      onChange={(e) => setFormData({ ...formData, telephone_urgence: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                      placeholder="06 12 34 56 78"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={actionLoading === 'save'}
                className="flex-1 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-all disabled:opacity-50"
              >
                {actionLoading === 'save' ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal inscription cours - Vue Calendrier */}
      {showCoursModal && selectedEnfant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-500 to-pink-600 p-5 text-white flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Inscrire {selectedEnfant.prenom}</h2>
                  <p className="text-white/80">Sélectionnez un cours sur le calendrier</p>
                </div>
                <button
                  onClick={() => { setShowCoursModal(false); setSelectedEnfant(null); setSelectedWeek(new Date()); }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation semaine */}
            <div className="p-4 border-b border-slate-200 flex-shrink-0">
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

            {/* Calendrier */}
            <div className="flex-1 overflow-auto">
              {/* En-tête des jours */}
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
                        {coursAtHour.map((cours) => {
                          const dejaInscrit = isEnfantInscrit(selectedEnfant.id, cours.id);
                          const complet = (cours.places_disponibles || 0) <= 0;
                          const placesRestantes = cours.places_disponibles || 0;

                          return (
                            <div
                              key={cours.id}
                              className={`p-2 rounded-lg border transition-all mb-1 ${
                                dejaInscrit
                                  ? 'bg-green-50 border-green-300'
                                  : complet
                                    ? 'bg-gray-100 border-gray-300 opacity-60'
                                    : isPast
                                      ? 'bg-slate-100 border-slate-200 opacity-50'
                                      : 'bg-white border-slate-200 hover:border-rose-300 hover:shadow-md cursor-pointer'
                              }`}
                              style={{ borderLeftColor: cours.type_cours?.couleur, borderLeftWidth: '3px' }}
                              onClick={() => {
                                if (!dejaInscrit && !complet && !isPast) {
                                  handleInscriptionEnfant(cours);
                                }
                              }}
                            >
                              <div className="text-xs font-bold text-slate-800 truncate">
                                {cours.titre}
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {cours.heure_debut.slice(0, 5)}
                              </div>
                              
                              {dejaInscrit ? (
                                <div className="text-xs text-green-700 font-bold mt-1 flex items-center gap-1 bg-green-100 rounded px-1 py-0.5">
                                  <CheckCircle className="w-3 h-3" />
                                  Inscrit
                                </div>
                              ) : complet ? (
                                <div className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                                  <XCircle className="w-3 h-3" />
                                  Complet
                                </div>
                              ) : (
                                <div className={`text-xs font-medium flex items-center gap-1 mt-1 ${
                                  placesRestantes <= 3 ? 'text-orange-600' : 'text-green-600'
                                }`}>
                                  <Users className="w-3 h-3" />
                                  {placesRestantes} place{placesRestantes > 1 ? 's' : ''}
                                </div>
                              )}

                              {actionLoading === cours.id && (
                                <div className="text-xs text-rose-600 font-medium mt-1">
                                  Inscription...
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

            {/* Footer avec légende */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
              <div className="flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white border border-slate-200 rounded"></div>
                  <span className="text-slate-600">Disponible (cliquez pour inscrire)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                  <span className="text-slate-600">Inscrit</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded opacity-60"></div>
                  <span className="text-slate-600">Complet</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression */}
      {showDeleteConfirm && enfantToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-red-500 p-5 text-white">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8" />
                <div>
                  <h3 className="text-xl font-bold">Supprimer {enfantToDelete.prenom} ?</h3>
                  <p className="text-white/80 text-sm">Cette action est irréversible</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-slate-600">
                Toutes les inscriptions aux cours de cet enfant seront également supprimées.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setEnfantToDelete(null); }}
                  className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading === 'delete'}
                  className="flex-1 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all disabled:opacity-50"
                >
                  {actionLoading === 'delete' ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

