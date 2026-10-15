'use client';

import { useState } from 'react';

interface BatchOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BatchOrderModal({ isOpen, onClose, onSuccess }: BatchOrderModalProps) {
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to queue orders');

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-lg border border-stone-200 max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-900">Create Batch Orders</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 font-bold text-sm cursor-pointer">✕</button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-2">
              Number of Orders to Queue
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#708238] text-stone-800 text-sm bg-white"
              required
            />
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-lg text-sm transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 bg-[#708238] hover:bg-[#5c6e2e] text-white font-medium rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Queuing...' : 'Queue Orders'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}