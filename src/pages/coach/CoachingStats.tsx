import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  BarChart3,
  TrendingUp,
  Users,
  Star,
  Activity,
  Calendar,
  Target,
  Award,
  ChevronRight,
  Filter,
  Search,
  ArrowUp,
  ArrowDown,
  Minus,
  Clock,
  Dumbbell,
  MessageCircle
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface Feedback {
  id: string;
  titre: string;
  date_completion: string;
  date_seance: string;
  note_ressenti: number;
  difficulte_percue: number;
  note_adherent: string;
  adherent: {
    id: string;
    prenom: string;
    nom: string;
  };
}

interface Stats {
  totalSeancesTerminees: number;
  totalSeancesPlanifiees: number;
  noteMoyenne: number;
  difficulteMoyenne: number;
  adherentsActifs: number;
  seancesCetteSemaine: number;
  seancesCeMois: number;
  evolutionNote: 'up' | 'down' | 'stable';
  tauxCompletion: number;
}

interface ChartData {
  seancesParMois: { mois: string; seances: number; satisfaction: number }[];
  repartitionNotes: { note: string; count: number; fill: string }[];
  repartitionDifficulte: { niveau: string; count: number; fill: string }[];
  topAdherents: { nom: string; seances: number }[];
}

export default function CoachingStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalSeancesTerminees: 0,
    totalSeancesPlanifiees: 0,
    noteMoyenne: 0,
    difficulteMoyenne: 0,
    adherentsActifs: 0,
    seancesCetteSemaine: 0,
    seancesCeMois: 0,
    evolutionNote: 'stable',
    tauxCompletion: 0
  });
  const [chartData, setChartData] = useState<ChartData>({
    seancesParMois: [],
    repartitionNotes: [],
    repartitionDifficulte: [],
    topAdherents: []
  });
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [filteredFeedbacks, setFilteredFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterNote, setFilterNote] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');

  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  useEffect(() => {
    filterFeedbacks();
  }, [feedbacks, searchTerm, filterNote, filterPeriod]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadFeedbacks(),
        loadChartData()
      ]);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    // Séances terminées
    const { data: seancesTerminees, count: totalTerminees } = await supabase
      .from('seances')
      .select('*', { count: 'exact' })
      .eq('coach_id', user!.id)
      .eq('statut', 'termine');

    // Séances planifiées
    const { count: totalPlanifiees } = await supabase
      .from('seances')
      .select('*', { count: 'exact' })
      .eq('coach_id', user!.id)
      .eq('statut', 'planifie');

    // Calcul des moyennes
    const seancesAvecNotes = (seancesTerminees || []).filter(s => s.note_ressenti);
    const noteMoyenne = seancesAvecNotes.length > 0
      ? seancesAvecNotes.reduce((acc, s) => acc + (s.note_ressenti || 0), 0) / seancesAvecNotes.length
      : 0;

    const seancesAvecDifficulte = (seancesTerminees || []).filter(s => s.difficulte_percue);
    const difficulteMoyenne = seancesAvecDifficulte.length > 0
      ? seancesAvecDifficulte.reduce((acc, s) => acc + (s.difficulte_percue || 0), 0) / seancesAvecDifficulte.length
      : 0;

    // Adhérents uniques avec séances
    const adherentIds = [...new Set((seancesTerminees || []).map(s => s.adherent_id).filter(Boolean))];

    // Séances cette semaine
    const debutSemaine = new Date();
    debutSemaine.setDate(debutSemaine.getDate() - debutSemaine.getDay());
    debutSemaine.setHours(0, 0, 0, 0);

    const { count: seancesSemaine } = await supabase
      .from('seances')
      .select('*', { count: 'exact' })
      .eq('coach_id', user!.id)
      .eq('statut', 'termine')
      .gte('date_completion', debutSemaine.toISOString());

    // Séances ce mois
    const debutMois = new Date();
    debutMois.setDate(1);
    debutMois.setHours(0, 0, 0, 0);

    const { count: seancesMois } = await supabase
      .from('seances')
      .select('*', { count: 'exact' })
      .eq('coach_id', user!.id)
      .eq('statut', 'termine')
      .gte('date_completion', debutMois.toISOString());

    // Calcul du taux de complétion
    const total = (totalTerminees || 0) + (totalPlanifiees || 0);
    const tauxCompletion = total > 0 ? ((totalTerminees || 0) / total) * 100 : 0;

    // Évolution de la note (comparer avec le mois précédent)
    const moisPrecedent = new Date();
    moisPrecedent.setMonth(moisPrecedent.getMonth() - 1);
    
    const { data: seancesMoisPrecedent } = await supabase
      .from('seances')
      .select('note_ressenti')
      .eq('coach_id', user!.id)
      .eq('statut', 'termine')
      .gte('date_completion', moisPrecedent.toISOString())
      .lt('date_completion', debutMois.toISOString())
      .not('note_ressenti', 'is', null);

    const noteMoisPrecedent = seancesMoisPrecedent && seancesMoisPrecedent.length > 0
      ? seancesMoisPrecedent.reduce((acc, s) => acc + s.note_ressenti, 0) / seancesMoisPrecedent.length
      : noteMoyenne;

    let evolutionNote: 'up' | 'down' | 'stable' = 'stable';
    if (noteMoyenne > noteMoisPrecedent + 0.2) evolutionNote = 'up';
    else if (noteMoyenne < noteMoisPrecedent - 0.2) evolutionNote = 'down';

    setStats({
      totalSeancesTerminees: totalTerminees || 0,
      totalSeancesPlanifiees: totalPlanifiees || 0,
      noteMoyenne,
      difficulteMoyenne,
      adherentsActifs: adherentIds.length,
      seancesCetteSemaine: seancesSemaine || 0,
      seancesCeMois: seancesMois || 0,
      evolutionNote,
      tauxCompletion
    });
  };

  const loadFeedbacks = async () => {
    const { data, error } = await supabase
      .from('seances')
      .select(`
        id,
        titre,
        date_completion,
        date_seance,
        note_ressenti,
        difficulte_percue,
        note_adherent,
        adherent:adherents(id, prenom, nom)
      `)
      .eq('coach_id', user!.id)
      .eq('statut', 'termine')
      .not('note_ressenti', 'is', null)
      .order('date_completion', { ascending: false });

    if (!error && data) {
      setFeedbacks(data as unknown as Feedback[]);
    }
  };

  const loadChartData = async () => {
    // Données pour le graphique d'évolution mensuelle (6 derniers mois)
    const seancesParMois: { mois: string; seances: number; satisfaction: number }[] = [];
    const moisNoms = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const debut = new Date(date.getFullYear(), date.getMonth(), 1);
      const fin = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const { data } = await supabase
        .from('seances')
        .select('note_ressenti')
        .eq('coach_id', user!.id)
        .eq('statut', 'termine')
        .gte('date_completion', debut.toISOString())
        .lte('date_completion', fin.toISOString());

      const seances = data?.length || 0;
      const seancesAvecNote = data?.filter(s => s.note_ressenti) || [];
      const satisfaction = seancesAvecNote.length > 0
        ? seancesAvecNote.reduce((acc, s) => acc + s.note_ressenti, 0) / seancesAvecNote.length
        : 0;

      seancesParMois.push({
        mois: moisNoms[date.getMonth()],
        seances,
        satisfaction: Math.round(satisfaction * 10) / 10
      });
    }

    // Répartition des notes (1-5 étoiles)
    const { data: allSeances } = await supabase
      .from('seances')
      .select('note_ressenti')
      .eq('coach_id', user!.id)
      .eq('statut', 'termine')
      .not('note_ressenti', 'is', null);

    const notesCounts = [0, 0, 0, 0, 0];
    const noteColors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
    (allSeances || []).forEach(s => {
      if (s.note_ressenti >= 1 && s.note_ressenti <= 5) {
        notesCounts[s.note_ressenti - 1]++;
      }
    });

    const repartitionNotes = notesCounts.map((count, index) => ({
      note: `${index + 1} ★`,
      count,
      fill: noteColors[index]
    }));

    // Répartition par difficulté
    const { data: seancesDifficulte } = await supabase
      .from('seances')
      .select('difficulte_percue')
      .eq('coach_id', user!.id)
      .eq('statut', 'termine')
      .not('difficulte_percue', 'is', null);

    const difficulteNiveaux = [
      { label: 'Facile (1-3)', min: 1, max: 3, fill: '#22c55e' },
      { label: 'Modéré (4-6)', min: 4, max: 6, fill: '#eab308' },
      { label: 'Difficile (7-10)', min: 7, max: 10, fill: '#ef4444' }
    ];

    const repartitionDifficulte = difficulteNiveaux.map(niveau => ({
      niveau: niveau.label,
      count: (seancesDifficulte || []).filter(s => 
        s.difficulte_percue >= niveau.min && s.difficulte_percue <= niveau.max
      ).length,
      fill: niveau.fill
    }));

    // Top adhérents par nombre de séances
    const { data: seancesAdherents } = await supabase
      .from('seances')
      .select('adherent:adherents(id, prenom, nom)')
      .eq('coach_id', user!.id)
      .eq('statut', 'termine')
      .not('adherent_id', 'is', null);

    const adherentCounts: Record<string, { nom: string; seances: number }> = {};
    (seancesAdherents || []).forEach(s => {
      const adherent = s.adherent as unknown as { id: string; prenom: string; nom: string };
      if (adherent) {
        const key = adherent.id;
        if (!adherentCounts[key]) {
          adherentCounts[key] = { nom: `${adherent.prenom} ${adherent.nom}`, seances: 0 };
        }
        adherentCounts[key].seances++;
      }
    });

    const topAdherents = Object.values(adherentCounts)
      .sort((a, b) => b.seances - a.seances)
      .slice(0, 5);

    setChartData({
      seancesParMois,
      repartitionNotes,
      repartitionDifficulte,
      topAdherents
    });
  };

  const filterFeedbacks = () => {
    let filtered = [...feedbacks];

    // Filtre par recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(f => 
        f.titre.toLowerCase().includes(term) ||
        f.adherent?.prenom?.toLowerCase().includes(term) ||
        f.adherent?.nom?.toLowerCase().includes(term) ||
        f.note_adherent?.toLowerCase().includes(term)
      );
    }

    // Filtre par note
    if (filterNote !== 'all') {
      const note = parseInt(filterNote);
      filtered = filtered.filter(f => f.note_ressenti === note);
    }

    // Filtre par période
    if (filterPeriod !== 'all') {
      const now = new Date();
      let startDate: Date;
      
      switch (filterPeriod) {
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case '3months':
          startDate = new Date(now.setMonth(now.getMonth() - 3));
          break;
        default:
          startDate = new Date(0);
      }

      filtered = filtered.filter(f => new Date(f.date_completion) >= startDate);
    }

    setFilteredFeedbacks(filtered);
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-slate-200'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Suivi & Statistiques</h1>
        </div>
        <p className="text-indigo-100">
          Vue d'ensemble de votre activité de coaching individuel
        </p>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Séances terminées */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <Target className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">
              Total
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.totalSeancesTerminees}</p>
          <p className="text-sm text-slate-500 mt-1">Séances terminées</p>
        </div>

        {/* Note moyenne */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 rounded-xl">
              <Star className="w-6 h-6 text-yellow-600" />
            </div>
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              stats.evolutionNote === 'up' ? 'bg-green-100 text-green-700' :
              stats.evolutionNote === 'down' ? 'bg-red-100 text-red-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              {stats.evolutionNote === 'up' && <ArrowUp className="w-3 h-3" />}
              {stats.evolutionNote === 'down' && <ArrowDown className="w-3 h-3" />}
              {stats.evolutionNote === 'stable' && <Minus className="w-3 h-3" />}
              vs mois dernier
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-800">
            {stats.noteMoyenne.toFixed(1)}
            <span className="text-lg text-yellow-500 ml-1">★</span>
          </p>
          <p className="text-sm text-slate-500 mt-1">Satisfaction moyenne</p>
        </div>

        {/* Difficulté moyenne */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-xl">
              <Activity className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
              /10
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.difficulteMoyenne.toFixed(1)}</p>
          <p className="text-sm text-slate-500 mt-1">Difficulté perçue</p>
        </div>

        {/* Adhérents actifs */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full">
              Actifs
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.adherentsActifs}</p>
          <p className="text-sm text-slate-500 mt-1">Adhérents coachés</p>
        </div>
      </div>

      {/* Stats secondaires */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-5 h-5 opacity-80" />
            <span className="text-sm font-medium opacity-80">Cette semaine</span>
          </div>
          <p className="text-4xl font-bold">{stats.seancesCetteSemaine}</p>
          <p className="text-sm opacity-80 mt-1">séances terminées</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 opacity-80" />
            <span className="text-sm font-medium opacity-80">Ce mois</span>
          </div>
          <p className="text-4xl font-bold">{stats.seancesCeMois}</p>
          <p className="text-sm opacity-80 mt-1">séances terminées</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-5 h-5 opacity-80" />
            <span className="text-sm font-medium opacity-80">Taux de complétion</span>
          </div>
          <p className="text-4xl font-bold">{stats.tauxCompletion.toFixed(0)}%</p>
          <p className="text-sm opacity-80 mt-1">des séances planifiées</p>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution mensuelle */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Évolution mensuelle
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData.seancesParMois}>
              <defs>
                <linearGradient id="colorSeances" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mois" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="seances" 
                stroke="#6366f1" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorSeances)"
                name="Séances"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Satisfaction moyenne */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Satisfaction par mois
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData.seancesParMois}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mois" stroke="#64748b" fontSize={12} />
              <YAxis domain={[0, 5]} stroke="#64748b" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                }}
                formatter={(value: number) => [`${value} ★`, 'Satisfaction']}
              />
              <Line 
                type="monotone" 
                dataKey="satisfaction" 
                stroke="#eab308" 
                strokeWidth={3}
                dot={{ fill: '#eab308', strokeWidth: 2, r: 6 }}
                activeDot={{ r: 8, fill: '#ca8a04' }}
                name="Satisfaction"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Répartition des notes */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            Répartition des notes
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.repartitionNotes} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" stroke="#64748b" fontSize={12} />
              <YAxis dataKey="note" type="category" stroke="#64748b" fontSize={12} width={50} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                }}
                formatter={(value: number) => [`${value} feedbacks`, '']}
              />
              <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                {chartData.repartitionNotes.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Répartition difficulté */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-600" />
            Difficulté perçue
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData.repartitionDifficulte}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="count"
                label={({ niveau, count }) => count > 0 ? `${count}` : ''}
              >
                {chartData.repartitionDifficulte.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                }}
                formatter={(value: number, name: string, props: any) => [
                  `${value} séances`,
                  props.payload.niveau
                ]}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value, entry: any) => entry.payload.niveau}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Adhérents */}
      {chartData.topAdherents.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Top adhérents (par nombre de séances)
          </h3>
          <div className="space-y-4">
            {chartData.topAdherents.map((adherent, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  index === 0 ? 'bg-amber-100 text-amber-700' :
                  index === 1 ? 'bg-slate-200 text-slate-700' :
                  index === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{adherent.nom}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-slate-400" />
                  <span className="font-bold text-slate-700">{adherent.seances}</span>
                  <span className="text-sm text-slate-500">séances</span>
                </div>
                <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      index === 0 ? 'bg-amber-500' :
                      index === 1 ? 'bg-slate-400' :
                      index === 2 ? 'bg-orange-400' :
                      'bg-indigo-400'
                    }`}
                    style={{ 
                      width: `${(adherent.seances / chartData.topAdherents[0].seances) * 100}%` 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste des feedbacks */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-rose-600" />
              Tous les feedbacks ({filteredFeedbacks.length})
            </h3>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Recherche */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
                />
              </div>

              {/* Filtre par note */}
              <select
                value={filterNote}
                onChange={(e) => setFilterNote(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Toutes les notes</option>
                <option value="5">5 étoiles</option>
                <option value="4">4 étoiles</option>
                <option value="3">3 étoiles</option>
                <option value="2">2 étoiles</option>
                <option value="1">1 étoile</option>
              </select>

              {/* Filtre par période */}
              <select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Toutes les périodes</option>
                <option value="week">7 derniers jours</option>
                <option value="month">30 derniers jours</option>
                <option value="3months">3 derniers mois</option>
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredFeedbacks.length > 0 ? (
            filteredFeedbacks.map(feedback => (
              <div key={feedback.id} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {/* Avatar & Info adhérent */}
                  <div className="flex items-center gap-4 md:w-48">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                      {feedback.adherent?.prenom?.[0]}{feedback.adherent?.nom?.[0]}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">
                        {feedback.adherent?.prenom} {feedback.adherent?.nom}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(feedback.date_completion).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Contenu */}
                  <div className="flex-1">
                    <p className="font-medium text-slate-700 mb-2">{feedback.titre}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 mb-3">
                      {/* Note */}
                      <div className="flex items-center gap-2">
                        {renderStars(feedback.note_ressenti)}
                      </div>
                      
                      {/* Difficulté */}
                      {feedback.difficulte_percue && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500">Difficulté:</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            feedback.difficulte_percue <= 3 ? 'bg-green-100 text-green-700' :
                            feedback.difficulte_percue <= 6 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {feedback.difficulte_percue}/10
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Commentaire */}
                    {feedback.note_adherent && (
                      <div className="bg-slate-50 rounded-lg p-4 border-l-4 border-indigo-400">
                        <p className="text-sm text-slate-600 italic">"{feedback.note_adherent}"</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center">
                    <Link 
                      to={`/coach/adherents`}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <MessageCircle className="w-16 h-16 mx-auto text-slate-200 mb-4" />
              <h4 className="text-lg font-medium text-slate-600 mb-2">Aucun feedback trouvé</h4>
              <p className="text-slate-500">
                {searchTerm || filterNote !== 'all' || filterPeriod !== 'all'
                  ? "Modifiez vos filtres pour voir plus de résultats"
                  : "Les feedbacks de vos adhérents apparaîtront ici une fois les séances terminées"
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

