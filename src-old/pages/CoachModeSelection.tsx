import { Link } from 'react-router-dom';
import { UserPlus, LogIn, Dumbbell, ArrowLeft } from 'lucide-react';

export default function CoachModeSelection() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-4">
            <Dumbbell className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Espace Coach</h1>
          <p className="text-blue-200">Choisissez votre mode d'accès</p>
        </div>

        <div className="space-y-4">
          <Link
            to="/coach/login"
            className="flex items-center gap-4 p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 hover:bg-white/20 transition-all group"
          >
            <div className="p-3 bg-blue-500 rounded-xl group-hover:scale-110 transition-transform">
              <LogIn className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Se connecter</h3>
              <p className="text-sm text-blue-200">J'ai déjà un compte coach</p>
            </div>
          </Link>

          <Link
            to="/coach/signup"
            className="flex items-center gap-4 p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 hover:bg-white/20 transition-all group"
          >
            <div className="p-3 bg-green-500 rounded-xl group-hover:scale-110 transition-transform">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Créer un compte</h3>
              <p className="text-sm text-blue-200">Je suis nouveau coach</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}



