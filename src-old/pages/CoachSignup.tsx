import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Dumbbell, AlertCircle, CheckCircle, Clock, Mail } from 'lucide-react';

export default function CoachSignup() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'gestion_club';

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    prenom: '',
    nom: '',
    telephone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const { signUp, user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user && userRole === 'coach') {
      navigate('/coach/dashboard', { replace: true });
    }
  }, [user, userRole, authLoading, navigate]);

  const getModeLabel = () => {
    switch(mode) {
      case 'coaching_individuel': return 'Coaching Individuel';
      case 'gestion_club': return 'Gestion Club';
      case 'coaching_structure': return 'Coaching Structure';
      default: return 'Coach';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);

    const { error } = await signUp(formData.email, formData.password, 'coach', {
      prenom: formData.prenom,
      nom: formData.nom,
      telephone: formData.telephone,
      nom_club: 'TeamFF 33',
      mode_coaching: mode,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Inscription réussie - afficher le message de confirmation
      setSignupComplete(true);
      setLoading(false);
    }
  };

  // Affichage après inscription réussie
  if (signupComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors mb-4">
              <Dumbbell className="w-8 h-8" />
              <span className="text-xl font-bold">Force Athlétique Club</span>
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-4">
              Demande envoyée !
            </h2>
            
            <div className="space-y-4 text-slate-600">
              <p className="text-lg">
                Votre demande d'inscription a bien été enregistrée.
              </p>
              
              <div className="bg-blue-50 rounded-xl p-4 text-left">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-blue-900 font-medium">Prochaine étape</p>
                    <p className="text-blue-700 text-sm mt-1">
                      L'administrateur va examiner votre demande. Vous recevrez un email de confirmation 
                      dès que votre compte sera validé.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-sm text-slate-500">
                  📧 Un email a été envoyé à <strong>{formData.email}</strong> avec les prochaines instructions.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200">
              <p className="text-sm text-slate-500 mb-4">
                Délai de traitement habituel : 24-48h
              </p>
              <Link 
                to="/"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                ← Retour à l'accueil
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors mb-4">
            <Dumbbell className="w-8 h-8" />
            <span className="text-xl font-bold">Force Athlétique Club</span>
          </Link>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Créer un compte</h2>
          <p className="text-slate-600 font-medium text-blue-600">{getModeLabel()}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Info box */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Validation requise</p>
                <p className="mt-1">Votre demande sera examinée par un administrateur avant activation de votre compte.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Prénom *</label>
                <input
                  type="text"
                  value={formData.prenom}
                  onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nom *</label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Téléphone</label>
              <input
                type="tel"
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Mot de passe *</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Confirmer le mot de passe *</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {loading ? 'Envoi de la demande...' : 'Envoyer ma demande'}
            </button>

            <div className="text-center text-sm text-slate-600">
              Déjà un compte ?{' '}
              <Link to="/coach/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Se connecter
              </Link>
            </div>
          </form>
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
