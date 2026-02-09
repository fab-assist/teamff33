import { useState } from 'react';
import { Bell, BellOff, X, Loader2 } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface NotificationPromptProps {
  onClose?: () => void;
}

export function NotificationPrompt({ onClose }: NotificationPromptProps) {
  const { isSupported, permission, isSubscribed, isLoading, error, subscribe, unsubscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  // Ne pas afficher si non supporté, déjà abonné, ou refusé définitivement
  if (!isSupported || dismissed || permission === 'denied') {
    return null;
  }

  // Ne pas afficher si déjà abonné (sauf pour se désabonner dans les paramètres)
  if (isSubscribed && !onClose) {
    return null;
  }

  const handleSubscribe = async () => {
    const success = await subscribe();
    if (success && onClose) {
      onClose();
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Bell className="w-6 h-6 text-orange-500" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">Activer les notifications</h3>
          <p className="text-sm text-gray-600 mt-1">
            Recevez des alertes pour les nouveaux messages, séances et rappels d'entraînement.
          </p>
          {error && (
            <p className="text-sm text-red-600 mt-1">{error}</p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSubscribe}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Activation...
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  Activer
                </>
              )}
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-gray-600 text-sm font-medium hover:text-gray-800"
            >
              Plus tard
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// Composant pour les paramètres (toggle on/off)
export function NotificationSettings() {
  const { isSupported, permission, isSubscribed, isLoading, error, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <BellOff className="w-5 h-5 text-gray-400" />
          <div>
            <p className="font-medium text-gray-700">Notifications non supportées</p>
            <p className="text-sm text-gray-500">Votre navigateur ne supporte pas les notifications push.</p>
          </div>
        </div>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="bg-red-50 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <BellOff className="w-5 h-5 text-red-500" />
          <div>
            <p className="font-medium text-gray-700">Notifications bloquées</p>
            <p className="text-sm text-gray-500">
              Vous avez bloqué les notifications. Pour les réactiver, modifiez les paramètres de votre navigateur.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isSubscribed ? (
            <Bell className="w-5 h-5 text-orange-500" />
          ) : (
            <BellOff className="w-5 h-5 text-gray-400" />
          )}
          <div>
            <p className="font-medium text-gray-700">Notifications push</p>
            <p className="text-sm text-gray-500">
              {isSubscribed
                ? 'Vous recevrez des notifications pour les messages et séances.'
                : 'Activez pour recevoir des alertes importantes.'}
            </p>
            {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isSubscribed ? 'bg-orange-500' : 'bg-gray-300'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isSubscribed ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
