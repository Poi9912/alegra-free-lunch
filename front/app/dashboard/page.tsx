'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import OrdersTable from '@components/OrdersTable';
import InventoryChart from '@components/InventoryChart';
import OrderTiles from '@components/OrderTiles';
import BatchOrderModal from '@components/BatchOrderModal';
import { useWebSocket } from '@/hooks/useWebSocket';
import { OrderStatus } from '@components/statusConfig';

interface Order {
  id: number;
  order_number: string;
  product: string;
  status: OrderStatus;
  created_at: string;
}

interface Recipe {
  id: number;
  product: string;
  ingredients: Array<{ ingredient_name: string; quantity: number }>;
}

export default function DashboardPage() {
  const [role, setRole] = useState<string>('operation');
  const [activeTab, setActiveTab] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const router = useRouter();

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoadingOrders(true);
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      setOrders(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoadingOrders(false);
    }
  };

  useEffect(() => {
    const userRole = localStorage.getItem('role') || 'operation';
    setRole(userRole);
    fetchOrders(false);

    // Resilient background polling every 3 seconds to guarantee real-time sync across tabs
    const pollInterval = setInterval(() => {
      fetchOrders(true);
    }, 3000);

    if (userRole !== 'manager') {
      fetch('/api/recipes', { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => setRecipes(Array.isArray(data.data) ? data.data : []))
        .catch(() => {});
    }

    return () => clearInterval(pollInterval);
  }, []);

  // WebSocket instant sync listener
  const handleWebSocketMessage = useCallback((type: string) => {
    if (type === 'ORDER_UPDATED' || type === 'ORDERS_CREATED') {
      fetchOrders(true);
    }
  }, []);

  useWebSocket(handleWebSocketMessage);

  const handleAdvanceStatus = async (orderId: number, targetStatus: OrderStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (res.ok) {
        fetchOrders(true);
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-[#708238]" />
          <h1 className="text-lg font-bold tracking-tight text-stone-900">Restaurant Operations Dashboard</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-xs font-medium uppercase px-3 py-1 bg-stone-100 rounded-md text-stone-600">
            Role: {role}
          </span>

          {role === 'operation' && (
            <button
              onClick={() => router.push('/dashboard/kiosk')}
              className="text-xs font-semibold text-[#708238] hover:text-[#5c6e2e] px-3 py-1.5 rounded-lg border border-[#708238]/30 hover:bg-[#708238]/5 transition-colors cursor-pointer"
            >
              Open Kiosk View
            </button>
          )}

          {role === 'manager' && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#708238] hover:bg-[#5c6e2e] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              New Batch Orders
            </button>
          )}

          <button
            onClick={handleLogout}
            className="text-xs font-medium text-stone-600 hover:text-stone-900 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {role === 'manager' ? (
          <div className="space-y-8">
            <OrdersTable />
            <InventoryChart />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Operation Tabs Navigation */}
            <div className="flex border-b border-stone-200 space-x-6">
              <button
                onClick={() => setActiveTab(1)}
                className={`pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
                  activeTab === 1 ? 'border-[#708238] text-[#708238]' : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                Tab 1: Cooking Staff (Confirmed & Cooking)
              </button>
              <button
                onClick={() => setActiveTab(2)}
                className={`pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
                  activeTab === 2 ? 'border-[#708238] text-[#708238]' : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                Tab 2: Kitchen Inventory & Recipes
              </button>
              <button
                onClick={() => setActiveTab(3)}
                className={`pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
                  activeTab === 3 ? 'border-[#708238] text-[#708238]' : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                Tab 3: Delivery Windows (Ready)
              </button>
            </div>

            {/* Tab 1 Content */}
            <div className={activeTab === 1 ? 'space-y-4' : 'hidden'}>
              <h3 className="text-lg font-bold text-stone-900">Active Kitchen Orders</h3>
              <OrderTiles
                orders={orders}
                loading={loadingOrders}
                allowedStatuses={['confirmed', 'cooking']}
                showAction={true}
                onAdvanceStatus={handleAdvanceStatus}
              />
            </div>

            {/* Tab 2 Content */}
            <div className={activeTab === 2 ? 'space-y-8' : 'hidden'}>
              <InventoryChart />
              <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                <h3 className="text-lg font-bold text-stone-900 mb-4">Today's Available Recipes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recipes.map((r) => (
                    <div key={r.id} className="border border-stone-200 rounded-lg p-4">
                      <h4 className="font-bold text-stone-800 text-sm mb-2">{r.product}</h4>
                      <ul className="text-xs text-stone-500 space-y-1">
                        {r.ingredients.map((ing, idx) => (
                          <li key={idx}>{ing.ingredient_name}: {ing.quantity} units</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tab 3 Content */}
            <div className={activeTab === 3 ? 'space-y-4' : 'hidden'}>
              <h3 className="text-lg font-bold text-stone-900">Ready for Delivery</h3>
              <OrderTiles
                orders={orders}
                loading={loadingOrders}
                allowedStatuses={['ready']}
                showAction={true}
                onAdvanceStatus={handleAdvanceStatus}
              />
            </div>
          </div>
        )}
      </main>

      <BatchOrderModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={() => setIsModalOpen(false)} />
    </div>
  );
}