import type { RiskLevel, Severity } from "../types";
import { riskClasses, severityClasses } from "../utils/risk";

export const RiskBadge = ({ level }: { level: RiskLevel }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${riskClasses[level]}`}>{level}</span>
);

export const SeverityBadge = ({ severity }: { severity: Severity }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${severityClasses[severity]}`}>{severity}</span>
);
