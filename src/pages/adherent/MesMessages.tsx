import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  MessageCircle,
  Send,
  Check,
  CheckCheck,
  Trash2,
  Loader2,
  UserCog,
  Crown,
  Users,
  Megaphone,
  ChevronLeft
} from 'lucide-react';

interface Message {
  id: string;
  sender_id: string;
  sender_type: string;
  contenu: string;
  date_envoi: string;
  lu: boolean;
  is_mine: boolean;
  is_group?: boolean;
}

interface CoachInfo {
  id: string;
  prenom: string;
  nom: string;
  is_super_admin?: boolean;
}

interface Groupe {
  id: string;
  nom: string;
  type: 'annonces' | 'discussion';
  is_general: boolean;
}

type ViewMode = 'list' | 'coach' | 'groupe';

export default function MesMessages() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [coach, setCoach] = useState<CoachInfo | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Groupes
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [selectedGroupe, setSelectedGroupe] = useState<Groupe | null>(null);
  const [groupeMessages, setGroupeMessages] = useState<Message[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadCoachAndConversation();
      loadGroupes();
    }
  }, [user]);

  // Ouvrir automatiquement le groupe si spécifié dans l'URL
  useEffect(() => {
    const groupeId = searchParams.get('groupe');
    if (groupeId && groupes.length > 0) {
      const groupe = groupes.find(g => g.id === groupeId);
      if (groupe) {
        openGroupe(groupe);
      }
    }
  }, [searchParams, groupes]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Polling pour les nouveaux messages
  useEffect(() => {
    const interval = setInterval(() => {
      if (conversationId) {
        loadMessages();
      }
    }, 10000); // Toutes les 10 secondes

    return () => clearInterval(interval);
  }, [conversationId]);

  const loadCoachAndConversation = async () => {
    if (!user) return;

    try {
      // Récupérer les infos de l'adhérent pour trouver son coach
      const { data: adherentData } = await supabase
        .from('adherents')
        .select('coach_id')
        .eq('id', user.id)
        .single();

      if (!adherentData?.coach_id) {
        setLoading(false);
        return;
      }

      // Récupérer les infos du coach
      const { data: coachData } = await supabase
        .from('coaches')
        .select('id, prenom, nom, is_super_admin')
        .eq('id', adherentData.coach_id)
        .single();

      if (coachData) {
        setCoach(coachData);

        // Chercher ou créer la conversation
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${coachData.id}),and(participant1_id.eq.${coachData.id},participant2_id.eq.${user.id})`)
          .single();

        if (existingConv) {
          setConversationId(existingConv.id);
          await loadMessagesForConversation(existingConv.id);
        } else {
          // Créer la conversation
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({
              participant1_id: user.id,
              participant1_type: 'adherent',
              participant2_id: coachData.id,
              participant2_type: 'coach'
            })
            .select()
            .single();

          if (newConv) {
            setConversationId(newConv.id);
          }
        }
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!conversationId) return;
    await loadMessagesForConversation(conversationId);
  };

  const loadMessagesForConversation = async (convId: string) => {
    try {
      // Charger les messages de la conversation individuelle
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('date_envoi', { ascending: true });

      if (error) throw error;

      const individualMessages = (data || []).map(m => ({
        ...m,
        is_mine: m.sender_id === user?.id,
        is_group: false
      }));

      // Charger les messages groupés non lus
      const { data: groupStatusData } = await supabase
        .from('messages_groupe_status')
        .select('message_groupe_id, lu')
        .eq('recipient_id', user?.id)
        .eq('recipient_type', 'adherent');

      let groupMessages: Message[] = [];
      if (groupStatusData && groupStatusData.length > 0) {
        const groupMsgIds = groupStatusData.map(s => s.message_groupe_id);
        const { data: groupMsgsData } = await supabase
          .from('messages_groupe')
          .select('id, sender_id, contenu, date_envoi')
          .in('id', groupMsgIds);

        if (groupMsgsData) {
          const statusMap = new Map(groupStatusData.map(s => [s.message_groupe_id, s.lu]));
          groupMessages = groupMsgsData.map(m => ({
            id: m.id,
            sender_id: m.sender_id,
            sender_type: 'coach',
            contenu: m.contenu,
            date_envoi: m.date_envoi,
            lu: statusMap.get(m.id) || false,
            is_mine: false,
            is_group: true
          }));
        }
      }

      // Combiner et trier par date
      const allMessages = [...individualMessages, ...groupMessages].sort(
        (a, b) => new Date(a.date_envoi).getTime() - new Date(b.date_envoi).getTime()
      );

      setMessages(allMessages);

      // Marquer comme lus les messages individuels du coach
      if (user) {
        await supabase
          .from('messages')
          .update({ lu: true, lu_at: new Date().toISOString() })
          .eq('conversation_id', convId)
          .neq('sender_id', user.id)
          .eq('lu', false);

        // Marquer comme lus les messages groupés
        if (groupStatusData && groupStatusData.length > 0) {
          const unreadGroupIds = groupStatusData
            .filter(s => !s.lu)
            .map(s => s.message_groupe_id);
          
          if (unreadGroupIds.length > 0) {
            await supabase
              .from('messages_groupe_status')
              .update({ lu: true, lu_at: new Date().toISOString() })
              .eq('recipient_id', user.id)
              .eq('recipient_type', 'adherent')
              .in('message_groupe_id', unreadGroupIds);
          }
        }
      }
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    }
  };

  // =====================================================
  // FONCTIONS GROUPES
  // =====================================================
  const loadGroupes = async () => {
    if (!user) return;
    try {
      // Groupes dont je suis membre
      const { data: mesGroupesIds } = await supabase
        .from('groupes_membres')
        .select('groupe_id')
        .eq('membre_id', user.id)
        .eq('membre_type', 'adherent');

      const groupeIds = mesGroupesIds?.map(g => g.groupe_id) || [];

      // Récupérer les groupes + les généraux
      let query = supabase.from('groupes_discussion').select('*').order('updated_at', { ascending: false });
      
      if (groupeIds.length > 0) {
        query = query.or(`is_general.eq.true,id.in.(${groupeIds.join(',')})`);
      } else {
        query = query.eq('is_general', true);
      }

      const { data } = await query;
      setGroupes(data || []);
    } catch (error) {
      console.error('Erreur chargement groupes:', error);
    }
  };

  const loadGroupeMessages = async (groupeId: string) => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('groupes_messages')
        .select('*')
        .eq('groupe_id', groupeId)
        .eq('supprime', false)
        .order('date_envoi', { ascending: true });

      if (data) {
        const senderIds = [...new Set(data.map(m => m.sender_id))];
        const { data: coachesData } = await supabase.from('coaches').select('id, prenom, nom').in('id', senderIds);
        const { data: adherentsData } = await supabase.from('adherents').select('id, prenom, nom').in('id', senderIds);
        
        const namesMap = new Map<string, string>();
        coachesData?.forEach(c => namesMap.set(c.id, `${c.prenom} ${c.nom}`));
        adherentsData?.forEach(a => namesMap.set(a.id, `${a.prenom} ${a.nom}`));

        setGroupeMessages(data.map(m => ({
          ...m,
          is_mine: m.sender_id === user.id,
          sender_name: namesMap.get(m.sender_id) || 'Inconnu'
        })));
      }
    } catch (error) {
      console.error('Erreur chargement messages groupe:', error);
    }
  };

  const sendGroupeMessage = async () => {
    if (!newMessage.trim() || !selectedGroupe || !user) return;
    setSending(true);
    try {
      await supabase.from('groupes_messages').insert({
        groupe_id: selectedGroupe.id,
        sender_id: user.id,
        sender_type: 'adherent',
        contenu: newMessage.trim()
      });
      setNewMessage('');
      loadGroupeMessages(selectedGroupe.id);
    } catch (error) {
      console.error('Erreur envoi:', error);
    } finally {
      setSending(false);
    }
  };

  const openGroupe = (groupe: Groupe) => {
    setSelectedGroupe(groupe);
    setViewMode('groupe');
    loadGroupeMessages(groupe.id);
    markGroupeAsRead(groupe.id);
  };

  const markGroupeAsRead = async (groupeId: string) => {
    if (!user) return;
    try {
      // Récupérer les IDs des messages de ce groupe
      const { data: groupeMessagesData } = await supabase
        .from('groupes_messages')
        .select('id')
        .eq('groupe_id', groupeId);

      if (groupeMessagesData && groupeMessagesData.length > 0) {
        const messageIds = groupeMessagesData.map(m => m.id);
        
        // Marquer comme lus tous les statuts de cet utilisateur pour ces messages
        await supabase
          .from('groupes_messages_status')
          .update({ lu: true, lu_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('user_type', 'adherent')
          .eq('lu', false)
          .in('message_id', messageIds);
      }
    } catch (error) {
      console.error('Erreur marquage lu:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId || !user) return;

    setSending(true);
    try {
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          sender_type: 'adherent',
          contenu: newMessage.trim(),
          lu: false
        });

      if (msgError) throw msgError;

      // Mettre à jour la date du dernier message
      await supabase
        .from('conversations')
        .update({ dernier_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      setNewMessage('');
      loadMessages();
    } catch (error) {
      console.error('Erreur envoi message:', error);
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm('Supprimer ce message ?')) return;

    try {
      await supabase
        .from('messages')
        .update({ supprime_par_expediteur: true })
        .eq('id', messageId);

      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-12 h-12 text-rose-600 animate-spin" />
      </div>
    );
  }

  // Vue en liste
  if (viewMode === 'list') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 flex items-center gap-3">
            <MessageCircle className="w-7 h-7 sm:w-8 sm:h-8 text-rose-600" />
            Messages
          </h1>
          <p className="text-slate-600 mt-1 text-sm sm:text-base">Vos conversations</p>
        </div>

        <div className="space-y-4">
          {/* Conversation Coach */}
          {coach && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-3 bg-gradient-to-r from-rose-50 to-pink-50 border-b border-rose-100">
                <div className="flex items-center gap-2 text-rose-700 font-semibold text-sm">
                  <UserCog className="w-4 h-4" />
                  Mon Coach
                </div>
              </div>
              <button
                onClick={() => { setViewMode('coach'); loadMessages(); }}
                className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white font-bold">
                  {coach.prenom[0]}{coach.nom[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{coach.prenom} {coach.nom}</h3>
                    {coach.is_super_admin && <Crown className="w-4 h-4 text-amber-500" />}
                  </div>
                  <p className="text-sm text-slate-500">Votre coach personnel</p>
                </div>
              </button>
            </div>
          )}

          {/* Groupes */}
          {groupes.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
                  <Users className="w-4 h-4" />
                  Groupes
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {groupes.map(groupe => (
                  <button
                    key={groupe.id}
                    onClick={() => openGroupe(groupe)}
                    className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${
                      groupe.is_general 
                        ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                        : groupe.type === 'annonces'
                          ? 'bg-gradient-to-br from-purple-500 to-violet-600'
                          : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                    }`}>
                      <Megaphone className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800">{groupe.nom}</h3>
                        {groupe.type === 'annonces' && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded">Annonces</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {groupe.type === 'annonces' ? 'Lecture seule' : 'Discussion'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pas de coach */}
          {!coach && groupes.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
              <UserCog className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-800 mb-2">Aucune conversation</h2>
              <p className="text-slate-500">Vous n'avez pas encore de coach assigné.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vue groupe
  if (viewMode === 'groupe' && selectedGroupe) {
    const canWrite = selectedGroupe.type === 'discussion';
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center gap-4">
              <button onClick={() => { setViewMode('list'); setSelectedGroupe(null); }} className="p-2 hover:bg-white/50 rounded-full">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${
                selectedGroupe.is_general ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'
              }`}>
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-lg">{selectedGroupe.nom}</h2>
                <p className="text-sm text-slate-500">{canWrite ? 'Discussion' : 'Annonces (lecture seule)'}</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="h-[400px] overflow-y-auto p-4 space-y-4 bg-slate-50">
            {groupeMessages.length > 0 ? (
              groupeMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.is_mine ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white text-slate-800 rounded-bl-md shadow-sm border border-slate-100'
                  }`}>
                    {!msg.is_mine && <p className="text-xs text-blue-600 font-medium mb-1">{msg.sender_name}</p>}
                    <p className="whitespace-pre-wrap">{msg.contenu}</p>
                    <div className={`flex items-center justify-end gap-1 mt-2 ${msg.is_mine ? 'text-blue-200' : 'text-slate-400'}`}>
                      <span className="text-xs">{new Date(msg.date_envoi).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <Megaphone className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Aucun message</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Saisie */}
          {canWrite ? (
            <div className="p-4 border-t border-slate-200 bg-white">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendGroupeMessage()}
                  placeholder="Écrivez votre message..."
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={sendGroupeMessage}
                  disabled={!newMessage.trim() || sending}
                  className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 border-t border-slate-200 bg-slate-100 text-center text-slate-500 text-sm">
              Ce canal est réservé aux annonces
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vue conversation coach
  if (!coach) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <UserCog className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Aucun coach assigné</h2>
          <p className="text-slate-500">Contactez l'administration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header avec infos coach */}
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-rose-50 to-pink-50">
          <div className="flex items-center gap-4">
            <button onClick={() => setViewMode('list')} className="p-2 hover:bg-white/50 rounded-full">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white font-bold text-lg">
              {coach.prenom[0]}{coach.nom[0]}
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                {coach.prenom} {coach.nom}
                {coach.is_super_admin && <Crown className="w-5 h-5 text-amber-500" />}
              </h2>
              <p className="text-sm text-slate-500">Votre coach personnel</p>
            </div>
          </div>
        </div>

        {/* Zone messages */}
        <div className="h-[400px] overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.length > 0 ? (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.is_mine
                      ? 'bg-rose-600 text-white rounded-br-md'
                      : 'bg-white text-slate-800 rounded-bl-md shadow-sm border border-slate-100'
                  }`}
                >
                  {/* Indicateur coach / message groupé */}
                  {!msg.is_mine && (
                    <div className="flex items-center gap-1 mb-1 text-rose-600">
                      <UserCog className="w-3 h-3" />
                      <span className="text-xs font-medium">
                        {coach.prenom}
                        {msg.is_group && (
                          <span className="ml-1 px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px]">
                            Message groupé
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.contenu}</p>
                  <div className={`flex items-center justify-end gap-1 mt-2 ${
                    msg.is_mine ? 'text-rose-200' : 'text-slate-400'
                  }`}>
                    <span className="text-xs">
                      {new Date(msg.date_envoi).toLocaleTimeString('fr-FR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                    {msg.is_mine && (
                      msg.lu ? (
                        <CheckCheck className="w-4 h-4" title="Lu" />
                      ) : (
                        <Check className="w-4 h-4" title="Envoyé" />
                      )
                    )}
                    {msg.is_mine && (
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        className="ml-2 opacity-50 hover:opacity-100"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Aucun message</p>
                <p className="text-sm mt-1">Envoyez un message à votre coach !</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Zone de saisie */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Écrivez votre message..."
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="p-3 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

