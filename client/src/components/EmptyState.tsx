export const EmptyState = ({ title, message }: { title: string; message: string }) => (
  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
    <h3 className="text-base font-semibold text-slate-900">{title}</h3>
    <p className="mt-1 text-sm text-slate-500">{message}</p>
  </div>
);
