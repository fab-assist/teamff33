import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  FileText,
  Copy,
  Eye,
  Filter,
  Search,
  LayoutGrid,
  List,
  CalendarDays,
  Loader2,
  Play,
  XCircle,
  MoreVertical
} from 'lucide-react';

// Types
interface Adherent {
  id: string;
  prenom: string;
  nom: string;
}

interface Seance {
  id: string;
  titre: string;
  description: string | null;
  date_seance: string;
  heure_debut: string | null;
  duree_estimee: number | null;
  statut: 'planifie' | 'en_cours' | 'termine' | 'annule';
  adherent_id: string | null;
  adherent?: Adherent;
  exercices_count?: number;
}

interface Template {
  id: string;
  titre: string;
  description: string | null;
  duree_estimee: number | null;
  niveau: string | null;
  categorie: string | null;
  exercices_count?: number;
}

type ViewMode = 'calendar' | 'list';
type FilterTab = 'upcoming' | 'history' | 'templates';

export default function Seances() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [seances, setSeances] = useState<Seance[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [adherents, setAdherents] = useState<Adherent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtres et vue
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeTab, setActiveTab] = useState<FilterTab>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAdherent, setSelectedAdherent] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Charger les adhérents
      const { data: adhData } = await supabase
        .from('adherents')
        .select('id, prenom, nom')
        .eq('coach_id', user.id)
        .order('nom');
      if (adhData) setAdherents(adhData);

      // Charger les séances avec count des exercices
      const { data: seancesData } = await supabase
        .from('seances')
        .select(`
          *,
          adherent:adherents(id, prenom, nom),
          exercices:seances_exercices(id)
        `)
        .eq('coach_id', user.id)
        .order('date_seance', { ascending: false });

      if (seancesData) {
        setSeances(seancesData.map(s => ({
          ...s,
          exercices_count: s.exercices?.length || 0
        })));
      }

      // Charger les templates
      const { data: templatesData } = await supabase
        .from('templates_seances')
        .select(`
          *,
          exercices:templates_seances_exercices(id)
        `)
        .eq('coach_id', user.id)
        .order('titre');

      if (templatesData) {
        setTemplates(templatesData.map(t => ({
          ...t,
          exercices_count: t.exercices?.length || 0
        })));
      }

    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les séances
  const today = new Date().toISOString().split('T')[0];
  
  const upcomingSeances = seances.filter(s => 
    s.date_seance >= today && s.statut !== 'annule'
  ).sort((a, b) => a.date_seance.localeCompare(b.date_seance));

  const historySeances = seances.filter(s => 
    s.date_seance < today || s.statut === 'termine' || s.statut === 'annule'
  ).sort((a, b) => b.date_seance.localeCompare(a.date_seance));

  // Appliquer les filtres de recherche
  const filterSeances = (list: Seance[]) => {
    return list.filter(s => {
      if (selectedAdherent !== 'all' && s.adherent_id !== selectedAdherent) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return s.titre.toLowerCase().includes(query) ||
               s.adherent?.prenom?.toLowerCase().includes(query) ||
               s.adherent?.nom?.toLowerCase().includes(query);
      }
      return true;
    });
  };

  const filteredUpcoming = filterSeances(upcomingSeances);
  const filteredHistory = filterSeances(historySeances);
  const filteredTemplates = templates.filter(t => {
    if (!searchQuery) return true;
    return t.titre.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Supprimer une séance
  const handleDeleteSeance = async (id: string) => {
    if (!confirm('Supprimer cette séance ?')) return;

    try {
      const { error } = await supabase
        .from('seances')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  // Dupliquer une séance
  const handleDuplicateSeance = async (seance: Seance) => {
    navigate(`/coach/seances/builder?seance=${seance.id}&duplicate=true`);
  };

  // Supprimer un template
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Supprimer ce template ?')) return;

    try {
      const { error } = await supabase
        .from('templates_seances')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  // Générer le calendrier
  const generateCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Lundi = 0
    
    const days: (Date | null)[] = [];
    
    // Jours vides avant
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    
    // Jours du mois
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }

    return days;
  };

  const getSeancesForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return seances.filter(s => s.date_seance === dateStr);
  };

  const getStatusBadge = (statut: string) => {
    const styles: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
      'planifie': { bg: 'bg-blue-100', text: 'text-blue-700', icon: Calendar },
      'en_cours': { bg: 'bg-orange-100', text: 'text-orange-700', icon: Play },
      'termine': { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
      'annule': { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle }
    };
    const labels: Record<string, string> = {
      'planifie': 'Planifiée',
      'en_cours': 'En cours',
      'termine': 'Terminée',
      'annule': 'Annulée'
    };
    const style = styles[statut] || styles['planifie'];
    const Icon = style.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        <Icon className="w-3 h-3" />
        {labels[statut]}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            Séances
          </h1>
          <p className="text-slate-600 mt-1">
            {upcomingSeances.length} séance{upcomingSeances.length > 1 ? 's' : ''} à venir • 
            {templates.length} template{templates.length > 1 ? 's' : ''}
          </p>
        </div>

        <Link
          to="/coach/seances/builder"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25"
        >
          <Plus className="w-5 h-5" />
          Nouvelle séance
        </Link>
      </div>

      {/* Tabs et filtres */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-slate-200">
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'upcoming' 
                  ? 'bg-white shadow text-blue-600' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              À venir ({filteredUpcoming.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'history' 
                  ? 'bg-white shadow text-blue-600' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Historique ({filteredHistory.length})
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'templates' 
                  ? 'bg-white shadow text-blue-600' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Templates ({filteredTemplates.length})
            </button>
          </div>

          {/* Vue toggle */}
          {activeTab !== 'templates' && (
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'list' 
                    ? 'bg-white shadow text-blue-600' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'calendar' 
                    ? 'bg-white shadow text-blue-600' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-4 p-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une séance..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {activeTab !== 'templates' && (
            <select
              value={selectedAdherent}
              onChange={(e) => setSelectedAdherent(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tous les adhérents</option>
              {adherents.map(adh => (
                <option key={adh.id} value={adh.id}>
                  {adh.prenom} {adh.nom}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Contenu principal */}
      {activeTab === 'templates' ? (
        /* Liste des templates */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map(template => (
            <div 
              key={template.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <FileText className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{template.titre}</h3>
                    <p className="text-sm text-slate-500">
                      {template.exercices_count} exercice{template.exercices_count! > 1 ? 's' : ''}
                      {template.duree_estimee && ` • ~${template.duree_estimee} min`}
                    </p>
                  </div>
                </div>
              </div>

              {template.description && (
                <p className="text-sm text-slate-600 mb-3 line-clamp-2">{template.description}</p>
              )}

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <Link
                  to={`/coach/seances/builder?template=${template.id}`}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Utiliser
                </Link>
                <button
                  onClick={() => handleDeleteTemplate(template.id)}
                  className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {filteredTemplates.length === 0 && (
            <div className="col-span-full bg-slate-50 rounded-xl p-12 text-center">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">Aucun template</h3>
              <p className="text-slate-500 mb-4">
                Créez des séances et sauvegardez-les comme templates pour les réutiliser
              </p>
            </div>
          )}
        </div>
      ) : viewMode === 'calendar' ? (
        /* Vue Calendrier */
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          {/* Header calendrier */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h3 className="text-lg font-semibold text-slate-800">
              {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          {/* Grille calendrier */}
          <div className="p-4">
            {/* Jours de la semaine */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-slate-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Jours du mois */}
            <div className="grid grid-cols-7 gap-1">
              {generateCalendar().map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="h-24 bg-slate-50 rounded-lg" />;
                }

                const dateStr = date.toISOString().split('T')[0];
                const daySeances = getSeancesForDate(date);
                const isToday = dateStr === today;
                const isPast = dateStr < today;

                return (
                  <div
                    key={dateStr}
                    className={`h-24 p-1 rounded-lg border transition-colors ${
                      isToday 
                        ? 'bg-blue-50 border-blue-300' 
                        : isPast 
                          ? 'bg-slate-50 border-slate-100' 
                          : 'bg-white border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${
                        isToday ? 'text-blue-700' : isPast ? 'text-slate-400' : 'text-slate-700'
                      }`}>
                        {date.getDate()}
                      </span>
                      {!isPast && (
                        <Link
                          to={`/coach/seances/builder?date=${dateStr}`}
                          className="p-1 hover:bg-blue-100 rounded text-slate-400 hover:text-blue-600"
                        >
                          <Plus className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                    <div className="space-y-0.5 overflow-hidden">
                      {daySeances.slice(0, 2).map(seance => (
                        <Link
                          key={seance.id}
                          to={`/coach/seances/builder?seance=${seance.id}`}
                          className={`block text-xs px-1 py-0.5 rounded truncate ${
                            seance.statut === 'termine' 
                              ? 'bg-green-100 text-green-700'
                              : seance.statut === 'annule'
                                ? 'bg-red-100 text-red-700 line-through'
                                : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {seance.heure_debut?.slice(0, 5)} {seance.titre}
                        </Link>
                      ))}
                      {daySeances.length > 2 && (
                        <span className="text-xs text-slate-400">+{daySeances.length - 2}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Vue Liste */
        <div className="space-y-4">
          {(activeTab === 'upcoming' ? filteredUpcoming : filteredHistory).map(seance => (
            <div
              key={seance.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                {/* Date */}
                <div className="flex-shrink-0 w-16 text-center">
                  <div className={`text-2xl font-bold ${
                    seance.date_seance === today ? 'text-blue-600' : 'text-slate-700'
                  }`}>
                    {new Date(seance.date_seance).getDate()}
                  </div>
                  <div className="text-xs text-slate-500 uppercase">
                    {new Date(seance.date_seance).toLocaleDateString('fr-FR', { month: 'short' })}
                  </div>
                  {seance.heure_debut && (
                    <div className="text-xs text-slate-400 mt-1">
                      {seance.heure_debut.slice(0, 5)}
                    </div>
                  )}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-semibold text-slate-800">{seance.titre}</h3>
                      {seance.adherent && (
                        <p className="text-sm text-slate-500 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {seance.adherent.prenom} {seance.adherent.nom}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(seance.statut)}
                  </div>

                  {seance.description && (
                    <p className="text-sm text-slate-600 line-clamp-1 mb-2">{seance.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Dumbbell className="w-4 h-4" />
                      {seance.exercices_count} exercice{seance.exercices_count! > 1 ? 's' : ''}
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
                  <button
                    onClick={() => handleDuplicateSeance(seance)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    title="Dupliquer"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSeance(seance.id)}
                    className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {(activeTab === 'upcoming' ? filteredUpcoming : filteredHistory).length === 0 && (
            <div className="bg-slate-50 rounded-xl p-12 text-center">
              <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">
                {activeTab === 'upcoming' ? 'Aucune séance à venir' : 'Aucune séance passée'}
              </h3>
              <p className="text-slate-500 mb-4">
                {activeTab === 'upcoming' 
                  ? 'Planifiez votre première séance pour commencer'
                  : 'L\'historique des séances apparaîtra ici'
                }
              </p>
              {activeTab === 'upcoming' && (
                <Link
                  to="/coach/seances/builder"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Créer une séance
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}





