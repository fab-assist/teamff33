import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, X, Bell } from 'lucide-react';

interface UnreadMessage {
  id: string;
  contenu: string;
  date_envoi: string;
  coach_name: string;
  groupe_id?: string;
  is_group?: boolean;
}

interface MessageNotificationPopupProps {
  userType: 'coach' | 'adherent';
}

export default function MessageNotificationPopup({ userType }: MessageNotificationPopupProps) {
  const { user } = useAuth();
  const [showPopup, setShowPopup] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState<UnreadMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const checkUnreadMessages = useCallback(async () => {
    if (!user || dismissed) return;

    try {
      if (userType === 'adherent') {
        // Pour un adhérent, vérifier les messages non lus de son coach
        const { data: adherentData } = await supabase
          .from('adherents')
          .select('coach_id')
          .eq('id', user.id)
          .single();

        if (!adherentData?.coach_id) return;

        let totalUnread = 0;
        const allUnreadMessages: UnreadMessage[] = [];

        // Trouver la conversation avec le coach
        const { data: convData } = await supabase
          .from('conversations')
          .select('id')
          .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${adherentData.coach_id}),and(participant1_id.eq.${adherentData.coach_id},participant2_id.eq.${user.id})`)
          .maybeSingle();

        // Récupérer le nom du coach
        const { data: coachData } = await supabase
          .from('coaches')
          .select('prenom, nom')
          .eq('id', adherentData.coach_id)
          .single();

        const coachName = coachData ? `${coachData.prenom} ${coachData.nom}` : 'Votre coach';

        if (convData) {
          // Compter les messages non lus de la conversation
          const { data: unreadData, count } = await supabase
            .from('messages')
            .select('id, contenu, date_envoi', { count: 'exact' })
            .eq('conversation_id', convData.id)
            .eq('sender_type', 'coach')
            .eq('lu', false)
            .order('date_envoi', { ascending: false })
            .limit(3);

          totalUnread += count || 0;
          
          if (unreadData) {
            allUnreadMessages.push(...unreadData.map(m => ({
              ...m,
              coach_name: coachName
            })));
          }
        }

        // Vérifier les messages de groupe non lus (nouvelle architecture)
        const { data: groupStatusData, count: groupCount } = await supabase
          .from('groupes_messages_status')
          .select('message_id', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('user_type', 'adherent')
          .eq('lu', false);

        totalUnread += groupCount || 0;

        // Charger le contenu des messages de groupe
        if (groupStatusData && groupStatusData.length > 0) {
          const groupMsgIds = groupStatusData.map(s => s.message_id);
          const { data: groupMessages } = await supabase
            .from('groupes_messages')
            .select('id, contenu, date_envoi, groupe_id, groupes_discussion(id, nom)')
            .in('id', groupMsgIds)
            .order('date_envoi', { ascending: false })
            .limit(3);

          if (groupMessages) {
            allUnreadMessages.push(...groupMessages.map(m => ({
              ...m,
              coach_name: (m.groupes_discussion as any)?.nom || 'Groupe',
              groupe_id: m.groupe_id,
              is_group: true
            })));
          }
        }

        // Mettre à jour l'état UNE SEULE FOIS avec le total calculé
        if (totalUnread > 0) {
          setUnreadCount(totalUnread);
          setUnreadMessages(allUnreadMessages.slice(0, 3));
          setShowPopup(true);
        } else {
          setUnreadCount(0);
          setShowPopup(false);
        }
      } else {
        // Pour un coach, compter tous les messages non lus
        const { data: convIds } = await supabase
          .from('conversations')
          .select('id')
          .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`);

        if (convIds && convIds.length > 0) {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .in('conversation_id', convIds.map(c => c.id))
            .neq('sender_id', user.id)
            .eq('lu', false);

          if (count && count > 0) {
            setUnreadCount(count);
            setShowPopup(true);
          }
        }
      }
    } catch (error) {
      console.error('Erreur vérification messages:', error);
    }
  }, [user, userType, dismissed]);

  // Vérifier à la connexion
  useEffect(() => {
    if (user) {
      // Petit délai pour laisser le temps à l'interface de se charger
      const timeout = setTimeout(() => {
        checkUnreadMessages();
      }, 1000);

      return () => clearTimeout(timeout);
    }
  }, [user, checkUnreadMessages]);

  // Polling toutes les 30 secondes
  useEffect(() => {
    if (!user || dismissed) return;

    const interval = setInterval(() => {
      checkUnreadMessages();
    }, 30000);

    return () => clearInterval(interval);
  }, [user, dismissed, checkUnreadMessages]);

  const handleDismiss = () => {
    setShowPopup(false);
    setDismissed(true);
    // Réactiver après 5 minutes
    setTimeout(() => setDismissed(false), 5 * 60 * 1000);
  };

  const handleClickOutside = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleDismiss();
    }
  };

  if (!showPopup || unreadCount === 0) return null;

  // Construire le chemin avec le groupe_id si c'est un message de groupe
  const firstGroupMessage = unreadMessages.find(m => m.is_group && m.groupe_id);
  const basePath = userType === 'adherent' ? '/adherent/messages' : '/coach/messages';
  const messagePath = firstGroupMessage ? `${basePath}?groupe=${firstGroupMessage.groupe_id}` : basePath;
  const primaryColor = userType === 'adherent' ? 'rose' : 'blue';

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
      onClick={handleClickOutside}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-bounce-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-6 bg-gradient-to-r ${
          userType === 'adherent' 
            ? 'from-rose-500 to-pink-600' 
            : 'from-blue-500 to-blue-600'
        } text-white relative`}>
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-full">
              <Bell className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {unreadCount === 1 ? 'Nouveau message !' : `${unreadCount} nouveaux messages !`}
              </h2>
              <p className="opacity-90 text-sm mt-1">
                {userType === 'adherent' 
                  ? 'Votre coach vous a écrit'
                  : 'Vous avez des messages non lus'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Aperçu des messages (côté adhérent) */}
        {userType === 'adherent' && unreadMessages.length > 0 && (
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            {unreadMessages.slice(0, 2).map((msg, idx) => (
              <div 
                key={msg.id}
                className={`${idx > 0 ? 'mt-3 pt-3 border-t border-slate-200' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center">
                    <MessageCircle className="w-3 h-3 text-rose-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">{msg.coach_name}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(msg.date_envoi).toLocaleTimeString('fr-FR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
                <p className="text-slate-600 text-sm line-clamp-2 ml-8">
                  "{msg.contenu}"
                </p>
              </div>
            ))}
            {unreadCount > 2 && (
              <p className="text-xs text-slate-500 mt-3 ml-8">
                + {unreadCount - 2} autre{unreadCount - 2 > 1 ? 's' : ''} message{unreadCount - 2 > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="p-6 space-y-3">
          <Link
            to={messagePath}
            onClick={() => setShowPopup(false)}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-white transition-all ${
              userType === 'adherent'
                ? 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            Voir mes messages
          </Link>

          <button
            onClick={handleDismiss}
            className="w-full py-3 text-slate-500 hover:text-slate-700 font-medium transition-colors"
          >
            Plus tard
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce-in {
          0% {
            opacity: 0;
            transform: scale(0.9) translateY(-20px);
          }
          50% {
            transform: scale(1.02) translateY(0);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-bounce-in {
          animation: bounce-in 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}

