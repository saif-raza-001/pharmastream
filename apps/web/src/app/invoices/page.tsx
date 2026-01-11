"use client";

import { useState, useEffect, useRef } from 'react';
import { invoicesAPI, accountsAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from "sonner";
import InvoicePrint from '@/components/InvoicePrint';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function InvoicesPage() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalInvoices: 0, totalAmount: 0, totalPaid: 0, totalDue: 0 });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, totalCount: 0, totalPages: 0 });
  const [customers, setCustomers] = useState<any[]>([]);
  
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fromDate, toDate, statusFilter, customerFilter, pagination.page]);

  const fetchCustomers = async () => {
    try {
      const res = await accountsAPI.getAll('CUSTOMER');
      setCustomers(res.data);
    } catch (err) {}
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params: any = {
        from: fromDate,
        to: toDate,
        page: pagination.page,
        pageSize: pagination.pageSize
      };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (customerFilter) params.customerId = customerFilter;
      if (searchQuery) params.search = searchQuery;
      
      const res = await invoicesAPI.getAll(params);
      setInvoices(res.data.invoices || res.data);
      if (res.data.stats) setStats(res.data.stats);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination({ ...pagination, page: 1 });
    fetchInvoices();
  };

  const handleViewInvoice = async (invoice: any) => {
    try {
      const res = await invoicesAPI.getById(invoice.id);
      setSelectedInvoice(res.data);
      setShowViewModal(true);
    } catch (err) {
      toast.error('Failed to load invoice');
    }
  };

  const handleOpenPayment = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(Number(invoice.dueAmount));
    setPaymentMode('CASH');
    setPaymentRef('');
    setShowPaymentModal(true);
  };

  const handleReceivePayment = async () => {
    if (!selectedInvoice || paymentAmount <= 0) {
      toast.error('Enter valid amount');
      return;
    }
    try {
      await invoicesAPI.receivePayment(selectedInvoice.id, {
        amount: paymentAmount,
        mode: paymentMode,
        reference: paymentRef
      });
      toast.success(`Payment of ₹${paymentAmount} received`);
      setShowPaymentModal(false);
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to process payment');
    }
  };

  const handleOpenDelete = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowDeleteModal(true);
  };

  const handleDeleteInvoice = async () => {
    if (!selectedInvoice) return;
    setIsDeleting(true);
    try {
      await invoicesAPI.delete(selectedInvoice.id);
      toast.success(`Invoice #${selectedInvoice.invoiceNo} deleted. Stock restored.`);
      setShowDeleteModal(false);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete invoice');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrintInvoice = async (invoice: any) => {
    try {
      const res = await invoicesAPI.getById(invoice.id);
      const fullInvoice = res.data;
      setSelectedInvoice({
        ...fullInvoice,
        totals: {
          grossAmount: Number(fullInvoice.grossAmount),
          totalDiscount: Number(fullInvoice.totalDiscount),
          taxableAmount: Number(fullInvoice.taxableAmount),
          gstAmount: Number(fullInvoice.cgstAmount) + Number(fullInvoice.sgstAmount),
          grandTotal: Number(fullInvoice.grandTotal)
        },
        items: fullInvoice.items.map((item: any) => ({
          productName: item.product.name,
          batchNo: item.batch.batchNo,
          expiry: new Date(item.batch.expiryDate).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' }),
          quantity: item.quantity,
          freeQuantity: item.freeQuantity,
          unitRate: Number(item.unitRate),
          discountPct: Number(item.discountPct),
          gstPct: Number(item.gstPct),
          amount: Number(item.totalAmount),
          mrp: Number(item.batch.mrp)
        }))
      });
      setShowPrintModal(true);
    } catch (err) {
      toast.error('Failed to load invoice');
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>Invoice #${selectedInvoice.invoiceNo}</title>
      <style>@page{size:auto;margin:5mm}body{font-family:Arial,sans-serif;margin:0;padding:0}</style>
      </head><body>${printRef.current.innerHTML}
      <script>window.onload=function(){setTimeout(function(){window.print()},500)}</script></body></html>
    `);
    printWindow.document.close();
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-IN');
  const formatCurrency = (amount: number) => `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col h-screen">
      <header className="h-11 bg-purple-700 flex items-center justify-between px-4 shrink-0">
        <h1 className="text-white font-semibold text-sm">📋 Invoice History</h1>
        <a href="/" className="text-white text-xs hover:underline">← Back to Billing</a>
      </header>

      <div className="bg-gray-50 px-4 py-3 border-b grid grid-cols-4 gap-4 shrink-0">
        <div className="bg-white px-4 py-2 rounded border">
          <div className="text-[10px] text-gray-500 uppercase">Total Invoices</div>
          <div className="text-lg font-bold text-gray-800">{stats.totalInvoices}</div>
        </div>
        <div className="bg-white px-4 py-2 rounded border">
          <div className="text-[10px] text-gray-500 uppercase">Total Amount</div>
          <div className="text-lg font-bold text-purple-600">{formatCurrency(stats.totalAmount)}</div>
        </div>
        <div className="bg-white px-4 py-2 rounded border">
          <div className="text-[10px] text-gray-500 uppercase">Collected</div>
          <div className="text-lg font-bold text-green-600">{formatCurrency(stats.totalPaid)}</div>
        </div>
        <div className="bg-white px-4 py-2 rounded border">
          <div className="text-[10px] text-gray-500 uppercase">Pending</div>
          <div className="text-lg font-bold text-orange-600">{formatCurrency(stats.totalDue)}</div>
        </div>
      </div>

      <div className="bg-white px-4 py-3 border-b shrink-0">
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="text-[10px] text-gray-500 uppercase">From</label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 text-xs w-36" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase">To</label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-8 text-xs w-36" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-8 text-xs border rounded px-2 w-28">
              <option value="ALL">All</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Customer</label>
            <select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} className="h-8 text-xs border rounded px-2 w-40">
              <option value="">All</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Invoice #</label>
            <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="h-8 text-xs w-28" />
          </div>
          <Button size="sm" onClick={handleSearch} className="h-8 bg-purple-600">🔍 Search</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="border-b">
              <th className="py-2 px-3 text-left font-semibold">Invoice #</th>
              <th className="py-2 px-3 text-left font-semibold">Date</th>
              <th className="py-2 px-3 text-left font-semibold">Customer</th>
              <th className="py-2 px-3 text-center font-semibold">Type</th>
              <th className="py-2 px-3 text-center font-semibold">Items</th>
              <th className="py-2 px-3 text-right font-semibold">Amount</th>
              <th className="py-2 px-3 text-right font-semibold">Paid</th>
              <th className="py-2 px-3 text-right font-semibold">Due</th>
              <th className="py-2 px-3 text-center font-semibold">Status</th>
              <th className="py-2 px-3 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-center py-10 text-gray-400">Loading...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10 text-gray-400">No invoices found</td></tr>
            ) : invoices.map((inv) => (
              <tr key={inv.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-3 font-semibold text-purple-600">#{inv.invoiceNo}</td>
                <td className="py-2 px-3">{formatDate(inv.invoiceDate)}</td>
                <td className="py-2 px-3">{inv.customer?.name || 'Walk-in'}</td>
                <td className="py-2 px-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] ${inv.invoiceType === 'CASH' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {inv.invoiceType}
                  </span>
                </td>
                <td className="py-2 px-3 text-center">{inv.items?.length || 0}</td>
                <td className="py-2 px-3 text-right font-semibold">{formatCurrency(inv.grandTotal)}</td>
                <td className="py-2 px-3 text-right text-green-600">{formatCurrency(inv.paidAmount)}</td>
                <td className="py-2 px-3 text-right text-orange-600">{Number(inv.dueAmount) > 0 ? formatCurrency(inv.dueAmount) : '-'}</td>
                <td className="py-2 px-3 text-center">
                  {Number(inv.dueAmount) > 0 ? (
                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px]">PENDING</span>
                  ) : (
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px]">PAID</span>
                  )}
                </td>
                <td className="py-2 px-3 text-center">
                  <button onClick={() => handleViewInvoice(inv)} className="text-blue-600 mx-1 hover:bg-blue-50 p-1 rounded" title="View">👁️</button>
                  <button onClick={() => handlePrintInvoice(inv)} className="text-gray-600 mx-1 hover:bg-gray-100 p-1 rounded" title="Print">🖨️</button>
                  {Number(inv.dueAmount) > 0 && (
                    <button onClick={() => handleOpenPayment(inv)} className="text-green-600 mx-1 hover:bg-green-50 p-1 rounded" title="Payment">💰</button>
                  )}
                  <button onClick={() => handleOpenDelete(inv)} className="text-red-500 mx-1 hover:bg-red-50 p-1 rounded" title="Delete">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="bg-gray-50 px-4 py-2 border-t flex justify-between items-center shrink-0">
          <span className="text-xs text-gray-500">Page {pagination.page} of {pagination.totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={pagination.page <= 1} onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}>← Prev</Button>
            <Button size="sm" variant="outline" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}>Next →</Button>
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="bg-white max-w-2xl p-0 gap-0 max-h-[80vh] overflow-y-auto">
          <DialogHeader className="bg-purple-600 text-white px-4 py-3 sticky top-0">
            <DialogTitle className="text-sm">Invoice #{selectedInvoice?.invoiceNo}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="p-4">
              <div className="grid grid-cols-3 gap-4 mb-4 text-xs">
                <div><span className="text-gray-500">Customer:</span> <b>{selectedInvoice.customer?.name}</b></div>
                <div><span className="text-gray-500">Date:</span> {formatDate(selectedInvoice.invoiceDate)}</div>
                <div><span className="text-gray-500">Type:</span> {selectedInvoice.invoiceType}</div>
              </div>
              <table className="w-full text-xs border mb-4">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left border">#</th>
                    <th className="p-2 text-left border">Product</th>
                    <th className="p-2 text-center border">Qty</th>
                    <th className="p-2 text-right border">Rate</th>
                    <th className="p-2 text-right border">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items?.map((item: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2 border">{i + 1}</td>
                      <td className="p-2 border">{item.product?.name}</td>
                      <td className="p-2 text-center border">{item.quantity}</td>
                      <td className="p-2 text-right border">{formatCurrency(item.unitRate)}</td>
                      <td className="p-2 text-right border">{formatCurrency(item.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-xs space-y-1">
                <div className="flex justify-between"><span>Total:</span><b>{formatCurrency(selectedInvoice.grandTotal)}</b></div>
                <div className="flex justify-between"><span>Paid:</span><span className="text-green-600">{formatCurrency(selectedInvoice.paidAmount)}</span></div>
                <div className="flex justify-between"><span>Due:</span><span className="text-orange-600">{formatCurrency(selectedInvoice.dueAmount)}</span></div>
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <Button variant="outline" size="sm" onClick={() => setShowViewModal(false)}>Close</Button>
                {Number(selectedInvoice.dueAmount) > 0 && (
                  <Button size="sm" onClick={() => { setShowViewModal(false); handleOpenPayment(selectedInvoice); }} className="bg-green-600">💰 Payment</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => { setShowViewModal(false); handleOpenDelete(selectedInvoice); }} className="text-red-600 border-red-300 hover:bg-red-50">🗑️ Delete</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="bg-white max-w-md p-0 gap-0">
          <DialogHeader className="bg-green-600 text-white px-4 py-3">
            <DialogTitle className="text-sm">Receive Payment - Invoice #{selectedInvoice?.invoiceNo}</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <div className="bg-orange-50 p-4 rounded-lg text-center">
              <div className="text-sm text-orange-600">Due Amount</div>
              <div className="text-3xl font-bold text-orange-700">{formatCurrency(selectedInvoice?.dueAmount || 0)}</div>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase mb-1 block">Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {['CASH', 'UPI', 'CARD'].map(mode => (
                  <button key={mode} onClick={() => setPaymentMode(mode)} className={`py-2 px-3 rounded text-xs font-semibold border ${paymentMode === mode ? 'bg-green-600 text-white' : 'bg-white'}`}>{mode}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase mb-1 block">Amount</label>
              <Input type="number" value={paymentAmount || ''} onChange={e => setPaymentAmount(Number(e.target.value))} className="h-12 text-xl font-bold text-center" />
            </div>
            {paymentMode !== 'CASH' && (
              <div>
                <label className="text-xs text-gray-500 uppercase mb-1 block">Reference</label>
                <Input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} className="h-8 text-xs" />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
              <Button onClick={handleReceivePayment} className="flex-1 bg-green-600">Receive ₹{paymentAmount}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="bg-white max-w-md p-0 gap-0">
          <DialogHeader className="bg-red-600 text-white px-4 py-3">
            <DialogTitle className="text-sm">⚠️ Delete Invoice</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-center">
              <div className="text-lg font-bold text-red-700">Invoice #{selectedInvoice?.invoiceNo}</div>
              <div className="text-sm text-red-600 mt-1">{selectedInvoice?.customer?.name}</div>
              <div className="text-2xl font-bold text-red-700 mt-2">{formatCurrency(selectedInvoice?.grandTotal || 0)}</div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
              <p className="text-xs text-yellow-800">
                <b>⚠️ Warning:</b> This will permanently delete the invoice and:
              </p>
              <ul className="text-xs text-yellow-700 mt-2 space-y-1 list-disc list-inside">
                <li>Restore all sold items back to inventory</li>
                <li>Remove all payment records for this invoice</li>
                <li>Update customer balance accordingly</li>
              </ul>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>Cancel</Button>
              <Button onClick={handleDeleteInvoice} disabled={isDeleting} className="flex-1 bg-red-600 hover:bg-red-700">
                {isDeleting ? 'Deleting...' : '🗑️ Delete Invoice'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Modal */}
      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="bg-white max-w-5xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="bg-purple-600 text-white px-4 py-3 sticky top-0">
            <DialogTitle className="text-sm">Print Invoice #{selectedInvoice?.invoiceNo}</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <div ref={printRef}>
              {selectedInvoice && <InvoicePrint invoice={selectedInvoice} customer={selectedInvoice.customer} items={selectedInvoice.items} />}
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowPrintModal(false)}>Close</Button>
              <Button size="sm" onClick={handlePrint} className="bg-purple-600">🖨️ Print</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
