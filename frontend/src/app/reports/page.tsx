'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { reportsApi } from '@/lib/api';
import { ProfitAndLossData, AccountLine } from '@/lib/types';
import { fmt } from '@/lib/utils';

function LineItem({ label, amount, indent = false, dim = false }: {
  label: string; amount: number; indent?: boolean; dim?: boolean;
}) {
  return (
    <div className={`flex justify-between py-1.5 text-sm ${indent ? 'pl-8' : ''} ${dim ? 'text-gray-500' : ''}`}>
      <span>{label}</span>
      <span>{fmt(amount)}</span>
    </div>
  );
}

function SubtotalRow({ label, amount, pct, color = 'gray' }: {
  label: string; amount: number; pct?: number; color?: string;
}) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-50',
    green: 'bg-green-50',
    blue: 'bg-blue-50',
    red: amount < 0 ? 'bg-red-50' : 'bg-green-50',
  };
  return (
    <div className={`flex justify-between py-2.5 px-2 font-semibold border-t border-b ${colors[color] || colors.gray}`}>
      <span>{label}</span>
      <div className="text-right">
        <div>{fmt(amount)}</div>
        {pct !== undefined && (
          <div className="text-xs font-normal text-gray-500">{pct.toFixed(1)}% margin</div>
        )}
      </div>
    </div>
  );
}

function AccountBreakdown({ accounts }: { accounts: AccountLine[] }) {
  if (!accounts || accounts.length === 0) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {accounts.map(a => (
        <LineItem key={a.account_code} label={a.account_name} amount={a.balance} indent dim />
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ProfitAndLossData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBreakdown, setShowBreakdown] = useState(true);

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(lastDay.toISOString().split('T')[0]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadReport();
  }, [user, startDate, endDate]);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const response = await reportsApi.getProfitAndLoss(startDate, endDate);
      setData(response as ProfitAndLossData);
    } catch (error) {
      console.error('Failed to load report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !user) return null;

  const s = data?.summary;
  const d = data?.d2c_metrics;
  const b = data?.breakdown;

  return (
    <Layout>
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Profit & Loss Statement</h1>
          <button
            onClick={() => setShowBreakdown(v => !v)}
            className="text-sm text-primary-600 underline"
          >
            {showBreakdown ? 'Hide' : 'Show'} line-item breakdown
          </button>
        </div>

        {/* Date Range */}
        <div className="card mb-8">
          <div className="flex items-center space-x-4">
            <div>
              <label className="label">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input" />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-600">Loading report...</div>
        ) : data && s ? (
          <div className="card space-y-5">

            {/* ── REVENUE ── */}
            <section>
              <LineItem label="Gross Revenue" amount={s.gross_revenue} />
              <LineItem label="Less: Returns & Refunds" amount={-s.returns} indent dim />
              <LineItem label="Less: Discounts" amount={-s.discounts} indent dim />
              <SubtotalRow label="Net Revenue" amount={s.net_revenue} color="gray" />
            </section>

            {/* ── COGS ── */}
            <section>
              <div className="flex justify-between py-1.5 text-sm font-medium text-gray-700">
                <span>Cost of Goods Sold</span>
                <span className="text-red-600">({fmt(s.cogs)})</span>
              </div>
              {showBreakdown && b && <AccountBreakdown accounts={b.cogs} />}
              <SubtotalRow label="Gross Profit" amount={s.gross_profit} pct={s.gross_margin} color="green" />
            </section>

            {/* ── FULFILLMENT (Variable) ── */}
            <section>
              <div className="flex justify-between py-1.5 text-sm font-medium text-gray-700">
                <span>Fulfillment & Variable Costs</span>
                <span className="text-red-600">({fmt(s.variable_expenses)})</span>
              </div>
              {showBreakdown && b && (
                <>
                  <AccountBreakdown accounts={b.fulfillment} />
                  <LineItem label="Payment Gateway Charges" amount={s.variable_expenses - (b.fulfillment?.reduce((acc, a) => acc + a.balance, 0) ?? 0)} indent dim />
                </>
              )}
              <SubtotalRow label="Contribution Margin" amount={s.contribution_margin} pct={s.contribution_margin_pct} color="blue" />
            </section>

            {/* ── MARKETING ── */}
            <section>
              <div className="flex justify-between py-1.5 text-sm font-medium text-gray-700">
                <span>Marketing Spend</span>
                <span className="text-red-600">({fmt(s.marketing_expenses)})</span>
              </div>
              {showBreakdown && b && <AccountBreakdown accounts={b.marketing} />}
            </section>

            {/* ── OPERATIONS (Fixed) ── */}
            <section>
              <div className="flex justify-between py-1.5 text-sm font-medium text-gray-700">
                <span>Operations & Overheads</span>
                <span className="text-red-600">({fmt(s.fixed_expenses)})</span>
              </div>
              {showBreakdown && b && <AccountBreakdown accounts={b.operations} />}
            </section>

            {/* ── OPERATING PROFIT ── */}
            <div className={`flex justify-between py-3 px-2 font-bold text-lg border-t-2 border-gray-900 ${s.operating_profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              <span>Operating Profit</span>
              <div className="text-right">
                <div>{fmt(s.operating_profit)}</div>
                <div className="text-sm font-normal text-gray-500">{s.operating_margin.toFixed(1)}% margin</div>
              </div>
            </div>

            {/* ── D2C METRICS ── */}
            <section className="border-t-2 pt-6">
              <h3 className="font-bold text-base text-gray-700 mb-4 uppercase tracking-wide">D2C Performance Metrics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'MER',                  value: `${d?.mer}x` },
                  { label: 'Orders',               value: `${d?.orders}` },
                  { label: 'AOV',                  value: fmt(d?.aov ?? 0) },
                  { label: 'Blended CAC',          value: fmt(d?.blended_cac ?? 0) },
                  { label: 'Gross Margin / Order', value: fmt(d?.gross_margin_per_order ?? 0) },
                  { label: 'CM / Order',           value: fmt(d?.contribution_margin_per_order ?? 0) },
                ].map(m => (
                  <div key={m.label} className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                    <p className="text-xl font-bold">{m.value}</p>
                  </div>
                ))}
              </div>
            </section>

          </div>
        ) : (
          <div className="text-center py-12 text-red-600">Failed to load report</div>
        )}
      </div>
    </Layout>
  );
}
