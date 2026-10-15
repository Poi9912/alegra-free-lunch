'use client';

import { useEffect, useState } from 'react';
import { getStatusBadgeStyle, OrderStatus } from '@components/statusConfig';

interface Order {
  id: number;
  order_number: string;
  product: string;
  status: OrderStatus;
}

export default function KioskPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.data) ? data.data : [];
        setOrders(list.filter((o: Order) => ['confirmed', 'cooking', 'ready'].includes(o.status)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, []);

  const confirmed = orders.filter((o) => o.status === 'confirmed');
  const cooking = orders.filter((o) => o.status === 'cooking');
  const ready = orders.filter((o) => o.status === 'ready');

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 p-8 flex flex-col">
      {/* Header without Exit Button */}
      <header className="flex items-center justify-between pb-6 mb-8 border-b border-stone-200">
        <div className="flex items-center space-x-3">
          <div className="w-4 h-4 rounded-full bg-[#708238]" />
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Restaurant Live Status Board</h1>
        </div>
      </header>

      {/* Light Mode Status Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 flex-1">
        {/* Confirmed Column */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col shadow-sm">
          <h2 className="text-lg font-bold text-blue-700 mb-4 uppercase tracking-wider">Confirmed</h2>
          <div className="space-y-3 flex-1 overflow-y-auto">
            {confirmed.map((o) => (
              <div key={o.id} className="bg-stone-50 border border-stone-200 p-4 rounded-xl">
                <p className="font-mono font-bold text-lg text-stone-900">{o.order_number}</p>
                <p className="text-sm text-stone-600">{o.product}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cooking Column */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col shadow-sm">
          <h2 className="text-lg font-bold text-amber-700 mb-4 uppercase tracking-wider">Cooking</h2>
          <div className="space-y-3 flex-1 overflow-y-auto">
            {cooking.map((o) => (
              <div key={o.id} className="bg-stone-50 border border-stone-200 p-4 rounded-xl">
                <p className="font-mono font-bold text-lg text-stone-900">{o.order_number}</p>
                <p className="text-sm text-stone-600">{o.product}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Ready Column */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col shadow-sm">
          <h2 className="text-lg font-bold text-emerald-700 mb-4 uppercase tracking-wider">Ready for Pickup</h2>
          <div className="space-y-3 flex-1 overflow-y-auto">
            {ready.map((o) => (
              <div key={o.id} className="bg-stone-50 border border-stone-200 p-4 rounded-xl">
                <p className="font-mono font-bold text-lg text-stone-900">{o.order_number}</p>
                <p className="text-sm text-stone-600">{o.product}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}