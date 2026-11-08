import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button, Card } from "./ui";
import { DashboardHeading, DashboardState, StatCard } from "../pages/dashboard/DashboardShell";
import { dashboardErrorMessage, dashboardRequest } from "../services/dashboardApi";
import type { ImpactDashboardData } from "../types/food";

const colors = ["#24583e", "#8ba98a", "#d9b754", "#cb7d66", "#7799a6", "#9c83a5"];

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function downloadCsv(report: ImpactDashboardData) {
  const fields = ["donation_id", "food_category", "created_at", "confirmed_at", "food_saved_kg", "meals_provided", "co2_saved_kg"];
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows = [
    fields.join(","),
    ...report.records.map((record) => fields.map((field) => cell(record[field as keyof typeof record])).join(",")),
  ];
  const blob = new Blob([rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "foodbridge-impact-report.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ImpactDashboard() {
  const [report, setReport] = useState<ImpactDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await dashboardRequest<{ report: ImpactDashboardData }>("/impact");
      setReport(result.report);
    } catch (failure) {
      setError(dashboardErrorMessage(failure, "Could not load impact records."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const charts = useMemo(() => {
    if (!report) return null;
    const weeklyStart = new Date();
    weeklyStart.setDate(weeklyStart.getDate() - 6);
    const weekly = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weeklyStart);
      date.setDate(weeklyStart.getDate() + index);
      return { date: dayKey(date), food_saved_kg: 0, meals_provided: 0 };
    });
    const months = Array.from({ length: 12 }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - 11 + index);
      return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, month: date.toLocaleDateString(undefined, { month: "short", year: "2-digit" }), food_saved_kg: 0 };
    });
    const categories = new Map<string, number>();
    const history = new Map<string, number>();
    for (const record of report.records) {
      const completionDate = dayKey(new Date(record.confirmed_at));
      const donationDate = dayKey(new Date(record.created_at));
      const week = weekly.find((entry) => entry.date === completionDate);
      if (week) {
        week.food_saved_kg += record.food_saved_kg;
        week.meals_provided += record.meals_provided;
      }
      const month = months.find((entry) => entry.key === completionDate.slice(0, 7));
      if (month) month.food_saved_kg += record.food_saved_kg;
      categories.set(record.food_category, (categories.get(record.food_category) ?? 0) + record.food_saved_kg);
      history.set(donationDate, (history.get(donationDate) ?? 0) + 1);
    }
    return {
      weekly,
      months: months.map(({ key: _key, ...entry }) => entry),
      categories: [...categories].map(([category, food_saved_kg]) => ({ category: category.replace(/_/g, " "), food_saved_kg })),
      history: [...history].sort(([left], [right]) => left.localeCompare(right)).slice(-30).map(([date, donations]) => ({ date, donations })),
      rescues: [
        { outcome: "Rescued", count: report.summary.successful_rescues },
        { outcome: "Blocked", count: report.summary.blocked_rescues },
      ],
    };
  }, [report]);

  return (
    <>
      <DashboardHeading
        action={<Button disabled={!report?.records.length} onClick={() => report && downloadCsv(report)} variant="secondary">Download impact report</Button>}
        description="Only donations with recorded impact and a confirmed NGO receipt are included."
        eyebrow="Measured together"
        title="FoodBridge impact"
      />
      {loading || error ? <DashboardState error={error} loading={loading} onRetry={() => void load()} /> : report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Food rescued" value={`${report.totals.food_saved_kg.toLocaleString()} kg`} note="Confirmed impact records" />
            <StatCard label="Estimated meals" value={report.totals.meals_provided.toLocaleString()} tone="butter" />
            <StatCard label="Estimated CO₂ saved" value={`${report.totals.co2_saved_kg.toLocaleString()} kg`} tone="powder" />
            <StatCard label="Successful donations" value={report.summary.successful_donations} />
            <StatCard label="Completed deliveries" value={report.summary.completed_deliveries} tone="sage" />
            <StatCard label="Active NGO partners" value={report.summary.active_ngo_partners} tone="blush" />
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <ChartCard title="Weekly impact" subtitle="Confirmed food and estimated meals, last 7 days">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={charts?.weekly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Bar dataKey="food_saved_kg" name="Food (kg)" fill="#24583e" /><Bar dataKey="meals_provided" name="Estimated meals" fill="#d9b754" /></BarChart></ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Monthly impact" subtitle="Confirmed food rescued, last 12 months">
              <ResponsiveContainer width="100%" height="100%"><LineChart data={charts?.months}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Line dataKey="food_saved_kg" name="Food (kg)" stroke="#24583e" strokeWidth={3} /></LineChart></ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Food category breakdown" subtitle="Recorded kilograms by food category">
              {charts?.categories.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={charts.categories} dataKey="food_saved_kg" nameKey="category" outerRadius={90} label>{charts.categories.map((entry, index) => <Cell fill={colors[index % colors.length]} key={entry.category} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <p className="text-sm text-slate-500">No completed impact records yet.</p>}
            </ChartCard>
            <ChartCard title="Donation history" subtitle="Confirmed donations grouped by donation creation date">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={charts?.history}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" minTickGap={24} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="donations" fill="#8ba98a" /></BarChart></ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Rescue outcomes" subtitle="Recorded rescue requests visible to your account">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={charts?.rescues}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="outcome" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#24583e" /></BarChart></ResponsiveContainer>
            </ChartCard>
          </div>
          <Card className="mt-5 p-4 text-xs leading-5 text-slate-500">
            Environmental figures are estimates copied from authorized, completed records. {report.co2_assumption}
          </Card>
        </>
      ) : <DashboardState empty />}
    </>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card className="min-w-0 p-5">
      <h2 className="font-semibold text-charcoal">{title}</h2>
      <p className="mb-3 mt-1 text-xs text-slate-500">{subtitle}</p>
      <div className="h-64 min-w-0">{children}</div>
    </Card>
  );
}
