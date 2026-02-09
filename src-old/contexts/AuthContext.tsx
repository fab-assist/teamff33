import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Durée d'inactivité avant déconnexion (30 minutes en millisecondes)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

interface CoachStatus {
  status: 'pending' | 'approved' | 'rejected' | null;
  is_super_admin: boolean;
}

interface AuthContextType {
  user: User | null;
  userRole: 'coach' | 'adherent' | null;
  coachStatus: CoachStatus;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; status?: string }>;
  signUp: (email: string, password: string, role: 'coach' | 'adherent', data: any) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'coach' | 'adherent' | null>(null);
  const [coachStatus, setCoachStatus] = useState<CoachStatus>({ status: null, is_super_admin: false });
  const [loading, setLoading] = useState(true);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fonction de déconnexion pour inactivité
  const handleInactivityLogout = useCallback(async () => {
    console.log('Déconnexion automatique pour inactivité');
    await supabase.auth.signOut();
    setUser(null);
    setUserRole(null);
    setCoachStatus({ status: null, is_super_admin: false });
    // Rediriger vers la page d'accueil
    window.location.href = '/';
  }, []);

  // Réinitialiser le timer d'inactivité
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      console.log('⏰ Timer expiré - Déconnexion automatique...');
      handleInactivityLogout();
    }, INACTIVITY_TIMEOUT);
  }, [handleInactivityLogout]);

  // Gérer le timer d'inactivité quand l'utilisateur est connecté
  useEffect(() => {
    if (!user) {
      // Pas d'utilisateur connecté, pas de timer
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      return;
    }

    // Événements d'activité à surveiller
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    // Démarrer le timer
    console.log('🔐 Timer d\'inactivité démarré (30 min)');
    resetInactivityTimer();

    // Réinitialiser le timer à chaque activité (throttled pour éviter trop d'appels)
    let lastActivity = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      // Ne réinitialiser que si plus de 1 minute depuis la dernière activité
      if (now - lastActivity > 60000) {
        console.log('👆 Activité détectée - Timer réinitialisé');
        lastActivity = now;
        resetInactivityTimer();
      }
    };

    // Ajouter les listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user, resetInactivityTimer]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await checkUserRole(session.user.id);
        } else {
          setUserRole(null);
          setCoachStatus({ status: null, is_super_admin: false });
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserRole = async (userId: string) => {
    const { data: coach } = await supabase
      .from('coaches')
      .select('id, status, is_super_admin')
      .eq('id', userId)
      .maybeSingle();

    if (coach) {
      setUserRole('coach');
      setCoachStatus({
        status: coach.status || 'pending',
        is_super_admin: coach.is_super_admin || false
      });
    } else {
      const { data: adherent } = await supabase
        .from('adherents')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (adherent) {
        setUserRole('adherent');
      }
      setCoachStatus({ status: null, is_super_admin: false });
    }
    setLoading(false);
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
      return { error };
      }

      // Vérifier le status du coach
      if (data.user) {
        const { data: coach } = await supabase
          .from('coaches')
          .select('status, is_super_admin')
          .eq('id', data.user.id)
          .maybeSingle();

        if (coach) {
          if (coach.status === 'pending') {
            await supabase.auth.signOut();
            return { 
              error: new Error('Votre compte est en attente de validation. Vous recevrez un email dès que votre compte sera activé.'),
              status: 'pending'
            };
          }
          
          if (coach.status === 'rejected') {
            await supabase.auth.signOut();
            return { 
              error: new Error('Votre demande d\'inscription a été refusée.'),
              status: 'rejected'
            };
          }
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, role: 'coach' | 'adherent', data: any) => {
    try {
      // Préparer les metadata selon le rôle
      const metadata: Record<string, any> = {
        role: role,
        prenom: data.prenom,
        nom: data.nom,
        telephone: data.telephone || null,
      };

      if (role === 'coach') {
        metadata.nom_club = data.nom_club || null;
        metadata.mode_coaching = data.mode_coaching || 'gestion_club';
      } else if (role === 'adherent') {
        metadata.date_naissance = data.date_naissance || null;
        metadata.sexe = data.sexe || null;
        metadata.type_adhesion = data.type_adhesion || 'club';
        metadata.historique_medical = data.historique_medical || '{}';
        metadata.blessures = data.blessures || null;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        return { error: authError };
      }
      if (!authData.user) {
        console.error('No user data returned');
        return { error: new Error('User creation failed') };
      }

      console.log('User created:', authData.user.id);

      // Attendre que le trigger crée le profil
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (role === 'coach') {
        // Appeler l'Edge Function pour envoyer l'email de validation au super admin
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-validation-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ coach_id: authData.user.id }),
          });
          
          if (!response.ok) {
            console.error('Failed to send validation email:', await response.text());
          } else {
            console.log('Validation email sent successfully');
          }
        } catch (emailError) {
          console.error('Error calling email function:', emailError);
        }
        
        // Déconnecter le coach en attendant la validation
        await supabase.auth.signOut();
      } else if (role === 'adherent') {
        // Appeler l'Edge Function pour notifier le super admin (informatif seulement)
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-new-adherent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ adherent_id: authData.user.id }),
          });
          
          if (!response.ok) {
            console.error('Failed to send adherent notification:', await response.text());
          } else {
            console.log('Adherent notification sent successfully');
          }
        } catch (emailError) {
          console.error('Error calling notification function:', emailError);
        }
        
        // L'adhérent reste connecté (pas de validation requise)
      }

      return { error: null };
    } catch (error) {
      console.error('Signup exception:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserRole(null);
    setCoachStatus({ status: null, is_super_admin: false });
  };

  return (
    <AuthContext.Provider value={{ user, userRole, coachStatus, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
