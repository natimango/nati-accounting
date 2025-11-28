'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { reportsApi } from '@/lib/api';
import { DashboardData } from '@/lib/types';

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadDashboard();
    }
  }, [user]);

  const loadDashboard = async () => {
    try {
      const response = await reportsApi.getDashboard();
      setData(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* Today's Snapshot */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Today&apos;s Snapshot</h2>
              <div className="grid grid-cols-3 gap-6">
                <div className="card">
                  <p className="text-sm text-gray-600 mb-2">Revenue</p>
                  <p className="text-3xl font-bold text-gray-900">
                    ₹{data.today.revenue.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-600 mb-2">Orders</p>
                  <p className="text-3xl font-bold text-gray-900">{data.today.orders}</p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-600 mb-2">AOV</p>
                  <p className="text-3xl font-bold text-gray-900">
                    ₹{Math.round(data.today.aov).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>

            {/* This Month */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">This Month</h2>
              <div className="card">
                <div className="grid grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ₹{data.this_month.revenue.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">COGS</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ₹{data.this_month.cogs.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Gross Margin</p>
                    <p className="text-2xl font-bold text-green-600">
                      {data.this_month.gross_margin.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Orders</p>
                    <p className="text-2xl font-bold text-gray-900">{data.this_month.orders}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pending Bills */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Pending Bills</h2>
              {data.pending_bills.length === 0 ? (
                <div className="card text-center py-8">
                  <p className="text-gray-600">No pending bills</p>
                </div>
              ) : (
                <div className="card">
                  <div className="space-y-4">
                    {data.pending_bills.map((bill) => (
                      <div
                        key={bill.bill_id}
                        className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {bill.bill_number || 'N/A'}
                          </p>
                          {bill.due_date && (
                            <p className="text-sm text-gray-600">
                              Due: {new Date(bill.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">
                            ₹{bill.total_amount.toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-3 gap-6">
                <button
                  onClick={() => router.push('/bills/upload')}
                  className="card hover:shadow-lg transition-shadow cursor-pointer text-left"
                >
                  <div className="text-3xl mb-2">📄</div>
                  <h3 className="font-semibold text-gray-900">Upload Bill</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Upload and process bills with AI
                  </p>
                </button>
                <button
                  onClick={() => router.push('/reports')}
                  className="card hover:shadow-lg transition-shadow cursor-pointer text-left"
                >
                  <div className="text-3xl mb-2">📊</div>
                  <h3 className="font-semibold text-gray-900">View P&L</h3>
                  <p className="text-sm text-gray-600 mt-1">Check financial performance</p>
                </button>
                <button
                  onClick={() => router.push('/bills')}
                  className="card hover:shadow-lg transition-shadow cursor-pointer text-left"
                >
                  <div className="text-3xl mb-2">👥</div>
                  <h3 className="font-semibold text-gray-900">View Bills</h3>
                  <p className="text-sm text-gray-600 mt-1">Manage all bills</p>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-red-600">Failed to load dashboard</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
