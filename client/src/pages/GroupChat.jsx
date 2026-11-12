import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import {
  Send,
  ArrowLeft,
  Search,
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

export default function GroupChat() {
  const { id } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const currentUserId = user?.id || user?._id;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const { data: group } = useQuery({
    queryKey: ['group', id],
    queryFn: () => api.get(`/groups/${id}`).then((r) => r.data.data.group),
  });

  const { isLoading } = useQuery({
    queryKey: ['group-messages', id],
    queryFn: async () => {
      const res = await api.get(`/groups/${id}/messages`);
      const list = res.data.data.messages || [];
      setMessages(list);
      if (list.length > 0) {
        api.post(`/groups/${id}/read`, {}).catch(() => {});
      }
      return list;
    },
  });

  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token: getAccessToken() } });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('group:join', { groupId: id }, (res) => setConnected(Boolean(res?.success)));
    });

    socket.on('group:message', (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (msg.senderId !== currentUserId) {
        socket.emit('group:seen', { groupId: id, messageIds: [msg.id] });
      }
    });

    socket.on('group:message_updated', (updated) => {
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    });

    socket.on('group:message_unsent', ({ messageId, message }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? message || { ...m, isUnsent: true, isDeletedForEveryone: true, content: 'This message was unsent' }
            : m
        )
      );
    });

    socket.on('group:typing', ({ groupId: gId, userId, name, isTyping }) => {
      if (gId !== id || userId === currentUserId) return;
      setTypingUsers((prev) => {
        const filtered = prev.filter((u) => u.userId !== userId);
        return isTyping ? [...filtered, { userId, name }] : filtered;
      });
    });

    socket.on('group:messages_seen', ({ groupId: gId, messageIds }) => {
      if (gId !== id || !Array.isArray(messageIds)) return;
      setMessages((prev) =>
        prev.map((m) =>
          messageIds.includes(m.id) ? { ...m, deliveryStatus: 'SEEN' } : m
        )
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [id, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const emitTyping = (typing) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('group:typing', { groupId: id, isTyping: typing });
    }
  };

  const handleInputChange = (val) => {
    setInput(val);
    emitTyping(Boolean(val.trim()));
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emitTyping(false), 1800);
  };

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed && !pendingAttachment) return;
    const payload = {
      groupId: id,
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
      socketRef.current.emit('group:message', payload, (res) => {
        if (!res?.success && res?.message) {
          showToast(res.message, 'error');
        }
      });
    } else {
      api.post(`/groups/${id}/messages`, payload).then((r) => {
        setMessages((prev) => [...prev, r.data.data.message]);
      }).catch((err) => {
        showToast(err.response?.data?.message || 'Failed to send message', 'error');
      });
    }
  };

  const handleEdit = async (messageId, content) => {
    try {
      const res = await api.patch(`/groups/${id}/messages/${messageId}`, { content });
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
      await api.delete(`/groups/${id}/messages/${messageId}/for-me`);
    } catch (err) {
      setMessages(snapshot);
      showToast(err.response?.data?.message || 'Could not remove message', 'error');
    }
  };

  const handleDeleteForEveryone = (messageId) => {
    if (!window.confirm('Delete this message for everyone in the group?')) return;
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('group:unsend', { groupId: id, messageId }, (res) => {
        if (!res?.success) showToast(res?.message || 'Failed to delete message', 'error');
      });
    } else {
      api.delete(`/groups/${id}/messages/${messageId}`).then((r) => {
        const updated = r.data.data.message;
        setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
      });
    }
  };

  const handleReact = async (messageId, emoji) => {
    try {
      const res = await api.post(`/groups/${id}/messages/${messageId}/reactions`, { emoji });
      const updated = res.data.data.message;
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not react to message', 'error');
    }
  };

  const handlePin = async (messageId) => {
    try {
      const res = await api.patch(`/groups/${id}/messages/${messageId}/pin`);
      const updated = res.data.data.message;
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not pin message', 'error');
    }
  };

  const handleClearChat = async () => {
    if (!window.confirm('Clear chat history from your view? Other members will still see messages.')) return;
    try {
      await api.post(`/groups/${id}/clear`, { action: 'CLEAR' });
      setMessages([]);
      showToast('Chat cleared from your view', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to clear chat', 'error');
    }
  };

  if (isLoading) return <Skeleton className="h-96" />;

  const myMember = group?.members?.find((m) => m.userId === currentUserId);
  const canModerate =
    group?.ownerId === currentUserId ||
    user?.role === 'ADMIN' ||
    myMember?.role === 'OWNER' ||
    myMember?.role === 'MODERATOR';

  const visibleMessages = searchTerm.trim()
    ? messages.filter(
        (m) =>
          !m.isUnsent &&
          !m.isDeletedForEveryone &&
          ((m.content || '').toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
            (m.attachment?.title || '').toLowerCase().includes(searchTerm.trim().toLowerCase()))
      )
    : messages;

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)] space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to={`/groups/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">{group?.name || 'Group Chat'}</h1>
            <p className="text-[11px] text-slate-400">{group?.members?.length || 0} participants</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="p-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
            title="Search messages"
          >
            <Search size={14} />
          </button>
          <button
            type="button"
            onClick={handleClearChat}
            className="p-2 rounded-xl border border-slate-800 text-slate-400 hover:text-amber-400 cursor-pointer"
            title="Clear chat for me"
          >
            <Eraser size={14} />
          </button>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            <span className="text-[11px] text-slate-400">{connected ? 'Live' : 'Connecting…'}</span>
          </div>
        </div>
      </div>

      {searchOpen && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/60">
          <Search size={14} className="text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search messages in this group…"
            className="flex-1 bg-transparent text-xs text-slate-100 focus:outline-none"
            autoFocus
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-white cursor-pointer">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div className="flex-1 border border-slate-800 rounded-2xl bg-slate-900/60 backdrop-blur-md flex flex-col overflow-hidden shadow-xl">
        {visibleMessages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center text-sm text-slate-500">
            {searchTerm ? 'No matching messages found.' : 'No messages yet — start the study conversation.'}
          </div>
        ) : (
          <ChatMessageList
            messages={visibleMessages}
            currentUserId={currentUserId}
            currentUserRole={user?.role}
            canPin={canModerate}
            canModerate={canModerate}
            showSenderNames
            typingUsers={typingUsers}
            onReply={(m) => setReplyingTo(m)}
            onCopy={(text) => {
              navigator.clipboard?.writeText(text);
              showToast('Copied to clipboard', 'success');
            }}
            onEdit={handleEdit}
            onDeleteForMe={handleDeleteForMe}
            onDeleteForEveryone={handleDeleteForEveryone}
            onReact={handleReact}
            onPin={handlePin}
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

        <div className="border-t border-slate-800 p-3 bg-slate-950/40 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="p-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
            title="Share Quiz, Material, or Study Note"
          >
            <Paperclip size={16} />
          </button>
          <input
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Message the group… (Enter to send)"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={send}
            disabled={!input.trim() && !pendingAttachment}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl p-2.5 text-white transition-all shadow-md cursor-pointer"
          >
            <Send size={16} />
          </button>
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
