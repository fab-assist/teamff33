import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Dumbbell, Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function UpdatePasswordCoach() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const init = async () => {
      try {
        // Méthode 1: PKCE flow — code dans l'URL (?code=xxx)
        const code = searchParams.get('code');
        if (code) {
          setDebugInfo('Code PKCE détecté, échange en cours...');
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            setReady(true);
            setDebugInfo('');
            return;
          }
          console.error('Code exchange error:', error);
          setDebugInfo(`Erreur PKCE: ${error.message}`);
        }

        // Méthode 2: Implicit flow — tokens dans le hash (#access_token=xxx)
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          setDebugInfo('Token implicite détecté...');
        }

        // Méthode 3: Écouter l'event PASSWORD_RECOVERY
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          console.log('Auth event:', event);
          if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
            setReady(true);
            setDebugInfo('');
          }
        });

        // Méthode 4: Session déjà active
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setReady(true);
          setDebugInfo('');
          return;
        }

        // Timeout
        setTimeout(() => {
          setReady(prev => {
            if (!prev) {
              setSessionError(true);
              setDebugInfo(`URL: ${window.location.href}`);
            }
            return prev;
          });
        }, 8000);

        return () => subscription.unsubscribe();
      } catch (err: any) {
        console.error('Init error:', err);
        setSessionError(true);
        setDebugInfo(err.message);
      }
    };

    init();
  }, [searchParams]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        navigate('/coach/login');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error('UpdatePassword error:', error);
      if (error.message.includes('same') || error.message.includes('different')) {
        setError('Le nouveau mot de passe doit être différent de l\'ancien.');
      } else if (error.message.includes('session') || error.message.includes('token')) {
        setError('Le lien a expiré. Veuillez refaire une demande de réinitialisation.');
      } else if (error.message.includes('weak') || error.message.includes('short')) {
        setError('Le mot de passe est trop faible. Essayez avec au moins 6 caractères.');
      } else {
        setError(`Erreur: ${error.message}`);
      }
      setLoading(false);
    } else {
      await supabase.auth.signOut();
      setSuccess(true);
      setLoading(false);
    }
  };

  // Chargement
  if (!ready && !sessionError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Vérification du lien en cours...</p>
          {debugInfo && <p className="text-xs text-slate-400 mt-2">{debugInfo}</p>}
        </div>
      </div>
    );
  }

  // Lien invalide
  if (sessionError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Lien invalide ou expiré</h2>
            <p className="text-slate-600 mb-6">
              Ce lien de réinitialisation n'est plus valide. Veuillez refaire une demande.
            </p>
            {debugInfo && <p className="text-xs text-slate-400 mb-4 break-all">{debugInfo}</p>}
            <Link
              to="/coach/reset-password"
              className="inline-block bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all"
            >
              Nouvelle demande
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Succès
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors mb-4">
              <Dumbbell className="w-8 h-8" />
              <span className="text-xl font-bold">Force Athlétique Club</span>
            </Link>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Mot de passe modifié</h2>
            <p className="text-slate-600 mb-6">Votre mot de passe a été modifié avec succès.</p>
            <p className="text-sm text-slate-500">Redirection vers la page de connexion coach...</p>
          </div>
        </div>
      </div>
    );
  }

  // Formulaire
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors mb-4">
            <Dumbbell className="w-8 h-8" />
            <span className="text-xl font-bold">Force Athlétique Club</span>
          </Link>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Nouveau mot de passe</h2>
          <p className="text-slate-600">Choisissez votre nouveau mot de passe</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nouveau mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Minimum 6 caractères</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Confirmer le mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Modification en cours...' : 'Modifier le mot de passe'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
