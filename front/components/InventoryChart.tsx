'use client';

import { useEffect, useState, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useWebSocket } from '@/hooks/useWebSocket';

interface InventoryItem {
  id: number;
  ingredient_name: string;
  quantity: number;
}

const getIngredientColor = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('tomato')) return '#e22d2d';
  if (lower.includes('lemon')) return '#a3db4f';
  if (lower.includes('potato')) return '#ca8a04';
  if (lower.includes('rice')) return '#c7cace';
  if (lower.includes('ketchup')) return '#7c1616';
  if (lower.includes('lettuce')) return '#2ba758';
  if (lower.includes('onion')) return '#ffed67';
  if (lower.includes('cheese')) return '#89d3fc';
  if (lower.includes('meat')) return '#b3451a';
  if (lower.includes('chicken')) return '#f7bd7b';
  return '#708238';
};

export default function InventoryChart() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInventory = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      const rawList = Array.isArray(data.data) ? data.data : [];
      const sortedList = rawList.sort((a: InventoryItem, b: InventoryItem) => Number(b.quantity) - Number(a.quantity));
      setInventory(sortedList);
    } catch (err) {
      console.error('Failed to fetch inventory', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory(false);
  }, []);

  const handleWebSocketMessage = useCallback((type: string) => {
    if (type === 'INVENTORY_UPDATED') {
      fetchInventory(true); // Silent update
    }
  }, []);

  useWebSocket(handleWebSocketMessage);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
      <h3 className="text-lg font-bold text-stone-900 mb-1">Inventory Levels</h3>
      <p className="text-xs text-stone-500 mb-6">Real-time stock distribution across ingredients (sorted by quantity)</p>

      {loading ? (
        <div className="py-12 text-center text-sm text-stone-500">Loading inventory data...</div>
      ) : inventory.length === 0 ? (
        <div className="py-12 text-center text-sm text-stone-500">No inventory data available.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 h-64 flex justify-center items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={inventory}
                  dataKey="quantity"
                  nameKey="ingredient_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={40}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {inventory.map((item, index) => (
                    <Cell key={`cell-${index}`} fill={getIngredientColor(item.ingredient_name)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e7e5e4', borderRadius: '0.5rem', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2">
            {inventory.map((item, i) => {
              const color = getIngredientColor(item.ingredient_name);
              return (
                <div key={item.id || i} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-100 text-xs">
                  <div className="flex items-center space-x-2 truncate mr-2">
                    <span className="w-3 h-3 rounded-full shrink-0 border border-stone-300" style={{ backgroundColor: color }} />
                    <span className="font-medium text-stone-800 truncate">{item.ingredient_name}</span>
                  </div>
                  <span className="font-mono text-stone-600 font-semibold shrink-0">{item.quantity} units</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}