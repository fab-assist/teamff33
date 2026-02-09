import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Package, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Search,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Minus,
  Circle,
  Flame,
  Dumbbell,
  Square,
  AlignJustify,
  Link,
  Box,
  Save,
  Filter
} from 'lucide-react';

// Map des icônes par nom
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'minus': Minus,
  'circle': Circle,
  'flame': Flame,
  'dumbbell': Dumbbell,
  'square': Square,
  'align-justify': AlignJustify,
  'link': Link,
  'box': Box,
  'package': Package,
};

interface Categorie {
  id: string;
  nom: string;
  description: string | null;
  icone: string;
  ordre: number;
}

interface TypeEquipement {
  id: string;
  categorie_id: string;
  nom: string;
  description: string | null;
  icone: string | null;
}

interface InventaireItem {
  id: string;
  type_equipement_id: string;
  poids: number | null;
  quantite: number;
  etat: 'neuf' | 'bon' | 'usé' | 'à_réparer' | 'hors_service';
  notes: string | null;
  type_equipement?: TypeEquipement;
}

export default function Inventaire() {
  const { coachStatus } = useAuth();
  const isSuperAdmin = coachStatus.is_super_admin;
  
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [typesEquipement, setTypesEquipement] = useState<TypeEquipement[]>([]);
  const [inventaire, setInventaire] = useState<InventaireItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategorie, setSelectedCategorie] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventaireItem | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    type_equipement_id: '',
    poids: '',
    quantite: '1',
    etat: 'bon' as InventaireItem['etat'],
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Charger les catégories
      const { data: catData } = await supabase
        .from('categories_equipement')
        .select('*')
        .order('ordre');
      
      setCategories(catData || []);
      
      // Par défaut, toutes les catégories sont fermées
      // (on ne fait rien avec expandedCategories, il reste un Set vide)

      // Charger les types d'équipements
      const { data: typesData } = await supabase
        .from('types_equipement')
        .select('*')
        .order('nom');
      
      setTypesEquipement(typesData || []);

      // Charger l'inventaire avec les types
      const { data: invData } = await supabase
        .from('inventaire')
        .select(`
          *,
          type_equipement:types_equipement(*)
        `)
        .order('poids');
      
      setInventaire(invData || []);

    } catch (error) {
      console.error('Erreur chargement inventaire:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategorie = (id: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCategories(newExpanded);
  };

  const getTypesByCategorie = (categorieId: string) => {
    return typesEquipement.filter(t => t.categorie_id === categorieId);
  };

  const getInventaireByType = (typeId: string) => {
    return inventaire.filter(i => i.type_equipement_id === typeId);
  };

  const getCategorieIcon = (iconeName: string) => {
    const Icon = iconMap[iconeName] || Package;
    return Icon;
  };

  const getEtatBadge = (etat: string) => {
    const styles: Record<string, string> = {
      'neuf': 'bg-green-100 text-green-700',
      'bon': 'bg-blue-100 text-blue-700',
      'usé': 'bg-yellow-100 text-yellow-700',
      'à_réparer': 'bg-orange-100 text-orange-700',
      'hors_service': 'bg-red-100 text-red-700'
    };
    const labels: Record<string, string> = {
      'neuf': 'Neuf',
      'bon': 'Bon état',
      'usé': 'Usé',
      'à_réparer': 'À réparer',
      'hors_service': 'Hors service'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[etat] || 'bg-gray-100'}`}>
        {labels[etat] || etat}
      </span>
    );
  };

  const handleAddItem = async () => {
    if (!formData.type_equipement_id) return;

    try {
      const { error } = await supabase
        .from('inventaire')
        .insert({
          type_equipement_id: formData.type_equipement_id,
          poids: formData.poids ? parseFloat(formData.poids) : null,
          quantite: parseInt(formData.quantite) || 1,
          etat: formData.etat,
          notes: formData.notes || null
        });

      if (error) throw error;

      await loadData();
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Erreur ajout:', error);
      alert('Erreur lors de l\'ajout');
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    try {
      const { error } = await supabase
        .from('inventaire')
        .update({
          poids: formData.poids ? parseFloat(formData.poids) : null,
          quantite: parseInt(formData.quantite) || 1,
          etat: formData.etat,
          notes: formData.notes || null
        })
        .eq('id', editingItem.id);

      if (error) throw error;

      await loadData();
      setShowEditModal(false);
      setEditingItem(null);
      resetForm();
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      alert('Erreur lors de la mise à jour');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Supprimer cet élément de l\'inventaire ?')) return;

    try {
      const { error } = await supabase
        .from('inventaire')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const openEditModal = (item: InventaireItem) => {
    setEditingItem(item);
    setFormData({
      type_equipement_id: item.type_equipement_id,
      poids: item.poids?.toString() || '',
      quantite: item.quantite.toString(),
      etat: item.etat,
      notes: item.notes || ''
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      type_equipement_id: '',
      poids: '',
      quantite: '1',
      etat: 'bon',
      notes: ''
    });
  };

  // Filtrage
  const filteredCategories = categories.filter(cat => {
    if (selectedCategorie && cat.id !== selectedCategorie) return false;
    if (!searchTerm) return true;
    
    const types = getTypesByCategorie(cat.id);
    return types.some(t => 
      t.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getInventaireByType(t.id).length > 0
    );
  });

  // Stats
  const totalItems = inventaire.reduce((sum, i) => sum + i.quantite, 0);
  const itemsARéparer = inventaire.filter(i => i.etat === 'à_réparer' || i.etat === 'hors_service').length;

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Inventaire du Club</h1>
        <p className="text-slate-600">
          {isSuperAdmin 
            ? 'Gérez le matériel et l\'équipement du club'
            : 'Consultez le matériel disponible'
          }
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total équipements</p>
              <p className="text-xl font-bold text-slate-800">{totalItems}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Box className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Catégories</p>
              <p className="text-xl font-bold text-slate-800">{categories.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Types d'équipement</p>
              <p className="text-xl font-bold text-slate-800">{typesEquipement.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${itemsARéparer > 0 ? 'bg-orange-100' : 'bg-green-100'}`}>
              <AlertCircle className={`w-5 h-5 ${itemsARéparer > 0 ? 'text-orange-600' : 'text-green-600'}`} />
            </div>
            <div>
              <p className="text-sm text-slate-500">À réparer</p>
              <p className="text-xl font-bold text-slate-800">{itemsARéparer}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher un équipement..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <select
          value={selectedCategorie || ''}
          onChange={(e) => setSelectedCategorie(e.target.value || null)}
          className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Toutes les catégories</option>
          {[...categories].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map(cat => (
            <option key={cat.id} value={cat.id}>{cat.nom}</option>
          ))}
        </select>

        {isSuperAdmin && (
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Ajouter
          </button>
        )}
      </div>

      {/* Liste par catégorie */}
      <div className="space-y-4">
        {filteredCategories.map(categorie => {
          const Icon = getCategorieIcon(categorie.icone);
          const types = getTypesByCategorie(categorie.id);
          const isExpanded = expandedCategories.has(categorie.id);
          
          // Filtrer par recherche
          const filteredTypes = types.filter(t => 
            !searchTerm || t.nom.toLowerCase().includes(searchTerm.toLowerCase())
          );

          if (filteredTypes.length === 0 && searchTerm) return null;

          return (
            <div key={categorie.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Header catégorie */}
              <button
                onClick={() => toggleCategorie(categorie.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 p-2 rounded-lg">
                    <Icon className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-slate-800">{categorie.nom}</h3>
                    {categorie.description && (
                      <p className="text-sm text-slate-500">{categorie.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-500">
                    {types.length} type{types.length > 1 ? 's' : ''}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Contenu catégorie */}
              {isExpanded && (
                <div className="border-t border-slate-200 divide-y divide-slate-100">
                  {filteredTypes.map(type => {
                    const items = getInventaireByType(type.id);
                    
                    return (
                      <div key={type.id} className="p-4 hover:bg-slate-50">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-slate-700">{type.nom}</h4>
                            {type.description && (
                              <p className="text-sm text-slate-500">{type.description}</p>
                            )}
                          </div>
                        </div>

                        {items.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {items.map(item => (
                              <div 
                                key={item.id}
                                className="flex items-center justify-between bg-slate-50 rounded-lg p-3"
                              >
                                <div className="flex items-center gap-4">
                                  {item.poids !== null && (
                                    <span className="font-bold text-blue-600 min-w-16">
                                      {item.poids} kg
                                    </span>
                                  )}
                                  <span className="text-slate-700">
                                    Quantité: <strong>{item.quantite}</strong>
                                  </span>
                                  {getEtatBadge(item.etat)}
                                  {item.notes && (
                                    <span className="text-sm text-slate-500 italic">
                                      {item.notes}
                                    </span>
                                  )}
                                </div>
                                
                                {isSuperAdmin && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => openEditModal(item)}
                                      className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                                      title="Modifier"
                                    >
                                      <Edit2 className="w-4 h-4 text-blue-600" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                      title="Supprimer"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-slate-400 italic flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            Aucun stock enregistré
                            {isSuperAdmin && (
                              <button
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    type_equipement_id: type.id
                                  }));
                                  setShowAddModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-700 font-medium"
                              >
                                → Ajouter
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Ajouter */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">Ajouter au stock</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Type d'équipement *
                </label>
                <select
                  value={formData.type_equipement_id}
                  onChange={(e) => setFormData({...formData, type_equipement_id: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Sélectionner...</option>
                  {[...categories].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map(cat => (
                    <optgroup key={cat.id} label={cat.nom}>
                      {getTypesByCategorie(cat.id).map(type => (
                        <option key={type.id} value={type.id}>{type.nom}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Poids (kg)
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    value={formData.poids}
                    onChange={(e) => setFormData({...formData, poids: e.target.value})}
                    placeholder="Ex: 20"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Quantité *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantite}
                    onChange={(e) => setFormData({...formData, quantite: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  État
                </label>
                <select
                  value={formData.etat}
                  onChange={(e) => setFormData({...formData, etat: e.target.value as InventaireItem['etat']})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="neuf">Neuf</option>
                  <option value="bon">Bon état</option>
                  <option value="usé">Usé</option>
                  <option value="à_réparer">À réparer</option>
                  <option value="hors_service">Hors service</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Remarques sur l'équipement..."
                  rows={2}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={handleAddItem}
                disabled={!formData.type_equipement_id}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                Ajouter au stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modifier */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">Modifier l'équipement</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingItem(null);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-500">Type d'équipement</p>
                <p className="font-medium text-slate-800">
                  {editingItem.type_equipement?.nom}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Poids (kg)
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    value={formData.poids}
                    onChange={(e) => setFormData({...formData, poids: e.target.value})}
                    placeholder="Ex: 20"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Quantité *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantite}
                    onChange={(e) => setFormData({...formData, quantite: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  État
                </label>
                <select
                  value={formData.etat}
                  onChange={(e) => setFormData({...formData, etat: e.target.value as InventaireItem['etat']})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="neuf">Neuf</option>
                  <option value="bon">Bon état</option>
                  <option value="usé">Usé</option>
                  <option value="à_réparer">À réparer</option>
                  <option value="hors_service">Hors service</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Remarques sur l'équipement..."
                  rows={2}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={handleUpdateItem}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                Enregistrer les modifications
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

