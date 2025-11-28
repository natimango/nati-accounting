'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { billsApi } from '@/lib/api';

export default function UploadBillPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError('');

    try {
      const response = await billsApi.uploadBill(file);
      setResult(response);
      setFile(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Upload Bill</h1>

        <div className="card">
          {/* Upload Area */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-primary-500 transition-colors">
            <div className="text-6xl mb-4">📄</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Drag & Drop Bills Here
            </h3>
            <p className="text-gray-600 mb-4">or click to browse</p>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="btn btn-primary cursor-pointer">
              Choose File
            </label>
            <p className="text-sm text-gray-500 mt-4">
              Supported: PDF, JPG, PNG (max 10MB)
            </p>
          </div>

          {/* Selected File */}
          {file && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-600">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="btn btn-primary disabled:opacity-50"
                >
                  {isUploading ? 'Processing...' : 'Upload & Process'}
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="mt-6 space-y-4">
              <div
                className={`p-4 rounded-lg ${
                  result.data.needs_review
                    ? 'bg-yellow-50 border border-yellow-200'
                    : 'bg-green-50 border border-green-200'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {result.data.needs_review
                        ? '⚠️ Please Review'
                        : '✅ Successfully Processed'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Confidence: {result.data.confidence_score}%
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/bills/${result.data.bill_id}`)}
                    className="btn btn-primary"
                  >
                    View Details
                  </button>
                </div>

                {result.data.extracted_data && (
                  <div className="bg-white p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Extracted Data:</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Vendor:</span>{' '}
                        <span className="font-medium">
                          {result.data.extracted_data.vendor_name || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Amount:</span>{' '}
                        <span className="font-medium">
                          ₹{result.data.extracted_data.total_amount?.toLocaleString('en-IN') || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Date:</span>{' '}
                        <span className="font-medium">
                          {result.data.extracted_data.bill_date || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Category:</span>{' '}
                        <span className="font-medium">
                          {result.data.extracted_data.category || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setResult(null);
                  setFile(null);
                }}
                className="btn btn-secondary w-full"
              >
                Upload Another Bill
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
