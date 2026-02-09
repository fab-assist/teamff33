import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Dumbbell, Mail, Lock, AlertCircle, Clock, XCircle } from 'lucide-react';

export default function CoachLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState<'default' | 'pending' | 'rejected'>('default');
  const [loading, setLoading] = useState(false);
  const { signIn, user, userRole, coachStatus, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user && userRole === 'coach' && coachStatus.status === 'approved') {
      navigate('/coach/dashboard', { replace: true });
    }
  }, [user, userRole, coachStatus, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setErrorType('default');
    setLoading(true);

    const result = await signIn(email, password);

    if (result.error) {
      if (result.status === 'pending') {
        setErrorType('pending');
        setError(result.error.message);
      } else if (result.status === 'rejected') {
        setErrorType('rejected');
        setError(result.error.message);
      } else {
        setErrorType('default');
      setError('Email ou mot de passe incorrect');
      }
      setLoading(false);
    }
  };

  const renderError = () => {
    if (!error) return null;

    if (errorType === 'pending') {
      return (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-4 rounded-lg">
          <div className="flex items-start gap-3">
            <Clock className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Compte en attente de validation</p>
              <p className="text-sm">
                Votre demande d'inscription est en cours d'examen. Vous recevrez un email 
                dès que votre compte sera activé.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (errorType === 'rejected') {
      return (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-4 rounded-lg">
          <div className="flex items-start gap-3">
            <XCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Demande refusée</p>
              <p className="text-sm">
                Votre demande d'inscription a été refusée. Si vous pensez qu'il s'agit 
                d'une erreur, veuillez nous contacter.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm">{error}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors mb-4">
            <Dumbbell className="w-8 h-8" />
            <span className="text-xl font-bold">Force Athlétique Club</span>
          </Link>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Connexion Coach</h2>
          <p className="text-slate-600">Connectez-vous pour accéder à votre espace</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {renderError()}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="coach@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>

            <div className="text-center space-y-2">
              <div className="text-sm text-slate-600">
                Pas encore de compte ?{' '}
                <Link to="/coach/signup" className="text-blue-600 hover:text-blue-700 font-medium">
                  Créer un compte
                </Link>
              </div>
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
