export default function EmptyState({ title, subtitle, action }) {
  return (
    <div className="text-center py-16 text-slate-400">
      <p className="text-slate-200 font-medium">{title}</p>
      {subtitle && <p className="text-sm mt-1">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
