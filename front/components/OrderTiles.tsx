'use client';

import { useEffect, useState, useCallback } from 'react';
import { getStatusBadgeStyle, OrderStatus } from './statusConfig';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Order {
  id: number;
  order_number: string;
  product: string;
  status: OrderStatus;
  created_at: string;
}

interface OrderTilesProps {
  allowedStatuses: OrderStatus[];
  showAction?: boolean;
  nextStatus?: OrderStatus;
  actionLabel?: string;
}

export default function OrderTiles({ allowedStatuses, showAction = false, nextStatus, actionLabel }: OrderTilesProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/orders');
      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      const list = Array.isArray(data.data) ? data.data : [];
      setOrders(list.filter((o: Order) => allowedStatuses.includes(o.status)));
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(false);
  }, []);

  const handleWebSocketMessage = useCallback((type: string) => {
    if (type === 'ORDER_UPDATED' || type === 'ORDERS_CREATED') {
      fetchOrders(true); // Silent update
    }
  }, []);

  useWebSocket(handleWebSocketMessage);

  const handleAdvanceStatus = async (orderId: number) => {
    if (!nextStatus) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        fetchOrders(true);
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="p-12 text-center text-sm text-stone-500">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="p-12 text-center text-sm text-stone-500 bg-white rounded-xl border border-stone-200">
          No orders currently in [{allowedStatuses.join(', ')}] state.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl shadow-sm border border-stone-200 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono font-bold text-stone-900 text-sm">{order.order_number}</span>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border uppercase tracking-wider ${getStatusBadgeStyle(order.status)}`}>
                    {order.status}
                  </span>
                </div>
                <h4 className="text-base font-bold text-stone-800 mb-1">{order.product}</h4>
                <p className="text-xs text-stone-400">Created: {new Date(order.created_at).toLocaleTimeString()}</p>
              </div>

              {showAction && nextStatus && actionLabel && (
                <button
                  onClick={() => handleAdvanceStatus(order.id)}
                  className="mt-4 w-full py-2 bg-[#708238] hover:bg-[#5c6e2e] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}