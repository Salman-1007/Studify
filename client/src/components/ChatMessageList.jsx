import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Reply,
  Copy,
  Edit3,
  Trash2,
  Pin,
  MoreVertical,
  Check,
  CheckCheck,
  X,
  BookOpen,
  FileText,
  Megaphone,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '✅'];
const EDIT_WINDOW_MS = 15 * 60 * 1000;

const formatDateLabel = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

function SharedAttachmentCard({ messageType, attachment, isMine }) {
  if (!attachment || messageType === 'TEXT') return null;

  const iconMap = {
    QUIZ: <Sparkles size={15} className="text-amber-400 shrink-0" />,
    QUIZ_ASSIGNMENT: <BookOpen size={15} className="text-indigo-400 shrink-0" />,
    MATERIAL: <FileText size={15} className="text-emerald-400 shrink-0" />,
    ANNOUNCEMENT: <Megaphone size={15} className="text-rose-400 shrink-0" />,
    STUDY_NOTE: <FileText size={15} className="text-blue-400 shrink-0" />,
  };

  const labelMap = {
    QUIZ: 'Shared Quiz',
    QUIZ_ASSIGNMENT: 'Assigned Quiz',
    MATERIAL: 'Study Material',
    ANNOUNCEMENT: 'Announcement',
    STUDY_NOTE: 'Study Note',
  };

  return (
    <div
      className={`mb-2 rounded-xl border p-2.5 text-left ${
        isMine
          ? 'bg-black/20 border-white/20 text-white'
          : 'bg-slate-900/70 border-slate-700/70 text-slate-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-80">
          {iconMap[messageType] || <FileText size={14} />}
          {labelMap[messageType] || 'Shared Resource'}
        </span>
        {attachment.link && (
          <Link
            to={attachment.link}
            className="inline-flex items-center gap-1 text-[11px] font-semibold underline-offset-2 hover:underline text-indigo-300"
          >
            Open <ExternalLink size={11} />
          </Link>
        )}
      </div>
      <p className="text-xs font-semibold leading-snug">{attachment.title || 'Shared Resource'}</p>
      {attachment.excerpt && <p className="text-[11px] opacity-80 mt-1 line-clamp-2">{attachment.excerpt}</p>}
      {attachment.subject && (
        <p className="text-[10px] opacity-75 mt-1">
          {attachment.subject}
          {attachment.questionCount ? ` • ${attachment.questionCount} questions` : ''}
        </p>
      )}
      {attachment.deadline && (
        <p className="text-[10px] opacity-75 mt-1">
          Due {new Date(attachment.deadline).toLocaleString()}
        </p>
      )}
    </div>
  );
}

export default function ChatMessageList({
  messages = [],
  currentUserId,
  currentUserRole,
  canPin = false,
  canModerate = false,
  showSenderNames = false,
  typingUsers = [],
  unreadDividerIndex = -1,
  onReply,
  onCopy,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onReact,
  onPin,
  bottomRef,
}) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');

  const pinnedMessages = messages.filter((m) => m.isPinned && !m.isUnsent && !m.isDeletedForEveryone);

  const startEdit = (msg) => {
    setEditingId(msg.id);
    setEditDraft(msg.content || '');
    setOpenMenuId(null);
  };

  const commitEdit = async (messageId) => {
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    await onEdit?.(messageId, trimmed);
    setEditingId(null);
    setEditDraft('');
  };

  let lastDateStr = '';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Pinned Banner */}
      {pinnedMessages.length > 0 && (
        <div
          className="px-4 py-2 border-b flex items-center justify-between gap-3 text-xs shrink-0"
          style={{
            backgroundColor: 'var(--accent-subtle)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Pin size={13} className="text-indigo-400 shrink-0" />
            <span className="font-semibold shrink-0">Pinned:</span>
            <span className="truncate opacity-85">
              {pinnedMessages[pinnedMessages.length - 1].content}
            </span>
          </div>
          {canPin && (
            <button
              type="button"
              onClick={() => onPin?.(pinnedMessages[pinnedMessages.length - 1].id)}
              className="text-[11px] font-semibold text-indigo-400 hover:underline shrink-0 cursor-pointer"
            >
              Unpin
            </button>
          )}
        </div>
      )}

      {/* Scrollable Message Stream */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin"
        onClick={() => setOpenMenuId(null)}
      >
        {messages.map((m, idx) => {
          const isMine = Boolean(
            currentUserId && (m.senderId === currentUserId || m.sender?.id === currentUserId)
          );
          const isDeleted = Boolean(m.isUnsent || m.isDeletedForEveryone || m.deletedForEveryoneAt);
          const dateLabel = formatDateLabel(m.createdAt);
          const showDateHeader = dateLabel && dateLabel !== lastDateStr;
          if (dateLabel) lastDateStr = dateLabel;

          const canEdit =
            isMine &&
            !isDeleted &&
            Date.now() - new Date(m.createdAt).getTime() <= EDIT_WINDOW_MS;
          const canDeleteEveryone =
            !isDeleted && (isMine || canModerate || currentUserRole === 'ADMIN');

          const isMenuOpen = openMenuId === m.id;
          const isEditing = editingId === m.id;

          return (
            <React.Fragment key={m.id}>
              {showDateHeader && (
                <div className="flex items-center justify-center my-2">
                  <span className="px-3 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800/80 text-slate-400 border border-slate-700/60">
                    {dateLabel}
                  </span>
                </div>
              )}

              {unreadDividerIndex === idx && (
                <div className="flex items-center gap-3 my-2">
                  <div className="flex-1 h-px bg-indigo-500/40" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    Unread Messages
                  </span>
                  <div className="flex-1 h-px bg-indigo-500/40" />
                </div>
              )}

              <div
                id={`msg-${m.id}`}
                className={`flex items-end gap-1.5 group relative ${
                  isMine ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Action Trigger (left for outgoing) */}
                {isMine && (
                  <div className="relative flex items-center gap-0.5 opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      aria-label="Message actions"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(isMenuOpen ? null : m.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 cursor-pointer"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>
                )}

                <div className={`max-w-[78%] sm:max-w-[68%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  {showSenderNames && !isMine && (
                    <span className="text-[11px] font-semibold text-indigo-400 mb-0.5 px-1">
                      {m.sender?.name || 'Member'}
                      {m.sender?.role === 'TEACHER' && (
                        <span className="ml-1.5 px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-bold">
                          TEACHER
                        </span>
                      )}
                    </span>
                  )}

                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm shadow-sm relative ${
                      isMine
                        ? isDeleted
                          ? 'bg-slate-800/60 border border-slate-700/60 text-slate-400 italic rounded-br-none'
                          : 'bg-indigo-600 text-white rounded-br-none'
                        : isDeleted
                        ? 'bg-slate-800/40 border border-slate-800 text-slate-500 italic rounded-bl-none'
                        : 'bg-slate-800 border border-slate-700/70 text-slate-100 rounded-bl-none'
                    }`}
                  >
                    {/* Quoted Reply Snippet */}
                    {m.replyTo && !isDeleted && (
                      <div
                        className={`mb-2 px-2.5 py-1.5 rounded-lg border-l-2 text-[11px] ${
                          isMine
                            ? 'bg-black/20 border-white/60 text-white/90'
                            : 'bg-slate-900/70 border-indigo-400 text-slate-300'
                        }`}
                      >
                        <p className="font-bold text-[10px]">
                          {m.replyTo.sender?.name || 'Message'}
                        </p>
                        <p className="truncate opacity-85">{m.replyTo.content}</p>
                      </div>
                    )}

                    {/* Shared Content Card */}
                    {!isDeleted && (
                      <SharedAttachmentCard
                        messageType={m.messageType}
                        attachment={m.attachment}
                        isMine={isMine}
                      />
                    )}

                    {/* Inline Edit or Body */}
                    {isEditing ? (
                      <div className="space-y-2 min-w-[210px]" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit(m.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="w-full bg-slate-950/80 border border-white/25 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-1.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-2 py-0.5 rounded bg-black/25 hover:bg-black/40 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => commitEdit(m.id)}
                            className="px-2 py-0.5 rounded bg-emerald-500 text-white font-semibold cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
                    )}

                    {/* Meta row */}
                    <div
                      className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] ${
                        isMine && !isDeleted ? 'text-indigo-100/80' : 'text-slate-400'
                      }`}
                    >
                      {m.isPinned && !isDeleted && <Pin size={10} />}
                      {m.editedAt && !isDeleted && <span>edited</span>}
                      <span>
                        {m.createdAt
                          ? new Date(m.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                      {isMine && !isDeleted && (
                        <span title={`Status: ${m.deliveryStatus || 'SENT'}`}>
                          {m.deliveryStatus === 'SEEN' ? (
                            <CheckCheck size={12} className="text-sky-300" />
                          ) : m.deliveryStatus === 'DELIVERED' ? (
                            <CheckCheck size={12} className="opacity-80" />
                          ) : (
                            <Check size={12} className="opacity-75" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reaction Badges */}
                  {m.reactionSummary && m.reactionSummary.length > 0 && !isDeleted && (
                    <div className="flex flex-wrap items-center gap-1 mt-1 px-1">
                      {m.reactionSummary.map((r) => (
                        <button
                          key={r.emoji}
                          type="button"
                          onClick={() => onReact?.(m.id, r.emoji)}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] border cursor-pointer transition-colors ${
                            r.reactedByMe
                              ? 'bg-indigo-500/25 border-indigo-400/50 text-indigo-200'
                              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <span>{r.emoji}</span>
                          <span className="font-semibold">{r.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Trigger (right for incoming) */}
                {!isMine && (
                  <div className="relative flex items-center gap-0.5 opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      aria-label="Message actions"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(isMenuOpen ? null : m.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 cursor-pointer"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>
                )}

                {/* Popover Menu */}
                {isMenuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute bottom-full mb-1 z-30 w-48 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl p-1.5 text-xs space-y-0.5 ${
                      isMine ? 'right-0' : 'left-0'
                    }`}
                  >
                    {!isDeleted && (
                      <div className="flex items-center justify-between px-1.5 py-1 border-b border-slate-800 mb-1">
                        {QUICK_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              onReact?.(m.id, emoji);
                              setOpenMenuId(null);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-800 text-sm cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {!isDeleted && (
                      <button
                        type="button"
                        onClick={() => {
                          onReply?.(m);
                          setOpenMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 cursor-pointer"
                      >
                        <Reply size={13} /> Reply
                      </button>
                    )}

                    {!isDeleted && (
                      <button
                        type="button"
                        onClick={() => {
                          onCopy?.(m.content);
                          setOpenMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 cursor-pointer"
                      >
                        <Copy size={13} /> Copy text
                      </button>
                    )}

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 cursor-pointer"
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                    )}

                    {canPin && !isDeleted && (
                      <button
                        type="button"
                        onClick={() => {
                          onPin?.(m.id);
                          setOpenMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 cursor-pointer"
                      >
                        <Pin size={13} /> {m.isPinned ? 'Unpin' : 'Pin message'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onDeleteForMe?.(m.id);
                        setOpenMenuId(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 cursor-pointer"
                    >
                      <Trash2 size={13} /> Delete for me
                    </button>

                    {canDeleteEveryone && (
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteForEveryone?.(m.id);
                          setOpenMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-950/50 cursor-pointer"
                      >
                        <Trash2 size={13} /> Delete for everyone
                      </button>
                    )}
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-indigo-400 font-medium">
            <span className="inline-flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.3s]" />
            </span>
            <span>
              {typingUsers.map((t) => t.name || 'Someone').join(', ')}{' '}
              {typingUsers.length === 1 ? 'is' : 'are'} typing…
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export function ReplyComposerBanner({ replyingTo, onCancel }) {
  if (!replyingTo) return null;
  return (
    <div
      className="px-4 py-2 border-t flex items-center justify-between gap-3 text-xs"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="border-l-2 border-indigo-500 pl-2.5 min-w-0">
        <p className="text-[10px] font-bold text-indigo-400">
          Replying to {replyingTo.sender?.name || 'message'}
        </p>
        <p className="text-slate-400 truncate">{replyingTo.content}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
      >
        <X size={14} />
      </button>
    </div>
  );
}
