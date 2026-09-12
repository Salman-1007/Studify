import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { BookOpen, MessageSquareText, Trophy, Users } from 'lucide-react';

export default function Landing() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-slate-100">
      <header className="max-w-6xl mx-auto flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold">S</div>
          <span className="font-semibold text-lg" style={{ fontFamily: 'Poppins' }}>Studify</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/login" className="text-slate-300 hover:text-white">Log in</Link>
          <Link to="/signup" className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg font-medium">Get started</Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto text-center px-6 pt-16 pb-20">
        <h1 className="text-4xl sm:text-5xl font-semibold leading-tight" style={{ fontFamily: 'Poppins' }}>
          Study smarter with an AI mentor that actually knows your material
        </h1>
        <p className="mt-5 text-slate-400 text-lg max-w-2xl mx-auto">
          Import your notes, chat through the confusing parts, generate quizzes and flashcards,
          then track exactly where you're weak — alone or with your study group.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link to="/signup" className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-lg font-medium">Create your account</Link>
          <Link to="/login" className="border border-slate-700 hover:border-slate-500 px-6 py-3 rounded-lg font-medium">I already have one</Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-6 pb-24">
        {[
          { icon: MessageSquareText, title: 'AI Mentor', desc: 'Ask questions about your own material and get grounded answers.' },
          { icon: BookOpen, title: 'Quizzes & Flashcards', desc: 'Generated from your syllabus, scored, and tracked over time.' },
          { icon: Users, title: 'Study Groups', desc: 'Real-time chat and group quiz competitions with classmates.' },
          { icon: Trophy, title: 'Leaderboards', desc: 'See how you stack up — globally, in your group, or per quiz.' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-xl border border-slate-800 p-5 bg-slate-900/40">
            <Icon className="text-blue-400 mb-3" size={22} />
            <h3 className="font-medium mb-1">{title}</h3>
            <p className="text-sm text-slate-400">{desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
