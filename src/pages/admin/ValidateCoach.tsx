import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Dumbbell, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface ValidationResult {
  success: boolean;
  action?: 'approve' | 'reject';
  coach?: {
    prenom: string;
    nom: string;
    email: string;
  };
  error?: string;
}

export default function ValidateCoach() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ValidationResult | null>(null);

  useEffect(() => {
    if (token) {
      validateToken(token);
    } else {
      setLoading(false);
      setResult({ success: false, error: 'Token manquant' });
    }
  }, [token]);

  const validateToken = async (token: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-coach`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ token }),
        }
      );

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Validation error:', error);
      setResult({ success: false, error: 'Erreur lors de la validation' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-slate-600">Validation en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors">
            <Dumbbell className="w-8 h-8" />
            <span className="text-xl font-bold">Force Athlétique Club</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {result?.success ? (
            result.action === 'approve' ? (
              <>
                <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-4">
                  Coach validé !
                </h2>
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-green-800">
                    <strong>{result.coach?.prenom} {result.coach?.nom}</strong> peut maintenant 
                    se connecter à l'application.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <XCircle className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-4">
                  Demande refusée
                </h2>
                <div className="bg-slate-50 rounded-xl p-4 mb-6">
                  <p className="text-slate-700">
                    La demande de <strong>{result.coach?.prenom} {result.coach?.nom}</strong> a été refusée.
                  </p>
                </div>
              </>
            )
          ) : (
            <>
              <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-4">
                Erreur de validation
              </h2>
              <div className="bg-red-50 rounded-xl p-4 mb-6">
                <p className="text-red-800">
                  {result?.error || 'Le lien de validation est invalide ou a expiré.'}
                </p>
              </div>
              <p className="text-slate-600 text-sm">
                Les liens de validation expirent après 7 jours.
              </p>
            </>
          )}

          <div className="mt-8 pt-6 border-t border-slate-200">
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

