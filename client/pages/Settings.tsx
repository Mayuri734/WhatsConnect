import { useEffect, useState } from "react";
import { Smartphone, Palette, HelpCircle, RefreshCw, RotateCcw } from "lucide-react";
import Layout from "@/components/Layout";

export default function Settings() {
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");
  const [darkMode, setDarkMode] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkTheme();
    checkWhatsAppStatus();
    loadQRCode();
  }, []);

  const checkTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");
    setDarkMode(isDark);
  };

  const checkWhatsAppStatus = async () => {
    try {
      const response = await fetch("/api/whatsapp/status");
      const data = await response.json();
      setConnectionStatus(data.connected ? "connected" : data.hasQR ? "connecting" : "disconnected");
    } catch (error) {
      console.error("Error checking WhatsApp status:", error);
      setConnectionStatus("disconnected");
    }
  };

  const loadQRCode = async () => {
    try {
      const response = await fetch("/api/whatsapp/qr?format=image");
      const data = await response.json();
      if (data.qrImage) {
        setQrCode(data.qrImage);
      }
    } catch (error) {
      console.error("Error loading QR code:", error);
    }
  };

  const handleThemeToggle = () => {
    const html = document.documentElement;
    const isDark = html.classList.toggle("dark");
    setDarkMode(isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  };

  const handleReconnect = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/whatsapp/reconnect", { method: "POST" });
      if (response.ok) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        checkWhatsAppStatus();
        loadQRCode();
      }
    } catch (error) {
      console.error("Error reconnecting:", error);
    } finally {
      setLoading(false);
    }
  };
const handleDisconnect = async () => {
  try {
    setLoading(true);

    const response = await fetch("/api/whatsapp/disconnect", {
      method: "POST",
    });

    if (response.ok) {
      setConnectionStatus("disconnected");
      setQrCode(null);

      // Reload QR after logout
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await loadQRCode();
    }
  } catch (error) {
    console.error("Error disconnecting WhatsApp:", error);
  } finally {
    setLoading(false);
  }
};

  

  return (
    <Layout>
      <div className="p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Settings</h1>
          <p className="text-slate-600 dark:text-slate-400">Manage your CRM preferences and connections</p>
        </div>

        <div className="max-w-2xl space-y-6">
          {/* WhatsApp Connection */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">WhatsApp Connection</h2>
            </div>

            {/* Status Card */}
            <div className={`p-4 rounded-lg border-l-4 mb-6 ${
              connectionStatus === "connected"
                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500"
                : connectionStatus === "connecting"
                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-500"
                : "bg-red-50 dark:bg-red-900/20 border-red-500"
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-3 h-3 rounded-full animate-pulse ${
                  connectionStatus === "connected"
                    ? "bg-emerald-500"
                    : connectionStatus === "connecting"
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`} />
                <span className={`font-semibold ${
                  connectionStatus === "connected"
                    ? "text-emerald-700 dark:text-emerald-300"
                    : connectionStatus === "connecting"
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-red-700 dark:text-red-300"
                }`}>
                  {connectionStatus === "connected"
                    ? "WhatsApp Connected ✓"
                    : connectionStatus === "connecting"
                    ? "Waiting for Connection"
                    : "Not Connected"}
                </span>
              </div>
              <p className={`text-sm ${
                connectionStatus === "connected"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : connectionStatus === "connecting"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
              }`}>
                {connectionStatus === "connected"
                  ? "Your WhatsApp account is ready to use. You can start sending and receiving messages."
                  : connectionStatus === "connecting"
                  ? "Scan the QR code below with your phone to complete the connection."
                  : "Go through the steps below to connect your WhatsApp account."}
              </p>
            </div>

            {/* QR Code */}
            {connectionStatus !== "connected" && (
              <div className="mb-6">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4">QR Code</h3>
                <div className="flex justify-center p-6 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
                  {qrCode ? (
                    <img src={qrCode} alt="WhatsApp QR Code" className="max-w-xs w-full" />
                  ) : (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-3"></div>
                      <p className="text-slate-500 dark:text-slate-400">Loading QR code...</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Instructions */}
            {connectionStatus !== "connected" && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  How to Connect
                </h4>
                <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                  <li>1. Open WhatsApp on your phone</li>
                  <li>2. Go to Settings → Linked Devices</li>
                  <li>3. Tap "Link a Device"</li>
                  <li>4. Scan the QR code shown above</li>
                  <li>5. Wait for the connection to complete</li>
                </ol>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-3 font-medium">
                  💡 You only need to scan once. Your WhatsApp will stay connected automatically!
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
             {connectionStatus === "connected" && (
  <button
    onClick={handleDisconnect}
    disabled={loading}
    className="flex-1 flex items-center justify-center gap-2 px-4 py-3
      bg-red-600 hover:bg-red-700 disabled:bg-slate-400
      text-white rounded-lg font-medium transition-colors"
  >
    <RotateCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
    Disconnect WhatsApp
  </button>
)}

              {connectionStatus !== "connected" && (
                <button
                  onClick={handleReconnect}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white rounded-lg font-medium transition-colors"
                >
                  <RotateCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Reconnect
                </button>
              )}
            </div>
          </div>

          {/* Theme Settings */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Palette className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Appearance</h2>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white">Dark Mode</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Switch between light and dark theme</p>
              </div>
              <button
                onClick={handleThemeToggle}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  darkMode ? "bg-emerald-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    darkMode ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Help & Support */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">About</h2>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white mb-2">WhatsConnect</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  A complete customer relationship management system integrated with WhatsApp messaging.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Version</p>
                  <p className="font-semibold text-slate-900 dark:text-white">1.0.0</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Status</p>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">Active</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
