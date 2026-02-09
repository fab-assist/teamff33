import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MessageNotificationPopup from './MessageNotificationPopup';
import FormuleExpirationPopup from './FormuleExpirationPopup';
import {
  Calendar,
  BarChart3,
  MessageCircle,
  Settings,
  LogOut,
  Dumbbell,
  Menu,
  X,
  LayoutDashboard,
  User,
  Target,
  UsersRound,
  Baby
} from 'lucide-react';

interface AdherentLayoutProps {
  children: ReactNode;
}

export default function AdherentLayout({ children }: AdherentLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/adherent/dashboard' },
    { icon: MessageCircle, label: 'Messages', path: '/adherent/messages' },
    { icon: UsersRound, label: 'Cours Collectifs', path: '/adherent/cours-collectifs' },
    { icon: Baby, label: 'Mes Enfants', path: '/adherent/enfants' },
    { icon: Calendar, label: 'Mes Séances', path: '/adherent/seances' },
    { icon: Target, label: 'Mes Objectifs', path: '/adherent/objectifs' },
    { icon: BarChart3, label: 'Ma Progression', path: '/adherent/progression' },
    { icon: User, label: 'Mon Profil', path: '/adherent/profil' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-rose-600 text-white p-2 rounded-lg shadow-lg"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-xl z-40 transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-200">
            <Link to="/adherent/dashboard" className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-2 rounded-lg">
                <Dumbbell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-slate-800">Force Athlétique</h1>
                <p className="text-xs text-rose-600 font-medium">Adhérent</p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-rose-50 text-rose-600 font-medium'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-200">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-all w-full"
            >
              <LogOut className="w-5 h-5" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="lg:ml-64 min-h-screen">
        <div className="p-4 pt-16 lg:p-8 lg:pt-8">
          {children}
        </div>
      </main>

      {/* Notification de nouveaux messages */}
      <MessageNotificationPopup userType="adherent" />

      {/* Popup expiration formule */}
      <FormuleExpirationPopup />
    </div>
  );
}





