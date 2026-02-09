import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  User,
  Dumbbell,
  Copy,
  Search,
  Loader2,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Library,
  Flame,
  Zap,
  Heart,
  Target,
  Activity,
  Users,
  CheckCircle,
  Calendar,
  Play,
  XCircle,
  List,
  LayoutGrid
} from 'lucide-react';

// Types
interface Coach {
  id: string;
  prenom: string;
  nom: string;
}

interface Template {
  id: string;
  coach_id: string;
  coach_originel_id: string | null;
  titre: string;
  description: string | null;
  duree_estimee: number | null;
  niveau: string | null;
  categorie: string | null;
  type_seance: string | null;
  zone_musculaire: string | null;
  tags: string[] | null;
  nb_exercices: number;
  temps_repos_global: number | null;
  nombre_passages: number | null;
  is_public: boolean;
  created_at: string;
  coach?: Coach;
  coach_originel?: Coach;
}

interface Adherent {
  id: string;
  prenom: string;
  nom: string;
}

interface SeancePlanifiee {
  id: string;
  titre: string;
  description: string | null;
  date_seance: string;
  duree_estimee: number | null;
  statut: 'planifie' | 'en_cours' | 'termine' | 'annule';
  adherent_id: string | null;
  adherent?: Adherent;
  exercices_count: number;
}

// Options pour les filtres
const TYPES_SEANCE = [
  { value: 'force', label: 'Force', icon: Dumbbell, color: 'bg-red-100 text-red-700' },
  { value: 'cardio', label: 'Cardio', icon: Heart, color: 'bg-pink-100 text-pink-700' },
  { value: 'hiit', label: 'HIIT', icon: Flame, color: 'bg-orange-100 text-orange-700' },
  { value: 'circuit', label: 'Circuit', icon: Activity, color: 'bg-amber-100 text-amber-700' },
  { value: 'mobilite', label: 'Mobilité', icon: Zap, color: 'bg-green-100 text-green-700' },
  { value: 'stretching', label: 'Stretching', icon: Target, color: 'bg-teal-100 text-teal-700' },
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
  { value: 'debutant', label: 'Débutant', color: 'bg-green-100 text-green-700' },
  { value: 'intermediaire', label: 'Intermédiaire', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'avance', label: 'Avancé', color: 'bg-red-100 text-red-700' },
];

type ViewTab = 'my_bank' | 'all_coaches' | 'planned';
type PlannedViewMode = 'list' | 'calendar';

export default function BanqueSeances() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [seancesPlanifiees, setSeancesPlanifiees] = useState<SeancePlanifiee[]>([]);
  const [plannedCount, setPlannedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState<string | null>(null);

  // Filtres
  const [activeTab, setActiveTab] = useState<ViewTab>('my_bank');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterZone, setFilterZone] = useState<string>('');
  const [filterNiveau, setFilterNiveau] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Vue calendrier
  const [plannedViewMode, setPlannedViewMode] = useState<PlannedViewMode>('list');
  const [selectedWeek, setSelectedWeek] = useState(new Date());

  // Modal de sélection pour ajouter une séance
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [bankTemplates, setBankTemplates] = useState<Template[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [bankSearch, setBankSearch] = useState('');

  // Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Lire les paramètres URL au montage
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const viewParam = searchParams.get('view');
    
    if (tabParam === 'planned') {
      setActiveTab('planned');
    }
    if (viewParam === 'calendar') {
      setPlannedViewMode('calendar');
    }
  }, [searchParams]);

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // === FONCTIONS CALENDRIER ===
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

  const formatDateLocal = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getSeancesForDay = (date: Date) => {
    const dateStr = formatDateLocal(date);
    return seancesPlanifiees.filter(s => s.date_seance === dateStr);
  };

  // Ouvrir le modal d'ajout
  const openAddModal = async (date: string) => {
    setSelectedDate(date);
    setShowAddModal(true);
    setBankSearch('');
    setLoadingBank(true);

    try {
      // Charger les templates de ma banque
      const { data, error } = await supabase
        .from('templates_seances')
        .select('*')
        .eq('coach_id', user!.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setBankTemplates(data.map(t => ({
          ...t,
          nb_exercices: t.nb_exercices || 0
        })));
      }
    } catch (error) {
      console.error('Erreur chargement banque:', error);
    } finally {
      setLoadingBank(false);
    }
  };

  // Filtrer les templates dans le modal
  const filteredBankTemplates = bankTemplates.filter(t => {
    if (!bankSearch) return true;
    const searchLower = bankSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const titleLower = (t.titre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return titleLower.includes(searchLower);
  });

  // Charger le compteur de séances planifiées au montage
  useEffect(() => {
    if (user) {
      loadPlannedCount();
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'planned') {
      loadSeancesPlanifiees();
    } else {
      loadTemplates();
    }
  }, [user, activeTab, selectedWeek, plannedViewMode]);

  const loadPlannedCount = async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('seances')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', user.id)
      .gte('date_seance', today);
    setPlannedCount(count || 0);
  };

  const loadTemplates = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // D'abord charger les templates
      let query = supabase
        .from('templates_seances')
        .select('*')
        .order('created_at', { ascending: false });

      if (activeTab === 'my_bank') {
        query = query.eq('coach_id', user.id);
      } else {
        query = query.neq('coach_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Si on est sur "autres coachs", charger les infos des coachs séparément
      let coachesMap: Record<string, Coach> = {};
      if (activeTab === 'all_coaches' && data && data.length > 0) {
        const coachIds = [...new Set(data.map(t => t.coach_id))];
        const { data: coachesData } = await supabase
          .from('coaches')
          .select('id, prenom, nom')
          .in('id', coachIds);
        
        if (coachesData) {
          coachesData.forEach(c => {
            coachesMap[c.id] = c;
          });
        }
      }
      
      const templatesWithDefaults = (data || []).map(t => ({
        ...t,
        nb_exercices: t.nb_exercices || 0,
        coach: coachesMap[t.coach_id] || null,
        coach_originel: null
      }));
      
      setTemplates(templatesWithDefaults);

    } catch (error) {
      console.error('Erreur chargement:', error);
      showNotification('error', 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const loadSeancesPlanifiees = async () => {
    if (!user) return;
    setLoading(true);

    try {
      let query = supabase
        .from('seances')
        .select(`
          id,
          titre,
          description,
          date_seance,
          duree_estimee,
          statut,
          adherent_id,
          adherent:adherents(id, prenom, nom),
          exercices:seances_exercices(id)
        `)
        .eq('coach_id', user.id);

      // En mode calendrier, charger uniquement la semaine sélectionnée
      if (plannedViewMode === 'calendar') {
        const startOfWeek = getStartOfWeek(selectedWeek);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        
        query = query
          .gte('date_seance', formatDateLocal(startOfWeek))
          .lte('date_seance', formatDateLocal(endOfWeek));
      }

      query = query.order('date_seance', { ascending: plannedViewMode === 'calendar' });

      const { data, error } = await query;

      if (error) throw error;

      const seancesFormatted: SeancePlanifiee[] = (data || []).map(s => ({
        id: s.id,
        titre: s.titre,
        description: s.description,
        date_seance: s.date_seance,
        duree_estimee: s.duree_estimee,
        statut: s.statut,
        adherent_id: s.adherent_id,
        adherent: Array.isArray(s.adherent) ? s.adherent[0] : s.adherent,
        exercices_count: s.exercices?.length || 0
      }));

      setSeancesPlanifiees(seancesFormatted);
      
      // Mettre à jour le compteur (toujours les séances à venir)
      const today = new Date().toISOString().split('T')[0];
      if (plannedViewMode === 'list') {
        setPlannedCount(seancesFormatted.filter(s => s.date_seance >= today).length);
      }

    } catch (error) {
      console.error('Erreur chargement séances:', error);
      showNotification('error', 'Erreur lors du chargement des séances');
    } finally {
      setLoading(false);
    }
  };

  // Normaliser le texte pour la recherche
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  // Filtrer les templates
  const filteredTemplates = templates.filter(t => {
    // Recherche
    if (searchQuery) {
      const query = normalizeText(searchQuery);
      const searchableText = normalizeText([
        t.titre,
        t.description || '',
        t.coach?.prenom || '',
        t.coach?.nom || '',
        ...(t.tags || [])
      ].join(' '));
      
      if (!searchableText.includes(query)) return false;
    }

    // Filtres
    if (filterType && t.type_seance !== filterType) return false;
    if (filterZone && t.zone_musculaire !== filterZone) return false;
    if (filterNiveau && t.niveau !== filterNiveau) return false;

    return true;
  });

  // Copier un template dans ma banque
  const handleCopyToMyBank = async (template: Template) => {
    if (!user) return;
    setCopying(template.id);

    try {
      const { error } = await supabase.rpc('copy_template_to_my_bank', {
        source_template_id: template.id,
        target_coach_id: user.id
      });

      if (error) throw error;

      showNotification('success', `"${template.titre}" copié dans votre banque !`);
      
      // Si on est sur l'onglet "Ma banque", recharger
      if (activeTab === 'my_bank') {
        await loadTemplates();
      }

    } catch (error) {
      console.error('Erreur copie:', error);
      showNotification('error', 'Erreur lors de la copie');
    } finally {
      setCopying(null);
    }
  };

  // Supprimer un template
  const handleDelete = async (template: Template) => {
    if (!confirm(`Supprimer "${template.titre}" ?`)) return;

    try {
      const { error } = await supabase
        .from('templates_seances')
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      setTemplates(prev => prev.filter(t => t.id !== template.id));
      showNotification('success', 'Séance supprimée');

    } catch (error) {
      console.error('Erreur suppression:', error);
      showNotification('error', 'Erreur lors de la suppression');
    }
  };

  // Obtenir l'icône et couleur du type
  const getTypeInfo = (type: string | null) => {
    const found = TYPES_SEANCE.find(t => t.value === type);
    return found || { icon: Dumbbell, color: 'bg-slate-100 text-slate-700', label: type || 'Non défini' };
  };

  // Obtenir la couleur du niveau
  const getNiveauInfo = (niveau: string | null) => {
    const found = NIVEAUX.find(n => n.value === niveau);
    return found || { color: 'bg-slate-100 text-slate-600', label: niveau || 'Non défini' };
  };

  // Effacer les filtres
  const clearFilters = () => {
    setSearchQuery('');
    setFilterType('');
    setFilterZone('');
    setFilterNiveau('');
  };

  const hasActiveFilters = searchQuery || filterType || filterZone || filterNiveau;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg animate-fade-in ${
          notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <X className="w-5 h-5" />}
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Library className="w-8 h-8 text-blue-600" />
            Banque de Séances
          </h1>
          <p className="text-slate-600 mt-1">
            {activeTab === 'my_bank' 
              ? `${templates.length} séance${templates.length > 1 ? 's' : ''} dans votre banque`
              : `${templates.length} séance${templates.length > 1 ? 's' : ''} partagée${templates.length > 1 ? 's' : ''}`
            }
          </p>
        </div>

        <Link
          to="/coach/seances/builder"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25"
        >
          <Plus className="w-5 h-5" />
          Créer une séance
        </Link>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-slate-200">
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('my_bank')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'my_bank' 
                  ? 'bg-white shadow text-blue-600' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Library className="w-4 h-4" />
              Ma banque
            </button>
            <button
              onClick={() => setActiveTab('planned')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'planned' 
                  ? 'bg-white shadow text-green-600' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Planifiées ({plannedCount})
            </button>
            <button
              onClick={() => setActiveTab('all_coaches')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'all_coaches' 
                  ? 'bg-white shadow text-blue-600' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              Autres coachs
            </button>
          </div>

          {/* Bouton filtres */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtres
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-blue-600 rounded-full" />
            )}
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Recherche + Filtres */}
        <div className="p-4 space-y-4">
          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une séance..."
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>

          {/* Filtres avancés */}
          {showFilters && (
            <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
              {/* Type */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Tous les types</option>
                {TYPES_SEANCE.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>

              {/* Zone */}
              <select
                value={filterZone}
                onChange={(e) => setFilterZone(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Toutes les zones</option>
                {ZONES_MUSCULAIRES.map(zone => (
                  <option key={zone.value} value={zone.value}>{zone.label}</option>
                ))}
              </select>

              {/* Niveau */}
              <select
                value={filterNiveau}
                onChange={(e) => setFilterNiveau(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Tous les niveaux</option>
                {NIVEAUX.map(niveau => (
                  <option key={niveau.value} value={niveau.value}>{niveau.label}</option>
                ))}
              </select>

              {/* Effacer filtres */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Effacer les filtres
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CONTENU PRINCIPAL */}
      {activeTab === 'planned' ? (
        /* === SÉANCES PLANIFIÉES === */
        <>
          {/* Toggle Vue Liste / Calendrier */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
            <div className="flex items-center justify-between p-4">
              {/* Switch vue */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setPlannedViewMode('list')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                    plannedViewMode === 'list' 
                      ? 'bg-white shadow text-blue-600' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <List className="w-4 h-4" />
                  Liste
                </button>
                <button
                  onClick={() => setPlannedViewMode('calendar')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                    plannedViewMode === 'calendar' 
                      ? 'bg-white shadow text-blue-600' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Calendrier
                </button>
              </div>

              {/* Navigation semaine (seulement en mode calendrier) */}
              {plannedViewMode === 'calendar' && (
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => navigateWeek(-1)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-slate-700">{formatWeekRange()}</span>
                  </div>

                  <button
                    onClick={() => setSelectedWeek(new Date())}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Aujourd'hui
                  </button>

                  <button
                    onClick={() => navigateWeek(1)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* VUE CALENDRIER AVEC CRÉNEAUX HORAIRES */}
          {plannedViewMode === 'calendar' ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="max-h-[550px] overflow-y-auto">
                {/* En-têtes des jours - sticky */}
                <div className="grid grid-cols-8 border-b border-slate-200 sticky top-0 z-10 bg-white">
                  {/* Colonne Heure */}
                  <div className="p-3 text-center border-r border-slate-200 bg-slate-50">
                    <div className="text-xs text-slate-500 font-medium">Heure</div>
                  </div>
                  {/* Colonnes des jours */}
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
                      const dateStr = formatDateLocal(day);
                      
                      // Filtrer les séances qui commencent à cette heure
                      const daySeances = getSeancesForDay(day);
                      // Note: Les séances n'ont pas d'heure pour l'instant, donc on les affiche toutes à 09:00 par défaut
                      // On pourrait ajouter un champ heure_seance plus tard
                      const seancesAtHour = hour === 9 ? daySeances : [];

                      return (
                        <div 
                          key={dayIdx}
                          className={`p-1 border-r border-slate-200 last:border-r-0 min-h-[60px] ${
                            isToday 
                              ? 'bg-blue-50/50' 
                              : isPast 
                                ? 'bg-slate-50/80' 
                                : 'hover:bg-blue-50/30'
                          }`}
                        >
                          {/* Séances à cette heure */}
                          {seancesAtHour.map(seance => {
                            const statusColors: Record<string, string> = {
                              'planifie': 'bg-blue-50 border-blue-400',
                              'en_cours': 'bg-orange-50 border-orange-400',
                              'termine': 'bg-green-50 border-green-400',
                              'annule': 'bg-red-50 border-red-400 opacity-60'
                            };
                            const colorClass = statusColors[seance.statut] || statusColors['planifie'];

                            return (
                              <Link
                                key={seance.id}
                                to={`/coach/seances/builder?seance=${seance.id}`}
                                className={`block p-2 rounded-lg border-l-4 ${colorClass} hover:shadow-md transition-all cursor-pointer mb-1`}
                              >
                                <div className="text-xs font-bold text-slate-800 truncate">
                                  {seance.titre}
                                </div>
                                {seance.adherent && (
                                  <div className="text-xs text-slate-500 flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {seance.adherent.prenom} {seance.adherent.nom}
                                  </div>
                                )}
                                <div className="text-xs text-slate-600 flex items-center gap-1">
                                  <Dumbbell className="w-3 h-3" />
                                  {seance.exercices_count} exo
                                  {seance.duree_estimee && (
                                    <span className="ml-1">• {seance.duree_estimee}'</span>
                                  )}
                                </div>
                              </Link>
                            );
                          })}

                          {/* Bouton ajouter au survol (seulement jours futurs et créneau 09:00) */}
                          {!isPast && hour === 9 && seancesAtHour.length === 0 && (
                            <button
                              onClick={() => openAddModal(dateStr)}
                              className="w-full h-full min-h-[50px] flex items-center justify-center gap-1 border-2 border-dashed border-transparent hover:border-blue-300 rounded-lg text-transparent hover:text-blue-500 hover:bg-blue-50/50 transition-all"
                            >
                              <Plus className="w-4 h-4" />
                              <span className="text-xs">Ajouter</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Bouton flottant pour ajouter */}
              <div className="p-4 border-t border-slate-200 bg-slate-50">
                <button
                  onClick={() => openAddModal(formatDateLocal(new Date()))}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Ajouter une séance
                </button>
              </div>
            </div>
          ) : (
            /* VUE LISTE */
            <div className="space-y-4">
              {seancesPlanifiees.length > 0 ? (
                seancesPlanifiees.map(seance => {
                  const isUpcoming = seance.date_seance >= new Date().toISOString().split('T')[0];
                  const statusStyles: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
                    'planifie': { bg: 'bg-blue-100', text: 'text-blue-700', icon: Calendar },
                    'en_cours': { bg: 'bg-orange-100', text: 'text-orange-700', icon: Play },
                    'termine': { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
                    'annule': { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle }
                  };
                  const statusLabels: Record<string, string> = {
                    'planifie': 'Planifiée',
                    'en_cours': 'En cours',
                    'termine': 'Terminée',
                    'annule': 'Annulée'
                  };
                  const style = statusStyles[seance.statut] || statusStyles['planifie'];
                  const StatusIcon = style.icon;

                  return (
                    <div
                      key={seance.id}
                      className={`bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow ${
                        isUpcoming ? 'border-slate-200' : 'border-slate-100 opacity-75'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Date */}
                        <div className={`flex-shrink-0 w-16 text-center p-2 rounded-lg ${
                          isUpcoming ? 'bg-blue-50' : 'bg-slate-50'
                        }`}>
                          <div className={`text-2xl font-bold ${
                            isUpcoming ? 'text-blue-600' : 'text-slate-400'
                          }`}>
                            {new Date(seance.date_seance).getDate()}
                          </div>
                          <div className="text-xs text-slate-500 uppercase">
                            {new Date(seance.date_seance).toLocaleDateString('fr-FR', { month: 'short' })}
                          </div>
                        </div>

                        {/* Infos */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <h3 className="font-semibold text-slate-800">{seance.titre}</h3>
                              {seance.adherent && (
                                <p className="text-sm text-slate-500 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {seance.adherent.prenom} {seance.adherent.nom}
                                </p>
                              )}
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusLabels[seance.statut]}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Dumbbell className="w-4 h-4" />
                              {seance.exercices_count} exercice{seance.exercices_count > 1 ? 's' : ''}
                            </span>
                            {seance.duree_estimee && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                ~{seance.duree_estimee} min
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Link
                            to={`/coach/seances/builder?seance=${seance.id}`}
                            className="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                            title="Modifier"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <Link
                            to={`/coach/seances/builder?from_seance=${seance.id}`}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                            title="Dupliquer"
                          >
                            <Copy className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={async () => {
                              if (!confirm('Supprimer cette séance ?')) return;
                              await supabase.from('seances').delete().eq('id', seance.id);
                              loadSeancesPlanifiees();
                              loadPlannedCount();
                            }}
                            className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-slate-50 rounded-xl p-12 text-center">
                  <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-600 mb-2">Aucune séance planifiée</h3>
                  <p className="text-slate-500 mb-6">Créez votre première séance avec une date et un adhérent</p>
                  <Link
                    to="/coach/seances/builder"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Créer une séance
                  </Link>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* === TEMPLATES (MA BANQUE / AUTRES COACHS) === */
        <>
          {/* Grille de cartes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTemplates.map(template => {
              const typeInfo = getTypeInfo(template.type_seance);
              const niveauInfo = getNiveauInfo(template.niveau);
              const TypeIcon = typeInfo.icon;
              const isMyTemplate = template.coach_id === user?.id;
              const originalCoach = template.coach_originel || template.coach;

              return (
                <div 
                  key={template.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-200 group"
                >
                  {/* Header coloré selon le type */}
                  <div className={`h-2 ${typeInfo.color.split(' ')[0]}`} />

                  <div className="p-5">
                    {/* Titre + Type */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${typeInfo.color}`}>
                          <TypeIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800 line-clamp-1">{template.titre}</h3>
                          <p className="text-xs text-slate-500">{typeInfo.label}</p>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {template.description && (
                      <p className="text-sm text-slate-600 line-clamp-2 mb-3">{template.description}</p>
                    )}

                    {/* Infos */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {/* Durée */}
                      {template.duree_estimee && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-md text-xs text-slate-600">
                          <Clock className="w-3 h-3" />
                          {template.duree_estimee} min
                        </span>
                      )}

                      {/* Exercices */}
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-md text-xs text-slate-600">
                        <Dumbbell className="w-3 h-3" />
                        {template.nb_exercices || 0} exo{(template.nb_exercices || 0) > 1 ? 's' : ''}
                      </span>

                      {/* Niveau */}
                      {template.niveau && (
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${niveauInfo.color}`}>
                          {niveauInfo.label}
                        </span>
                      )}

                      {/* Zone */}
                      {template.zone_musculaire && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs">
                          {ZONES_MUSCULAIRES.find(z => z.value === template.zone_musculaire)?.label || template.zone_musculaire}
                        </span>
                      )}
                    </div>

                    {/* Coach originel */}
                    {!isMyTemplate && originalCoach && (
                      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-medium">
                          {originalCoach.prenom?.[0]}{originalCoach.nom?.[0]}
                        </div>
                        <span className="text-xs text-slate-500">
                          Par {originalCoach.prenom} {originalCoach.nom}
                        </span>
                      </div>
                    )}

                    {/* Coach originel (si c'est ma copie) */}
                    {isMyTemplate && template.coach_originel && (
                      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                        <span className="text-xs text-slate-400">
                          Copié de {template.coach_originel.prenom} {template.coach_originel.nom}
                        </span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {isMyTemplate ? (
                        <>
                          {/* Modifier */}
                          <Link
                            to={`/coach/seances/builder?template=${template.id}`}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                          >
                            <Edit2 className="w-4 h-4" />
                            Modifier
                          </Link>

                          {/* Utiliser (créer séance depuis template) */}
                          <Link
                            to={`/coach/seances/builder?from_template=${template.id}`}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                          >
                            <Plus className="w-4 h-4" />
                            Utiliser
                          </Link>

                          {/* Supprimer */}
                          <button
                            onClick={() => handleDelete(template)}
                            className="p-2.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Voir détails */}
                          <Link
                            to={`/coach/seances/builder?view_template=${template.id}`}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                          >
                            Voir détails
                          </Link>

                          {/* Copier dans ma banque */}
                          <button
                            onClick={() => handleCopyToMyBank(template)}
                            disabled={copying === template.id}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            {copying === template.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                            Copier
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty state pour templates */}
          {filteredTemplates.length === 0 && (
            <div className="bg-slate-50 rounded-xl p-12 text-center col-span-full">
              <Library className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">
                {hasActiveFilters 
                  ? 'Aucune séance ne correspond à vos critères'
                  : activeTab === 'my_bank'
                    ? 'Votre banque est vide'
                    : 'Aucune séance partagée disponible'
                }
              </h3>
              <p className="text-slate-500 mb-6">
                {hasActiveFilters
                  ? 'Essayez de modifier vos filtres'
                  : activeTab === 'my_bank'
                    ? 'Créez votre première séance pour commencer'
                    : 'Les séances des autres coachs apparaîtront ici'
                }
              </p>
              {activeTab === 'my_bank' && !hasActiveFilters && (
                <Link
                  to="/coach/seances/builder"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Créer une séance
                </Link>
              )}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                  Effacer les filtres
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal de sélection pour ajouter une séance */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Ajouter une séance</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Pour le {new Date(selectedDate).toLocaleDateString('fr-FR', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="p-6 space-y-4 flex-shrink-0">
              {/* Créer from scratch */}
              <Link
                to={`/coach/seances/builder?date=${selectedDate}`}
                onClick={() => setShowAddModal(false)}
                className="block p-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-100 group-hover:bg-blue-100 rounded-xl transition-colors">
                    <Plus className="w-6 h-6 text-slate-600 group-hover:text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 group-hover:text-blue-800">
                      Créer une séance vide
                    </h4>
                    <p className="text-sm text-slate-500">
                      Partir de zéro et construire une nouvelle séance
                    </p>
                  </div>
                </div>
              </Link>

              {/* Séparateur */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-sm font-medium text-slate-400">OU</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Titre section banque */}
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                  <Library className="w-5 h-5 text-blue-600" />
                  Utiliser un modèle de ma banque
                </h4>
                {bankTemplates.length > 0 && (
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                    {bankTemplates.length} disponible{bankTemplates.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Recherche dans la banque */}
              {bankTemplates.length > 5 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher dans ma banque..."
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              )}
            </div>

            {/* Liste des templates */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {loadingBank ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : filteredBankTemplates.length > 0 ? (
                <div className="grid gap-3">
                  {filteredBankTemplates.map(template => {
                    const typeInfo = getTypeInfo(template.type_seance);
                    const niveauInfo = getNiveauInfo(template.niveau);
                    const TypeIcon = typeInfo.icon;

                    return (
                      <Link
                        key={template.id}
                        to={`/coach/seances/builder?from_template=${template.id}&date=${selectedDate}`}
                        onClick={() => setShowAddModal(false)}
                        className="p-4 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          {/* Icône type */}
                          <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                            <TypeIcon className="w-5 h-5" />
                          </div>

                          {/* Infos */}
                          <div className="flex-1 min-w-0">
                            <h5 className="font-semibold text-slate-800 truncate group-hover:text-blue-800">
                              {template.titre}
                            </h5>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                              <span className="flex items-center gap-1">
                                <Dumbbell className="w-3 h-3" />
                                {template.nb_exercices} exo{template.nb_exercices > 1 ? 's' : ''}
                              </span>
                              {template.duree_estimee && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {template.duree_estimee} min
                                </span>
                              )}
                              {template.niveau && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${niveauInfo.color}`}>
                                  {niveauInfo.label}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Chevron */}
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Library className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  {bankSearch ? (
                    <>
                      <p className="font-medium">Aucun résultat pour "{bankSearch}"</p>
                      <button
                        onClick={() => setBankSearch('')}
                        className="text-sm text-blue-600 hover:underline mt-2"
                      >
                        Effacer la recherche
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Votre banque est vide</p>
                      <p className="text-sm mt-1">Créez des séances et sauvegardez-les dans votre banque</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 flex-shrink-0">
              <button
                onClick={() => setShowAddModal(false)}
                className="w-full py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

