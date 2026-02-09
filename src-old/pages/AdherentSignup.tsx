import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Dumbbell, AlertCircle, CheckCircle, User, Phone, Calendar, Activity } from 'lucide-react';

// Liste des problèmes médicaux courants
const MEDICAL_CONDITIONS = [
  { id: 'cardiaque', label: 'Problèmes cardiaques' },
  { id: 'hypertension', label: 'Hypertension artérielle' },
  { id: 'diabete', label: 'Diabète' },
  { id: 'asthme', label: 'Asthme / Problèmes respiratoires' },
  { id: 'dos', label: 'Problèmes de dos (hernie, sciatique, etc.)' },
  { id: 'articulations', label: 'Problèmes articulaires (genoux, épaules, etc.)' },
  { id: 'epilepsie', label: 'Épilepsie' },
  { id: 'grossesse', label: 'Grossesse' },
  { id: 'chirurgie_recente', label: 'Chirurgie récente (< 6 mois)' },
  { id: 'medicaments', label: 'Prise de médicaments régulière' },
];

export default function AdherentSignup() {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signupComplete, setSignupComplete] = useState(false);

  const [formData, setFormData] = useState({
    // Étape 1: Infos de base
    email: '',
    password: '',
    confirmPassword: '',
    prenom: '',
    nom: '',
    telephone: '',
    
    // Étape 2: Infos personnelles
    date_naissance: '',
    sexe: '',
    type_adhesion: 'coaching_individuel',
    duree_formule_mois: 1 as 1 | 4 | 8, // Durée formule coaching individuel
    
    // Étape 3: Santé
    historique_medical: {} as Record<string, boolean>,
    blessures: '',
  });

  const handleMedicalChange = (id: string) => {
    setFormData(prev => ({
      ...prev,
      historique_medical: {
        ...prev.historique_medical,
        [id]: !prev.historique_medical[id]
      }
    }));
  };

  const validateStep = (stepNum: number): boolean => {
    setError('');
    
    if (stepNum === 1) {
      if (!formData.email || !formData.password || !formData.confirmPassword) {
        setError('Veuillez remplir tous les champs obligatoires');
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Les mots de passe ne correspondent pas');
        return false;
      }
      if (formData.password.length < 6) {
        setError('Le mot de passe doit contenir au moins 6 caractères');
        return false;
      }
      if (!formData.prenom || !formData.nom) {
        setError('Veuillez renseigner votre nom et prénom');
        return false;
      }
    }
    
    if (stepNum === 2) {
      if (!formData.date_naissance) {
        setError('Veuillez renseigner votre date de naissance');
        return false;
      }
      if (!formData.sexe) {
        setError('Veuillez sélectionner votre sexe');
        return false;
      }
    }
    
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    // Sécurité : ne soumettre que si on est à l'étape 3
    if (step !== 3) {
      console.error('Tentative de soumission hors étape 3');
      return;
    }
    
    if (!validateStep(step)) return;
    
    setLoading(true);
    setError('');

    // Calculer date_fin_formule si coaching individuel
    const hasCoaching = ['coaching_individuel', 'club_et_coaching', 'coaching_et_collectifs', 'tous'].includes(formData.type_adhesion);
    const dateFinFormule = hasCoaching 
      ? new Date(new Date().setMonth(new Date().getMonth() + formData.duree_formule_mois)).toISOString().split('T')[0]
      : null;

    const { error } = await signUp(formData.email, formData.password, 'adherent', {
      prenom: formData.prenom,
      nom: formData.nom,
      telephone: formData.telephone,
      date_naissance: formData.date_naissance,
      sexe: formData.sexe,
      type_adhesion: formData.type_adhesion,
      duree_formule_mois: hasCoaching ? formData.duree_formule_mois : null,
      date_fin_formule: dateFinFormule,
      historique_medical: JSON.stringify(formData.historique_medical),
      blessures: formData.blessures,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSignupComplete(true);
      setLoading(false);
    }
  };

  const getTypeAdhesionLabel = (type: string) => {
    switch (type) {
      case 'club': return 'Adhésion Club';
      case 'coaching_individuel': return 'Coaching Individuel';
      case 'cours_collectifs': return 'Cours Collectifs';
      case 'club_et_coaching': return 'Club + Coaching Individuel';
      case 'club_et_collectifs': return 'Club + Cours Collectifs';
      case 'coaching_et_collectifs': return 'Coaching + Cours Collectifs';
      case 'tous': return 'Accès Complet';
      default: return type;
    }
  };

  // Page de confirmation après inscription
  if (signupComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-100 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 text-rose-600 hover:text-rose-700 transition-colors">
              <Dumbbell className="w-8 h-8" />
              <span className="text-xl font-bold">Force Athlétique Club</span>
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-4">
              Inscription réussie !
            </h2>
            
            <p className="text-slate-600 mb-6">
              Bienvenue <strong>{formData.prenom}</strong> ! Votre compte a été créé avec succès.
            </p>

            <div className="bg-rose-50 rounded-xl p-4 mb-6 text-left">
              <p className="text-rose-800 text-sm">
                <strong>Type d'adhésion :</strong> {getTypeAdhesionLabel(formData.type_adhesion)}
              </p>
              {['coaching_individuel', 'club_et_coaching', 'coaching_et_collectifs', 'tous'].includes(formData.type_adhesion) && (
                <>
                  <p className="text-rose-700 text-sm mt-2">
                    ⏱️ Durée de formule : <strong>{formData.duree_formule_mois} mois</strong>
                  </p>
                  <p className="text-rose-700 text-sm mt-1">
                    🎯 Un coach vous sera bientôt attribué pour votre suivi personnalisé.
                  </p>
                </>
              )}
              {['cours_collectifs', 'club_et_collectifs', 'coaching_et_collectifs', 'tous'].includes(formData.type_adhesion) && (
                <p className="text-rose-700 text-sm mt-2">
                  👥 Vous pourrez vous inscrire aux cours collectifs depuis votre espace adhérent.
                </p>
              )}
            </div>

            <Link
              to="/adherent/login"
              className="inline-block w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-rose-600 hover:to-pink-700 transition-all shadow-lg"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-rose-600 hover:text-rose-700 transition-colors mb-4">
            <Dumbbell className="w-8 h-8" />
            <span className="text-xl font-bold">Force Athlétique Club</span>
          </Link>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Inscription Adhérent</h2>
          <p className="text-slate-600">Rejoignez notre club de Force Athlétique</p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                s === step 
                  ? 'bg-rose-500 text-white' 
                  : s < step 
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-200 text-slate-500'
              }`}>
                {s < step ? '✓' : s}
              </div>
              {s < 3 && (
                <div className={`w-12 h-1 mx-1 ${s < step ? 'bg-green-500' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* ÉTAPE 1: Informations de base */}
            {step === 1 && (
              <>
                <div className="flex items-center gap-2 text-rose-600 mb-4">
                  <User className="w-5 h-5" />
                  <h3 className="font-semibold">Informations de connexion</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Prénom *</label>
                    <input
                      type="text"
                      value={formData.prenom}
                      onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Nom *</label>
                    <input
                      type="text"
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    placeholder="06 XX XX XX XX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Mot de passe *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Confirmer le mot de passe *</label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {/* ÉTAPE 2: Informations personnelles */}
            {step === 2 && (
              <>
                <div className="flex items-center gap-2 text-rose-600 mb-4">
                  <Calendar className="w-5 h-5" />
                  <h3 className="font-semibold">Informations personnelles</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date de naissance *</label>
                  <input
                    type="date"
                    value={formData.date_naissance}
                    onChange={(e) => setFormData({ ...formData, date_naissance: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Sexe *</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, sexe: 'homme' })}
                      className={`py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                        formData.sexe === 'homme'
                          ? 'border-rose-500 bg-rose-50 text-rose-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      👨 Homme
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, sexe: 'femme' })}
                      className={`py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                        formData.sexe === 'femme'
                          ? 'border-rose-500 bg-rose-50 text-rose-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      👩 Femme
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Quelle formule vous correspond ? *</label>
                  <div className="space-y-3">
                    {[
                      { 
                        value: 'coaching_individuel', 
                        label: '🎯 Coaching Individuel', 
                        desc: 'Un coach personnel vous accompagne avec des séances sur-mesure',
                        details: 'Programme personnalisé • Suivi de progression • Conseils nutrition'
                      },
                      { 
                        value: 'cours_collectifs', 
                        label: '👥 Cours Collectifs', 
                        desc: 'Participez aux séances de groupe encadrées par nos coachs',
                        details: 'Squat • Développé couché • Soulevé de terre • Technique'
                      },
                      { 
                        value: 'tous', 
                        label: '⭐ Formule Complète', 
                        desc: 'Le meilleur des deux mondes !',
                        details: 'Coaching individuel + Cours collectifs inclus'
                      },
                      { 
                        value: 'club', 
                        label: '🏋️ Club Force Athlétique', 
                        desc: 'Rejoignez le groupe de compétiteurs',
                        details: 'Entraînement compétition • Préparation aux championnats'
                      },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, type_adhesion: option.value })}
                        className={`w-full py-4 px-5 rounded-xl border-2 text-left transition-all ${
                          formData.type_adhesion === option.value
                            ? 'border-rose-500 bg-rose-50 shadow-md'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-semibold text-slate-800 text-lg">{option.label}</div>
                        <div className="text-slate-600 mt-1">{option.desc}</div>
                        <div className="text-xs text-slate-400 mt-2">{option.details}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Durée formule coaching - affiché seulement si coaching individuel */}
                {['coaching_individuel', 'club_et_coaching', 'coaching_et_collectifs', 'tous'].includes(formData.type_adhesion) && (
                  <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                    <label className="block text-sm font-medium text-purple-800 mb-3">
                      ⏱️ Durée de votre formule coaching
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 1, label: '1 mois', desc: 'Découverte' },
                        { value: 4, label: '4 mois', desc: 'Progression' },
                        { value: 8, label: '8 mois', desc: 'Transformation' },
                      ].map((duree) => (
                        <button
                          key={duree.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, duree_formule_mois: duree.value as 1 | 4 | 8 })}
                          className={`py-3 px-4 rounded-lg border-2 text-center transition-all ${
                            formData.duree_formule_mois === duree.value
                              ? 'border-purple-500 bg-purple-100 text-purple-800'
                              : 'border-purple-200 hover:border-purple-300 bg-white'
                          }`}
                        >
                          <div className="font-bold text-lg">{duree.label}</div>
                          <div className="text-xs text-purple-600">{duree.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ÉTAPE 3: Santé */}
            {step === 3 && (
              <>
                <div className="flex items-center gap-2 text-rose-600 mb-4">
                  <Activity className="w-5 h-5" />
                  <h3 className="font-semibold">Informations de santé</h3>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <p className="text-amber-800 text-sm">
                    Ces informations nous permettent d'adapter votre entraînement en toute sécurité.
                    Elles restent strictement confidentielles.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Avez-vous des antécédents médicaux parmi les suivants ?
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {MEDICAL_CONDITIONS.map((condition) => (
                      <label
                        key={condition.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                          formData.historique_medical[condition.id]
                            ? 'bg-rose-50 border border-rose-200'
                            : 'bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.historique_medical[condition.id] || false}
                          onChange={() => handleMedicalChange(condition.id)}
                          className="w-5 h-5 rounded border-slate-300 text-rose-500 focus:ring-rose-500"
                        />
                        <span className="text-slate-700">{condition.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Blessures actuelles ou passées
                  </label>
                  <textarea
                    value={formData.blessures}
                    onChange={(e) => setFormData({ ...formData, blessures: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    rows={3}
                    placeholder="Décrivez vos blessures éventuelles (ex: entorse cheville 2023, tendinite épaule...)"
                  />
                </div>
              </>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-4 pt-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-all"
                >
                  ← Précédent
                </button>
              )}
              
              {step < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex-1 bg-gradient-to-r from-rose-500 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-rose-600 hover:to-pink-700 transition-all shadow-lg"
                >
                  Suivant →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-rose-500 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-rose-600 hover:to-pink-700 transition-all shadow-lg disabled:opacity-50"
                >
                  {loading ? 'Inscription...' : "Finaliser l'inscription"}
                </button>
              )}
            </div>

            <div className="text-center text-sm text-slate-600 pt-2">
              Déjà inscrit ?{' '}
              <Link to="/adherent/login" className="text-rose-600 hover:text-rose-700 font-medium">
                Se connecter
              </Link>
            </div>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-sm text-slate-600 hover:text-slate-800">
            ← Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

