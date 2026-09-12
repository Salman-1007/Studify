export default function ComingSoon({ feature }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-400">
      <p className="text-lg font-medium text-slate-200">{feature} is coming soon</p>
      <p className="text-sm mt-1">This part of Studify hasn't been built yet — no placeholder data here, just an honest status.</p>
    </div>
  );
}
