import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import CoachLogin from './pages/CoachLogin';
import CoachSignup from './pages/CoachSignup';
import CoachLayout from './components/CoachLayout';
import CoachDashboard from './pages/coach/CoachDashboard';
import MesAdherents from './pages/coach/MesAdherents';
import Inventaire from './pages/coach/Inventaire';
import CoursCollectifsCoach from './pages/coach/CoursCollectifs';
import Exercices from './pages/coach/Exercices';
import BanqueSeances from './pages/coach/BanqueSeances';
import SeanceBuilder from './pages/coach/SeanceBuilder';
import SeanceDetailCoach from './pages/coach/SeanceDetailCoach';
import CoachingStats from './pages/coach/CoachingStats';
import CoachMessages from './pages/coach/Messages';
import ValidateCoach from './pages/admin/ValidateCoach';
import AdherentLogin from './pages/AdherentLogin';
import AdherentSignup from './pages/AdherentSignup';
import AdherentLayout from './components/AdherentLayout';
import AdherentDashboard from './pages/adherent/AdherentDashboard';
import MesCoursCollectifs from './pages/adherent/MesCoursCollectifs';
import MesEnfants from './pages/adherent/MesEnfants';
import MesSeances from './pages/adherent/MesSeances';
import SeanceDetail from './pages/adherent/SeanceDetail';
import MesMessages from './pages/adherent/MesMessages';
import MonProfil from './pages/adherent/MonProfil';

function ProtectedRoute({ children, role }: { children: React.ReactNode; role: 'coach' | 'adherent' }) {
  const { user, userRole, coachStatus, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || userRole !== role) {
    return <Navigate to="/" replace />;
  }

  // Pour les coachs, vérifier que le compte est approuvé
  if (role === 'coach' && coachStatus.status !== 'approved') {
    return <Navigate to="/coach/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          
          {/* Coach routes */}
          <Route path="/coach/login" element={<CoachLogin />} />
          <Route path="/coach/signup" element={<CoachSignup />} />
          
          {/* Admin route */}
          <Route path="/admin/validate-coach" element={<ValidateCoach />} />

          {/* Protected Coach routes */}
          <Route
            path="/coach/dashboard"
            element={
              <ProtectedRoute role="coach">
                <CoachLayout>
                  <CoachDashboard />
                </CoachLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coach/adherents"
            element={
              <ProtectedRoute role="coach">
                <CoachLayout>
                  <MesAdherents />
                </CoachLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coach/inventaire"
            element={
              <ProtectedRoute role="coach">
                <CoachLayout>
                  <Inventaire />
                </CoachLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coach/cours-collectifs"
            element={
              <ProtectedRoute role="coach">
                <CoachLayout>
                  <CoursCollectifsCoach />
                </CoachLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coach/exercices"
            element={
              <ProtectedRoute role="coach">
                <CoachLayout>
                  <Exercices />
                </CoachLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coach/seances"
            element={
              <ProtectedRoute role="coach">
                <CoachLayout>
                  <BanqueSeances />
                </CoachLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coach/seances/builder"
            element={
              <ProtectedRoute role="coach">
                <CoachLayout>
                  <SeanceBuilder />
                </CoachLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coach/seances/:id"
            element={
              <ProtectedRoute role="coach">
                <CoachLayout>
                  <SeanceDetailCoach />
                </CoachLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coach/coaching-stats"
            element={
              <ProtectedRoute role="coach">
                <CoachLayout>
                  <CoachingStats />
                </CoachLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coach/messages"
            element={
              <ProtectedRoute role="coach">
                <CoachLayout>
                  <CoachMessages />
                </CoachLayout>
              </ProtectedRoute>
            }
          />

          <Route path="/coach/*" element={
            <ProtectedRoute role="coach">
              <CoachLayout>
                <div className="text-center py-12">
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Page en construction</h2>
                  <p className="text-slate-600">Cette fonctionnalité arrive bientôt</p>
                </div>
              </CoachLayout>
            </ProtectedRoute>
          } />

          {/* Adherent routes */}
          <Route path="/adherent/login" element={<AdherentLogin />} />
          <Route path="/adherent/signup" element={<AdherentSignup />} />

          {/* Protected Adherent routes */}
          <Route
            path="/adherent/dashboard"
            element={
              <ProtectedRoute role="adherent">
                <AdherentLayout>
                  <AdherentDashboard />
                </AdherentLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/adherent/cours-collectifs"
            element={
              <ProtectedRoute role="adherent">
                <AdherentLayout>
                  <MesCoursCollectifs />
                </AdherentLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/adherent/enfants"
            element={
              <ProtectedRoute role="adherent">
                <AdherentLayout>
                  <MesEnfants />
                </AdherentLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/adherent/seances"
            element={
              <ProtectedRoute role="adherent">
                <AdherentLayout>
                  <MesSeances />
                </AdherentLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/adherent/seances/:id"
            element={
              <ProtectedRoute role="adherent">
                <AdherentLayout>
                  <SeanceDetail />
                </AdherentLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/adherent/messages"
            element={
              <ProtectedRoute role="adherent">
                <AdherentLayout>
                  <MesMessages />
                </AdherentLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/adherent/profil"
            element={
              <ProtectedRoute role="adherent">
                <AdherentLayout>
                  <MonProfil />
                </AdherentLayout>
              </ProtectedRoute>
            }
          />

          <Route path="/adherent/*" element={
            <ProtectedRoute role="adherent">
              <AdherentLayout>
                <div className="text-center py-12">
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Page en construction</h2>
                  <p className="text-slate-600">Cette fonctionnalité arrive bientôt</p>
                </div>
              </AdherentLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
