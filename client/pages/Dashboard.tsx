import { useEffect, useState } from "react";
import { Users, MessageSquare, ArrowDownRight, ArrowUpRight } from "lucide-react";
import CountUp from "react-countup";
import Layout from "@/components/Layout";

interface Stats {
  totalContacts: number;
  totalMessages: number;
  inboundMessages: number;
  outboundMessages: number;
}

interface Message {
  _id: string;
  message: string;
  direction: "inbound" | "outbound";
  timestamp: string;
  contactId?: {
    name: string;
    phone: string;
  };
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalContacts: 0,
    totalMessages: 0,
    inboundMessages: 0,
    outboundMessages: 0,
  });

  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const [statsRes, contactsRes, messagesRes] = await Promise.all([
        fetch("/api/messages/stats/summary"),
        fetch("/api/contacts"),
        fetch("/api/messages"),
      ]);

      const statsData = await statsRes.json();
      const contactsData = await contactsRes.json();
      const messagesData = await messagesRes.json();

      setStats({
        totalContacts: contactsData.length || 0,
        totalMessages: statsData.totalMessages || 0,
        inboundMessages: statsData.inboundMessages || 0,
        outboundMessages: statsData.outboundMessages || 0,
      });

      setRecentMessages(Array.isArray(messagesData) ? messagesData.slice(0, 8) : []);
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const diff = Date.now() - date.getTime();
    const min = Math.floor(diff / 60000);
    const hr = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);

    if (min < 1) return "Just now";
    if (min < 60) return `${min}m ago`;
    if (hr < 24) return `${hr}h ago`;
    if (day < 7) return `${day}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Welcome to your WhatsConnect
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {/* Contacts */}
          <StatCard
            title="Total Contacts"
            icon={<Users className="w-4 h-4 text-blue-600" />}
            value={stats.totalContacts}
            loading={loading}
            color="bg-blue-100 dark:bg-blue-900/30"
          />

          {/* Messages */}
          <StatCard
            title="Total Messages"
            icon={<MessageSquare className="w-4 h-4 text-emerald-600" />}
            value={stats.totalMessages}
            loading={loading}
            color="bg-emerald-100 dark:bg-emerald-900/30"
          />

          {/* Inbound */}
          <StatCard
            title="Inbound"
            icon={<ArrowDownRight className="w-4 h-4 text-green-600" />}
            value={stats.inboundMessages}
            loading={loading}
            color="bg-green-100 dark:bg-green-900/30"
          />

          {/* Outbound */}
          <StatCard
            title="Outbound"
            icon={<ArrowUpRight className="w-4 h-4 text-purple-600" />}
            value={stats.outboundMessages}
            loading={loading}
            color="bg-purple-100 dark:bg-purple-900/30"
          />
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            Recent Activity
          </h3>

          <div className="space-y-4 max-h-[320px] overflow-y-auto">
            {recentMessages.length === 0 && (
              <p className="text-sm text-slate-500">No recent messages</p>
            )}

            {recentMessages.map((msg) => (
              <div
                key={msg._id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition"
              >
                <span
                  className={`w-2 h-2 mt-2 rounded-full ${
                    msg.direction === "inbound"
                      ? "bg-green-500"
                      : "bg-purple-500"
                  }`}
                />
                <div className="flex-1">
                  <p className="text-sm text-slate-800 dark:text-slate-200 truncate">
                    {msg.message}
                  </p>
                  <p className="text-xs text-slate-500">
                    {msg.contactId?.name ||
                      msg.contactId?.phone ||
                      "Unknown"}{" "}
                    • {formatDate(msg.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

/* ---------- Reusable Stat Card ---------- */
function StatCard({
  title,
  value,
  icon,
  loading,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  loading: boolean;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md transition">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {title}
        </h3>
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      </div>

      <p className="text-2xl font-bold text-slate-900 dark:text-white">
        {loading ? "..." : <CountUp end={value} duration={1.2} />}
      </p>
    </div>
  );
}
