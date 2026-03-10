'use client';

import { useState } from 'react';
import { timeAgo } from '@/lib/time';
import type { GeneratedContent, ScrapedPost, WatchlistPage } from '@/types/database';

export interface FacebookQueueItem extends GeneratedContent {
  scraped_post: ScrapedPost & {
    watchlist_page: Pick<WatchlistPage, 'page_name' | 'page_url'>;
  };
}

interface FacebookCardProps {
  item: FacebookQueueItem;
  onAction: (id: string, action: string, payload?: Record<string, string>) => Promise<void>;
}

export default function FacebookCard({ item, onAction }: FacebookCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.generated_text);
  const [acting, setActing] = useState(false);

  const source = item.scraped_post?.watchlist_page;

  async function handleAction(action: string, payload?: Record<string, string>) {
    setActing(true);
    await onAction(item.id, action, payload);
  }

  async function handleSaveEdit() {
    await handleAction('edit', { edited_text: editText });
  }

  return (
    <div className="mx-4 mb-4 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <span className="font-medium text-neutral-400">
          {source?.page_name || 'Unknown source'}
        </span>
        <span className="text-neutral-500">{timeAgo(item.created_at)}</span>
      </div>

      {/* Original text (collapsible) */}
      {item.scraped_post?.original_text && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full border-t border-neutral-800 px-4 py-3 text-left"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-600">
            Original {expanded ? '▲' : '▼'}
          </p>
          <p className={`mt-1 text-sm text-neutral-500 ${expanded ? '' : 'line-clamp-3'}`}>
            {item.scraped_post.original_text}
          </p>
        </button>
      )}

      {/* Generated text */}
      <div className="border-t border-neutral-800 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-600">Generated</p>
        {editing ? (
          <div className="mt-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
              rows={6}
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="min-h-[48px] flex-1 rounded-lg bg-neutral-800 text-sm font-medium text-neutral-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={acting}
                className="min-h-[48px] flex-1 rounded-lg bg-blue-600 text-sm font-medium text-white disabled:opacity-50"
              >
                Save & Approve
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-sm text-white">{item.generated_text}</p>
        )}
      </div>

      {/* Image thumbnail */}
      {item.generated_image_url && (
        <div className="border-t border-neutral-800 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.generated_image_url}
            alt="Generated"
            className="max-h-48 rounded-lg object-cover"
          />
        </div>
      )}

      {/* Pills */}
      <div className="flex gap-2 border-t border-neutral-800 px-4 py-3">
        {item.voice_style && (
          <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-400">
            {item.voice_style}
          </span>
        )}
        <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-400">
          {item.language_mix}
        </span>
      </div>

      {/* Action buttons */}
      {!editing && (
        <div className="flex gap-2 border-t border-neutral-800 px-4 py-3">
          <button
            onClick={() => handleAction('reject')}
            disabled={acting}
            className="min-h-[48px] flex-1 rounded-lg bg-red-900/50 text-sm font-medium text-red-400 transition-colors hover:bg-red-900 active:bg-red-800 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={() => handleAction('regenerate')}
            disabled={acting}
            className="min-h-[48px] flex-1 rounded-lg bg-amber-900/50 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-900 active:bg-amber-800 disabled:opacity-50"
          >
            Regen
          </button>
          <button
            onClick={() => setEditing(true)}
            disabled={acting}
            className="min-h-[48px] flex-1 rounded-lg bg-blue-900/50 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-900 active:bg-blue-800 disabled:opacity-50"
          >
            Edit
          </button>
          <button
            onClick={() => handleAction('approve')}
            disabled={acting}
            className="min-h-[48px] flex-1 rounded-lg bg-green-900/50 text-sm font-medium text-green-400 transition-colors hover:bg-green-900 active:bg-green-800 disabled:opacity-50"
          >
            Approve
          </button>
        </div>
      )}
    </div>
  );
}
