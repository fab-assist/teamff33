import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MessageNotificationPopup from './MessageNotificationPopup';
import {
  Users,
  Package,
  Calendar,
  Video,
  BarChart3,
  MessageCircle,
  Settings,
  LogOut,
  Dumbbell,
  Menu,
  X,
  LayoutDashboard,
  UsersRound,
  Building2,
  UserCog
} from 'lucide-react';

interface CoachLayoutProps {
  children: ReactNode;
}

interface MenuItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export default function CoachLayout({ children }: CoachLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const menuSections: MenuSection[] = [
    {
      title: '',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/coach/dashboard' },
        { icon: MessageCircle, label: 'Messages', path: '/coach/messages' },
        { icon: Users, label: 'Mes Adhérents', path: '/coach/adherents' },
      ]
    },
    {
      title: 'Coaching Individuel',
      items: [
        { icon: Calendar, label: 'Séances', path: '/coach/seances' },
        { icon: Video, label: 'Exercices', path: '/coach/exercices' },
        { icon: BarChart3, label: 'Suivi & Stats', path: '/coach/coaching-stats' },
      ]
    },
    {
      title: 'Gestion Club',
      items: [
        { icon: UsersRound, label: 'Cours Collectifs', path: '/coach/cours-collectifs' },
        { icon: Package, label: 'Inventaire', path: '/coach/inventaire' },
        { icon: BarChart3, label: 'Statistiques', path: '/coach/statistiques' },
      ]
    },
    {
      title: 'Coaching Structure',
      items: [
        { icon: Building2, label: 'Entreprises', path: '/coach/entreprises' },
        { icon: UserCog, label: 'Programmes Groupe', path: '/coach/programmes-groupe' },
      ]
    },
    {
      title: '',
      items: [
        { icon: Settings, label: 'Mon Profil', path: '/coach/profil' },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-blue-600 text-white p-2 rounded-lg shadow-lg"
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
            <Link to="/coach/dashboard" className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-lg">
                <Dumbbell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-slate-800">Force Athlétique</h1>
                <p className="text-xs text-blue-600 font-medium">Coach</p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {menuSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className={section.title ? 'mt-4' : ''}>
                {section.title && (
                  <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {section.title}
                  </div>
                )}
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                        isActive
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
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
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>

      {/* Notification de nouveaux messages */}
      <MessageNotificationPopup userType="coach" />
    </div>
  );
}
