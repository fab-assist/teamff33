import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search,
  Filter,
  Grid3X3,
  List,
  Star,
  Clock,
  X,
  ChevronDown,
  Loader2,
  Dumbbell,
  ZoomIn,
  Edit3,
  Check,
  Save
} from 'lucide-react';

interface Categorie {
  id: string;
  slug: string;
  nom_en: string;
  nom_fr: string;
  emoji: string;
  ordre: number;
}

interface Exercice {
  id: string;
  categorie_id: string;
  nom_en: string;
  nom_fr: string;
  nom_fichier: string;
  gif_url: string;
  categorie?: Categorie;
}

export default function Exercices() {
  const { user } = useAuth();
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [favoris, setFavoris] = useState<Set<string>>(new Set());
  const [recents, setRecents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategorie, setSelectedCategorie] = useState<string>('all');
  const [showFavorisOnly, setShowFavorisOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Pagination
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;
  
  // Modal zoom
  const [zoomedExercice, setZoomedExercice] = useState<Exercice | null>(null);
  
  // Observer pour infinite scroll
  const observerTarget = useRef<HTMLDivElement>(null);

  // Charger les catégories
  useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase
        .from('categories_exercices')
        .select('*')
        .order('ordre');
      
      if (data) setCategories(data);
    };
    loadCategories();
  }, []);

  // Charger les favoris
  useEffect(() => {
    if (!user) return;
    
    const loadFavoris = async () => {
      const { data } = await supabase
        .from('exercices_favoris')
        .select('exercice_id')
        .eq('user_id', user.id);
      
      if (data) {
        setFavoris(new Set(data.map(f => f.exercice_id)));
      }
    };
    loadFavoris();
  }, [user]);

  // Charger les récents
  useEffect(() => {
    if (!user) return;
    
    const loadRecents = async () => {
      const { data } = await supabase
        .from('exercices_vus')
        .select('exercice_id')
        .eq('user_id', user.id)
        .order('vu_at', { ascending: false })
        .limit(10);
      
      if (data) {
        setRecents(data.map(r => r.exercice_id));
      }
    };
    loadRecents();
  }, [user]);

  // Fonction pour normaliser le texte (enlever les accents)
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  // Fonction pour dédupliquer les exercices par nom (garde le premier de chaque nom)
  const deduplicateExercices = (exercices: Exercice[]): Exercice[] => {
    const seen = new Map<string, Exercice>();
    for (const ex of exercices) {
      const key = normalizeText(ex.nom_fr);
      if (!seen.has(key)) {
        seen.set(key, ex);
      }
    }
    return Array.from(seen.values());
  };

  // Charger les exercices avec filtres
  const loadExercices = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(0);
      setExercices([]);
    } else {
      setLoadingMore(true);
    }

    const currentPage = reset ? 0 : page;
    
    // Si recherche active, charger TOUS les exercices (en 2 requêtes car limite Supabase de 1000)
    if (searchQuery.trim()) {
      // Première requête : 0-999
      let query1 = supabase
        .from('exercices')
        .select(`
          *,
          categorie:categories_exercices(*)
        `)
        .order('nom_fr')
        .range(0, 999);

      // Deuxième requête : 1000-1999
      let query2 = supabase
        .from('exercices')
        .select(`
          *,
          categorie:categories_exercices(*)
        `)
        .order('nom_fr')
        .range(1000, 1999);

      // Filtre par catégorie côté serveur
      if (selectedCategorie !== 'all') {
        query1 = query1.eq('categorie_id', selectedCategorie);
        query2 = query2.eq('categorie_id', selectedCategorie);
      }

      const [result1, result2] = await Promise.all([query1, query2]);
      const data = [...(result1.data || []), ...(result2.data || [])];
      const error = result1.error || result2.error;


      if (!error && data) {
        // Filtrer côté client avec normalisation des accents
        const searchWords = searchQuery.trim().toLowerCase().split(/\s+/);
        const normalizedSearchWords = searchWords.map(w => normalizeText(w));
        
        let filtered = (data as Exercice[]).filter(e => {
          const nomFrNorm = normalizeText(e.nom_fr);
          const nomEnNorm = normalizeText(e.nom_en);
          const nomFichierNorm = normalizeText(e.nom_fichier || '');
          // Chercher dans nom_fr, nom_en ET nom_fichier
          const texteRecherche = `${nomFrNorm} ${nomEnNorm} ${nomFichierNorm}`;
          
          // Tous les mots doivent être présents (ordre indépendant, accents ignorés)
          return normalizedSearchWords.every(word => texteRecherche.includes(word));
        });

        
        // Dédupliquer pour éviter les doublons (même exercice plusieurs fois)
        filtered = deduplicateExercices(filtered);
        
        if (showFavorisOnly) {
          filtered = filtered.filter(e => favoris.has(e.id));
        }

        // Pagination côté client
        const paginatedResults = filtered.slice(0, (currentPage + 1) * PAGE_SIZE);
        
        if (reset) {
          setExercices(paginatedResults);
        } else {
          setExercices(paginatedResults);
        }
        
        setHasMore(filtered.length > (currentPage + 1) * PAGE_SIZE);
        if (!reset) setPage(p => p + 1);
      }
    } else {
      // Sans recherche, requête normale avec pagination serveur
      let query = supabase
        .from('exercices')
        .select(`
          *,
          categorie:categories_exercices(*)
        `)
        .order('nom_fr')
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (selectedCategorie !== 'all') {
        query = query.eq('categorie_id', selectedCategorie);
      }

      const { data, error } = await query;

      if (!error && data) {
        let filtered = data as Exercice[];
        
        if (showFavorisOnly) {
          filtered = filtered.filter(e => favoris.has(e.id));
        }
        
        if (reset) {
          // Dédupliquer les nouveaux résultats
          setExercices(deduplicateExercices(filtered));
        } else {
          setExercices(prev => {
            const combined = [...prev, ...filtered];
            // Toujours dédupliquer après l'ajout
            return deduplicateExercices(combined);
          });
        }
        
        setHasMore(data.length === PAGE_SIZE);
        if (!reset) setPage(p => p + 1);
      }
    }

    setLoading(false);
    setLoadingMore(false);
  }, [page, selectedCategorie, searchQuery, showFavorisOnly, favoris]);

  // Charger au changement de filtres
  useEffect(() => {
    loadExercices(true);
  }, [selectedCategorie, searchQuery, showFavorisOnly]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadExercices(false);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadExercices]);

  // Toggle favori
  const toggleFavori = async (exerciceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const isFavori = favoris.has(exerciceId);
    
    if (isFavori) {
      await supabase
        .from('exercices_favoris')
        .delete()
        .eq('user_id', user.id)
        .eq('exercice_id', exerciceId);
      
      setFavoris(prev => {
        const next = new Set(prev);
        next.delete(exerciceId);
        return next;
      });
    } else {
      await supabase
        .from('exercices_favoris')
        .insert({ user_id: user.id, exercice_id: exerciceId });
      
      setFavoris(prev => new Set(prev).add(exerciceId));
    }
  };

  // Marquer comme vu et ouvrir le zoom
  const openZoom = async (exercice: Exercice) => {
    setZoomedExercice(exercice);
    
    if (!user) return;
    
    // Upsert dans exercices_vus
    await supabase
      .from('exercices_vus')
      .upsert(
        { user_id: user.id, exercice_id: exercice.id, vu_at: new Date().toISOString() },
        { onConflict: 'user_id,exercice_id' }
      );
    
    // Mettre à jour les récents localement
    setRecents(prev => {
      const filtered = prev.filter(id => id !== exercice.id);
      return [exercice.id, ...filtered].slice(0, 10);
    });
  };

  // Récupérer les exercices récents
  const exercicesRecents = exercices.filter(e => recents.includes(e.id))
    .sort((a, b) => recents.indexOf(a.id) - recents.indexOf(b.id))
    .slice(0, 5);

  // Récupérer les favoris
  const exercicesFavoris = exercices.filter(e => favoris.has(e.id)).slice(0, 5);

  // Statistiques
  const stats = {
    total: exercices.length,
    favoris: favoris.size,
    categories: categories.length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <Dumbbell className="w-8 h-8 text-blue-600" />
            Bibliothèque d'Exercices
          </h1>
          <p className="text-slate-600 mt-1">
            {stats.total} exercices • {stats.favoris} favoris • {stats.categories} catégories
          </p>
        </div>
        
        {/* Vue toggle */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-all ${
              viewMode === 'grid' 
                ? 'bg-white shadow text-blue-600' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Grid3X3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-all ${
              viewMode === 'list' 
                ? 'bg-white shadow text-blue-600' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un exercice (français ou anglais)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Filtre catégorie */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select
              value={selectedCategorie}
              onChange={(e) => setSelectedCategorie(e.target.value)}
              className="pl-10 pr-10 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white min-w-[200px]"
            >
              <option value="all">Toutes les catégories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.emoji} {cat.nom_fr}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          </div>

          {/* Filtre favoris */}
          <button
            onClick={() => setShowFavorisOnly(!showFavorisOnly)}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
              showFavorisOnly
                ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Star className={`w-5 h-5 ${showFavorisOnly ? 'fill-yellow-500' : ''}`} />
            Favoris
          </button>
        </div>
      </div>

      {/* Section Favoris (si pas filtré) */}
      {!showFavorisOnly && !searchQuery && selectedCategorie === 'all' && exercicesFavoris.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-4 border border-yellow-200">
          <h3 className="font-semibold text-amber-800 flex items-center gap-2 mb-3">
            <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
            Mes Favoris
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {exercicesFavoris.map(exercice => (
              <ExerciceCard
                key={exercice.id}
                exercice={exercice}
                isFavori={true}
                onToggleFavori={toggleFavori}
                onZoom={openZoom}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {/* Section Récents (si pas filtré) */}
      {!showFavorisOnly && !searchQuery && selectedCategorie === 'all' && exercicesRecents.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
          <h3 className="font-semibold text-blue-800 flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-blue-600" />
            Récemment consultés
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {exercicesRecents.map(exercice => (
              <ExerciceCard
                key={exercice.id}
                exercice={exercice}
                isFavori={favoris.has(exercice.id)}
                onToggleFavori={toggleFavori}
                onZoom={openZoom}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {/* Grille principale */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
      ) : exercices.length === 0 ? (
        <div className="text-center py-20">
          <Dumbbell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-600">Aucun exercice trouvé</h3>
          <p className="text-slate-500 mt-1">
            {searchQuery ? 'Essayez une autre recherche' : 'La bibliothèque est vide'}
          </p>
        </div>
      ) : (
        <>
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
              : 'flex flex-col gap-3'
          }>
            {exercices.map(exercice => (
              <ExerciceCard
                key={exercice.id}
                exercice={exercice}
                isFavori={favoris.has(exercice.id)}
                onToggleFavori={toggleFavori}
                onZoom={openZoom}
                listMode={viewMode === 'list'}
              />
            ))}
          </div>

          {/* Loader pour infinite scroll */}
          <div ref={observerTarget} className="h-10 flex items-center justify-center">
            {loadingMore && (
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            )}
          </div>
        </>
      )}

      {/* Modal Zoom */}
      {zoomedExercice && (
        <ModalZoomExercice
          exercice={zoomedExercice}
          isFavori={favoris.has(zoomedExercice.id)}
          onToggleFavori={toggleFavori}
          onClose={() => setZoomedExercice(null)}
          onUpdate={(updated) => {
            setExercices(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
            setZoomedExercice({ ...zoomedExercice, ...updated });
          }}
        />
      )}
    </div>
  );
}

// Composant Carte Exercice
interface ExerciceCardProps {
  exercice: Exercice;
  isFavori: boolean;
  onToggleFavori: (id: string, e: React.MouseEvent) => void;
  onZoom: (exercice: Exercice) => void;
  compact?: boolean;
  listMode?: boolean;
}

function ExerciceCard({ exercice, isFavori, onToggleFavori, onZoom, compact, listMode }: ExerciceCardProps) {
  if (listMode) {
    return (
      <div
        onClick={() => onZoom(exercice)}
        className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
      >
        <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100">
          <img
            src={exercice.gif_url}
            alt={exercice.nom_fr}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-800 truncate">{exercice.nom_fr}</h4>
          <p className="text-sm text-slate-500 truncate">({exercice.nom_en})</p>
          <span className="inline-flex items-center gap-1 text-xs text-slate-600 mt-1">
            {exercice.categorie?.emoji} {exercice.categorie?.nom_fr}
          </span>
        </div>
        <button
          onClick={(e) => onToggleFavori(exercice.id, e)}
          className={`p-2 rounded-full transition-all ${
            isFavori
              ? 'bg-yellow-100 text-yellow-600'
              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
          }`}
        >
          <Star className={`w-5 h-5 ${isFavori ? 'fill-yellow-500' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => onZoom(exercice)}
      className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all group ${
        compact ? 'w-36 flex-shrink-0' : ''
      }`}
    >
      {/* GIF */}
      <div className={`relative bg-slate-100 ${compact ? 'h-28' : 'h-36'}`}>
        <img
          src={exercice.gif_url}
          alt={exercice.nom_fr}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Overlay hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
          <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-all" />
        </div>
        
        {/* Bouton favori */}
        <button
          onClick={(e) => onToggleFavori(exercice.id, e)}
          className={`absolute top-2 right-2 p-1.5 rounded-full transition-all ${
            isFavori
              ? 'bg-yellow-500 text-white shadow-lg'
              : 'bg-white/80 text-slate-400 hover:bg-white hover:text-yellow-500'
          }`}
        >
          <Star className={`w-4 h-4 ${isFavori ? 'fill-white' : ''}`} />
        </button>
      </div>
      
      {/* Infos */}
      <div className={`p-2 ${compact ? 'p-2' : 'p-3'}`}>
        <h4 className={`font-medium text-slate-800 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
          {exercice.nom_fr}
        </h4>
        {!compact && (
          <p className="text-xs text-slate-500 truncate mt-0.5">
            ({exercice.nom_en})
          </p>
        )}
        <div className={`flex items-center gap-1 mt-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          <span>{exercice.categorie?.emoji}</span>
          <span className="text-slate-600 truncate">{exercice.categorie?.nom_fr}</span>
        </div>
      </div>
    </div>
  );
}

// Composant Modal Zoom avec édition
interface ModalZoomExerciceProps {
  exercice: Exercice;
  isFavori: boolean;
  onToggleFavori: (id: string, e: React.MouseEvent) => void;
  onClose: () => void;
  onUpdate: (updated: Partial<Exercice> & { id: string }) => void;
}

function ModalZoomExercice({ exercice, isFavori, onToggleFavori, onClose, onUpdate }: ModalZoomExerciceProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editNomFr, setEditNomFr] = useState(exercice.nom_fr);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (editNomFr.trim() === exercice.nom_fr) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('exercices')
      .update({ nom_fr: editNomFr.trim() })
      .eq('id', exercice.id);

    if (!error) {
      onUpdate({ id: exercice.id, nom_fr: editNomFr.trim() });
      setIsEditing(false);
    }
    setSaving(false);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 mr-4">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editNomFr}
                    onChange={(e) => setEditNomFr(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg text-slate-800 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-300"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave();
                      if (e.key === 'Escape') {
                        setEditNomFr(exercice.nom_fr);
                        setIsEditing(false);
                      }
                    }}
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="p-2 bg-green-500 hover:bg-green-600 rounded-lg transition-all"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => {
                      setEditNomFr(exercice.nom_fr);
                      setIsEditing(false);
                    }}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold truncate">{exercice.nom_fr}</h2>
                    <p className="text-blue-200 truncate">({exercice.nom_en})</p>
                  </div>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all flex-shrink-0"
                    title="Renommer l'exercice"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={(e) => onToggleFavori(exercice.id, e)}
                className={`p-2 rounded-lg transition-all ${
                  isFavori
                    ? 'bg-yellow-500 text-white'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                <Star className={`w-5 h-5 ${isFavori ? 'fill-white' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* GIF */}
        <div className="p-6 flex justify-center bg-slate-100">
          <img
            src={exercice.gif_url}
            alt={exercice.nom_fr}
            className="max-h-[400px] rounded-lg shadow-lg"
          />
        </div>

        {/* Infos */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-sm font-medium text-slate-700">
              {exercice.categorie?.emoji} {exercice.categorie?.nom_fr}
            </span>
            
            {/* Bouton ajouter à séance (pour plus tard) */}
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all opacity-50 cursor-not-allowed"
              disabled
              title="Bientôt disponible"
            >
              Ajouter à une séance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

