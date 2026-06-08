import path from "path";

export const sanitizeFileName = (fileName: string) => {
  const parsed = path.parse(fileName);
  const safeBase = parsed.name.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 80) || "evidence";
  const safeExt = parsed.ext.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 12);
  return `${Date.now()}-${safeBase}${safeExt}`;
};
