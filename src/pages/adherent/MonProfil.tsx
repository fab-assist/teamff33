import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Save, 
  Edit2, 
  X,
  CheckCircle,
  AlertCircle,
  Shield,
  Sparkles
} from 'lucide-react';

interface AdherentData {
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
  coach?: {
    prenom: string;
    nom: string;
  } | null;
  created_at: string;
}

const FORMULES = [
  { 
    value: 'coaching_individuel', 
    label: '🎯 Coaching Individuel', 
    desc: 'Un coach personnel vous accompagne',
    color: 'purple'
  },
  { 
    value: 'cours_collectifs', 
    label: '👥 Cours Collectifs', 
    desc: 'Participez aux séances de groupe',
    color: 'orange'
  },
  { 
    value: 'tous', 
    label: '⭐ Formule Complète', 
    desc: 'Coaching + Cours collectifs',
    color: 'green'
  },
  { 
    value: 'club', 
    label: '🏋️ Club Force Athlétique', 
    desc: 'Groupe compétition',
    color: 'amber'
  },
];

export default function MonProfil() {
  const { user } = useAuth();
  const [adherentData, setAdherentData] = useState<AdherentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showFormuleModal, setShowFormuleModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    telephone: '',
    date_naissance: '',
    sexe: '',
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('adherents')
      .select(`
        *,
        coach:coaches(prenom, nom)
      `)
      .eq('id', user!.id)
      .single();

    if (data) {
      setAdherentData(data);
      setFormData({
        prenom: data.prenom || '',
        nom: data.nom || '',
        telephone: data.telephone || '',
        date_naissance: data.date_naissance || '',
        sexe: data.sexe || '',
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.prenom.trim() || !formData.nom.trim()) {
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('adherents')
        .update({
          prenom: formData.prenom.trim(),
          nom: formData.nom.trim(),
          telephone: formData.telephone.trim() || null,
          date_naissance: formData.date_naissance || null,
          sexe: formData.sexe || null,
        })
        .eq('id', user!.id);

      if (error) throw error;

      setEditMode(false);
      setSuccessMessage('Profil mis à jour !');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadData();
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleChangeFormule = async (newFormule: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('adherents')
        .update({ type_adhesion: newFormule })
        .eq('id', user!.id);

      if (error) throw error;

      setShowFormuleModal(false);
      setSuccessMessage('Formule modifiée avec succès !');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadData();
    } catch (error) {
      console.error('Erreur changement formule:', error);
    } finally {
      setSaving(false);
    }
  };

  const getFormuleInfo = (type: string) => {
    return FORMULES.find(f => f.value === type) || { label: type, desc: '', color: 'gray' };
  };

  const getFormuleColor = (type: string) => {
    switch (type) {
      case 'coaching_individuel': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'cours_collectifs': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'tous': return 'bg-gradient-to-r from-purple-100 to-orange-100 text-purple-800 border-purple-300';
      case 'club': return 'bg-amber-100 text-amber-800 border-amber-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const calculateAge = (dateNaissance: string) => {
    const today = new Date();
    const birth = new Date(dateNaissance);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Mon Profil</h1>
        <p className="text-slate-600">Gérez vos informations personnelles et votre formule</p>
      </div>

      {/* Message de succès */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-700 font-medium">{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche - Infos principales */}
        <div className="lg:col-span-2 space-y-6">
          {/* Carte profil */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-rose-500 to-pink-600 p-6">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-4 rounded-full">
                  <User className="w-10 h-10 text-white" />
                </div>
                <div className="text-white">
                  <h2 className="text-2xl font-bold">
                    {adherentData?.prenom} {adherentData?.nom}
                  </h2>
                  <p className="text-rose-100">{adherentData?.email}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {editMode ? (
                /* Mode édition */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Prénom</label>
                      <input
                        type="text"
                        value={formData.prenom}
                        onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nom</label>
                      <input
                        type="text"
                        value={formData.nom}
                        onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
                    <input
                      type="tel"
                      value={formData.telephone}
                      onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                      placeholder="06 12 34 56 78"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Date de naissance</label>
                      <input
                        type="date"
                        value={formData.date_naissance}
                        onChange={(e) => setFormData({ ...formData, date_naissance: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Sexe</label>
                      <select
                        value={formData.sexe}
                        onChange={(e) => setFormData({ ...formData, sexe: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                      >
                        <option value="">Non renseigné</option>
                        <option value="homme">Homme</option>
                        <option value="femme">Femme</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 py-2 bg-rose-500 text-white rounded-lg font-medium hover:bg-rose-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                    <button
                      onClick={() => {
                        setEditMode(false);
                        setFormData({
                          prenom: adherentData?.prenom || '',
                          nom: adherentData?.nom || '',
                          telephone: adherentData?.telephone || '',
                          date_naissance: adherentData?.date_naissance || '',
                          sexe: adherentData?.sexe || '',
                        });
                      }}
                      className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Mode affichage */
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-slate-700">
                    <Mail className="w-5 h-5 text-slate-400" />
                    <span>{adherentData?.email}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-slate-700">
                    <Phone className="w-5 h-5 text-slate-400" />
                    <span>{adherentData?.telephone || 'Non renseigné'}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-slate-700">
                    <Calendar className="w-5 h-5 text-slate-400" />
                    <span>
                      {adherentData?.date_naissance 
                        ? `${new Date(adherentData.date_naissance).toLocaleDateString('fr-FR')} (${calculateAge(adherentData.date_naissance)} ans)`
                        : 'Non renseigné'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-700">
                    <User className="w-5 h-5 text-slate-400" />
                    <span>
                      {adherentData?.sexe === 'homme' ? '👨 Homme' : adherentData?.sexe === 'femme' ? '👩 Femme' : 'Non renseigné'}
                    </span>
                  </div>

                  <button
                    onClick={() => setEditMode(true)}
                    className="mt-4 w-full py-2 border-2 border-rose-300 text-rose-600 rounded-lg font-medium hover:bg-rose-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Modifier mes informations
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Coach assigné */}
          {adherentData?.coach && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-rose-500" />
                Mon Coach
              </h3>
              <div className="flex items-center gap-4">
                <div className="bg-rose-100 p-3 rounded-full">
                  <User className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">
                    {adherentData.coach.prenom} {adherentData.coach.nom}
                  </p>
                  <p className="text-sm text-slate-500">Coach personnel</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Colonne droite - Formule */}
        <div className="space-y-6">
          {/* Carte formule */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Ma Formule
            </h3>
            
            <div className={`p-4 rounded-xl border-2 ${getFormuleColor(adherentData?.type_adhesion || '')}`}>
              <div className="text-xl font-bold mb-1">
                {getFormuleInfo(adherentData?.type_adhesion || '').label}
              </div>
              <div className="text-sm opacity-80">
                {getFormuleInfo(adherentData?.type_adhesion || '').desc}
              </div>
            </div>

            <button
              onClick={() => setShowFormuleModal(true)}
              className="mt-4 w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium hover:from-amber-600 hover:to-orange-600 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Changer de formule
            </button>
          </div>

          {/* Infos inscription */}
          <div className="bg-slate-50 rounded-xl p-6">
            <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
              Membre depuis
            </h4>
            <p className="text-lg font-semibold text-slate-800">
              {adherentData?.created_at 
                ? new Date(adherentData.created_at).toLocaleDateString('fr-FR', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })
                : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Modal changement de formule */}
      {showFormuleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-amber-500" />
                  Changer de formule
                </h3>
                <button
                  onClick={() => setShowFormuleModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <p className="text-slate-600 mb-4">
                Sélectionnez votre nouvelle formule. Le changement sera effectif immédiatement.
              </p>

              <div className="space-y-3">
                {FORMULES.map((formule) => {
                  const isCurrentFormule = adherentData?.type_adhesion === formule.value;
                  return (
                    <button
                      key={formule.value}
                      onClick={() => !isCurrentFormule && handleChangeFormule(formule.value)}
                      disabled={saving || isCurrentFormule}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        isCurrentFormule
                          ? 'border-green-500 bg-green-50 cursor-default'
                          : 'border-slate-200 hover:border-rose-300 hover:bg-rose-50'
                      } disabled:opacity-50`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-800">{formule.label}</div>
                          <div className="text-sm text-slate-500">{formule.desc}</div>
                        </div>
                        {isCurrentFormule && (
                          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            Actuelle
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <strong>Note :</strong> Si vous passez à une formule avec coaching individuel, 
                    un coach vous sera attribué dans les plus brefs délais.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


