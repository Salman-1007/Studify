import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { Send, Trash2, ArrowLeft, Users } from 'lucide-react';
import { api, getAccessToken, SOCKET_URL } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function GroupChat() {
  const { id } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState(null);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  const { data: group } = useQuery({
    queryKey: ['group', id],
    queryFn: () => api.get(`/groups/${id}`).then((r) => r.data.data.group),
  });

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

    socket.on('group:message_unsent', ({ messageId, message }) => {
      setMessages((prev) =>
        prev
          ? prev.map((m) =>
              m.id === messageId
                ? { ...m, isUnsent: true, content: 'This message was unsent' }
                : m
            )
          : prev
      );
    });

    return () => socket.disconnect();
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  const send = () => {
    if (!input.trim()) return;
    const content = input.trim();
    setInput('');

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('group:message', { groupId: id, content });
    } else {
      api.post(`/groups/${id}/messages`, { content }).then((r) => {
        setMessages((prev) => [...prev, r.data.data.message]);
      });
    }
  };

  const handleUnsend = (messageId) => {
    if (!window.confirm('Unsend this message for everyone in the group?')) return;

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('group:unsend', { groupId: id, messageId }, (res) => {
        if (!res?.success) {
          showToast(res?.message || 'Failed to unsend message', 'error');
        }
      });
    } else {
      api.delete(`/groups/${id}/messages/${messageId}`).then(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, isUnsent: true, content: 'This message was unsent' }
              : m
          )
        );
      });
    }
  };

  if (isLoading || messages === null) return <Skeleton className="h-96" />;

  const isOwnerOrAdmin = group?.ownerId === user?.id || user?.role === 'ADMIN';

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)] space-y-3">
      <div className="flex items-center justify-between">
        <Link
          to={`/groups/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Group
        </Link>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          <span className="text-xs text-slate-400">{connected ? 'Live Chat' : 'Connecting…'}</span>
        </div>
      </div>

      <div className="flex-1 border border-slate-800 rounded-2xl bg-slate-900/60 backdrop-blur-md flex flex-col overflow-hidden shadow-xl">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 scrollbar-thin">
          {messages.length === 0 && (
            <p className="text-sm text-slate-500 text-center mt-12">No messages yet — start the study conversation.</p>
          )}

          {messages.map((m) => {
            const currentUserId = user?.id || user?._id;
            const isMine = Boolean(currentUserId && (m.senderId === currentUserId || m.sender?.id === currentUserId));
            const canUnsend = (isMine || isOwnerOrAdmin) && !m.isUnsent;

            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 group ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                {/* Unsend button (visible on hover or tap) */}
                {isMine && canUnsend && (
                  <button
                    type="button"
                    onClick={() => handleUnsend(m.id)}
                    className="opacity-40 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 cursor-pointer"
                    title="Unsend for everyone"
                  >
                    <Trash2 size={13} />
                  </button>
                )}

                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm shadow-md transition-all ${
                    isMine
                      ? m.isUnsent
                        ? 'bg-slate-800/60 border border-slate-700/60 text-slate-400 italic rounded-br-none'
                        : 'bg-blue-600 text-white rounded-br-none'
                      : m.isUnsent
                      ? 'bg-slate-800/40 border border-slate-800 text-slate-500 italic rounded-bl-none'
                      : 'bg-slate-800 border border-slate-700/60 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {!isMine && (
                    <p className="text-[11px] font-semibold text-blue-400 mb-0.5">
                      {m.sender?.name || 'Classmate'}
                    </p>
                  )}
                  <p className="leading-relaxed">{m.content}</p>
                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                      isMine ? 'text-blue-200/80' : 'text-slate-500'
                    }`}
                  >
                    <span>
                      {m.createdAt
                        ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                    {m.isUnsent && <span className="ml-1 text-slate-400">• Unsent</span>}
                  </div>
                </div>

                {/* Admin moderation unsend button */}
                {!isMine && isOwnerOrAdmin && canUnsend && (
                  <button
                    type="button"
                    onClick={() => handleUnsend(m.id)}
                    className="opacity-40 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 cursor-pointer"
                    title="Moderate: Unsend for everyone"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <div className="border-t border-slate-800 p-3 bg-slate-950/40 flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={connected ? 'Message the group… (Enter to send)' : 'Connecting…'}
            disabled={!connected}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={send}
            disabled={!connected || !input.trim()}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-xl p-2.5 text-white transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
