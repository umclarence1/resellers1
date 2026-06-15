import { ORDER_STATUS_FILTERS, OrderStatusFilter, statusFilterButtonClass } from '@/lib/order-status';

export default function OrderStatusFilters({
  value,
  onChange,
}: {
  value: OrderStatusFilter;
  onChange: (filter: OrderStatusFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {ORDER_STATUS_FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onChange(f.id)}
          className={statusFilterButtonClass(value === f.id)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
