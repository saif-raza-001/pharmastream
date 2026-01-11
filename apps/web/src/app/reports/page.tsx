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
  
  // Date filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First of current month
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // Data
  const [salesData, setSalesData] = useState<any>(null);
  const [purchaseData, setPurchaseData] = useState<any>(null);
  const [stockData, setStockData] = useState<any>(null);
  const [gstData, setGstData] = useState<any>(null);
  
  // Filters
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

  const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-IN');

  return (
    <div className="flex flex-col h-screen print:h-auto">
      {/* Header */}
      <header className="h-11 bg-indigo-700 flex items-center justify-between px-4 shrink-0 print:hidden">
        <h1 className="text-white font-semibold text-sm">📊 Reports</h1>
        <Button size="sm" className="h-7 bg-white text-indigo-700 text-xs" onClick={handlePrint}>
          🖨️ Print
        </Button>
      </header>

      {/* Tabs */}
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

      {/* Filters */}
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

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white p-4">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading...</div>
          </div>
        )}

        {/* SALES REPORT */}
        {activeTab === 'sales' && salesData && !loading && (
          <div>
            {/* Summary Cards */}
            <div className="grid grid-cols-6 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-600">Total Invoices</div>
                <div className="text-2xl font-bold text-blue-700">{salesData.summary.totalInvoices}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-xs text-green-600">Gross Sales</div>
                <div className="text-xl font-bold text-green-700">{formatCurrency(salesData.summary.grossAmount)}</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="text-xs text-orange-600">Discount</div>
                <div className="text-xl font-bold text-orange-700">{formatCurrency(salesData.summary.totalDiscount)}</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-xs text-purple-600">GST Collected</div>
                <div className="text-xl font-bold text-purple-700">{formatCurrency(salesData.summary.cgstAmount + salesData.summary.sgstAmount)}</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="text-xs text-emerald-600">Net Sales</div>
                <div className="text-xl font-bold text-emerald-700">{formatCurrency(salesData.summary.grandTotal)}</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-xs text-red-600">Outstanding</div>
                <div className="text-xl font-bold text-red-700">{formatCurrency(salesData.summary.dueAmount)}</div>
              </div>
            </div>

            {/* Invoice List */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 text-xs font-semibold">
                Invoice Details ({salesData.invoices.length})
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Invoice#</th>
                      <th className="p-2 text-left">Customer</th>
                      <th className="p-2 text-center">Type</th>
                      <th className="p-2 text-right">Gross</th>
                      <th className="p-2 text-right">Disc</th>
                      <th className="p-2 text-right">GST</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2 text-right">Paid</th>
                      <th className="p-2 text-right">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.invoices.map((inv: any) => (
                      <tr key={inv.id} className="border-t hover:bg-gray-50">
                        <td className="p-2">{formatDate(inv.invoiceDate)}</td>
                        <td className="p-2 font-semibold">#{inv.invoiceNo}</td>
                        <td className="p-2">{inv.customer.name}</td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${inv.invoiceType === 'CASH' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {inv.invoiceType}
                          </span>
                        </td>
                        <td className="p-2 text-right">{formatCurrency(Number(inv.grossAmount))}</td>
                        <td className="p-2 text-right text-orange-600">{formatCurrency(Number(inv.totalDiscount))}</td>
                        <td className="p-2 text-right text-purple-600">{formatCurrency(Number(inv.cgstAmount) + Number(inv.sgstAmount))}</td>
                        <td className="p-2 text-right font-semibold">{formatCurrency(Number(inv.grandTotal))}</td>
                        <td className="p-2 text-right text-green-600">{formatCurrency(Number(inv.paidAmount))}</td>
                        <td className="p-2 text-right text-red-600 font-semibold">{formatCurrency(Number(inv.dueAmount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Products */}
            {salesData.topProducts.length > 0 && (
              <div className="mt-6 border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 text-xs font-semibold">
                  Top Selling Products
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">Product</th>
                      <th className="p-2 text-right">Qty Sold</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.topProducts.slice(0, 10).map((p: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2 font-medium">{p.name}</td>
                        <td className="p-2 text-right">{p.qty}</td>
                        <td className="p-2 text-right font-semibold">{formatCurrency(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* PURCHASE REPORT */}
        {activeTab === 'purchases' && purchaseData && !loading && (
          <div>
            {/* Summary Cards */}
            <div className="grid grid-cols-5 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-600">Total Purchases</div>
                <div className="text-2xl font-bold text-blue-700">{purchaseData.summary.totalPurchases}</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-xs text-purple-600">Gross Amount</div>
                <div className="text-xl font-bold text-purple-700">{formatCurrency(purchaseData.summary.grossAmount)}</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="text-xs text-orange-600">Discount</div>
                <div className="text-xl font-bold text-orange-700">{formatCurrency(purchaseData.summary.totalDiscount)}</div>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="text-xs text-indigo-600">GST Paid</div>
                <div className="text-xl font-bold text-indigo-700">{formatCurrency(purchaseData.summary.cgstAmount + purchaseData.summary.sgstAmount)}</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="text-xs text-emerald-600">Net Purchases</div>
                <div className="text-xl font-bold text-emerald-700">{formatCurrency(purchaseData.summary.grandTotal)}</div>
              </div>
            </div>

            {/* Purchase List */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 text-xs font-semibold">
                Purchase Details ({purchaseData.purchases.length})
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Entry#</th>
                      <th className="p-2 text-left">Bill No</th>
                      <th className="p-2 text-left">Supplier</th>
                      <th className="p-2 text-right">Gross</th>
                      <th className="p-2 text-right">GST</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseData.purchases.map((p: any) => (
                      <tr key={p.id} className="border-t hover:bg-gray-50">
                        <td className="p-2">{formatDate(p.purchaseDate)}</td>
                        <td className="p-2 font-semibold">#{p.purchaseNo}</td>
                        <td className="p-2">{p.billNo}</td>
                        <td className="p-2">{p.supplier.name}</td>
                        <td className="p-2 text-right">{formatCurrency(Number(p.grossAmount))}</td>
                        <td className="p-2 text-right text-purple-600">{formatCurrency(Number(p.cgstAmount) + Number(p.sgstAmount))}</td>
                        <td className="p-2 text-right font-semibold">{formatCurrency(Number(p.grandTotal))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* STOCK REPORT */}
        {activeTab === 'stock' && stockData && !loading && (
          <div>
            {/* Summary Cards */}
            <div className="grid grid-cols-6 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-600">Total Products</div>
                <div className="text-2xl font-bold text-blue-700">{stockData.summary.totalProducts}</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-xs text-purple-600">Total Stock</div>
                <div className="text-xl font-bold text-purple-700">{stockData.summary.totalStock.toLocaleString()}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-xs text-green-600">Stock Value (Cost)</div>
                <div className="text-lg font-bold text-green-700">{formatCurrency(stockData.summary.totalStockValue)}</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="text-xs text-emerald-600">Stock Value (MRP)</div>
                <div className="text-lg font-bold text-emerald-700">{formatCurrency(stockData.summary.totalMRPValue)}</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 cursor-pointer hover:bg-orange-100" onClick={() => setStockFilter('low')}>
                <div className="text-xs text-orange-600">Low Stock</div>
                <div className="text-2xl font-bold text-orange-700">{stockData.summary.lowStockCount}</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 cursor-pointer hover:bg-red-100" onClick={() => setStockFilter('expiring')}>
                <div className="text-xs text-red-600">Expiring Soon</div>
                <div className="text-2xl font-bold text-red-700">{stockData.summary.expiringSoonCount}</div>
              </div>
            </div>

            {/* Stock Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 text-xs font-semibold flex justify-between">
                <span>Stock Details ({stockData.items.length})</span>
                <span className="text-gray-500">
                  {stockFilter !== 'all' && `Showing: ${stockFilter}`}
                </span>
              </div>
              <div className="max-h-[500px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">Product</th>
                      <th className="p-2 text-left">Manufacturer</th>
                      <th className="p-2 text-center">Rack</th>
                      <th className="p-2 text-right">Stock</th>
                      <th className="p-2 text-right">Cost Value</th>
                      <th className="p-2 text-right">MRP Value</th>
                      <th className="p-2 text-center">Batches</th>
                      <th className="p-2 text-center">Earliest Expiry</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockData.items.map((item: any, i: number) => (
                      <tr key={item.id} className={`border-t hover:bg-gray-50 ${item.isExpired ? 'bg-red-50' : item.isExpiringSoon ? 'bg-orange-50' : ''}`}>
                        <td className="p-2 text-gray-500">{i + 1}</td>
                        <td className="p-2 font-medium">{item.name}</td>
                        <td className="p-2">{item.manufacturer}</td>
                        <td className="p-2 text-center">
                          {item.rackLocation !== '-' && (
                            <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                              {item.rackLocation}
                            </span>
                          )}
                        </td>
                        <td className={`p-2 text-right font-semibold ${item.isOutOfStock ? 'text-red-600' : item.isLowStock ? 'text-orange-600' : 'text-green-600'}`}>
                          {item.totalStock}
                        </td>
                        <td className="p-2 text-right">{formatCurrency(item.stockValue)}</td>
                        <td className="p-2 text-right">{formatCurrency(item.mrpValue)}</td>
                        <td className="p-2 text-center">{item.batchCount}</td>
                        <td className="p-2 text-center">
                          {item.earliestExpiry ? formatDate(item.earliestExpiry) : '-'}
                        </td>
                        <td className="p-2 text-center">
                          {item.isExpired && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px]">EXPIRED</span>}
                          {item.isExpiringSoon && !item.isExpired && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px]">EXPIRING</span>}
                          {item.isOutOfStock && <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px]">OUT</span>}
                          {item.isLowStock && !item.isOutOfStock && <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[10px]">LOW</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* GST REPORT */}
        {activeTab === 'gst' && gstData && !loading && (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-lg font-bold">GST Summary</h2>
              <p className="text-sm text-gray-500">
                {formatDate(gstData.period.from)} to {formatDate(gstData.period.to)}
              </p>
            </div>

            {/* GST Summary Cards */}
            <div className="grid grid-cols-3 gap-6 mb-6">
              {/* Output GST */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-green-600 text-white px-4 py-2 text-sm font-semibold">
                  Output GST (On Sales)
                </div>
                <div className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Taxable Amount:</span>
                    <span className="font-semibold">{formatCurrency(gstData.outputGST.taxableAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CGST:</span>
                    <span>{formatCurrency(gstData.outputGST.cgst)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST:</span>
                    <span>{formatCurrency(gstData.outputGST.sgst)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span>Total GST:</span>
                    <span className="text-green-600">{formatCurrency(gstData.outputGST.total)}</span>
                  </div>
                </div>
              </div>

              {/* Input GST */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold">
                  Input GST (On Purchases)
                </div>
                <div className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Taxable Amount:</span>
                    <span className="font-semibold">{formatCurrency(gstData.inputGST.taxableAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CGST:</span>
                    <span>{formatCurrency(gstData.inputGST.cgst)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST:</span>
                    <span>{formatCurrency(gstData.inputGST.sgst)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span>Total GST:</span>
                    <span className="text-blue-600">{formatCurrency(gstData.inputGST.total)}</span>
                  </div>
                </div>
              </div>

              {/* Net GST Payable */}
              <div className="border rounded-lg overflow-hidden">
                <div className={`${gstData.netGST.total >= 0 ? 'bg-red-600' : 'bg-green-600'} text-white px-4 py-2 text-sm font-semibold`}>
                  Net GST {gstData.netGST.total >= 0 ? 'Payable' : 'Refundable'}
                </div>
                <div className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>CGST:</span>
                    <span>{formatCurrency(Math.abs(gstData.netGST.cgst))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST:</span>
                    <span>{formatCurrency(Math.abs(gstData.netGST.sgst))}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold text-lg">
                    <span>Total:</span>
                    <span className={gstData.netGST.total >= 0 ? 'text-red-600' : 'text-green-600'}>
                      {formatCurrency(Math.abs(gstData.netGST.total))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sales Transactions */}
            <div className="border rounded-lg overflow-hidden mb-6">
              <div className="bg-gray-100 px-4 py-2 text-xs font-semibold">
                Sales Transactions ({gstData.sales.length})
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Invoice#</th>
                      <th className="p-2 text-left">Customer</th>
                      <th className="p-2 text-left">GSTIN</th>
                      <th className="p-2 text-right">Taxable</th>
                      <th className="p-2 text-right">CGST</th>
                      <th className="p-2 text-right">SGST</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstData.sales.map((s: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{formatDate(s.date)}</td>
                        <td className="p-2 font-semibold">#{s.invoiceNo}</td>
                        <td className="p-2">{s.customer}</td>
                        <td className="p-2 font-mono text-[10px]">{s.gstin}</td>
                        <td className="p-2 text-right">{formatCurrency(s.taxable)}</td>
                        <td className="p-2 text-right">{formatCurrency(s.cgst)}</td>
                        <td className="p-2 text-right">{formatCurrency(s.sgst)}</td>
                        <td className="p-2 text-right font-semibold">{formatCurrency(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Purchase Transactions */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 text-xs font-semibold">
                Purchase Transactions ({gstData.purchases.length})
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Bill No</th>
                      <th className="p-2 text-left">Supplier</th>
                      <th className="p-2 text-left">GSTIN</th>
                      <th className="p-2 text-right">Taxable</th>
                      <th className="p-2 text-right">CGST</th>
                      <th className="p-2 text-right">SGST</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstData.purchases.map((p: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{formatDate(p.date)}</td>
                        <td className="p-2 font-semibold">{p.billNo}</td>
                        <td className="p-2">{p.supplier}</td>
                        <td className="p-2 font-mono text-[10px]">{p.gstin}</td>
                        <td className="p-2 text-right">{formatCurrency(p.taxable)}</td>
                        <td className="p-2 text-right">{formatCurrency(p.cgst)}</td>
                        <td className="p-2 text-right">{formatCurrency(p.sgst)}</td>
                        <td className="p-2 text-right font-semibold">{formatCurrency(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
