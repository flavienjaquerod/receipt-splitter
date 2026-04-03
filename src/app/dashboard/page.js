'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../lib/supabase/client';
import { useAuth } from '../../contexts/authContext';
import { useDarkMode } from '../../contexts/darkModeContext';
import DarkModeToggle from '../../components/darkModeToggle';
import { FileText, Plus, LogOut } from 'lucide-react';

export default function DashboardPage() {
  const { user, signOut, loading } = useAuth();
  const { isDarkMode } = useDarkMode();
  const router = useRouter();
  const [receipts, setReceipts] = useState([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    supabase
      .from('receipts')
      .select('*, items(count)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setReceipts(data || []);
        setLoadingReceipts(false);
      });
  }, [user]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header>
        <nav className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Receipt Splitter
              </span>
            </div>

            <div className="flex items-center gap-3">
              <DarkModeToggle />
              <span className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 truncate max-w-[160px]">
                {user.email}
              </span>
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Your receipts</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">All your splitting sessions in one place</p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New session
          </Link>
        </div>

        {loadingReceipts ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">Loading…</div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No receipts yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-6">
              Your saved splitting sessions will appear here
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Start splitting
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {receipts.map(receipt => (
              <div
                key={receipt.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{receipt.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {receipt.items?.[0]?.count ?? 0} items ·{' '}
                      {new Date(receipt.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
