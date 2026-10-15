'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OrdersTable from '@components/OrdersTable';
import InventoryChart from '@components/InventoryChart';
import OrderTiles from '@components/OrderTiles';
import BatchOrderModal from '@components/BatchOrderModal';

interface Recipe {
  id: number;
  product: string;
  ingredients: Array<{ ingredient_name: string; quantity: number }>;
}

export default function DashboardPage() {
  const [role, setRole] = useState<string>('operation');
  const [activeTab, setActiveTab] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const router = useRouter();

  useEffect(() => {
    const userRole = localStorage.getItem('role') || 'operation';
    setRole(userRole);

    if (userRole === 'manager') {
      // Manager default view setup
    } else {
      // Fetch recipes for Operation Tab 2
      fetch('/api/recipes')
        .then((res) => res.json())
        .then((data) => setRecipes(Array.isArray(data.data) ? data.data : []))
        .catch(() => {});
    }
  }, []);

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
            {activeTab === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-stone-900">Active Kitchen Orders</h3>
                <OrderTiles allowedStatuses={['confirmed', 'cooking']} showAction={true} nextStatus="cooking" actionLabel="Start Cooking / Advance" />
              </div>
            )}

            {/* Tab 2 Content */}
            {activeTab === 2 && (
              <div className="space-y-8">
                <InventoryChart />
                <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                  <h3 className="text-lg font-bold text-stone-900 mb-4">Today's Available Recipes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recipes.map((r) => (
                      <div key={r.id} className="border border-stone-200 rounded-lg p-4">
                        <h4 className="font-bold text-stone-800 text-sm mb-2">{r.product}</h4>
                        <ul className="text-xs text-stone-500 space-y-1">
                          {r.ingredients.map((ing, idx) => (
                            <li key={idx}>• {ing.ingredient_name}: {ing.quantity} units</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3 Content */}
            {activeTab === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-stone-900">Ready for Delivery</h3>
                <OrderTiles allowedStatuses={['ready']} showAction={true} nextStatus="delivered" actionLabel="Mark Delivered" />
              </div>
            )}
          </div>
        )}
      </main>

      <BatchOrderModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={() => window.location.reload()} />
    </div>
  );
}