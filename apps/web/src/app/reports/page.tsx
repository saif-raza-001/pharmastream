"use client";

import { useState, useEffect } from 'react';
import { reportsAPI, accountsAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type ReportTab = 'sales' | 'purchases' | 'stock' | 'gst';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');
  const [loading, setLoading] = useState(false);
  
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [salesData, setSalesData] = useState<any>(null);
  const [purchaseData, setPurchaseData] = useState<any>(null);
  const [stockData, setStockData] = useState<any>(null);
  const [gstData, setGstData] = useState<any>(null);
  
  const [stockFilter, setStockFilter] = useState('all');
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (activeTab === 'sales') fetchSalesReport();
    else if (activeTab === 'purchases') fetchPurchaseReport();
    else if (activeTab === 'stock') fetchStockReport();
    else if (activeTab === 'gst') fetchGSTReport();
  }, [activeTab, stockFilter]);

  const fetchAccounts = async () => {
    try {
      const [custRes, suppRes] = await Promise.all([
        accountsAPI.getAll('CUSTOMER'),
        accountsAPI.getAll('SUPPLIER')
      ]);
      setCustomers(custRes.data || []);
      setSuppliers(suppRes.data || []);
    } catch (err) {}
  };

  const fetchSalesReport = async () => {
    setLoading(true);
    try {
      const res = await reportsAPI.getSales({ 
        from: fromDate, 
        to: toDate,
        customerId: selectedCustomer || undefined
      });
      setSalesData(res.data);
    } catch (err) {
      toast.error('Failed to load sales report');
    }
    setLoading(false);
  };

  const fetchPurchaseReport = async () => {
    setLoading(true);
    try {
      const res = await reportsAPI.getPurchases({ 
        from: fromDate, 
        to: toDate,
        supplierId: selectedSupplier || undefined
      });
      setPurchaseData(res.data);
    } catch (err) {
      toast.error('Failed to load purchase report');
    }
    setLoading(false);
  };

  const fetchStockReport = async () => {
    setLoading(true);
    try {
      const res = await reportsAPI.getStock(stockFilter);
      setStockData(res.data);
    } catch (err) {
      toast.error('Failed to load stock report');
    }
    setLoading(false);
  };

  const fetchGSTReport = async () => {
    setLoading(true);
    try {
      const res = await reportsAPI.getGST(fromDate, toDate);
      setGstData(res.data);
    } catch (err) {
      toast.error('Failed to load GST report');
    }
    setLoading(false);
  };

  const handleApplyFilter = () => {
    if (activeTab === 'sales') fetchSalesReport();
    else if (activeTab === 'purchases') fetchPurchaseReport();
    else if (activeTab === 'gst') fetchGSTReport();
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val: number | undefined | null) => {
    const safeVal = val || 0;
    return `₹${safeVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };
  
  const formatDate = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN');
  };

  return (
    <div className="flex flex-col h-screen print:h-auto">
      <header className="h-11 bg-indigo-700 flex items-center justify-between px-4 shrink-0 print:hidden">
        <h1 className="text-white font-semibold text-sm">📊 Reports</h1>
        <Button size="sm" className="h-7 bg-white text-indigo-700 text-xs" onClick={handlePrint}>
          🖨️ Print
        </Button>
      </header>

      <div className="bg-white border-b px-4 shrink-0 print:hidden">
        <div className="flex gap-0">
          {(['sales', 'purchases', 'stock', 'gst'] as ReportTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-xs font-semibold border-b-2 transition ${
                activeTab === tab 
                  ? 'border-indigo-600 text-indigo-700 bg-indigo-50' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'sales' && '🧾 Sales Report'}
              {tab === 'purchases' && '📦 Purchase Report'}
              {tab === 'stock' && '📋 Stock Report'}
              {tab === 'gst' && '🏛️ GST Report'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 px-4 py-3 border-b shrink-0 print:hidden">
        <div className="flex items-center gap-4">
          {(activeTab === 'sales' || activeTab === 'purchases' || activeTab === 'gst') && (
            <>
              <div>
                <label className="text-[10px] text-gray-500 uppercase block">From</label>
                <Input 
                  type="date" 
                  value={fromDate} 
                  onChange={e => setFromDate(e.target.value)}
                  className="h-8 text-xs w-36"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase block">To</label>
                <Input 
                  type="date" 
                  value={toDate} 
                  onChange={e => setToDate(e.target.value)}
                  className="h-8 text-xs w-36"
                />
              </div>
            </>
          )}
          
          {activeTab === 'sales' && (
            <div>
              <label className="text-[10px] text-gray-500 uppercase block">Customer</label>
              <select 
                value={selectedCustomer} 
                onChange={e => setSelectedCustomer(e.target.value)}
                className="h-8 text-xs border rounded px-2 w-48"
              >
                <option value="">All Customers</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          
          {activeTab === 'purchases' && (
            <div>
              <label className="text-[10px] text-gray-500 uppercase block">Supplier</label>
              <select 
                value={selectedSupplier} 
                onChange={e => setSelectedSupplier(e.target.value)}
                className="h-8 text-xs border rounded px-2 w-48"
              >
                <option value="">All Suppliers</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          
          {activeTab === 'stock' && (
            <div>
              <label className="text-[10px] text-gray-500 uppercase block">Filter</label>
              <select 
                value={stockFilter} 
                onChange={e => { setStockFilter(e.target.value); }}
                className="h-8 text-xs border rounded px-2 w-48"
              >
                <option value="all">All Products</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
                <option value="expiring">Expiring in 30 Days</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          )}
          
          {(activeTab === 'sales' || activeTab === 'purchases' || activeTab === 'gst') && (
            <div className="flex items-end">
              <Button size="sm" onClick={handleApplyFilter} className="h-8 bg-indigo-600">
                Apply Filter
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white p-4">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading...</div>
          </div>
        )}

        {activeTab === 'sales' && salesData && !loading && (
          <div>
            <div className="grid grid-cols-5 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-600">Total Invoices</div>
                <div className="text-2xl font-bold text-blue-700">{salesData.summary?.totalInvoices || 0}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-xs text-green-600">Total Sales</div>
                <div className="text-xl font-bold text-green-700">{formatCurrency(salesData.summary?.totalAmount)}</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-xs text-purple-600">GST Collected</div>
                <div className="text-xl font-bold text-purple-700">{formatCurrency(salesData.summary?.totalGst)}</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="text-xs text-emerald-600">Total Paid</div>
                <div className="text-xl font-bold text-emerald-700">{formatCurrency(salesData.summary?.totalPaid)}</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-xs text-red-600">Outstanding</div>
                <div className="text-xl font-bold text-red-700">{formatCurrency(salesData.summary?.totalDue)}</div>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 text-xs font-semibold">
                Invoice Details ({salesData.invoices?.length || 0})
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Invoice#</th>
                      <th className="p-2 text-left">Customer</th>
                      <th className="p-2 text-center">Type</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2 text-right">Paid</th>
                      <th className="p-2 text-right">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.invoices?.map((inv: any) => (
                      <tr key={inv.id} className="border-t hover:bg-gray-50">
                        <td className="p-2">{formatDate(inv.invoiceDate)}</td>
                        <td className="p-2 font-semibold">#{inv.invoiceNo}</td>
                        <td className="p-2">{inv.customer?.name || 'Walk-in'}</td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${inv.invoiceType === 'CASH' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {inv.invoiceType}
                          </span>
                        </td>
                        <td className="p-2 text-right font-semibold">{formatCurrency(Number(inv.grandTotal))}</td>
                        <td className="p-2 text-right text-green-600">{formatCurrency(Number(inv.paidAmount))}</td>
                        <td className="p-2 text-right text-red-600 font-semibold">{formatCurrency(Number(inv.dueAmount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'purchases' && purchaseData && !loading && (
          <div>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-600">Total Purchases</div>
                <div className="text-2xl font-bold text-blue-700">{purchaseData.summary?.totalPurchases || 0}</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-xs text-purple-600">Total Amount</div>
                <div className="text-xl font-bold text-purple-700">{formatCurrency(purchaseData.summary?.totalAmount)}</div>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="text-xs text-indigo-600">GST Paid</div>
                <div className="text-xl font-bold text-indigo-700">{formatCurrency(purchaseData.summary?.totalGst)}</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="text-xs text-emerald-600">Net Purchases</div>
                <div className="text-xl font-bold text-emerald-700">{formatCurrency(purchaseData.summary?.totalAmount)}</div>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 text-xs font-semibold">
                Purchase Details ({purchaseData.purchases?.length || 0})
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Entry#</th>
                      <th className="p-2 text-left">Bill No</th>
                      <th className="p-2 text-left">Supplier</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseData.purchases?.map((p: any) => (
                      <tr key={p.id} className="border-t hover:bg-gray-50">
                        <td className="p-2">{formatDate(p.purchaseDate)}</td>
                        <td className="p-2 font-semibold">#{p.purchaseNo}</td>
                        <td className="p-2">{p.billNo}</td>
                        <td className="p-2">{p.supplier?.name}</td>
                        <td className="p-2 text-right font-semibold">{formatCurrency(Number(p.grandTotal))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stock' && stockData && !loading && (
          <div>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-600">Total Products</div>
                <div className="text-2xl font-bold text-blue-700">{stockData.summary?.totalProducts || 0}</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-xs text-purple-600">Total Stock</div>
                <div className="text-xl font-bold text-purple-700">{(stockData.summary?.totalStock || 0).toLocaleString()}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-xs text-green-600">Stock Value</div>
                <div className="text-lg font-bold text-green-700">{formatCurrency(stockData.summary?.totalValue)}</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="text-xs text-emerald-600">Showing</div>
                <div className="text-2xl font-bold text-emerald-700">{stockData.products?.length || 0}</div>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 text-xs font-semibold">
                Stock Details ({stockData.products?.length || 0})
              </div>
              <div className="max-h-[500px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Product</th>
                      <th className="p-2 text-left">Manufacturer</th>
                      <th className="p-2 text-right">Stock</th>
                      <th className="p-2 text-right">Value</th>
                      <th className="p-2 text-center">Rack</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockData.products?.map((item: any) => (
                      <tr key={item.id} className="border-t hover:bg-gray-50">
                        <td className="p-2 font-medium">{item.name}</td>
                        <td className="p-2">{item.manufacturer?.name}</td>
                        <td className="p-2 text-right">{item.totalStock || 0}</td>
                        <td className="p-2 text-right">{formatCurrency(item.stockValue)}</td>
                        <td className="p-2 text-center">{item.rackLocation || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gst' && gstData && !loading && (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-lg font-bold">GST Summary</h2>
              <p className="text-sm text-gray-500">
                {formatDate(gstData.period?.from)} to {formatDate(gstData.period?.to)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-green-600 text-white px-4 py-2 text-sm font-semibold">
                  Output GST (Sales)
                </div>
                <div className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Taxable:</span>
                    <span>{formatCurrency(gstData.sales?.taxableAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CGST:</span>
                    <span>{formatCurrency(gstData.sales?.cgst)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST:</span>
                    <span>{formatCurrency(gstData.sales?.sgst)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span>Total:</span>
                    <span className="text-green-600">{formatCurrency(gstData.sales?.totalGst)}</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold">
                  Input GST (Purchases)
                </div>
                <div className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Taxable:</span>
                    <span>{formatCurrency(gstData.purchases?.taxableAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CGST:</span>
                    <span>{formatCurrency(gstData.purchases?.cgst)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST:</span>
                    <span>{formatCurrency(gstData.purchases?.sgst)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span>Total:</span>
                    <span className="text-blue-600">{formatCurrency(gstData.purchases?.totalGst)}</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className={`${(gstData.netGst || 0) >= 0 ? 'bg-red-600' : 'bg-green-600'} text-white px-4 py-2 text-sm font-semibold`}>
                  Net GST {(gstData.netGst || 0) >= 0 ? 'Payable' : 'Credit'}
                </div>
                <div className="p-4">
                  <div className="text-3xl font-bold text-center py-4">
                    <span className={(gstData.netGst || 0) >= 0 ? 'text-red-600' : 'text-green-600'}>
                      {formatCurrency(Math.abs(gstData.netGst || 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
