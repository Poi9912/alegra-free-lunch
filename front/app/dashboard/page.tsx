'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Order {
  id: number;
  order_number: string;
  product: string; // Recipe name from backend join
  status: 'created' | 'confirmed' | 'cooking' | 'ready' | 'delivered';
  created_at: string;
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    // Note: Middleware already protects this route, but keeping client fallback for safety
    const role = localStorage.getItem('role') || 'Operator';
    setUsername(role);

    fetchOrders();
  }, [router]);

  useEffect(() => {
    if (filterStatus === 'all') {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter((order) => order.status === filterStatus));
    }
  }, [filterStatus, orders]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders');

      if (res.status === 401) {
        localStorage.clear();
        router.push('/login');
        return;
      }

      if (!res.ok) throw new Error('Failed to fetch orders');

      const data = await res.json();
      const orderList = Array.isArray(data.data) ? data.data : [];
      setOrders(orderList);
      setFilteredOrders(orderList);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  const getStatusBadge = (status: Order['status']) => {
    const styles: Record<Order['status'], string> = {
      created: 'bg-stone-100 text-stone-700 border-stone-200',
      confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
      cooking: 'bg-amber-50 text-amber-700 border-amber-200',
      ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      delivered: 'bg-stone-100 text-stone-500 border-stone-200',
    };

    return (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border uppercase tracking-wider ${styles[status]}`}>
        {status}
      </span>
    );
  };

  const statuses = ['all', 'created', 'confirmed', 'cooking', 'ready', 'delivered'];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-[#708238]" />
          <h1 className="text-lg font-bold tracking-tight text-stone-900">Restaurant Operations</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-xs font-medium uppercase px-3 py-1 bg-stone-100 rounded-md text-stone-600">
            Role: {username}
          </span>
          <button
            onClick={handleLogout}
            className="text-xs font-medium text-stone-600 hover:text-stone-900 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-stone-900">Active Orders</h2>
            <p className="text-sm text-stone-500">Real-time tracking of kitchen pipeline and deliveries</p>
          </div>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 bg-[#708238] hover:bg-[#5c6e2e] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer self-start sm:self-auto"
          >
            Refresh Orders
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-4 mb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 mr-2">Filter:</span>
          {statuses.map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer whitespace-nowrap ${
                filterStatus === st
                  ? 'bg-[#708238] text-white shadow-sm'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-stone-500">Loading order queue...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-sm text-stone-500">No orders found for this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-stone-500 text-xs font-semibold uppercase tracking-wider">
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
                      <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                      <td className="px-6 py-4 text-stone-500 text-xs">
                        {new Date(order.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}