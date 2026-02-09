import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Clock, AlertTriangle, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function FormuleExpirationPopup() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [joursRestants, setJoursRestants] = useState<number | null>(null);
  const [dateFinFormule, setDateFinFormule] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      checkFormuleExpiration();
    }
  }, [user]);

  const checkFormuleExpiration = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('adherents')
        .select('date_fin_formule, duree_formule_mois')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !data || !data.date_fin_formule) return;

      // Calculer les jours restants
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateEcheance = new Date(data.date_fin_formule);
      const diffTime = dateEcheance.getTime() - today.getTime();
      const jours = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Afficher le popup si la formule expire dans 15 jours ou moins
      if (jours <= 15 && jours >= 0) {
        // Vérifier si le popup a déjà été fermé aujourd'hui
        const lastDismissed = localStorage.getItem(`formule_popup_dismissed_${user.id}`);
        const todayStr = today.toISOString().split('T')[0];
        
        if (lastDismissed !== todayStr) {
          setJoursRestants(jours);
          setDateFinFormule(data.date_fin_formule);
          setShow(true);
        }
      }
    } catch (error) {
      console.error('Erreur vérification formule:', error);
    }
  };

  const handleClose = () => {
    // Enregistrer que le popup a été fermé aujourd'hui
    const todayStr = new Date().toISOString().split('T')[0];
    localStorage.setItem(`formule_popup_dismissed_${user?.id}`, todayStr);
    setShow(false);
  };

  if (!show || joursRestants === null) return null;

  const isUrgent = joursRestants <= 7;
  const isExpired = joursRestants <= 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden ${isUrgent ? 'ring-4 ring-red-400' : 'ring-4 ring-amber-400'}`}>
        {/* Header */}
        <div className={`p-6 ${isUrgent ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-amber-400 to-orange-400'}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-3 rounded-full">
                {isUrgent ? (
                  <AlertTriangle className="w-8 h-8 text-white" />
                ) : (
                  <Clock className="w-8 h-8 text-white" />
                )}
              </div>
              <div className="text-white">
                <h2 className="text-xl font-bold">
                  {isExpired ? 'Formule expirée' : 'Formule bientôt terminée'}
                </h2>
                <p className="text-white/80 text-sm">Information importante</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            {isExpired ? (
              <>
                <div className="text-5xl font-bold text-red-600 mb-2">Expirée</div>
                <p className="text-slate-600">Votre formule coaching a expiré</p>
              </>
            ) : (
              <>
                <div className={`text-5xl font-bold mb-2 ${isUrgent ? 'text-red-600' : 'text-amber-600'}`}>
                  {joursRestants === 0 ? "Aujourd'hui" : joursRestants === 1 ? '1 jour' : `${joursRestants} jours`}
                </div>
                <p className="text-slate-600">
                  Votre formule coaching se termine le{' '}
                  <strong>
                    {new Date(dateFinFormule!).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </strong>
                </p>
              </>
            )}
          </div>

          <div className={`p-4 rounded-xl mb-6 ${isUrgent ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
            <p className={`text-sm ${isUrgent ? 'text-red-700' : 'text-amber-700'}`}>
              💡 Pour renouveler votre formule et continuer votre progression, 
              contactez votre coach ou le club.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              to="/adherent/messages"
              onClick={handleClose}
              className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 transition-colors text-center flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              Contacter mon coach
            </Link>
            <button
              onClick={handleClose}
              className="px-6 py-3 border border-slate-300 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              Compris
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
