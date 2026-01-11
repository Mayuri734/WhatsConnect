import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { MessageSquare, Settings, Users, BarChart3, Home, Menu, X, FileText } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");
  const location = useLocation();

  useEffect(() => {
    checkWhatsAppStatus();
    const interval = setInterval(checkWhatsAppStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkWhatsAppStatus = async () => {
    try {
      const response = await fetch("/api/whatsapp/status");
      const data = await response.json();
      setConnectionStatus(data.connected ? "connected" : "disconnected");
    } catch (error) {
      console.error("Error checking WhatsApp status:", error);
      setConnectionStatus("disconnected");
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { icon: Home, label: "Dashboard", path: "/" },
    { icon: Users, label: "Contacts", path: "/contacts" },
    { icon: MessageSquare, label: "Conversations", path: "/conversations" },
    { icon: FileText, label: "Templates", path: "/templates" },
    { icon: BarChart3, label: "Analytics", path: "/analytics" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-72" : "w-20"
        } bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-300 shadow-sm`}
      >
        {/* Header */}
        <div className="px-6 py-8 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
              W
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">WhatsConnect</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Conversations. Simplified. ⭐</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive(item.path)
                  ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium border-l-2 border-emerald-500"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50"
              }`}
              title={!sidebarOpen ? item.label : ""}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Status */}
        <div className="px-3 py-4 border-t border-slate-200 dark:border-slate-700">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
            connectionStatus === "connected"
              ? "bg-emerald-50 dark:bg-emerald-900/30"
              : connectionStatus === "connecting"
              ? "bg-amber-50 dark:bg-amber-900/30"
              : "bg-red-50 dark:bg-red-900/30"
          }`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              connectionStatus === "connected"
                ? "bg-emerald-500"
                : connectionStatus === "connecting"
                ? "bg-amber-500"
                : "bg-red-500"
            }`} />
            {sidebarOpen && (
              <span className={`text-xs font-medium ${
                connectionStatus === "connected"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : connectionStatus === "connecting"
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-red-700 dark:text-red-300"
              }`}>
                {connectionStatus === "connected"
                  ? "Connected"
                  : connectionStatus === "connecting"
                  ? "Connecting..."
                  : "Disconnected"}
              </span>
            )}
          </div>
        </div>

        {/* Toggle Button */}
        <div className="px-3 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-slate-600 dark:text-slate-400 mx-auto" />
            ) : (
              <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400 mx-auto" />
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
