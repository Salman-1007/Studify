import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { Send } from 'lucide-react';
import { api, getAccessToken, SOCKET_URL } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function GroupChat() {
  const { id } = useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState(null);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  const { data: history, isLoading } = useQuery({
    queryKey: ['group-messages', id],
    queryFn: () => api.get(`/groups/${id}/messages`).then((r) => r.data.data.messages),
  });

  useEffect(() => {
    if (history) setMessages(history);
  }, [history]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token: getAccessToken() } });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('group:join', { groupId: id }, (res) => setConnected(res?.success));
    });
    socket.on('group:message', (msg) => {
      setMessages((prev) => (prev ? [...prev, msg] : [msg]));
    });

    return () => socket.disconnect();
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  const send = () => {
    if (!input.trim()) return;
    socketRef.current.emit('group:message', { groupId: id, content: input.trim() });
    setInput('');
  };

  if (isLoading || messages === null) return <Skeleton className="h-96" />;

  return (
    <div className="max-w-2xl flex flex-col h-[calc(100vh-8rem)]">
      <Link to={`/groups/${id}`} className="text-sm text-slate-400 hover:text-slate-200 mb-3">← Group</Link>
      <div className="flex-1 border border-slate-800 rounded-xl bg-slate-900/40 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && <p className="text-sm text-slate-500 text-center mt-8">No messages yet — say hello.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.senderId === user.id || m.sender?.id === user.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-xl px-3.5 py-2 text-sm ${m.senderId === user.id || m.sender?.id === user.id ? 'bg-blue-500 text-white' : 'bg-slate-800'}`}>
                {!(m.senderId === user.id || m.sender?.id === user.id) && <p className="text-xs opacity-70 mb-0.5">{m.sender?.name}</p>}
                <p>{m.content}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-slate-800 p-3 flex items-center gap-2">
          <input
            value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={connected ? 'Message the group…' : 'Connecting…'} disabled={!connected}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm disabled:opacity-60"
          />
          <button onClick={send} disabled={!connected} className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-lg p-2.5 text-white">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
