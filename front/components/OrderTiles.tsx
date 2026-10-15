'use client';

import { getStatusBadgeStyle, OrderStatus } from './statusConfig';

interface Order {
  id: number;
  order_number: string;
  product: string;
  status: OrderStatus;
  created_at: string;
}

interface OrderTilesProps {
  orders: Order[];
  loading: boolean;
  allowedStatuses: OrderStatus[];
  showAction?: boolean;
  onAdvanceStatus: (orderId: number, targetStatus: OrderStatus) => void;
}

const getNextStep = (status: OrderStatus) => {
  switch (status) {
    case 'confirmed':
      return { nextStatus: 'cooking' as OrderStatus, label: 'Start Cooking' };
    case 'cooking':
      return { nextStatus: 'ready' as OrderStatus, label: 'Mark Ready' };
    case 'ready':
      return { nextStatus: 'delivered' as OrderStatus, label: 'Mark Delivered' };
    default:
      return null;
  }
};

export default function OrderTiles({ orders, loading, allowedStatuses, showAction = false, onAdvanceStatus }: OrderTilesProps) {
  const filteredOrders = orders.filter((o) => allowedStatuses.includes(o.status));

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="p-12 text-center text-sm text-stone-500">Loading orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center text-sm text-stone-500 bg-white rounded-xl border border-stone-200">
          No orders currently in [{allowedStatuses.join(', ')}] state.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const nextStep = getNextStep(order.status);
            return (
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

                {showAction && nextStep && (
                  <button
                    onClick={() => onAdvanceStatus(order.id, nextStep.nextStatus)}
                    className="mt-4 w-full py-2 bg-[#708238] hover:bg-[#5c6e2e] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    {nextStep.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}