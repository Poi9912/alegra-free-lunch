export type OrderStatus = 'created' | 'confirmed' | 'cooking' | 'ready' | 'delivered';

export const getStatusBadgeStyle = (status: OrderStatus) => {
  const styles: Record<OrderStatus, string> = {
    created: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
    cooking: 'bg-orange-50 text-orange-700 border-orange-200',
    ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    delivered: 'bg-stone-100 text-stone-500 border-stone-200',
  };

  return styles[status] || 'bg-stone-100 text-stone-700 border-stone-200';
};