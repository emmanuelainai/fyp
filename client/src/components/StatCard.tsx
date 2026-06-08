import type { LucideIcon } from "lucide-react";

export const StatCard = ({ label, value, icon: Icon, accent = "text-blue-700" }: { label: string; value: string | number; icon: LucideIcon; accent?: string }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      </div>
      <div className={`rounded-md bg-slate-100 p-2 ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);
