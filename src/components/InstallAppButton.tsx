import { useState } from 'react';
import { Download, Smartphone, X, Share, Plus } from 'lucide-react';
import { useInstallPWA } from '../hooks/useInstallPWA';

export function InstallAppButton() {
  const { isInstallable, isInstalled, isIOS, install } = useInstallPWA();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Ne rien afficher si déjà installé
  if (isInstalled) {
    return null;
  }

  // Gérer le clic sur le bouton
  const handleClick = async () => {
    if (isIOS) {
      // Sur iOS, afficher les instructions
      setShowIOSModal(true);
    } else if (isInstallable) {
      // Sur Android/Desktop, déclencher l'installation
      setInstalling(true);
      await install();
      setInstalling(false);
    }
  };

  // Ne pas afficher si non installable et pas iOS
  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      {/* Bouton d'installation */}
      <button
        onClick={handleClick}
        disabled={installing}
        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {installing ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Installation...
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            <span>Installer l'application</span>
            <Smartphone className="w-5 h-5" />
          </>
        )}
      </button>

      {/* Modal instructions iOS */}
      {showIOSModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 relative animate-slide-up">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                Installer sur iPhone/iPad
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-900">Appuyez sur le bouton Partager</p>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Share className="w-4 h-4" /> en bas de Safari
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-900">Faites défiler et appuyez sur</p>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Plus className="w-4 h-4" /> "Sur l'écran d'accueil"
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium text-gray-900">Appuyez sur "Ajouter"</p>
                  <p className="text-sm text-gray-500">L'application apparaîtra sur votre écran d'accueil</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full mt-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
