"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { reportsAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchDashboard();
    
    // Update time every minute
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await reportsAPI.getDashboard();
      setData(res.data);
    } catch (err) {
      console.error('Dashboard error:', err);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => 
    `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  
  const formatCurrencyDetailed = (val: number) => 
    `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatDate = (date: Date) => 
    date.toLocaleDateString('en-IN', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

  const formatTime = (date: Date) => 
    date.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit'
    });

  // Calculate growth percentage
  const getGrowth = () => {
    if (!data || !data.lastMonth.sales) return 0;
    return ((data.thisMonth.sales - data.lastMonth.sales) / data.lastMonth.sales * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-4 shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">{getGreeting()}! 👋</h1>
            <p className="text-slate-300 text-sm">{formatDate(currentTime)} • {formatTime(currentTime)}</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => router.push('/')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              🧾 New Sale
            </Button>
            <Button 
              onClick={() => router.push('/purchase')}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              📦 New Purchase
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Today's Summary */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">📊 Today's Summary</h2>
          <div className="grid grid-cols-4 gap-4">
            {/* Today's Sales */}
            <div className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Today's Sales</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(data?.today?.sales || 0)}</p>
                  <p className="text-xs text-gray-400 mt-1">{data?.today?.salesCount || 0} invoices</p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">💰</span>
                </div>
              </div>
            </div>

            {/* Today's Purchases */}
            <div className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Today's Purchases</p>
                  <p className="text-2xl font-bold text-purple-600">{formatCurrency(data?.today?.purchases || 0)}</p>
                  <p className="text-xs text-gray-400 mt-1">{data?.today?.purchasesCount || 0} entries</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">📦</span>
                </div>
              </div>
            </div>

            {/* Customer Outstanding */}
            <div className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition cursor-pointer" onClick={() => router.push('/accounts?type=CUSTOMER')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Customer Dues</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(data?.outstanding?.customerDues || 0)}</p>
                  <p className="text-xs text-gray-400 mt-1">{data?.outstanding?.customerCount || 0} customers</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
              </div>
            </div>

            {/* Supplier Dues */}
            <div className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition cursor-pointer" onClick={() => router.push('/accounts?type=SUPPLIER')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Supplier Dues</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(data?.outstanding?.supplierDues || 0)}</p>
                  <p className="text-xs text-gray-400 mt-1">{data?.outstanding?.supplierCount || 0} suppliers</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🏭</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Performance + Alerts */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* This Month */}
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">📈 This Month's Performance</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-500">Total Sales</span>
                  <span className="text-lg font-bold text-emerald-600">{formatCurrency(data?.thisMonth?.sales || 0)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-emerald-500 h-2 rounded-full" 
                    style={{ width: `${Math.min(100, (data?.thisMonth?.sales / (data?.lastMonth?.sales || 1)) * 100)}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-gray-500">vs Last Month</span>
                <span className={`text-sm font-semibold ${Number(getGrowth()) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Number(getGrowth()) >= 0 ? '↑' : '↓'} {Math.abs(Number(getGrowth()))}%
                </span>
              </div>
              
              <div className="text-xs text-gray-400">
                {data?.thisMonth?.salesCount || 0} invoices this month
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">⚠️ Stock Alerts</h3>
            <div className="space-y-3">
              <div 
                className="flex items-center justify-between p-3 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 transition"
                onClick={() => router.push('/reports?tab=stock&filter=expiring')}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">⏰</span>
                  <div>
                    <p className="text-sm font-medium text-orange-700">Expiring Soon</p>
                    <p className="text-xs text-orange-500">Within 120 days</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-orange-600">{data?.alerts?.expiringSoon || 0}</span>
              </div>
              
              <div 
                className="flex items-center justify-between p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition"
                onClick={() => router.push('/reports?tab=stock&filter=expired')}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🚫</span>
                  <div>
                    <p className="text-sm font-medium text-red-700">Expired</p>
                    <p className="text-xs text-red-500">Need attention</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-red-600">{data?.alerts?.expired || 0}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">⚡ Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => router.push('/')}
                className="p-4 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition text-center"
              >
                <span className="text-2xl block mb-1">🧾</span>
                <span className="text-xs font-medium text-emerald-700">New Sale</span>
              </button>
              
              <button 
                onClick={() => router.push('/purchase')}
                className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition text-center"
              >
                <span className="text-2xl block mb-1">📦</span>
                <span className="text-xs font-medium text-purple-700">Purchase</span>
              </button>
              
              <button 
                onClick={() => router.push('/payments')}
                className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition text-center"
              >
                <span className="text-2xl block mb-1">💳</span>
                <span className="text-xs font-medium text-blue-700">Payment</span>
              </button>
              
              <button 
                onClick={() => router.push('/products')}
                className="p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition text-center"
              >
                <span className="text-2xl block mb-1">💊</span>
                <span className="text-xs font-medium text-orange-700">Products</span>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-gray-600">📋 Recent Invoices</h3>
            <button 
              onClick={() => router.push('/reports')}
              className="text-xs text-indigo-600 hover:underline"
            >
              View All →
            </button>
          </div>
          
          {data?.recentInvoices?.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Invoice #</th>
                  <th className="pb-2 font-medium">Customer</th>
                  <th className="pb-2 font-medium text-right">Amount</th>
                  <th className="pb-2 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {data.recentInvoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 font-semibold text-indigo-600">#{inv.invoiceNo}</td>
                    <td className="py-3">{inv.customer}</td>
                    <td className="py-3 text-right font-semibold">{formatCurrencyDetailed(inv.amount)}</td>
                    <td className="py-3 text-right text-gray-500 text-xs">
                      {new Date(inv.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <span className="text-4xl block mb-2">📋</span>
              <p>No invoices today</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t px-6 py-2 text-center text-xs text-gray-400 shrink-0">
        PharmaStream ERP v1.6 • Dashboard auto-refreshes every minute
      </footer>
    </div>
  );
}
