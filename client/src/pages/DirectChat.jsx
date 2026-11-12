import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import {
  MessageSquare,
  Search,
  Send,
  UserPlus,
  Check,
  Trash2,
  Paperclip,
  Eraser,
  X,
} from 'lucide-react';
import { api, getAccessToken, SOCKET_URL } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ChatMessageList, { ReplyComposerBanner } from '../components/ChatMessageList.jsx';
import ShareStudyModal from '../components/ShareStudyModal.jsx';

const formatLastSeen = (presence) => {
  if (!presence || !presence.showOnlineStatus) return 'Online status hidden';
  if (presence.online) return 'Online';
  if (!presence.lastSeenAt) return 'Offline';
  return `Last seen ${new Date(presence.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

export default function DirectChat() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const currentUserId = user?.id || user?._id;

  const [selectedChatId, setSelectedChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [partnerPresence, setPartnerPresence] = useState(null);
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [msgSearchOpen, setMsgSearchOpen] = useState(false);
  const [msgSearch, setMsgSearch] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [typingPartner, setTypingPartner] = useState(null);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const { data: chats = [], isLoading: loadingChats, refetch: refetchChats } = useQuery({
    queryKey: ['direct-chats'],
    queryFn: () => api.get('/direct-chats').then((r) => r.data.data.chats),
    refetchInterval: 15000,
  });

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ['search-users', searchQuery],
    queryFn: () =>
      api.get(`/direct-chats/search-users?q=${encodeURIComponent(searchQuery)}`).then((r) => r.data.data.users),
    enabled: searchQuery.trim().length >= 2,
  });

  const selectedChat = chats.find((c) => c.id === selectedChatId) || null;

  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token: getAccessToken() } });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (selectedChatId) {
        socket.emit('direct:join', { chatId: selectedChatId });
      }
    });

    socket.on('direct:message', (msg) => {
      if (msg.chatId === selectedChatId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (msg.senderId !== currentUserId) {
          socket.emit('direct:seen', { chatId: selectedChatId, messageIds: [msg.id] });
        }
      }
      refetchChats();
    });

    socket.on('direct:message_updated', (updated) => {
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    });

    socket.on('direct:message_unsent', ({ messageId, message }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? message || { ...m, isUnsent: true, isDeletedForEveryone: true, content: 'This message was unsent' }
            : m
        )
      );
      refetchChats();
    });

    socket.on('direct:typing', ({ chatId: cId, userId, name, isTyping }) => {
      if (cId !== selectedChatId || userId === currentUserId) return;
      setTypingPartner(isTyping ? { userId, name } : null);
    });

    socket.on('direct:messages_seen', ({ chatId: cId, messageIds }) => {
      if (cId !== selectedChatId || !Array.isArray(messageIds)) return;
      setMessages((prev) =>
        prev.map((m) =>
          messageIds.includes(m.id) ? { ...m, deliveryStatus: 'SEEN' } : m
        )
      );
    });

    socket.on('presence:update', ({ userId, online, lastSeenAt }) => {
      if (selectedChat?.partner?.id === userId) {
        setPartnerPresence((prev) =>
          prev && !prev.showOnlineStatus
            ? prev
            : { showOnlineStatus: true, online, lastSeenAt }
        );
      }
    });

    socket.on('direct:notification', () => {
      refetchChats();
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedChatId, currentUserId, selectedChat?.partner?.id, refetchChats]);

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      setPartnerPresence(null);
      setTypingPartner(null);
      return;
    }

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('direct:join', { chatId: selectedChatId });
    }

    api
      .get(`/direct-chats/${selectedChatId}/messages`)
      .then((r) => {
        const list = r.data.data.messages || [];
        setMessages(list);
        setPartnerPresence(r.data.data.partnerPresence || null);
        if (list.length > 0) {
          api.post(`/direct-chats/${selectedChatId}/read`, {}).then(() => refetchChats()).catch(() => {});
        }
      })
      .catch((err) => {
        showToast(err.response?.data?.message || 'Could not load messages', 'error');
      });
  }, [selectedChatId, showToast, refetchChats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const emitTyping = (typing) => {
    if (socketRef.current?.connected && selectedChatId) {
      socketRef.current.emit('direct:typing', { chatId: selectedChatId, isTyping: typing });
    }
  };

  const handleInputChange = (val) => {
    setInput(val);
    emitTyping(Boolean(val.trim()));
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emitTyping(false), 1800);
  };

  const handleSendMessage = () => {
    const trimmed = input.trim();
    if ((!trimmed && !pendingAttachment) || !selectedChatId) return;

    const payload = {
      chatId: selectedChatId,
      content: trimmed || pendingAttachment?.defaultContent || '',
      messageType: pendingAttachment?.messageType || 'TEXT',
      attachment: pendingAttachment?.attachment || null,
      replyToId: replyingTo?.id || null,
    };

    setInput('');
    setReplyingTo(null);
    setPendingAttachment(null);
    emitTyping(false);

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('direct:message', payload, (res) => {
        if (!res?.success && res?.message) {
          showToast(res.message, 'error');
        }
      });
    } else {
      api.post(`/direct-chats/${selectedChatId}/messages`, payload).then((r) => {
        setMessages((prev) => [...prev, r.data.data.message]);
        refetchChats();
      }).catch((err) => {
        showToast(err.response?.data?.message || 'Failed to send message', 'error');
      });
    }
  };

  const handleEditMessage = async (messageId, content) => {
    try {
      const res = await api.patch(`/direct-chats/${selectedChatId}/messages/${messageId}`, { content });
      const updated = res.data.data.message;
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to edit message', 'error');
    }
  };

  const handleDeleteForMe = async (messageId) => {
    const snapshot = messages;
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    try {
      await api.delete(`/direct-chats/${selectedChatId}/messages/${messageId}/for-me`);
    } catch (err) {
      setMessages(snapshot);
      showToast(err.response?.data?.message || 'Could not remove message', 'error');
    }
  };

  const handleDeleteForEveryone = (messageId) => {
    if (!window.confirm('Delete this message for everyone?')) return;
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('direct:unsend', { chatId: selectedChatId, messageId }, (res) => {
        if (!res?.success) showToast(res?.message || 'Failed to delete message', 'error');
      });
    } else {
      api.delete(`/direct-chats/messages/${messageId}`).then((r) => {
        const updated = r.data.data.message;
        setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
        refetchChats();
      });
    }
  };

  const handleReactMessage = async (messageId, emoji) => {
    try {
      const res = await api.post(`/direct-chats/${selectedChatId}/messages/${messageId}/reactions`, { emoji });
      const updated = res.data.data.message;
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update reaction', 'error');
    }
  };

  const handlePinMessage = async (messageId) => {
    try {
      const res = await api.patch(`/direct-chats/${selectedChatId}/messages/${messageId}/pin`);
      const updated = res.data.data.message;
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to pin message', 'error');
    }
  };

  const handleClearChat = async () => {
    if (!selectedChatId) return;
    if (!window.confirm('Clear all messages from your view?')) return;
    try {
      await api.post(`/direct-chats/${selectedChatId}/clear`, { action: 'CLEAR' });
      setMessages([]);
      refetchChats();
      showToast('Chat cleared from your view', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not clear chat', 'error');
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedChatId) return;
    if (!window.confirm('Delete this conversation from your inbox? It will reappear if they message you again.')) return;
    try {
      await api.delete(`/direct-chats/${selectedChatId}`);
      setSelectedChatId(null);
      setMessages([]);
      refetchChats();
      showToast('Conversation removed from your list', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not delete conversation', 'error');
    }
  };

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

  const updateStatusMutation = useMutation({
    mutationFn: ({ chatId, status }) =>
      api.put(`/direct-chats/${chatId}/status`, { status }).then((r) => r.data.data.chat),
    onSuccess: (_, vars) => {
      showToast(vars.status === 'ACCEPTED' ? 'Chat request accepted' : 'Chat request declined', 'success');
      refetchChats();
    },
  });

  const visibleMessages = msgSearch.trim()
    ? messages.filter(
        (m) =>
          !m.isUnsent &&
          !m.isDeletedForEveryone &&
          ((m.content || '').toLowerCase().includes(msgSearch.trim().toLowerCase()) ||
            (m.attachment?.title || '').toLowerCase().includes(msgSearch.trim().toLowerCase()))
      )
    : messages;

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8.5rem)] flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Poppins' }}>
            <MessageSquare size={22} className="text-indigo-400" />
            Direct Messaging
          </h1>
          <p className="text-xs text-slate-400">
            Real-time conversations with classmates and teachers — with replies, reactions, and study sharing
          </p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden">
        {/* Left Sidebar */}
        <div className="md:col-span-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col overflow-hidden backdrop-blur-md">
          <div className="p-3 border-b border-slate-800">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students or teachers…"
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {searchQuery.trim().length >= 2 ? (
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
              <p className="text-[11px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                Matching Users
              </p>
              {searching ? (
                <div className="p-4 text-center text-xs text-slate-500">Searching…</div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">No users found</div>
              ) : (
                searchResults.map((target) => (
                  <div
                    key={target.id}
                    className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-950/40 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{target.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{target.email}</p>
                      <span className="text-[10px] text-indigo-400">
                        {target.grade ? `Class ${target.grade}` : 'Member'} • {target.points || 0} XP
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={startChatMutation.isPending}
                      onClick={() => startChatMutation.mutate(target.id)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <UserPlus size={13} />
                      <span>{target.chat ? 'Chat' : 'Connect'}</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
              {loadingChats ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : chats.length === 0 ? (
                <div className="p-6 text-center text-slate-500 space-y-2">
                  <MessageSquare size={32} className="mx-auto text-slate-600" />
                  <p className="text-xs font-medium">No active chats yet</p>
                  <p className="text-[11px]">Search for a classmate or teacher above to start!</p>
                </div>
              ) : (
                chats.map((c) => {
                  const isSelected = c.id === selectedChatId;
                  const isPending = c.status === 'PENDING';
                  const needsAction = isPending && !c.isInitiator;
                  const isOnline = Boolean(c.partner?.presence?.online);

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedChatId(c.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-500/50 bg-indigo-500/10 text-white shadow-sm'
                          : 'border-slate-800/60 bg-slate-900/30 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400">
                              {c.partner?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            {isOnline && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
                            )}
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

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {c.unreadCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                              {c.unreadCount}
                            </span>
                          )}
                          {isPending && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {needsAction && (
                        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-800/60">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatusMutation.mutate({ chatId: c.id, status: 'REJECTED' });
                            }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px] font-medium cursor-pointer"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatusMutation.mutate({ chatId: c.id, status: 'ACCEPTED' });
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer"
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

        {/* Right Conversation Panel */}
        <div className="md:col-span-8 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col overflow-hidden backdrop-blur-md">
          {selectedChat ? (
            <>
              <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center font-bold text-sm text-indigo-400 shrink-0">
                    {selectedChat.partner?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-white leading-tight truncate">{selectedChat.partner?.name}</h2>
                    <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          partnerPresence?.online ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                      <span>{formatLastSeen(partnerPresence || selectedChat.partner?.presence)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setMsgSearchOpen((v) => !v)}
                    className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                    title="Search messages"
                  >
                    <Search size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleClearChat}
                    className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-amber-400 cursor-pointer"
                    title="Clear messages for me"
                  >
                    <Eraser size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteConversation}
                    className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-rose-400 cursor-pointer"
                    title="Delete conversation from my inbox"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {msgSearchOpen && (
                <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/30 flex items-center gap-2">
                  <Search size={13} className="text-slate-400" />
                  <input
                    type="text"
                    value={msgSearch}
                    onChange={(e) => setMsgSearch(e.target.value)}
                    placeholder="Search within this conversation…"
                    className="flex-1 bg-transparent text-xs text-slate-100 focus:outline-none"
                    autoFocus
                  />
                  {msgSearch && (
                    <button type="button" onClick={() => setMsgSearch('')} className="text-slate-400 hover:text-white cursor-pointer">
                      <X size={13} />
                    </button>
                  )}
                </div>
              )}

              {visibleMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-1">
                  <p className="text-xs font-semibold text-slate-400">
                    {msgSearch ? 'No matching messages' : 'Say hello!'}
                  </p>
                  <p className="text-[11px]">
                    {msgSearch
                      ? 'Try a different keyword.'
                      : 'Ask questions, reply inline, or share quizzes and study notes.'}
                  </p>
                </div>
              ) : (
                <ChatMessageList
                  messages={visibleMessages}
                  currentUserId={currentUserId}
                  currentUserRole={user?.role}
                  canPin
                  canModerate={false}
                  showSenderNames={false}
                  typingUsers={typingPartner ? [typingPartner] : []}
                  onReply={(m) => setReplyingTo(m)}
                  onCopy={(text) => {
                    navigator.clipboard?.writeText(text);
                    showToast('Copied to clipboard', 'success');
                  }}
                  onEdit={handleEditMessage}
                  onDeleteForMe={handleDeleteForMe}
                  onDeleteForEveryone={handleDeleteForEveryone}
                  onReact={handleReactMessage}
                  onPin={handlePinMessage}
                  bottomRef={bottomRef}
                />
              )}

              <ReplyComposerBanner replyingTo={replyingTo} onCancel={() => setReplyingTo(null)} />

              {pendingAttachment && (
                <div className="px-4 py-2 border-t border-slate-800 bg-indigo-500/10 flex items-center justify-between text-xs">
                  <span className="text-indigo-300 font-medium truncate">
                    Attached: {pendingAttachment.attachment?.title || pendingAttachment.messageType}
                  </span>
                  <button type="button" onClick={() => setPendingAttachment(null)} className="text-slate-400 hover:text-white cursor-pointer">
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex items-center gap-2">
                <button
                  type="button"
                  disabled={selectedChat.status === 'PENDING'}
                  onClick={() => setShareOpen(true)}
                  className="p-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                  title="Share Quiz, Material, or Study Note"
                >
                  <Paperclip size={16} />
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={
                    selectedChat.status === 'PENDING'
                      ? 'Waiting for chat request approval…'
                      : 'Type a message… (Press Enter to send)'
                  }
                  disabled={selectedChat.status === 'PENDING'}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={(!input.trim() && !pendingAttachment) || selectedChat.status === 'PENDING'}
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white cursor-pointer transition-all shadow-md"
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center text-indigo-400">
                <MessageSquare size={26} />
              </div>
              <h3 className="text-base font-bold text-slate-300" style={{ fontFamily: 'Poppins' }}>
                Select a Chat or Find Classmates
              </h3>
              <p className="text-xs max-w-sm text-slate-400 leading-relaxed">
                Collaborate with peers and educators in real time — reply inline, react, pin key explanations, and share quizzes or notes.
              </p>
            </div>
          )}
        </div>
      </div>

      <ShareStudyModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onSelect={(item) => setPendingAttachment(item)}
      />
    </div>
  );
}
