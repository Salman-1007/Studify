import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import {
  MessageSquare,
  Search,
  Send,
  UserPlus,
  Check,
  X,
  Trash2,
  Clock,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  MoreVertical,
} from 'lucide-react';
import { api, getAccessToken, SOCKET_URL } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function DirectChat() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [selectedChatId, setSelectedChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [connected, setConnected] = useState(false);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  // Fetch list of direct chats
  const { data: chats = [], isLoading: loadingChats, refetch: refetchChats } = useQuery({
    queryKey: ['direct-chats'],
    queryFn: () => api.get('/direct-chats').then((r) => r.data.data.chats),
    refetchInterval: 15000,
  });

  // Search users for new chat
  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ['search-users', searchQuery],
    queryFn: () => api.get(`/direct-chats/search-users?q=${encodeURIComponent(searchQuery)}`).then((r) => r.data.data.users),
    enabled: searchQuery.trim().length >= 2,
  });

  // Selected chat details
  const selectedChat = chats.find((c) => c.id === selectedChatId) || null;

  // Socket connection
  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token: getAccessToken() } });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      if (selectedChatId) {
        socket.emit('direct:join', { chatId: selectedChatId });
      }
    });

    socket.on('direct:message', (msg) => {
      if (msg.chatId === selectedChatId) {
        setMessages((prev) => [...prev, msg]);
      }
      refetchChats();
    });

    socket.on('direct:message_unsent', ({ messageId, message }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, isUnsent: true, content: 'This message was unsent' }
            : m
        )
      );
      refetchChats();
    });

    socket.on('direct:notification', () => {
      refetchChats();
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedChatId, refetchChats]);

  // Fetch messages when selected chat changes
  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('direct:join', { chatId: selectedChatId });
    }

    api
      .get(`/direct-chats/${selectedChatId}/messages`)
      .then((r) => {
        setMessages(r.data.data.messages || []);
      })
      .catch((err) => {
        showToast(err.response?.data?.message || 'Could not load messages', 'error');
      });
  }, [selectedChatId, showToast]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  // Send message
  const handleSendMessage = () => {
    if (!input.trim() || !selectedChatId) return;
    const content = input.trim();
    setInput('');

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('direct:message', { chatId: selectedChatId, content });
    } else {
      // HTTP fallback
      api.post(`/direct-chats/${selectedChatId}/messages`, { content }).then((r) => {
        setMessages((prev) => [...prev, r.data.data.message]);
        refetchChats();
      });
    }
  };

  // Unsend message
  const handleUnsendMessage = (messageId) => {
    if (!window.confirm('Unsend this message for everyone?')) return;

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('direct:unsend', { chatId: selectedChatId, messageId }, (res) => {
        if (!res?.success) {
          showToast(res?.message || 'Failed to unsend message', 'error');
        }
      });
    } else {
      api.delete(`/direct-chats/messages/${messageId}`).then(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, isUnsent: true, content: 'This message was unsent' }
              : m
          )
        );
        refetchChats();
      });
    }
  };

  // Start chat with user mutation
  const startChatMutation = useMutation({
    mutationFn: (targetUserId) =>
      api.post('/direct-chats/request', { recipientId: targetUserId }).then((r) => r.data.data.chat),
    onSuccess: (chat) => {
      showToast('Chat opened', 'success');
      setSearchQuery('');
      refetchChats();
      setSelectedChatId(chat.id);
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Could not start chat', 'error');
    },
  });

  // Accept / Reject chat request mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ chatId, status }) =>
      api.put(`/direct-chats/${chatId}/status`, { status }).then((r) => r.data.data.chat),
    onSuccess: (_, vars) => {
      showToast(vars.status === 'ACCEPTED' ? 'Chat request accepted' : 'Chat request declined', 'success');
      refetchChats();
    },
  });

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8.5rem)] flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Poppins' }}>
            <MessageSquare size={22} className="text-blue-400" />
            1-on-1 Student Chat
          </h1>
          <p className="text-xs text-slate-400">
            Connect directly with peer matric/intermediate students across Pakistan
          </p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden">
        {/* Left Sidebar: Chats list and User Search (4 cols) */}
        <div className="md:col-span-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col overflow-hidden backdrop-blur-md">
          {/* Search bar */}
          <div className="p-3 border-b border-slate-800">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students by name or email…"
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Search Results Dropdown/List */}
          {searchQuery.trim().length >= 2 ? (
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
              <p className="text-[11px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                Matching Students
              </p>
              {searching ? (
                <div className="p-4 text-center text-xs text-slate-500">Searching…</div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">No students found</div>
              ) : (
                searchResults.map((target) => (
                  <div
                    key={target.id}
                    className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-950/40 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{target.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{target.email}</p>
                      <span className="text-[10px] text-blue-400">
                        {target.grade ? `Class ${target.grade}` : 'Student'} • {target.points || 0} XP
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={startChatMutation.isPending}
                      onClick={() => startChatMutation.mutate(target.id)}
                      className="px-2.5 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <UserPlus size={13} />
                      <span>{target.chat ? 'Chat' : 'Connect'}</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Chat list */
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
              {loadingChats ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : chats.length === 0 ? (
                <div className="p-6 text-center text-slate-500 space-y-2">
                  <MessageSquare size={32} className="mx-auto text-slate-600" />
                  <p className="text-xs font-medium">No active chats yet</p>
                  <p className="text-[11px]">Search for a classmate above to start a conversation!</p>
                </div>
              ) : (
                chats.map((c) => {
                  const isSelected = c.id === selectedChatId;
                  const isPending = c.status === 'PENDING';
                  const needsAction = isPending && !c.isInitiator;

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedChatId(c.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-500/50 bg-blue-500/10 text-white shadow-sm'
                          : 'border-slate-800/60 bg-slate-900/30 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-blue-400 shrink-0">
                            {c.partner?.name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-100 truncate">{c.partner?.name}</p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {c.lastMessage ? (
                                <span className={c.lastMessage.isUnsent ? 'italic text-slate-500' : ''}>
                                  {c.lastMessage.content}
                                </span>
                              ) : (
                                <span className="italic text-slate-500">No messages yet</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {isPending && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                            Pending
                          </span>
                        )}
                      </div>

                      {/* Action buttons if current user needs to accept request */}
                      {needsAction && (
                        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-800/60">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatusMutation.mutate({ chatId: c.id, status: 'REJECTED' });
                            }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px] font-medium"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatusMutation.mutate({ chatId: c.id, status: 'ACCEPTED' });
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-medium flex items-center gap-1"
                          >
                            <Check size={12} />
                            Accept
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Right Area: Messages View (8 cols) */}
        <div className="md:col-span-8 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col overflow-hidden backdrop-blur-md">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center font-bold text-sm text-blue-400">
                    {selectedChat.partner?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white leading-tight">{selectedChat.partner?.name}</h2>
                    <p className="text-[11px] text-slate-400">
                      {selectedChat.partner?.email} • {selectedChat.partner?.grade ? `Class ${selectedChat.partner.grade}` : 'Student'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-slate-400 text-[11px]">Real-time encrypted</span>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 space-y-1">
                    <p className="text-xs font-semibold text-slate-400">Say hello!</p>
                    <p className="text-[11px]">Ask questions about Class 9 Physics or share study tips.</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMine = m.senderId === user?.id || m.sender?.id === user?.id;

                    return (
                      <div
                        key={m.id}
                        className={`flex items-end gap-2 group ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        {/* Unsend button (visible on hover for sender) */}
                        {isMine && !m.isUnsent && (
                          <button
                            type="button"
                            onClick={() => handleUnsendMessage(m.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800/80 cursor-pointer"
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
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={
                    selectedChat.status === 'PENDING'
                      ? 'Waiting for chat request approval…'
                      : 'Type a message… (Press Enter to send)'
                  }
                  disabled={selectedChat.status === 'PENDING'}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!input.trim() || selectedChat.status === 'PENDING'}
                  className="p-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white cursor-pointer transition-all shadow-md shadow-blue-500/20"
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center text-blue-400">
                <MessageSquare size={26} />
              </div>
              <h3 className="text-base font-bold text-slate-300" style={{ fontFamily: 'Poppins' }}>
                Select a Chat or Find Classmates
              </h3>
              <p className="text-xs max-w-sm text-slate-400 leading-relaxed">
                Study with friends, compare test scores, clarify Physics doubts, and message in real-time.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

