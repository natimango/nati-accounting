'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { billsApi } from '@/lib/api';
import { Bill } from '@/lib/types';

export default function BillsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadBills();
    }
  }, [user, filter]);

  const loadBills = async () => {
    try {
      const response = await billsApi.getBills(filter || undefined);
      setBills(response.data);
    } catch (error) {
      console.error('Failed to load bills:', error);
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
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Bills</h1>
          <button
            onClick={() => router.push('/bills/upload')}
            className="btn btn-primary"
          >
            Upload Bill
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="flex space-x-4">
            <button
              onClick={() => setFilter('')}
              className={`px-4 py-2 rounded-lg ${
                filter === '' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('PENDING')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'PENDING' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('POSTED')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'POSTED' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Posted
            </button>
          </div>
        </div>

        {/* Bills List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading bills...</p>
          </div>
        ) : bills.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-600">No bills found</p>
            <button
              onClick={() => router.push('/bills/upload')}
              className="btn btn-primary mt-4"
            >
              Upload First Bill
            </button>
          </div>
        ) : (
          <div className="card">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Bill Number</th>
                  <th className="text-left py-3 px-4">Vendor</th>
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Amount</th>
                  <th className="text-left py-3 px-4">Category</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr
                    key={bill.bill_id}
                    onClick={() => router.push(`/bills/${bill.bill_id}`)}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="py-3 px-4">{bill.bill_number || 'N/A'}</td>
                    <td className="py-3 px-4">{bill.vendor_name || 'N/A'}</td>
                    <td className="py-3 px-4">
                      {bill.bill_date
                        ? new Date(bill.bill_date).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-semibold">
                      ₹{bill.total_amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">{bill.category || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          bill.status === 'POSTED'
                            ? 'bg-green-100 text-green-700'
                            : bill.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {bill.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {bill.confidence_score ? `${bill.confidence_score}%` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
