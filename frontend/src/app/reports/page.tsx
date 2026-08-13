'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { reportsApi } from '@/lib/api';
import { ProfitAndLossData, AccountLine, SpendByCategoryData, MonthlyTrendData } from '@/lib/types';
import { fmt } from '@/lib/utils';

type Tab = 'pl' | 'spend' | 'trend';

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

const EXPENSE_TYPE_LABEL: Record<string, string> = {
  PURCHASE: 'COGS / Purchase',
  OPEX: 'Operating Expense',
};

const EXPENSE_TYPE_COLOR: Record<string, string> = {
  PURCHASE: 'bg-blue-100 text-blue-700',
  OPEX: 'bg-purple-100 text-purple-700',
};

export default function ReportsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('pl');

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(lastDay.toISOString().split('T')[0]);

  // P&L state
  const [plData, setPlData] = useState<ProfitAndLossData | null>(null);
  const [plLoading, setPlLoading] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(true);

  // Spend state
  const [spendData, setSpendData] = useState<SpendByCategoryData | null>(null);
  const [spendLoading, setSpendLoading] = useState(false);

  // Trend state
  const [trendData, setTrendData] = useState<MonthlyTrendData | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendMonths, setTrendMonths] = useState(6);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadPL();
      loadSpend();
    }
  }, [user, startDate, endDate]);

  useEffect(() => {
    if (user && tab === 'trend') loadTrend();
  }, [user, tab, trendMonths]);

  const loadPL = async () => {
    setPlLoading(true);
    try {
      const response = await reportsApi.getProfitAndLoss(startDate, endDate);
      setPlData(response as ProfitAndLossData);
    } catch (error) {
      console.error('Failed to load P&L:', error);
    } finally {
      setPlLoading(false);
    }
  };

  const loadSpend = async () => {
    setSpendLoading(true);
    try {
      const response = await reportsApi.getSpendByCategory(startDate, endDate);
      setSpendData(response as SpendByCategoryData);
    } catch (error) {
      console.error('Failed to load spend:', error);
    } finally {
      setSpendLoading(false);
    }
  };

  const loadTrend = async () => {
    setTrendLoading(true);
    try {
      const response = await reportsApi.getMonthlyTrend(trendMonths);
      setTrendData(response as MonthlyTrendData);
    } catch (error) {
      console.error('Failed to load trend:', error);
    } finally {
      setTrendLoading(false);
    }
  };

  if (authLoading || !user) return null;

  const s = plData?.summary;
  const d = plData?.d2c_metrics;
  const b = plData?.breakdown;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'pl',    label: 'P&L Statement' },
    { key: 'spend', label: 'Spend by Category' },
    { key: 'trend', label: 'Monthly Trend' },
  ];

  return (
    <Layout>
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        </div>

        {/* Tab bar */}
        <div className="flex space-x-1 mb-6 border-b border-gray-200">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-primary-600 text-primary-700 bg-primary-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Shared date range (P&L + Spend tabs) */}
        {tab !== 'trend' && (
          <div className="card mb-6">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="label">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input" />
              </div>
              {tab === 'pl' && (
                <button
                  onClick={() => setShowBreakdown(v => !v)}
                  className="text-sm text-primary-600 underline pb-1"
                >
                  {showBreakdown ? 'Hide' : 'Show'} line-item breakdown
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── P&L TAB ── */}
        {tab === 'pl' && (
          plLoading ? (
            <div className="text-center py-12 text-gray-600">Loading report...</div>
          ) : plData && s ? (
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

              {/* ── FULFILLMENT ── */}
              <section>
                <div className="flex justify-between py-1.5 text-sm font-medium text-gray-700">
                  <span>Fulfillment & Variable Costs</span>
                  <span className="text-red-600">({fmt(s.variable_expenses)})</span>
                </div>
                {showBreakdown && b && <AccountBreakdown accounts={b.fulfillment} />}
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

              {/* ── OPERATIONS ── */}
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
              {d && (
                <section className="border-t-2 pt-6">
                  <h3 className="font-bold text-base text-gray-700 mb-4 uppercase tracking-wide">D2C Performance Metrics</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { label: 'MER',                  value: `${d.mer}x` },
                      { label: 'Orders',               value: `${d.orders}` },
                      { label: 'AOV',                  value: fmt(d.aov) },
                      { label: 'Blended CAC',          value: fmt(d.blended_cac) },
                      { label: 'Gross Margin / Order', value: fmt(d.gross_margin_per_order) },
                      { label: 'CM / Order',           value: fmt(d.contribution_margin_per_order) },
                    ].map(m => (
                      <div key={m.label} className="text-center p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                        <p className="text-xl font-bold">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-red-600">Failed to load report</div>
          )
        )}

        {/* ── SPEND TAB ── */}
        {tab === 'spend' && (
          spendLoading ? (
            <div className="text-center py-12 text-gray-600">Loading spend data...</div>
          ) : spendData ? (
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">Total Spend</h2>
                  <span className="text-2xl font-bold text-gray-900">{fmt(spendData.total_spend)}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500 text-xs uppercase tracking-wide">
                      <th className="pb-2 pr-4">Category</th>
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4 text-right">Bills</th>
                      <th className="pb-2 pr-4 text-right">Amount</th>
                      <th className="pb-2 text-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spendData.categories.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="py-2.5 pr-4 font-medium capitalize">{row.category}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${EXPENSE_TYPE_COLOR[row.expense_type] || 'bg-gray-100 text-gray-600'}`}>
                            {EXPENSE_TYPE_LABEL[row.expense_type] || row.expense_type}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-right text-gray-600">{row.bill_count}</td>
                        <td className="py-2.5 pr-4 text-right font-semibold">{fmt(row.total_amount)}</td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 bg-gray-100 rounded h-1.5">
                              <div
                                className="bg-primary-500 h-1.5 rounded"
                                style={{ width: `${Math.min(row.pct_of_total, 100)}%` }}
                              />
                            </div>
                            <span className="text-gray-600 w-10 text-right">{row.pct_of_total.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {spendData.categories.length === 0 && (
                  <p className="text-center py-8 text-gray-400">No bills found for this period</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-red-600">Failed to load spend data</div>
          )
        )}

        {/* ── TREND TAB ── */}
        {tab === 'trend' && (
          <div>
            <div className="card mb-6">
              <div className="flex items-center gap-4">
                <label className="label mb-0">Show last</label>
                {[3, 6, 12].map(n => (
                  <button
                    key={n}
                    onClick={() => setTrendMonths(n)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      trendMonths === n ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {n} months
                  </button>
                ))}
              </div>
            </div>

            {trendLoading ? (
              <div className="text-center py-12 text-gray-600">Loading trend data...</div>
            ) : trendData ? (
              <div className="card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500 text-xs uppercase tracking-wide">
                      <th className="pb-2 pr-4">Month</th>
                      <th className="pb-2 pr-4 text-right">Orders</th>
                      <th className="pb-2 pr-4 text-right">Revenue</th>
                      <th className="pb-2 pr-4 text-right">COGS</th>
                      <th className="pb-2 pr-4 text-right">Gross Profit</th>
                      <th className="pb-2 text-right">Total Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendData.months.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="py-2.5 pr-4 font-medium">{row.month}</td>
                        <td className="py-2.5 pr-4 text-right text-gray-600">{row.orders.toLocaleString()}</td>
                        <td className="py-2.5 pr-4 text-right font-semibold">{fmt(row.revenue)}</td>
                        <td className="py-2.5 pr-4 text-right text-red-600">({fmt(row.cogs)})</td>
                        <td className={`py-2.5 pr-4 text-right font-semibold ${row.gross_profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {fmt(row.gross_profit)}
                        </td>
                        <td className="py-2.5 text-right text-gray-600">{fmt(row.spend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {trendData.months.length === 0 && (
                  <p className="text-center py-8 text-gray-400">No data for this period</p>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-red-600">Failed to load trend data</div>
            )}
          </div>
        )}

      </div>
    </Layout>
  );
}
