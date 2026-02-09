import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  MessageCircle,
  Send,
  Search,
  User,
  Users,
  Check,
  CheckCheck,
  Trash2,
  X,
  ChevronLeft,
  Loader2,
  Clock,
  Crown,
  UserCog,
  Megaphone,
  Plus,
  Settings,
  UserPlus
} from 'lucide-react';

interface Adherent {
  id: string;
  prenom: string;
  nom: string;
  email: string;
}

interface Coach {
  id: string;
  prenom: string;
  nom: string;
  is_super_admin?: boolean;
}

interface Conversation {
  id: string;
  participant_id: string;
  participant_type: 'coach' | 'adherent';
  participant_name: string;
  participant_initials: string;
  dernier_message: string;
  dernier_message_at: string;
  unread_count: number;
}

interface Message {
  id: string;
  sender_id: string;
  sender_type: string;
  contenu: string;
  date_envoi: string;
  lu: boolean;
  is_mine: boolean;
  sender_name?: string;
}

interface Groupe {
  id: string;
  nom: string;
  description: string;
  type: 'annonces' | 'discussion';
  is_general: boolean;
  members_count: number;
}

export default function CoachMessages() {
  const { user, coachStatus } = useAuth();
  const isSuperAdmin = coachStatus.is_super_admin;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Pour nouveau message
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [availableRecipients, setAvailableRecipients] = useState<(Adherent | Coach)[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState<'my_adherents' | 'all_adherents' | 'all_coaches'>('my_adherents');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // États pour les groupes
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [selectedGroupe, setSelectedGroupe] = useState<Groupe | null>(null);
  const [groupeMessages, setGroupeMessages] = useState<Message[]>([]);
  const [showCreateGroupeModal, setShowCreateGroupeModal] = useState(false);
  const [groupeForm, setGroupeForm] = useState({ nom: '', description: '', type: 'discussion' as 'annonces' | 'discussion', selectedMembers: [] as string[] });
  const [allAdherentsForGroupe, setAllAdherentsForGroupe] = useState<Adherent[]>([]);
  const [allCoachesForGroupe, setAllCoachesForGroupe] = useState<Coach[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-fermer la notification après 3 secondes
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (user) {
      loadConversations();
      loadAvailableRecipients();
      loadGroupes();
    }
  }, [user]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      markAsRead(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Polling pour les nouveaux messages (toutes les 15 secondes)
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
      if (selectedConversation) {
        loadMessages(selectedConversation.id);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [selectedConversation]);

  const loadConversations = async () => {
    if (!user) return;

    try {
      // Charger les conversations où le coach est participant
      const { data: convData, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
        .order('dernier_message_at', { ascending: false });

      if (error) throw error;

      // Pour chaque conversation, récupérer les infos de l'autre participant
      const conversationsWithDetails: Conversation[] = [];

      for (const conv of convData || []) {
        const isParticipant1 = conv.participant1_id === user.id;
        const otherParticipantId = isParticipant1 ? conv.participant2_id : conv.participant1_id;
        const otherParticipantType = isParticipant1 ? conv.participant2_type : conv.participant1_type;

        // Récupérer les infos du participant
        let participantName = 'Utilisateur';
        let participantInitials = 'U';

        if (otherParticipantType === 'adherent') {
          const { data: adherent } = await supabase
            .from('adherents')
            .select('prenom, nom')
            .eq('id', otherParticipantId)
            .single();

          if (adherent) {
            participantName = `${adherent.prenom} ${adherent.nom}`;
            participantInitials = `${adherent.prenom[0]}${adherent.nom[0]}`;
          }
        } else {
          const { data: coach } = await supabase
            .from('coaches')
            .select('prenom, nom')
            .eq('id', otherParticipantId)
            .single();

          if (coach) {
            participantName = `${coach.prenom} ${coach.nom}`;
            participantInitials = `${coach.prenom[0]}${coach.nom[0]}`;
          }
        }

        // Récupérer le dernier message
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('contenu')
          .eq('conversation_id', conv.id)
          .order('date_envoi', { ascending: false })
          .limit(1)
          .single();

        // Compter les messages non lus
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .eq('lu', false)
          .neq('sender_id', user.id);

        conversationsWithDetails.push({
          id: conv.id,
          participant_id: otherParticipantId,
          participant_type: otherParticipantType,
          participant_name: participantName,
          participant_initials: participantInitials,
          dernier_message: lastMessage?.contenu || '',
          dernier_message_at: conv.dernier_message_at,
          unread_count: unreadCount || 0
        });
      }

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('date_envoi', { ascending: true });

      if (error) throw error;

      setMessages((data || []).map(m => ({
        ...m,
        is_mine: m.sender_id === user?.id
      })));
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const markAsRead = async (conversationId: string) => {
    if (!user) return;

    await supabase
      .from('messages')
      .update({ lu: true, lu_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('lu', false);
  };

  const loadAvailableRecipients = async () => {
    if (!user) return;

    try {
      // Charger mes adhérents
      const { data: myAdherents } = await supabase
        .from('adherents')
        .select('id, prenom, nom, email')
        .eq('coach_id', user.id);

      let recipients: (Adherent | Coach)[] = myAdherents || [];

      // Si super admin, charger tous les adhérents et tous les coachs
      if (isSuperAdmin) {
        const { data: allAdherents } = await supabase
          .from('adherents')
          .select('id, prenom, nom, email');

        const { data: allCoaches } = await supabase
          .from('coaches')
          .select('id, prenom, nom, is_super_admin')
          .neq('id', user.id);

        recipients = [...(allAdherents || []), ...(allCoaches || [])];
      } else {
        // Coach normal : charger le super admin pour pouvoir lui écrire
        const { data: superAdmin } = await supabase
          .from('coaches')
          .select('id, prenom, nom, is_super_admin')
          .eq('is_super_admin', true)
          .single();

        if (superAdmin) {
          recipients = [...recipients, superAdmin];
        }
      }

      setAvailableRecipients(recipients);
    } catch (error) {
      console.error('Erreur chargement destinataires:', error);
    }
  };

  // =====================================================
  // FONCTIONS GROUPES
  // =====================================================
  const loadGroupes = async () => {
    try {
      const { data } = await supabase
        .from('groupes_discussion')
        .select('*')
        .order('updated_at', { ascending: false });

      if (data) {
        const groupesWithCount = await Promise.all(
          data.map(async (g) => {
            const { count } = await supabase
              .from('groupes_membres')
              .select('*', { count: 'exact', head: true })
              .eq('groupe_id', g.id);
            return { ...g, members_count: count || 0 };
          })
        );
        setGroupes(groupesWithCount);
      }
    } catch (error) {
      console.error('Erreur chargement groupes:', error);
    }
  };

  const loadGroupeMessages = async (groupeId: string) => {
    setLoadingMessages(true);
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
          is_mine: m.sender_id === user?.id,
          sender_name: namesMap.get(m.sender_id) || 'Inconnu'
        })));
      }
    } catch (error) {
      console.error('Erreur chargement messages groupe:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendGroupeMessage = async () => {
    if (!newMessage.trim() || !selectedGroupe || !user) return;

    setSending(true);
    try {
      // 1. Insérer le message
      const { data: newMsg, error: msgError } = await supabase
        .from('groupes_messages')
        .insert({
          groupe_id: selectedGroupe.id,
          sender_id: user.id,
          sender_type: 'coach',
          contenu: newMessage.trim()
        })
        .select()
        .single();

      if (msgError) throw msgError;

      let recipients: { id: string; type: 'coach' | 'adherent' }[] = [];

      // 2. Récupérer les destinataires
      if (selectedGroupe.is_general) {
        // Groupe général : notifier TOUS les adhérents + tous les coachs
        const { data: allAdherents } = await supabase.from('adherents').select('id');
        const { data: allCoaches } = await supabase.from('coaches').select('id');
        
        if (allAdherents) {
          recipients.push(...allAdherents.map(a => ({ id: a.id, type: 'adherent' as const })));
        }
        if (allCoaches) {
          recipients.push(...allCoaches.map(c => ({ id: c.id, type: 'coach' as const })));
        }
      } else {
        // Groupe normal : récupérer les membres
        const { data: membres } = await supabase
          .from('groupes_membres')
          .select('membre_id, membre_type')
          .eq('groupe_id', selectedGroupe.id);

        if (membres) {
          recipients = membres.map(m => ({ id: m.membre_id, type: m.membre_type as 'coach' | 'adherent' }));
        }
      }

      // 3. Créer un statut de lecture pour chaque destinataire (sauf l'expéditeur)
      if (newMsg && recipients.length > 0) {
        const statusRecords = recipients
          .filter(r => r.id !== user.id)
          .map(r => ({
            message_id: newMsg.id,
            user_id: r.id,
            user_type: r.type,
            lu: false
          }));

        if (statusRecords.length > 0) {
          await supabase.from('groupes_messages_status').insert(statusRecords);
        }
      }

      await supabase.from('groupes_discussion').update({ updated_at: new Date().toISOString() }).eq('id', selectedGroupe.id);

      setNewMessage('');
      loadGroupeMessages(selectedGroupe.id);
    } catch (error) {
      console.error('Erreur envoi message groupe:', error);
    } finally {
      setSending(false);
    }
  };

  const openCreateGroupeModal = async () => {
    // Charger tous les adhérents (sans filtre de statut pour éviter les problèmes)
    const { data: adherents, error: adhError } = await supabase
      .from('adherents')
      .select('id, prenom, nom, email')
      .order('nom');
    
    if (adhError) {
      console.error('Erreur chargement adhérents:', adhError);
    }
    
    const { data: coaches, error: coachError } = await supabase
      .from('coaches')
      .select('id, prenom, nom, is_super_admin')
      .order('nom');
    
    if (coachError) {
      console.error('Erreur chargement coachs:', coachError);
    }
    
    console.log('Adhérents chargés:', adherents?.length || 0);
    
    setAllAdherentsForGroupe(adherents || []);
    setAllCoachesForGroupe(coaches || []);
    setGroupeForm({ nom: '', description: '', type: 'discussion', selectedMembers: [] });
    setShowCreateGroupeModal(true);
  };

  const toggleGroupeMember = (id: string) => {
    setGroupeForm(prev => ({
      ...prev,
      selectedMembers: prev.selectedMembers.includes(id)
        ? prev.selectedMembers.filter(m => m !== id)
        : [...prev.selectedMembers, id]
    }));
  };

  const selectAllAdherentsForGroupe = () => {
    const ids = allAdherentsForGroupe.map(a => a.id);
    setGroupeForm(prev => ({ ...prev, selectedMembers: [...new Set([...prev.selectedMembers, ...ids])] }));
  };

  const selectCoachAdherentsForGroupe = (coachId: string) => {
    // Cette fonction nécessiterait de recharger les adhérents par coach
    // Pour l'instant, on sélectionne tous
    selectAllAdherentsForGroupe();
  };

  const saveGroupe = async () => {
    if (!groupeForm.nom.trim() || !user) return;

    setSending(true);
    try {
      const { data: newGroupe, error } = await supabase
        .from('groupes_discussion')
        .insert({
          nom: groupeForm.nom.trim(),
          description: groupeForm.description.trim(),
          type: groupeForm.type,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      if (groupeForm.selectedMembers.length > 0 && newGroupe) {
        const membres = groupeForm.selectedMembers.map(id => {
          const isCoach = allCoachesForGroupe.some(c => c.id === id);
          return { groupe_id: newGroupe.id, membre_id: id, membre_type: isCoach ? 'coach' : 'adherent', added_by: user.id };
        });
        await supabase.from('groupes_membres').insert(membres);
      }

      setNotification({ type: 'success', message: 'Groupe créé !' });
      setShowCreateGroupeModal(false);
      loadGroupes();
    } catch (error) {
      console.error('Erreur création groupe:', error);
      setNotification({ type: 'error', message: 'Erreur lors de la création' });
    } finally {
      setSending(false);
    }
  };

  const deleteGroupe = async (groupeId: string) => {
    try {
      await supabase.from('groupes_discussion').delete().eq('id', groupeId);
      setSelectedGroupe(null);
      setShowDeleteConfirm(null);
      loadGroupes();
      setNotification({ type: 'success', message: 'Groupe supprimé' });
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
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
          .eq('user_type', 'coach')
          .eq('lu', false)
          .in('message_id', messageIds);
      }
    } catch (error) {
      console.error('Erreur marquage lu:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    setSending(true);
    try {
      // Insérer le message
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: user.id,
          sender_type: 'coach',
          contenu: newMessage.trim(),
          lu: false
        });

      if (msgError) throw msgError;

      // Mettre à jour la date du dernier message
      await supabase
        .from('conversations')
        .update({ dernier_message_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);

      setNewMessage('');
      loadMessages(selectedConversation.id);
      loadConversations();
    } catch (error) {
      console.error('Erreur envoi message:', error);
    } finally {
      setSending(false);
    }
  };

  const startNewConversation = async (recipientId: string, recipientType: 'coach' | 'adherent') => {
    if (!user) return;

    try {
      // Vérifier si une conversation existe déjà
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${recipientId}),and(participant1_id.eq.${recipientId},participant2_id.eq.${user.id})`)
        .single();

      let conversationId = existing?.id;

      if (!conversationId) {
        // Créer nouvelle conversation
        const { data: newConv, error } = await supabase
          .from('conversations')
          .insert({
            participant1_id: user.id,
            participant1_type: 'coach',
            participant2_id: recipientId,
            participant2_type: recipientType,
            dernier_message_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;
        conversationId = newConv.id;
      }

      setShowNewMessageModal(false);
      loadConversations();
      
      // Sélectionner la conversation
      setTimeout(() => {
        const conv = conversations.find(c => c.id === conversationId);
        if (conv) setSelectedConversation(conv);
      }, 500);
    } catch (error) {
      console.error('Erreur création conversation:', error);
    }
  };

  const sendBroadcastMessage = async () => {
    if (!broadcastMessage.trim() || !user) return;

    setSending(true);
    try {
      // Insérer le message groupé
      const { data: groupMsg, error } = await supabase
        .from('messages_groupe')
        .insert({
          sender_id: user.id,
          sender_type: 'coach',
          contenu: broadcastMessage.trim(),
          target_type: broadcastTarget
        })
        .select()
        .single();

      if (error) throw error;

      // Récupérer les destinataires selon le type
      let recipients: { id: string; type: 'coach' | 'adherent' }[] = [];

      if (broadcastTarget === 'my_adherents') {
        const { data } = await supabase
          .from('adherents')
          .select('id')
          .eq('coach_id', user.id);
        recipients = (data || []).map(a => ({ id: a.id, type: 'adherent' as const }));
      } else if (broadcastTarget === 'all_adherents' && isSuperAdmin) {
        const { data } = await supabase
          .from('adherents')
          .select('id');
        recipients = (data || []).map(a => ({ id: a.id, type: 'adherent' as const }));
      } else if (broadcastTarget === 'all_coaches' && isSuperAdmin) {
        const { data } = await supabase
          .from('coaches')
          .select('id')
          .neq('id', user.id);
        recipients = (data || []).map(c => ({ id: c.id, type: 'coach' as const }));
      }

      // Créer les statuts pour chaque destinataire
      const statusRecords = recipients.map(r => ({
        message_groupe_id: groupMsg.id,
        recipient_id: r.id,
        recipient_type: r.type,
        lu: false
      }));

      if (statusRecords.length > 0) {
        await supabase.from('messages_groupe_status').insert(statusRecords);
      }

      setBroadcastMessage('');
      setIsBroadcast(false);
      setShowNewMessageModal(false);
      setNotification({ type: 'success', message: `Message envoyé à ${recipients.length} destinataire(s)` });
    } catch (error) {
      console.error('Erreur envoi message groupé:', error);
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

  const filteredConversations = conversations.filter(c => 
    c.participant_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRecipients = availableRecipients.filter(r => {
    const name = `${r.prenom} ${r.nom}`.toLowerCase();
    return name.includes(recipientSearch.toLowerCase());
  });

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Hier';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('fr-FR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <MessageCircle className="w-8 h-8 text-blue-600" />
          Messages
        </h1>
        <p className="text-slate-600 mt-1">Communiquez avec vos adhérents</p>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`mb-4 p-4 rounded-xl flex items-center gap-3 ${
          notification.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {notification.type === 'success' ? (
            <Check className="w-5 h-5 text-green-600" />
          ) : (
            <X className="w-5 h-5 text-red-600" />
          )}
          <span className="font-medium">{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-auto p-1 hover:bg-white/50 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 h-[600px]">
          {/* Liste des conversations */}
          <div className="border-r border-slate-200 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-800">Conversations</h2>
                <button
                  onClick={() => setShowNewMessageModal(true)}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Liste conversations */}
            <div className="flex-1 overflow-y-auto max-h-[200px]">
              {filteredConversations.length > 0 ? (
                filteredConversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => { setSelectedConversation(conv); setSelectedGroupe(null); }}
                    className={`w-full p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100 text-left ${
                      selectedConversation?.id === conv.id && !selectedGroupe ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm ${
                      conv.participant_type === 'coach' 
                        ? 'bg-gradient-to-br from-purple-500 to-purple-600' 
                        : 'bg-gradient-to-br from-blue-500 to-blue-600'
                    }`}>
                      {conv.participant_initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800 truncate text-sm flex items-center gap-1">
                          {conv.participant_name}
                          {conv.participant_type === 'coach' && (
                            <UserCog className="w-3 h-3 text-purple-500" />
                          )}
                        </span>
                        <span className="text-xs text-slate-400">
                          {conv.dernier_message_at && formatTime(conv.dernier_message_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{conv.dernier_message}</p>
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {conv.unread_count}
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-slate-500 text-sm">
                  <p>Aucune conversation</p>
                </div>
              )}
            </div>

            {/* Section Groupes */}
            <div className="border-t border-slate-200">
              <div className="p-3 bg-purple-50 flex items-center justify-between">
                <span className="font-semibold text-purple-800 text-sm flex items-center gap-2">
                  <Megaphone className="w-4 h-4" />
                  Groupes
                </span>
                {isSuperAdmin && (
                  <button
                    onClick={openCreateGroupeModal}
                    className="p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    title="Créer un groupe"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="max-h-[180px] overflow-y-auto">
                {groupes.length > 0 ? (
                  groupes.map(groupe => (
                    <button
                      key={groupe.id}
                      onClick={() => { setSelectedGroupe(groupe); setSelectedConversation(null); loadGroupeMessages(groupe.id); markGroupeAsRead(groupe.id); }}
                      className={`w-full p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100 text-left ${
                        selectedGroupe?.id === groupe.id ? 'bg-purple-50' : ''
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${
                        groupe.is_general 
                          ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                          : groupe.type === 'annonces'
                            ? 'bg-gradient-to-br from-purple-500 to-violet-600'
                            : 'bg-gradient-to-br from-indigo-500 to-blue-600'
                      }`}>
                        <Megaphone className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-slate-800 text-sm flex items-center gap-1">
                          {groupe.nom}
                          {groupe.type === 'annonces' && (
                            <span className="text-[10px] bg-purple-100 text-purple-700 px-1 rounded">Annonces</span>
                          )}
                        </span>
                        <p className="text-xs text-slate-500">{groupe.members_count} membre{groupe.members_count > 1 ? 's' : ''}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    <p>Aucun groupe</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Zone de messages */}
          <div className="col-span-2 flex flex-col">
            {selectedGroupe ? (
              <>
                {/* Header groupe */}
                <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-purple-50">
                  <button
                    onClick={() => setSelectedGroupe(null)}
                    className="md:hidden p-2 hover:bg-white/50 rounded-lg"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${
                    selectedGroupe.is_general 
                      ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                      : 'bg-gradient-to-br from-purple-500 to-violet-600'
                  }`}>
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      {selectedGroupe.nom}
                      {selectedGroupe.type === 'annonces' && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Annonces</span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500">{selectedGroupe.members_count} membres</p>
                  </div>
                  {isSuperAdmin && (
                    <button
                      onClick={() => setShowDeleteConfirm(selectedGroupe.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Supprimer le groupe"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Messages groupe */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                    </div>
                  ) : groupeMessages.length > 0 ? (
                    groupeMessages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                            msg.is_mine
                              ? 'bg-purple-600 text-white rounded-br-md'
                              : 'bg-white text-slate-800 rounded-bl-md shadow-sm'
                          }`}
                        >
                          {!msg.is_mine && (
                            <p className="text-xs text-purple-600 font-medium mb-1">{msg.sender_name}</p>
                          )}
                          <p className="whitespace-pre-wrap">{msg.contenu}</p>
                          <div className={`flex items-center justify-end gap-1 mt-1 ${
                            msg.is_mine ? 'text-purple-200' : 'text-slate-400'
                          }`}>
                            <span className="text-xs">
                              {new Date(msg.date_envoi).toLocaleTimeString('fr-FR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                      <div className="text-center">
                        <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Aucun message</p>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Zone de saisie groupe */}
                <div className="p-4 border-t border-slate-200 bg-white">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendGroupeMessage()}
                      placeholder="Écrivez votre message..."
                      className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <button
                      onClick={sendGroupeMessage}
                      disabled={!newMessage.trim() || sending}
                      className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : selectedConversation ? (
              <>
                {/* Header conversation */}
                <div className="p-4 border-b border-slate-200 flex items-center gap-3">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="md:hidden p-2 hover:bg-slate-100 rounded-lg"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                    selectedConversation.participant_type === 'coach'
                      ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                      : 'bg-gradient-to-br from-blue-500 to-blue-600'
                  }`}>
                    {selectedConversation.participant_initials}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      {selectedConversation.participant_name}
                      {selectedConversation.participant_type === 'coach' && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Coach</span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedConversation.participant_type === 'adherent' ? 'Adhérent' : 'Coach'}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    </div>
                  ) : messages.length > 0 ? (
                    messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                            msg.is_mine
                              ? 'bg-blue-600 text-white rounded-br-md'
                              : 'bg-white text-slate-800 rounded-bl-md shadow-sm'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.contenu}</p>
                          <div className={`flex items-center justify-end gap-1 mt-1 ${
                            msg.is_mine ? 'text-blue-200' : 'text-slate-400'
                          }`}>
                            <span className="text-xs">
                              {new Date(msg.date_envoi).toLocaleTimeString('fr-FR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                            {msg.is_mine && (
                              msg.lu ? (
                                <CheckCheck className="w-4 h-4" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )
                            )}
                            {msg.is_mine && (
                              <button
                                onClick={() => deleteMessage(msg.id)}
                                className="ml-2 opacity-50 hover:opacity-100"
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
                        <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Aucun message</p>
                        <p className="text-sm">Envoyez le premier message !</p>
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
                      className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 bg-slate-50">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Sélectionnez une conversation</p>
                  <p className="text-sm mt-1">ou un groupe</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal nouveau message */}
      {showNewMessageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">Nouveau message</h3>
              <button
                onClick={() => {
                  setShowNewMessageModal(false);
                  setIsBroadcast(false);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              {/* Toggle message individuel / groupé */}
              <div className="flex gap-2">
                <button
                  onClick={() => setIsBroadcast(false)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    !isBroadcast
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <User className="w-4 h-4 inline mr-2" />
                  Individuel
                </button>
                <button
                  onClick={() => setIsBroadcast(true)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    isBroadcast
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Users className="w-4 h-4 inline mr-2" />
                  Groupe
                </button>
              </div>

              {!isBroadcast ? (
                // Message individuel
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un destinataire..."
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {filteredRecipients.map(recipient => {
                      const isCoach = 'is_super_admin' in recipient;
                      return (
                        <button
                          key={recipient.id}
                          onClick={() => startNewConversation(recipient.id, isCoach ? 'coach' : 'adherent')}
                          className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 rounded-lg transition-colors text-left"
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                            isCoach
                              ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                              : 'bg-gradient-to-br from-blue-500 to-blue-600'
                          }`}>
                            {recipient.prenom[0]}{recipient.nom[0]}
                          </div>
                          <div className="flex-1">
                            <span className="font-medium text-slate-800 flex items-center gap-2">
                              {recipient.prenom} {recipient.nom}
                              {isCoach && (recipient as Coach).is_super_admin && (
                                <Crown className="w-4 h-4 text-amber-500" />
                              )}
                            </span>
                            <span className="text-sm text-slate-500">
                              {isCoach ? 'Coach' : 'Adhérent'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                // Message groupé
                <>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">
                      Envoyer à
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                        <input
                          type="radio"
                          name="broadcast"
                          checked={broadcastTarget === 'my_adherents'}
                          onChange={() => setBroadcastTarget('my_adherents')}
                          className="text-blue-600"
                        />
                        <User className="w-5 h-5 text-blue-600" />
                        <span>Mes adhérents</span>
                      </label>

                      {isSuperAdmin && (
                        <>
                          <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                            <input
                              type="radio"
                              name="broadcast"
                              checked={broadcastTarget === 'all_adherents'}
                              onChange={() => setBroadcastTarget('all_adherents')}
                              className="text-blue-600"
                            />
                            <Users className="w-5 h-5 text-green-600" />
                            <span>Tous les adhérents</span>
                          </label>

                          <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                            <input
                              type="radio"
                              name="broadcast"
                              checked={broadcastTarget === 'all_coaches'}
                              onChange={() => setBroadcastTarget('all_coaches')}
                              className="text-blue-600"
                            />
                            <UserCog className="w-5 h-5 text-purple-600" />
                            <span>Tous les coachs</span>
                          </label>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Message
                    </label>
                    <textarea
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      rows={4}
                      placeholder="Écrivez votre message..."
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  <button
                    onClick={sendBroadcastMessage}
                    disabled={!broadcastMessage.trim() || sending}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    Envoyer à tous
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression groupe */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Supprimer ce groupe ?</h3>
              <p className="text-slate-600 mb-6">
                Cette action est irréversible. Tous les messages du groupe seront supprimés.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => deleteGroupe(showDeleteConfirm)}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal création groupe */}
      {showCreateGroupeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-purple-50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-purple-600" />
                Créer un groupe
              </h3>
              <button
                onClick={() => setShowCreateGroupeModal(false)}
                className="p-2 hover:bg-white/50 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              {/* Nom */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom du groupe *</label>
                <input
                  type="text"
                  value={groupeForm.nom}
                  onChange={(e) => setGroupeForm(prev => ({ ...prev, nom: e.target.value }))}
                  placeholder="Ex: Groupe Fitness"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={groupeForm.description}
                  onChange={(e) => setGroupeForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  placeholder="Description optionnelle..."
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setGroupeForm(prev => ({ ...prev, type: 'discussion' }))}
                    className={`flex-1 p-3 rounded-lg border-2 text-left ${
                      groupeForm.type === 'discussion' ? 'border-purple-500 bg-purple-50' : 'border-slate-200'
                    }`}
                  >
                    <Users className={`w-5 h-5 mb-1 ${groupeForm.type === 'discussion' ? 'text-purple-600' : 'text-slate-400'}`} />
                    <p className="font-medium text-sm">Discussion</p>
                    <p className="text-xs text-slate-500">Tous peuvent écrire</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupeForm(prev => ({ ...prev, type: 'annonces' }))}
                    className={`flex-1 p-3 rounded-lg border-2 text-left ${
                      groupeForm.type === 'annonces' ? 'border-purple-500 bg-purple-50' : 'border-slate-200'
                    }`}
                  >
                    <Megaphone className={`w-5 h-5 mb-1 ${groupeForm.type === 'annonces' ? 'text-purple-600' : 'text-slate-400'}`} />
                    <p className="font-medium text-sm">Annonces</p>
                    <p className="text-xs text-slate-500">Coachs uniquement</p>
                  </button>
                </div>
              </div>

              {/* Membres */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Membres ({groupeForm.selectedMembers.length} sélectionnés)
                </label>
                <button
                  type="button"
                  onClick={selectAllAdherentsForGroupe}
                  className="mb-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
                >
                  <UserPlus className="w-4 h-4 inline mr-1" />
                  Tous les adhérents
                </button>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {allAdherentsForGroupe
                    .filter(a => `${a.prenom} ${a.nom}`.toLowerCase().includes(memberSearch.toLowerCase()))
                    .map(adherent => (
                      <label
                        key={adherent.id}
                        className="flex items-center gap-3 p-2 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={groupeForm.selectedMembers.includes(adherent.id)}
                          onChange={() => toggleGroupeMember(adherent.id)}
                          className="w-4 h-4 text-purple-600 rounded"
                        />
                        <span className="text-sm">{adherent.prenom} {adherent.nom}</span>
                      </label>
                    ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateGroupeModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={saveGroupe}
                disabled={!groupeForm.nom.trim() || sending}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Créer le groupe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

