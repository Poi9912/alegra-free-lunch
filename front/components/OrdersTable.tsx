'use client';

import { useEffect, useState } from 'react';
import { getStatusBadgeStyle, OrderStatus } from './statusConfig';

interface Order {
  id: number;
  order_number: string;
  product: string;
  status: OrderStatus;
  created_at: string;
}

export default function OrdersTable() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders');
      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      const list = Array.isArray(data.data) ? data.data : [];
      setOrders(list);
      setFilteredOrders(list);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (filterStatus === 'all') {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter((o) => o.status === filterStatus));
    }
  }, [filterStatus, orders]);

  const statuses = ['all', 'created', 'confirmed', 'cooking', 'ready', 'delivered'];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-stone-900">Active Orders Queue</h3>
          <p className="text-xs text-stone-500">Manage and monitor live operational orders</p>
        </div>
        <button
          onClick={fetchOrders}
          className="px-3.5 py-2 bg-[#708238] hover:bg-[#5c6e2e] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer self-start sm:self-auto"
        >
          Refresh Table
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 mr-2">Filter:</span>
        {statuses.map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer whitespace-nowrap ${
              filterStatus === st
                ? 'bg-[#708238] text-white shadow-sm'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>}

      {/* Dynamic size container restricted to max 60% height with vertical scrolling */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden max-h-[50vh] flex flex-col">
        {loading ? (
          <div className="p-12 text-center text-sm text-stone-500">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-sm text-stone-500">No orders found.</div>
        ) : (
          <div className="overflow-y-auto overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-stone-50 z-10">
                <tr className="border-b border-stone-200 text-stone-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3.5">Order Number</th>
                  <th className="px-6 py-3.5">Recipe Name</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-sm">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-stone-900">{order.order_number}</td>
                    <td className="px-6 py-4 font-medium text-stone-800">{order.product}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border uppercase tracking-wider ${getStatusBadgeStyle(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-stone-500 text-xs">{new Date(order.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}