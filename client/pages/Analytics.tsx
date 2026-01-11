import { useEffect, useState } from "react";
import { TrendingUp, Users, MessageSquare, Clock } from "lucide-react";
import CountUp from "react-countup";
import Layout from "@/components/Layout";

interface Stats {
  totalMessages: number;
  inboundMessages: number;
  outboundMessages: number;
}

export default function Analytics() {
  const [stats, setStats] = useState<Stats>({
    totalMessages: 0,
    inboundMessages: 0,
    outboundMessages: 0,
  });

  const [metrics, setMetrics] = useState({
    avgResponseTime: 0,
    resolutionRate: 0,
    satisfaction: 0,
    totalContacts: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
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
        totalMessages: statsData.totalMessages || 0,
        inboundMessages: statsData.inboundMessages || 0,
        outboundMessages: statsData.outboundMessages || 0,
      });

      const messages = Array.isArray(messagesData) ? messagesData : [];

      let totalResponseTime = 0;
      let responseCount = 0;

      for (let i = 0; i < messages.length - 1; i++) {
        if (
          messages[i].direction === "inbound" &&
          messages[i + 1].direction === "outbound"
        ) {
          totalResponseTime +=
            new Date(messages[i + 1].timestamp).getTime() -
            new Date(messages[i].timestamp).getTime();
          responseCount++;
        }
      }

      const avgResponseTime =
        responseCount > 0
          ? Math.round(totalResponseTime / responseCount / 60000)
          : 0;

      const resolved = contactsData.filter(
        (c: any) => c.queryStatus === "resolved" || c.queryStatus === "closed"
      ).length;

      const resolutionRate =
        contactsData.length > 0
          ? (resolved / contactsData.length) * 100
          : 0;

      const inbound = messages.filter((m: any) => m.direction === "inbound");
      const positive = inbound.filter(
        (m: any) => m.sentiment === "positive"
      ).length;

      const satisfaction =
        inbound.length > 0 ? (positive / inbound.length) * 100 : 0;

      setMetrics({
        avgResponseTime,
        resolutionRate,
        satisfaction,
        totalContacts: contactsData.length,
      });
    } catch (error) {
      console.error("Analytics error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Analytics & Insights
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Track your CRM performance
          </p>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard title="Avg Response Time" value={metrics.avgResponseTime} suffix="min" icon={<Clock />} />
              <MetricCard title="Resolution Rate" value={metrics.resolutionRate} suffix="%" icon={<TrendingUp />} />
              <MetricCard title="Satisfaction" value={metrics.satisfaction} suffix="%" icon={<MessageSquare />} />
              <MetricCard title="Total Contacts" value={metrics.totalContacts} icon={<Users />} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Message Flow */}
              <Card title="Message Flow">
                <Progress label="Inbound" value={stats.inboundMessages} total={stats.totalMessages} color="blue" />
                <Progress label="Outbound" value={stats.outboundMessages} total={stats.totalMessages} color="purple" />
              </Card>

              {/* Donut */}
              <Card title="Message Distribution" center>
                <DonutChart inbound={stats.inboundMessages} outbound={stats.outboundMessages} />
              </Card>

              {/* Quick Stats */}
              <Card title="Quick Stats">
                <QuickStat label="Messages / Contact" value={
                  metrics.totalContacts > 0
                    ? (stats.totalMessages / metrics.totalContacts).toFixed(1)
                    : "0"
                } />
                <QuickStat label="Inbound Ratio" value={`${((stats.inboundMessages / stats.totalMessages) * 100 || 0).toFixed(1)}%`} />
                <QuickStat label="Outbound Ratio" value={`${((stats.outboundMessages / stats.totalMessages) * 100 || 0).toFixed(1)}%`} />
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

/* ---------- Reusable Components ---------- */

function Card({ title, children, center = false }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
        {title}
      </h3>
      <div className={center ? "flex justify-center" : ""}>{children}</div>
    </div>
  );
}

function MetricCard({ title, value, suffix = "", icon }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 hover:-translate-y-1 transition">
      <div className="flex justify-between mb-2">
        <h3 className="text-sm text-slate-600 dark:text-slate-400">{title}</h3>
        <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
        <CountUp end={value} duration={1.2} /> {suffix}
      </p>
    </div>
  );
}

function Progress({ label, value, total, color }: any) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1 text-slate-600 dark:text-slate-400">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full">
        <div
          className={`h-2 rounded-full transition-all duration-700 bg-${color}-500 dark:bg-${color}-400`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function DonutChart({ inbound, outbound }: any) {
  const total = inbound + outbound;
  const inboundPct = total ? (inbound / total) * 282.7 : 0;
  const outboundPct = total ? (outbound / total) * 282.7 : 0;

  return (
    <div className="relative">
      <svg viewBox="0 0 100 100" className="w-48 h-48">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeDasharray={`${inboundPct} 282.7`}
          transform="rotate(-90 50 50)"
          className="text-blue-500 dark:text-blue-400 transition-all duration-1000"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeDasharray={`${outboundPct} 282.7`}
          strokeDashoffset={`-${inboundPct}`}
          transform="rotate(-90 50 50)"
          className="text-purple-500 dark:text-purple-400 transition-all duration-1000"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {total}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
      </div>
    </div>
  );
}

function QuickStat({ label, value }: any) {
  return (
    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3 mb-3">
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <span className="font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}
