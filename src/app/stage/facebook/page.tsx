'use client';

import { useState, useEffect, useCallback } from 'react';
import QueueHeader from '@/components/stage/QueueHeader';
import TwoFABanner from '@/components/stage/TwoFABanner';
import FacebookCard, { type FacebookQueueItem } from '@/components/stage/FacebookCard';

export default function FacebookQueuePage() {
  const [items, setItems] = useState<FacebookQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stage/facebook');
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleAction(id: string, action: string, payload?: Record<string, string>) {
    // Optimistic: remove card immediately
    setItems((prev) => prev.filter((item) => item.id !== id));

    try {
      const res = await fetch(`/api/stage/facebook/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });

      if (!res.ok) {
        // Re-fetch on error to restore card
        await fetchItems();
      }
    } catch {
      await fetchItems();
    }
  }

  return (
    <>
      <QueueHeader
        title="Facebook Queue"
        count={items.length}
        onRefresh={fetchItems}
        loading={loading}
      />
      <TwoFABanner />
      {!loading && items.length === 0 && (
        <p className="px-4 py-12 text-center text-sm text-neutral-600">
          No content pending review
        </p>
      )}
      {items.map((item) => (
        <FacebookCard key={item.id} item={item} onAction={handleAction} />
      ))}
    </>
  );
}
