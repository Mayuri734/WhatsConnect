import { Link } from "react-router-dom";
import { Home, ChevronRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-6xl font-bold text-slate-900 dark:text-white mb-2">404</div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Page not found</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist. Let's get you back to the main app.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
        >
          <Home className="w-4 h-4" />
          Back to Dashboard
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
