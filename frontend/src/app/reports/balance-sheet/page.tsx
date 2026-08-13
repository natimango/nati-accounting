'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { reportsApi } from '@/lib/api';
import { BalanceSheetData, AccountLine } from '@/lib/types';
import { fmt } from '@/lib/utils';

function AccountSection({ title, accounts, total, accent }: {
  title: string;
  accounts: AccountLine[];
  total: number;
  accent: string;
}) {
  return (
    <div className="mb-6">
      <h3 className={`text-xs font-bold uppercase tracking-widest mb-3 ${accent}`}>{title}</h3>
      <div className="space-y-1">
        {accounts.length === 0 ? (
          <p className="text-sm text-gray-400 pl-2">No entries</p>
        ) : (
          accounts.map(a => (
            <div key={a.account_code} className="flex justify-between text-sm py-1 border-b border-gray-50">
              <span className="text-gray-700">
                <span className="text-gray-400 text-xs mr-2">{a.account_code}</span>
                {a.account_name}
              </span>
              <span className="font-medium">{fmt(a.balance)}</span>
            </div>
          ))
        )}
      </div>
      <div className="flex justify-between font-semibold mt-3 pt-2 border-t border-gray-200 text-sm">
        <span>Total {title}</span>
        <span>{fmt(total)}</span>
      </div>
    </div>
  );
}

export default function BalanceSheetPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadReport();
  }, [user, asOfDate]);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const response = await reportsApi.getBalanceSheet(asOfDate);
      setData(response as BalanceSheetData);
    } catch (error) {
      console.error('Failed to load balance sheet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !user) return null;

  const balanced = data
    ? Math.abs(data.summary.total_assets - data.summary.total_liabilities - data.summary.total_equity) < 0.01
    : null;

  return (
    <Layout>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Balance Sheet</h1>

        {/* Date Picker */}
        <div className="card mb-8">
          <div className="flex items-center space-x-4">
            <div>
              <label className="label">As of Date</label>
              <input
                type="date"
                value={asOfDate}
                onChange={e => setAsOfDate(e.target.value)}
                className="input"
              />
            </div>
            {data && (
              <div className={`text-sm font-medium px-3 py-1.5 rounded-full ${balanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {balanced ? 'Balanced ✓' : 'Out of balance — check journal entries'}
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-600">Loading balance sheet...</div>
        ) : data ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Left — Assets */}
            <div className="card">
              <AccountSection
                title="Assets"
                accounts={data.accounts.assets}
                total={data.summary.total_assets}
                accent="text-blue-600"
              />
            </div>

            {/* Right — Liabilities + Equity */}
            <div className="card space-y-0">
              <AccountSection
                title="Liabilities"
                accounts={data.accounts.liabilities}
                total={data.summary.total_liabilities}
                accent="text-red-600"
              />
              <AccountSection
                title="Equity"
                accounts={data.accounts.equity}
                total={data.summary.total_equity}
                accent="text-green-600"
              />
              <div className="flex justify-between font-bold text-base pt-3 border-t-2 border-gray-900">
                <span>Total Liabilities + Equity</span>
                <span>{fmt(data.summary.total_liabilities + data.summary.total_equity)}</span>
              </div>
            </div>

          </div>
        ) : (
          <div className="text-center py-12 text-red-600">Failed to load balance sheet</div>
        )}
      </div>
    </Layout>
  );
}
