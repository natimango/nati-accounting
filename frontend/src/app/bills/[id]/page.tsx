'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { billsApi, tagsApi } from '@/lib/api';
import { Bill, Tag } from '@/lib/types';
import { fmt } from '@/lib/utils';

const TAG_GROUP_LABELS: Record<string, string> = {
  PURCHASE: 'Purchase (COGS)',
  FULFILLMENT: 'Fulfillment',
  MARKETING: 'Marketing',
  OPERATIONS: 'Operations',
};

const STATUS_STYLES: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-700',
  POSTED:    'bg-green-100 text-green-700',
  PAID:      'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export default function BillDetailPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [bill, setBill] = useState<Bill | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && id) loadData();
  }, [user, id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [billRes, tagsRes] = await Promise.all([
        billsApi.getBillById(id),
        tagsApi.getTags(),
      ]);
      const billData = billRes as Bill & { tags?: Tag[] };
      const tagsData = tagsRes as unknown as { tags: Tag[] };
      setBill(billData);
      setAllTags(tagsData.tags ?? []);
      setSelectedTagIds(new Set((billData.tags ?? []).map((t: Tag) => t.tag_id)));
    } catch {
      setError('Failed to load bill');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev => {
      const next = new Set(prev);
      next.has(tagId) ? next.delete(tagId) : next.add(tagId);
      return next;
    });
  };

  const saveTags = async () => {
    setIsSavingTags(true);
    setError('');
    try {
      await tagsApi.setBillTags(id, Array.from(selectedTagIds));
      setSuccessMsg('Tags saved');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch {
      setError('Failed to save tags');
    } finally {
      setIsSavingTags(false);
    }
  };

  const approveBill = async () => {
    if (!confirm('Post this bill to accounting? This cannot be undone.')) return;
    setIsApproving(true);
    setError('');
    try {
      await billsApi.approveBill(id);
      await loadData();
      setSuccessMsg('Bill approved and posted');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      setError(msg || 'Failed to approve bill');
    } finally {
      setIsApproving(false);
    }
  };

  if (authLoading || !user) return null;

  // Group available tags by group
  const tagsByGroup = allTags.reduce((acc: Record<string, Tag[]>, tag) => {
    if (!acc[tag.tag_group]) acc[tag.tag_group] = [];
    acc[tag.tag_group].push(tag);
    return acc;
  }, {});

  const canApprove = user.role === 'ADMIN' || user.role === 'ACCOUNTANT';

  return (
    <Layout>
      <div className="max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center">
              ← Back to Bills
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {bill?.bill_number ? `Bill #${bill.bill_number}` : 'Bill Detail'}
            </h1>
          </div>
          {bill && bill.status === 'PENDING' && canApprove && (
            <button
              onClick={approveBill}
              disabled={isApproving}
              className="btn btn-primary disabled:opacity-50"
            >
              {isApproving ? 'Approving...' : 'Approve & Post'}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{successMsg}</div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-gray-600">Loading...</div>
        ) : !bill ? (
          <div className="text-center py-12 text-red-600">Bill not found</div>
        ) : (
          <div className="space-y-6">

            {/* Bill Info */}
            <div className="card grid grid-cols-2 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Vendor</p>
                <p className="font-semibold">{bill.vendor_name || '—'}</p>
                {bill.gstin && <p className="text-xs text-gray-500">GST: {bill.gstin}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Amount</p>
                <p className="font-semibold text-lg">{fmt(bill.total_amount)}</p>
                {bill.tax_amount ? <p className="text-xs text-gray-500">Tax: {fmt(bill.tax_amount)}</p> : null}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</p>
                <span className={`px-2 py-1 rounded text-sm font-medium ${STATUS_STYLES[bill.status] || 'bg-gray-100 text-gray-600'}`}>
                  {bill.status}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Bill Date</p>
                <p className="font-medium">{bill.bill_date ? new Date(bill.bill_date).toLocaleDateString() : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Due Date</p>
                <p className="font-medium">{bill.due_date ? new Date(bill.due_date).toLocaleDateString() : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">AI Confidence</p>
                <p className="font-medium">{bill.confidence_score != null ? `${bill.confidence_score}%` : '—'}</p>
              </div>
            </div>

            {/* Line Items */}
            {bill.items && bill.items.length > 0 && (
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-4">Line Items</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-2 pr-4">Description</th>
                      <th className="py-2 pr-4 text-right">Qty</th>
                      <th className="py-2 pr-4 text-right">Rate</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.items.map(item => (
                      <tr key={item.item_id} className="border-b last:border-0">
                        <td className="py-2 pr-4">{item.description}</td>
                        <td className="py-2 pr-4 text-right">{item.quantity ?? '—'}</td>
                        <td className="py-2 pr-4 text-right">{item.rate ? fmt(item.rate) : '—'}</td>
                        <td className="py-2 text-right font-medium">{fmt(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={3} className="pt-3 text-right pr-4">Total</td>
                      <td className="pt-3 text-right">{fmt(bill.total_amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Tags */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Expense Tags</h2>
                <button
                  onClick={saveTags}
                  disabled={isSavingTags}
                  className="btn btn-primary text-sm disabled:opacity-50"
                >
                  {isSavingTags ? 'Saving...' : 'Save Tags'}
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Tags map this bill to the correct accounts in P&L. Select all that apply.
              </p>
              <div className="space-y-4">
                {Object.entries(tagsByGroup).map(([group, tags]) => (
                  <div key={group}>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                      {TAG_GROUP_LABELS[group] || group}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {tags.map(tag => {
                        const selected = selectedTagIds.has(tag.tag_id);
                        return (
                          <button
                            key={tag.tag_id}
                            onClick={() => toggleTag(tag.tag_id)}
                            className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                              selected
                                ? 'text-white border-transparent'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                            }`}
                            style={selected ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                          >
                            {tag.tag_name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Document */}
            {bill.document_url && (
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-3">Document</h2>
                <a
                  href={bill.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                >
                  View Original Document
                </a>
              </div>
            )}

          </div>
        )}
      </div>
    </Layout>
  );
}
