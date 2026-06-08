import type { RiskLevel, Severity } from "../types";

export const riskClasses: Record<RiskLevel, string> = {
  LOW: "bg-green-100 text-green-800 border-green-200",
  MEDIUM: "bg-yellow-100 text-yellow-900 border-yellow-200",
  HIGH: "bg-orange-100 text-orange-900 border-orange-200",
  CRITICAL: "bg-red-100 text-red-800 border-red-200"
};

export const severityClasses: Record<Severity, string> = {
  INFO: "bg-slate-100 text-slate-700 border-slate-200",
  LOW: "bg-green-100 text-green-800 border-green-200",
  MEDIUM: "bg-yellow-100 text-yellow-900 border-yellow-200",
  HIGH: "bg-orange-100 text-orange-900 border-orange-200",
  CRITICAL: "bg-red-100 text-red-800 border-red-200"
};
