import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  PanelTable,
  PanelTableHeader,
  PanelTableToolbar,
  PanelTableScroll,
  PanelTableEmpty,
  panelTableHeadClass,
  panelTableTh,
  panelTableRowClass,
  panelTableCellClass,
} from '@/components/ui/PanelTable';

export type WalletTransactionRow = {
  _id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  reference?: string;
  description: string;
  createdAt: string;
};

const typeLabels: Record<string, string> = {
  deposit: 'Deposit',
  purchase: 'Purchase',
  refund: 'Refund',
  withdrawal: 'Withdrawal',
  profit_credit: 'Profit',
  referral_credit: 'Referral',
  adjustment: 'Adjustment',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GH', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function WalletTransactionTable({
  transactions,
  loading,
  search,
  onSearchChange,
}: {
  transactions: WalletTransactionRow[];
  loading?: boolean;
  search?: string;
  onSearchChange?: (value: string) => void;
}) {
  const query = (search || '').trim().toLowerCase();
  const filtered = query
    ? transactions.filter(
        (t) =>
          t.description.toLowerCase().includes(query) ||
          (t.reference || '').toLowerCase().includes(query) ||
          t._id.toLowerCase().includes(query)
      )
    : transactions;

  return (
    <PanelTable>
      <PanelTableHeader
        title="Transaction history"
        subtitle="Deposits and deductions on your wallet"
      />
      {onSearchChange && (
        <PanelTableToolbar>
          <span className="text-sm text-gray-600">{filtered.length} transactions</span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search transactions..."
            className="w-full sm:w-56 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
        </PanelTableToolbar>
      )}

      {loading ? (
        <PanelTableEmpty message="Loading transactions..." />
      ) : filtered.length === 0 ? (
        <PanelTableEmpty
          message={query ? 'No transactions match your search.' : 'No wallet activity yet.'}
        />
      ) : (
        <PanelTableScroll minWidth={760}>
          <thead className={panelTableHeadClass}>
            <tr>
              <th className={panelTableTh()}>Reference</th>
              <th className={panelTableTh()}>Description</th>
              <th className={panelTableTh()}>Type</th>
              <th className={panelTableTh()}>Amount</th>
              <th className={panelTableTh()}>Balance</th>
              <th className={panelTableTh()}>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => {
              const isDebit = tx.amount < 0;
              const ref = tx.reference || tx._id.slice(-12);
              return (
                <tr key={tx._id} className={panelTableRowClass}>
                  <td className={cn(panelTableCellClass, 'font-mono text-xs text-gray-600')}>#{ref}</td>
                  <td
                    className={cn(panelTableCellClass, 'text-gray-700 max-w-[200px] truncate')}
                    title={tx.description}
                  >
                    {tx.description}
                  </td>
                  <td className={panelTableCellClass}>
                    <span
                      className={cn(
                        'inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold',
                        isDebit ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      )}
                    >
                      {isDebit ? 'Debit' : 'Credit'}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">{typeLabels[tx.type] || tx.type}</p>
                  </td>
                  <td
                    className={cn(
                      panelTableCellClass,
                      'font-semibold tabular-nums',
                      isDebit ? 'text-red-600' : 'text-emerald-600'
                    )}
                  >
                    {isDebit ? '' : '+'}
                    {formatCurrency(Math.abs(tx.amount))}
                  </td>
                  <td className={cn(panelTableCellClass, 'text-gray-800 tabular-nums font-medium')}>
                    {formatCurrency(tx.balanceAfter)}
                  </td>
                  <td className={cn(panelTableCellClass, 'text-gray-600 whitespace-nowrap')}>
                    {formatDateTime(tx.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </PanelTableScroll>
      )}
    </PanelTable>
  );
}
