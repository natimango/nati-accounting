'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { reportsApi } from '@/lib/api';
import { ProfitAndLossData } from '@/lib/types';

export default function ReportsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ProfitAndLossData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Default to current month
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(lastDay.toISOString().split('T')[0]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadReport();
    }
  }, [user, startDate, endDate]);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const response = await reportsApi.getProfitAndLoss(startDate, endDate);
      setData(response.data);
    } catch (error) {
      console.error('Failed to load report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !user) {
    return null;
  }

  return (
    <Layout>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Profit & Loss Statement</h1>

        {/* Date Range Selector */}
        <div className="card mb-8">
          <div className="flex items-center space-x-4">
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* P&L Report */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading report...</p>
          </div>
        ) : data ? (
          <div className="card">
            <div className="space-y-6">
              {/* Revenue Section */}
              <div>
                <div className="flex justify-between py-2">
                  <span className="font-semibold">Gross Revenue</span>
                  <span className="font-semibold">
                    ₹{data.summary.gross_revenue.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between py-2 pl-8 text-sm">
                  <span>Returns & Refunds</span>
                  <span>(₹{data.summary.returns.toLocaleString('en-IN')})</span>
                </div>
                <div className="flex justify-between py-2 pl-8 text-sm">
                  <span>Discounts</span>
                  <span>(₹{data.summary.discounts.toLocaleString('en-IN')})</span>
                </div>
                <div className="flex justify-between py-3 border-t border-b font-semibold bg-gray-50">
                  <span>Net Revenue</span>
                  <span>₹{data.summary.net_revenue.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* COGS */}
              <div>
                <div className="flex justify-between py-3 border-b">
                  <span className="font-semibold">Cost of Goods Sold</span>
                  <span className="font-semibold text-red-600">
                    (₹{data.summary.cogs.toLocaleString('en-IN')})
                  </span>
                </div>
                <div className="flex justify-between py-3 border-b font-bold bg-green-50">
                  <span>Gross Profit</span>
                  <div className="text-right">
                    <div>₹{data.summary.gross_profit.toLocaleString('en-IN')}</div>
                    <div className="text-sm text-green-600">
                      {data.summary.gross_margin.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Variable Expenses */}
              <div>
                <div className="flex justify-between py-3 border-b">
                  <span className="font-semibold">Variable Expenses</span>
                  <span className="font-semibold text-red-600">
                    (₹{data.summary.variable_expenses.toLocaleString('en-IN')})
                  </span>
                </div>
                <div className="flex justify-between py-3 border-b font-bold bg-blue-50">
                  <span>Contribution Margin</span>
                  <div className="text-right">
                    <div>₹{data.summary.contribution_margin.toLocaleString('en-IN')}</div>
                    <div className="text-sm text-blue-600">
                      {data.summary.contribution_margin_pct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Operating Expenses */}
              <div>
                <div className="flex justify-between py-2">
                  <span className="font-semibold">Operating Expenses</span>
                  <span className="font-semibold text-red-600">
                    (₹{data.summary.operating_expenses.toLocaleString('en-IN')})
                  </span>
                </div>
                <div className="flex justify-between py-2 pl-8 text-sm">
                  <span>Marketing</span>
                  <span>(₹{data.summary.marketing_expenses.toLocaleString('en-IN')})</span>
                </div>
                <div className="flex justify-between py-2 pl-8 text-sm">
                  <span>Fixed Costs</span>
                  <span>(₹{data.summary.fixed_expenses.toLocaleString('en-IN')})</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 border-gray-900 font-bold text-lg">
                  <span>Operating Profit</span>
                  <div className="text-right">
                    <div
                      className={
                        data.summary.operating_profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }
                    >
                      ₹{data.summary.operating_profit.toLocaleString('en-IN')}
                    </div>
                    <div className="text-sm text-gray-600">
                      {data.summary.operating_margin.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* D2C Metrics */}
              <div className="border-t-2 pt-6">
                <h3 className="font-bold text-lg mb-4">D2C METRICS</h3>
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">MER</p>
                    <p className="text-2xl font-bold">{data.d2c_metrics.mer}x</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Orders</p>
                    <p className="text-2xl font-bold">{data.d2c_metrics.orders}</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">AOV</p>
                    <p className="text-2xl font-bold">
                      ₹{data.d2c_metrics.aov.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Blended CAC</p>
                    <p className="text-2xl font-bold">
                      ₹{data.d2c_metrics.blended_cac.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Gross Margin/Order</p>
                    <p className="text-2xl font-bold">
                      ₹{data.d2c_metrics.gross_margin_per_order.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">CM/Order</p>
                    <p className="text-2xl font-bold">
                      ₹{data.d2c_metrics.contribution_margin_per_order.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-red-600">Failed to load report</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
