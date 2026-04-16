'use client';

import { useState } from 'react';
import { Send, Trash2, CornerDownRight, X, Pencil, Check } from 'lucide-react';
import type { Comment } from '@/lib/types';
import { useGenealogyStore } from '@/store/genealogyStore';
import { cn } from '@/lib/utils';

interface Props {
  personId: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)   return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function CommentsTab({ personId }: Props) {
  const { comments, addComment, editComment, deleteComment } = useGenealogyStore(s => ({
    comments:      s.comments,
    addComment:    s.addComment,
    editComment:   s.editComment,
    deleteComment: s.deleteComment,
  }));

  const [text, setText]           = useState('');
  const [author, setAuthor]       = useState('');
  const [replyTo, setReplyTo]     = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText]   = useState('');

  // All comments for this person, sorted oldest first
  const all = Object.values(comments)
    .filter(c => c.personId === personId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const topLevel = all.filter(c => !c.parentId);
  const replies  = (parentId: string) => all.filter(c => c.parentId === parentId);

  function submitComment() {
    const trimmed = text.trim();
    if (!trimmed) return;
    addComment({ personId, text: trimmed, authorName: author.trim() || undefined });
    setText('');
  }

  function submitReply(parentId: string) {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    addComment({ personId, text: trimmed, authorName: author.trim() || undefined, parentId });
    setReplyText('');
    setReplyTo(null);
  }

  function startEdit(c: Comment) {
    setEditingId(c.id);
    setEditText(c.text);
  }

  function saveEdit() {
    if (editingId && editText.trim()) {
      editComment(editingId, editText.trim());
    }
    setEditingId(null);
    setEditText('');
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Author name (shared across posts in this session) */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Your name (optional)</label>
        <input
          value={author}
          onChange={e => setAuthor(e.target.value)}
          placeholder="Anonymous"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
      </div>

      {/* New comment box */}
      <div className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment(); }}
          placeholder="Add a note, memory, or question about this person…"
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <button
          onClick={submitComment}
          disabled={!text.trim()}
          className="self-end flex items-center gap-1.5 px-4 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          Post
        </button>
      </div>

      {/* Thread list */}
      {topLevel.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">
          No comments yet. Share a memory or note about this person.
        </p>
      ) : (
        <div className="space-y-4">
          {topLevel.map(c => (
            <CommentBlock
              key={c.id}
              comment={c}
              replies={replies(c.id)}
              editingId={editingId}
              editText={editText}
              setEditText={setEditText}
              replyTo={replyTo}
              replyText={replyText}
              setReplyText={setReplyText}
              authorHint={author}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={() => { setEditingId(null); setEditText(''); }}
              onDelete={deleteComment}
              onStartReply={(id) => { setReplyTo(id); setReplyText(''); }}
              onCancelReply={() => setReplyTo(null)}
              onSubmitReply={submitReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentBlock({
  comment, replies, editingId, editText, setEditText,
  replyTo, replyText, setReplyText, authorHint,
  onStartEdit, onSaveEdit, onCancelEdit,
  onDelete, onStartReply, onCancelReply, onSubmitReply,
}: {
  comment: Comment;
  replies: Comment[];
  editingId: string | null;
  editText: string;
  setEditText: (v: string) => void;
  replyTo: string | null;
  replyText: string;
  setReplyText: (v: string) => void;
  authorHint: string;
  onStartEdit: (c: Comment) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onStartReply: (id: string) => void;
  onCancelReply: () => void;
  onSubmitReply: (parentId: string) => void;
}) {
  const isEditing = editingId === comment.id;

  return (
    <div>
      <CommentBubble
        comment={comment}
        isEditing={isEditing}
        editText={editText}
        setEditText={setEditText}
        onStartEdit={onStartEdit}
        onSaveEdit={onSaveEdit}
        onCancelEdit={onCancelEdit}
        onDelete={onDelete}
        onReply={() => onStartReply(comment.id)}
      />

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-4 mt-2 space-y-2 border-l-2 border-gray-100 pl-3">
          {replies.map(reply => (
            <CommentBubble
              key={reply.id}
              comment={reply}
              isEditing={editingId === reply.id}
              editText={editText}
              setEditText={setEditText}
              onStartEdit={onStartEdit}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              onDelete={onDelete}
              isReply
            />
          ))}
        </div>
      )}

      {/* Reply form */}
      {replyTo === comment.id && (
        <div className="ml-4 mt-2 border-l-2 border-primary-100 pl-3">
          <div className="flex items-start gap-2">
            <CornerDownRight className="w-3.5 h-3.5 text-primary-400 mt-2 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <textarea
                autoFocus
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmitReply(comment.id); }}
                placeholder={`Reply to ${comment.authorName ?? 'this comment'}…`}
                rows={2}
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={onCancelReply}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
                <button
                  onClick={() => onSubmitReply(comment.id)}
                  disabled={!replyText.trim()}
                  className="flex items-center gap-1 text-xs text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 px-3 py-1 rounded-lg transition-colors"
                >
                  <Send className="w-3 h-3" /> Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentBubble({
  comment, isEditing, editText, setEditText,
  onStartEdit, onSaveEdit, onCancelEdit, onDelete, onReply, isReply = false,
}: {
  comment: Comment;
  isEditing: boolean;
  editText: string;
  setEditText: (v: string) => void;
  onStartEdit: (c: Comment) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onReply?: () => void;
  isReply?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const edited = comment.updatedAt !== comment.createdAt;

  return (
    <div
      className={cn('group relative rounded-xl px-3 py-2.5 bg-gray-50 border border-gray-100', isReply && 'bg-white')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-gray-700">
          {comment.authorName ?? 'You'}
        </span>
        <span className="text-xs text-gray-400">{timeAgo(comment.createdAt)}</span>
        {edited && <span className="text-xs text-gray-300 italic">edited</span>}

        {/* Action buttons (hover) */}
        <div className={cn('ml-auto flex items-center gap-1 transition-opacity', hovered ? 'opacity-100' : 'opacity-0')}>
          {!isReply && onReply && (
            <button
              onClick={onReply}
              className="p-1 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
              title="Reply"
            >
              <CornerDownRight className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => onStartEdit(comment)}
            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Edit"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => { if (confirm('Delete this comment?')) onDelete(comment.id); }}
            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Body */}
      {isEditing ? (
        <div className="space-y-1.5">
          <textarea
            autoFocus
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSaveEdit(); if (e.key === 'Escape') onCancelEdit(); }}
            rows={3}
            className="w-full text-sm border border-primary-300 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={onCancelEdit} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100">
              <X className="w-3 h-3" /> Cancel
            </button>
            <button onClick={onSaveEdit} disabled={!editText.trim()} className="flex items-center gap-1 text-xs text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 px-3 py-1 rounded-lg transition-colors">
              <Check className="w-3 h-3" /> Save
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{comment.text}</p>
      )}
    </div>
  );
}
