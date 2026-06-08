export const departments = [
  "Computer Science",
  "Mechanical Engineering",
  "Electronic Engineering",
  "Mass Communication",
  "Economics",
  "Business Administration",
  "Finance",
  "Financial Accounting",
  "ISMS",
  "Software Engineering",
] as const;

export type Department = (typeof departments)[number];
