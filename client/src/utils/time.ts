export const formatDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

export const formatDuration = (minutes: number) => `${minutes} minute${minutes === 1 ? "" : "s"}`;
