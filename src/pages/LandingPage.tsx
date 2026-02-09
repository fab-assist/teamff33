import { useNavigate } from 'react-router-dom';
import { Dumbbell, UserCog, User } from 'lucide-react';
import { InstallAppButton } from '../components/InstallAppButton';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <Dumbbell className="w-16 h-16 text-blue-600" />
          </div>
          <h1 className="text-5xl font-bold text-slate-800 mb-4">
            Force Athlétique Club
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Application de gestion complète pour votre club de Force Athlétique
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          <button
            onClick={() => navigate('/coach/login')}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-8 text-white shadow-xl transition-all hover:scale-105 hover:shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative z-10">
              <UserCog className="w-20 h-20 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-3">COACH</h2>
              <p className="text-blue-100">
                Gérez vos adhérents, cours collectifs et votre club
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate('/adherent/login')}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 p-8 text-white shadow-xl transition-all hover:scale-105 hover:shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-pink-400 to-rose-500 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative z-10">
              <User className="w-20 h-20 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-3">ADHÉRENT</h2>
              <p className="text-pink-100">
                Consultez vos séances, suivez votre progression et communiquez avec votre coach
              </p>
            </div>
          </button>
        </div>

        {/* Bouton d'installation PWA */}
        <div className="mt-12 text-center">
          <InstallAppButton />
        </div>
      </div>
    </div>
  );
}
