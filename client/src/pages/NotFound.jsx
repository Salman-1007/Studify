import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center text-slate-100">
      <p className="text-3xl font-semibold" style={{ fontFamily: 'Poppins' }}>Page not found</p>
      <p className="text-slate-400 mt-2">That page doesn't exist.</p>
      <Link to="/" className="mt-4 text-blue-400">Back to Studify</Link>
    </div>
  );
}
