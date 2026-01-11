"use client";

import { useState, useEffect, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useBillingStore } from '@/lib/store';
import { productsAPI, accountsAPI, invoicesAPI } from '@/lib/api';
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

export default function BillingPage() {
  const { customer, items, invoiceType, setCustomer, addItem, removeItem, clearBill, getTotals } = useBillingStore();
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  
  // Recent invoices
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [selectedViewInvoice, setSelectedViewInvoice] = useState<any>(null);
  const [showViewInvoiceModal, setShowViewInvoiceModal] = useState(false);

  // Payment form
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  const [useAdvance, setUseAdvance] = useState(false);
  const [advanceToUse, setAdvanceToUse] = useState(0);

  // New Customer Form
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    mobile: '',
    city: '',
    address: '',
    gstin: '',
    creditLimit: 0
  });

  const customerInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const newCustomerNameRef = useRef<HTMLInputElement>(null);
  const paymentInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const totals = getTotals();

  useHotkeys('f2', () => productInputRef.current?.focus(), { preventDefault: true });
  useHotkeys('f3', () => customerInputRef.current?.focus(), { preventDefault: true });
  useHotkeys('f10', () => handleInitiateSave(), { preventDefault: true });
  useHotkeys('ctrl+p', () => savedInvoice && handlePrint(), { preventDefault: true });
  useHotkeys('escape', () => { 
    setShowBatchModal(false); 
    setShowProductSearch(false); 
    setShowCustomerSearch(false);
    setShowAddCustomerModal(false);
    setShowPaymentModal(false);
    setShowPrintModal(false);
    setShowViewInvoiceModal(false);
  });

  useEffect(() => {
    fetchRecentInvoices();
  }, []);

  useEffect(() => {
    if (customerSearch.length > 0) {
      accountsAPI.getAll('CUSTOMER', customerSearch).then(res => {
        setCustomerResults(res.data);
      }).catch(() => setCustomerResults([]));
    } else {
      setCustomerResults([]);
    }
  }, [customerSearch]);

  useEffect(() => {
    if (productSearch.length > 0) {
      productsAPI.getAll({ search: productSearch }).then(res => {
        const allProducts = res.data.products || res.data || [];
        setProductResults(allProducts);
      }).catch(() => setProductResults([]));
    } else {
      setProductResults([]);
    }
  }, [productSearch]);

  useEffect(() => {
    if (showBatchModal && quantityInputRef.current) {
      setTimeout(() => quantityInputRef.current?.focus(), 100);
    }
  }, [showBatchModal]);

  useEffect(() => {
    if (showAddCustomerModal && newCustomerNameRef.current) {
      setTimeout(() => newCustomerNameRef.current?.focus(), 100);
    }
  }, [showAddCustomerModal]);

  useEffect(() => {
    if (showPaymentModal && paymentInputRef.current) {
      setTimeout(() => paymentInputRef.current?.focus(), 100);
    }
  }, [showPaymentModal]);

  const fetchRecentInvoices = async () => {
    try {
      const res = await invoicesAPI.getRecent();
      setRecentInvoices(res.data);
    } catch (err) {
      console.error('Failed to fetch recent invoices');
    }
  };

  const handleSelectCustomer = (cust: any) => {
    setCustomer({ id: cust.id, name: cust.name, currentBalance: Number(cust.currentBalance || 0) });
    setShowCustomerSearch(false);
    setCustomerSearch('');
    productInputRef.current?.focus();
  };

  const handleAddNewCustomer = () => {
    setNewCustomerForm({ ...newCustomerForm, name: customerSearch });
    setShowAddCustomerModal(true);
    setShowCustomerSearch(false);
  };

  const handleSaveNewCustomer = async () => {
    if (!newCustomerForm.name) {
      toast.error("Customer name required");
      return;
    }
    try {
      const res = await accountsAPI.create({
        accountType: 'CUSTOMER',
        name: newCustomerForm.name,
        mobile: newCustomerForm.mobile || null,
        city: newCustomerForm.city || 'Local',
        address: newCustomerForm.address || null,
        gstin: newCustomerForm.gstin || null,
        creditLimit: newCustomerForm.creditLimit || 0,
        openingBalance: 0
      });
      handleSelectCustomer(res.data);
      setNewCustomerForm({ name: '', mobile: '', city: '', address: '', gstin: '', creditLimit: 0 });
      setShowAddCustomerModal(false);
      toast.success(`Customer "${res.data.name}" added`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add customer");
    }
  };

  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
    setShowProductSearch(false);
    setProductSearch('');
    if (product.batches && product.batches.length > 0) {
      const availableBatches = product.batches.filter((b: any) => b.currentStock > 0);
      if (availableBatches.length > 0) {
        setSelectedProduct({ ...product, batches: availableBatches });
        setShowBatchModal(true);
      } else {
        toast.error("No stock available");
      }
    } else {
      toast.error("No batches available");
    }
  };

  const handleSelectBatch = (batch: any) => {
    if (quantity <= 0) { toast.error("Enter quantity"); return; }
    if (batch.currentStock < quantity) { toast.error(`Only ${batch.currentStock} available`); return; }
    
    // Use product's actual GST rate or default to 12%
    const gstRate = Number(selectedProduct.gstRate) || 12;
    
    addItem({
      id: `${Date.now()}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      batchId: batch.id,
      batchNo: batch.batchNo,
      expiry: new Date(batch.expiryDate).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' }),
      quantity,
      freeQuantity: 0,
      unitRate: Number(batch.saleRate),
      discountPct: discount,
      gstPct: gstRate, // Dynamic GST from product
      amount: quantity * Number(batch.saleRate) * (1 - discount / 100),
      mrp: Number(batch.mrp)
    });
    
    setShowBatchModal(false);
    setSelectedProduct(null);
    setQuantity(1);
    setDiscount(0);
    toast.success(`Added (GST: ${gstRate}%)`);
    setTimeout(() => productInputRef.current?.focus(), 50);
  };

  // Calculate customer balance info
  const customerBalance = customer?.currentBalance || 0;
  const hasAdvance = customerBalance < 0;
  const advanceAvailable = hasAdvance ? Math.abs(customerBalance) : 0;
  const hasDue = customerBalance > 0;

  const handleInitiateSave = () => {
    if (!customer) { toast.error("Select customer (F3)"); return; }
    if (items.length === 0) { toast.error("Add items (F2)"); return; }
    
    // Reset payment form
    setUseAdvance(false);
    setAdvanceToUse(0);
    
    // Set default payment amount based on invoice type
    if (invoiceType === 'CASH') {
      setPaymentAmount(totals.grandTotal);
    } else {
      setPaymentAmount(0);
    }
    setPaymentMode('CASH');
    setPaymentRef('');
    setShowPaymentModal(true);
  };

  // Calculate amounts for payment modal
  const effectiveAdvance = useAdvance ? Math.min(advanceToUse, advanceAvailable, totals.grandTotal) : 0;
  const remainingToPay = totals.grandTotal - effectiveAdvance;
  const dueAfterPayment = remainingToPay - paymentAmount;

  const handleSaveBill = async () => {
    if (!customer) { toast.error("Select customer"); return; }
    if (isSaving) return;
    setIsSaving(true);
    
    try {
      const res = await invoicesAPI.create({ 
        customerId: customer.id, 
        invoiceType, 
        items, 
        totals,
        payment: {
          amount: paymentAmount,
          advanceUsed: effectiveAdvance,
          mode: paymentMode,
          reference: paymentRef
        }
      });
      
      const customerRes = await accountsAPI.getById(customer.id);
      
      setSavedInvoice({
        ...res.data,
        totals,
        items: [...items],
        customer: customerRes.data,
        payment: { 
          amount: paymentAmount, 
          advanceUsed: effectiveAdvance,
          mode: paymentMode, 
          reference: paymentRef 
        }
      });
      
      let successMsg = `Invoice #${res.data.invoiceNo} saved!`;
      if (effectiveAdvance > 0) {
        successMsg += ` Advance used: ₹${effectiveAdvance}`;
      }
      if (paymentAmount > 0) {
        successMsg += ` Received: ₹${paymentAmount}`;
      }
      if (dueAfterPayment > 0) {
        successMsg += ` Due: ₹${dueAfterPayment.toFixed(2)}`;
      }
      toast.success(successMsg);
      
      setShowPaymentModal(false);
      setShowPrintModal(true);
      clearBill();
      setCustomerSearch('');
      fetchRecentInvoices();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error saving invoice");
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewInvoice = async (invoice: any) => {
    try {
      const res = await invoicesAPI.getById(invoice.id);
      setSelectedViewInvoice(res.data);
      setShowViewInvoiceModal(true);
    } catch (err) {
      toast.error("Failed to load invoice");
    }
  };

  const handleReprintInvoice = () => {
    if (!selectedViewInvoice) return;
    
    const invoiceForPrint = {
      ...selectedViewInvoice,
      totals: {
        grossAmount: Number(selectedViewInvoice.grossAmount),
        totalDiscount: Number(selectedViewInvoice.totalDiscount),
        taxableAmount: Number(selectedViewInvoice.taxableAmount),
        gstAmount: Number(selectedViewInvoice.cgstAmount) + Number(selectedViewInvoice.sgstAmount),
        grandTotal: Number(selectedViewInvoice.grandTotal)
      },
      items: selectedViewInvoice.items.map((item: any) => ({
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
    };
    
    setSavedInvoice(invoiceForPrint);
    setShowViewInvoiceModal(false);
    setShowPrintModal(true);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice #${savedInvoice.invoiceNo}</title>
        <style>
          @page { size: auto; margin: 5mm; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
        <script>
          window.onload = function() { setTimeout(function() { window.print(); }, 500); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleNewBill = () => {
    setShowPrintModal(false);
    setSavedInvoice(null);
    customerInputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar */}
      <header className="h-11 bg-emerald-700 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-6">
          <h1 className="text-white font-semibold text-sm">Sales Invoice</h1>
          <div className="flex gap-1 text-[10px]">
            <kbd className="bg-emerald-600 text-emerald-100 px-1.5 py-0.5 rounded">F2</kbd>
            <span className="text-emerald-200">Product</span>
            <kbd className="bg-emerald-600 text-emerald-100 px-1.5 py-0.5 rounded ml-2">F3</kbd>
            <span className="text-emerald-200">Customer</span>
            <kbd className="bg-emerald-600 text-emerald-100 px-1.5 py-0.5 rounded ml-2">F10</kbd>
            <span className="text-emerald-200">Save</span>
          </div>
        </div>
        <Button 
          onClick={handleInitiateSave} 
          disabled={isSaving}
          size="sm"
          className="h-7 bg-white text-emerald-700 hover:bg-emerald-50 text-xs font-semibold"
        >
          {isSaving ? 'Saving...' : 'Save Invoice (F10)'}
        </Button>
      </header>

      {/* Invoice Header */}
      <div className="bg-white border-b px-4 py-2 shrink-0">
        <div className="grid grid-cols-5 gap-3">
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Invoice No</label>
            <div className="h-8 bg-gray-100 rounded flex items-center px-2 text-xs font-medium text-gray-600">AUTO</div>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Date</label>
            <div className="h-8 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-600">
              {new Date().toLocaleDateString('en-IN')}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Type</label>
            <select 
              className="h-8 w-full border rounded px-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
              value={invoiceType}
              onChange={(e) => useBillingStore.getState().setInvoiceType(e.target.value as any)}
            >
              <option value="CASH">Cash</option>
              <option value="CREDIT">Credit</option>
            </select>
          </div>
          <div className="col-span-2 relative">
            <label className="text-[10px] text-gray-500 uppercase">Customer (F3)</label>
            <Input 
              ref={customerInputRef}
              placeholder="Search or type new..."
              value={customer ? customer.name : customerSearch}
              onChange={(e) => { 
                if (customer) setCustomer(null);
                setCustomerSearch(e.target.value); 
                setShowCustomerSearch(true); 
              }}
              onFocus={() => customerSearch && setShowCustomerSearch(true)}
              className="h-8 text-xs"
            />
            {showCustomerSearch && (
              <div className="absolute z-50 w-full bg-white border shadow-lg mt-1 rounded max-h-64 overflow-y-auto">
                {customerSearch.length > 0 && (
                  <div className="px-3 py-3 bg-emerald-50 hover:bg-emerald-100 cursor-pointer border-b-2 border-emerald-200" onClick={handleAddNewCustomer}>
                    <span className="text-emerald-700">➕ Add "{customerSearch}"</span>
                  </div>
                )}
                {customerResults.map((c) => (
                  <div key={c.id} className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-xs border-b" onClick={() => handleSelectCustomer(c)}>
                    <div className="font-medium">{c.name}</div>
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>{c.city || 'Local'}</span>
                      {Number(c.currentBalance) > 0 && <span className="text-orange-600 font-semibold">Due: ₹{Number(c.currentBalance).toFixed(0)}</span>}
                      {Number(c.currentBalance) < 0 && <span className="text-green-600 font-semibold">Advance: ₹{Math.abs(Number(c.currentBalance)).toFixed(0)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Customer Balance Badge */}
            {customer && (
              <div className={`absolute right-0 top-0 text-[10px] px-1.5 py-0.5 rounded ${
                hasDue ? 'bg-orange-100 text-orange-700' : 
                hasAdvance ? 'bg-green-100 text-green-700' : 
                'bg-gray-100 text-gray-600'
              }`}>
                {hasDue && `Due: ₹${customerBalance.toFixed(0)}`}
                {hasAdvance && `Advance: ₹${advanceAvailable.toFixed(0)}`}
                {!hasDue && !hasAdvance && 'Balance: ₹0'}
              </div>
            )}
          </div>
        </div>
        
        {/* Advance Available Banner */}
        {customer && hasAdvance && (
          <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-600">💰</span>
              <span className="text-sm text-green-700">
                Advance Available: <b>₹{advanceAvailable.toFixed(2)}</b>
              </span>
            </div>
            <span className="text-xs text-green-600">Will be shown in payment</span>
          </div>
        )}
      </div>

      {/* Product Search */}
      <div className="bg-gray-100 px-4 py-2 border-b shrink-0">
        <div className="relative">
          <Input 
            ref={productInputRef}
            placeholder="🔍 Search product by name, salt, or barcode... (F2)"
            value={productSearch}
            onChange={(e) => { setProductSearch(e.target.value); setShowProductSearch(true); }}
            className="h-8 text-xs bg-white"
          />
          {showProductSearch && productResults.length > 0 && (
            <div className="absolute z-50 w-full bg-white border shadow-lg mt-1 rounded max-h-72 overflow-y-auto">
              {productResults.map((p) => {
                const totalStock = p.batches?.reduce((sum: number, b: any) => sum + b.currentStock, 0) || 0;
                const gstRate = p.gstRate || 12;
                return (
                  <div key={p.id} className={`px-3 py-2 cursor-pointer text-xs border-b ${totalStock > 0 ? 'hover:bg-emerald-50' : 'bg-gray-50 opacity-75'}`} onClick={() => totalStock > 0 ? handleSelectProduct(p) : toast.error("No stock")}>
                    <div className="flex justify-between">
                      <div>
                        <span className="font-medium">{p.name}</span>
                        {p.rackLocation && <span className="ml-2 text-[10px] bg-blue-100 px-1 rounded">🗂️ {p.rackLocation}</span>}
                      </div>
                      <span className={totalStock > 0 ? 'text-emerald-600' : 'text-red-500'}>{totalStock} pcs</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                      <span>{p.saltComposition || 'No composition'} • {p.packingInfo || 'No packing'}</span>
                      <span className="bg-purple-100 text-purple-700 px-1 rounded font-semibold">GST: {gstRate}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="flex-1 overflow-auto bg-white" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="border-b">
              <th className="w-10 py-2 px-2 text-left">#</th>
              <th className="py-2 px-2 text-left">Product</th>
              <th className="w-20 py-2 px-2">Batch</th>
              <th className="w-14 py-2 px-2 text-center">Qty</th>
              <th className="w-20 py-2 px-2 text-right">Rate</th>
              <th className="w-14 py-2 px-2 text-center">Disc%</th>
              <th className="w-14 py-2 px-2 text-center">GST%</th>
              <th className="w-20 py-2 px-2 text-right">Amount</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400">Press F2 to add products</td></tr>
            ) : (
              items.map((item, i) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="py-1.5 px-2 text-gray-500">{i + 1}</td>
                  <td className="py-1.5 px-2 font-medium">{item.productName}</td>
                  <td className="py-1.5 px-2 text-center">{item.batchNo}</td>
                  <td className="py-1.5 px-2 text-center font-semibold">{item.quantity}</td>
                  <td className="py-1.5 px-2 text-right">₹{item.unitRate.toFixed(2)}</td>
                  <td className="py-1.5 px-2 text-center text-orange-600">{item.discountPct}%</td>
                  <td className="py-1.5 px-2 text-center text-purple-600 font-semibold">{item.gstPct}%</td>
                  <td className="py-1.5 px-2 text-right font-bold">₹{item.amount.toFixed(2)}</td>
                  <td className="py-1.5 px-2"><button onClick={() => removeItem(i)} className="text-red-400">✕</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Summary */}
      <div className="bg-white border-t px-4 py-2 shrink-0">
        <div className="flex justify-between items-center">
          <div className="flex gap-4 text-xs">
            <span>Items: <b>{items.length}</b></span>
            <span>Qty: <b>{items.reduce((s, i) => s + i.quantity, 0)}</b></span>
            <span>Gross: <b>₹{totals.grossAmount.toFixed(2)}</b></span>
            <span className="text-orange-600">Disc: ₹{totals.totalDiscount.toFixed(2)}</span>
            <span className="text-blue-600">GST: ₹{totals.gstAmount.toFixed(2)}</span>
          </div>
          <div className="bg-emerald-600 text-white px-6 py-2 rounded">
            <span className="text-emerald-200 text-xs mr-2">Total:</span>
            <span className="text-xl font-bold">₹{totals.grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="bg-gray-50 border-t px-4 py-2 shrink-0 max-h-28 overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-500 uppercase font-semibold">Recent Invoices</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {recentInvoices.slice(0, 10).map((inv) => (
            <div 
              key={inv.id} 
              onClick={() => handleViewInvoice(inv)}
              className="bg-white border rounded px-3 py-1.5 cursor-pointer hover:border-emerald-500 text-xs min-w-[140px] shrink-0"
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold">#{inv.invoiceNo}</span>
                <span className={`text-[10px] px-1 rounded ${Number(inv.dueAmount) > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                  {Number(inv.dueAmount) > 0 ? 'DUE' : 'PAID'}
                </span>
              </div>
              <div className="text-[10px] text-gray-500">{inv.customer?.name}</div>
              <div className="font-semibold">₹{Number(inv.grandTotal).toFixed(0)}</div>
            </div>
          ))}
          {recentInvoices.length === 0 && <span className="text-xs text-gray-400">No recent invoices</span>}
        </div>
      </div>

      {/* Add Customer Modal */}
      <Dialog open={showAddCustomerModal} onOpenChange={setShowAddCustomerModal}>
        <DialogContent className="bg-white max-w-md p-0 gap-0">
          <DialogHeader className="bg-emerald-600 text-white px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Name *</label>
              <Input ref={newCustomerNameRef} value={newCustomerForm.name} onChange={e => setNewCustomerForm({...newCustomerForm, name: e.target.value})} className="h-8 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Mobile</label>
                <Input value={newCustomerForm.mobile} onChange={e => setNewCustomerForm({...newCustomerForm, mobile: e.target.value})} className="h-8 text-xs" maxLength={10} />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">City</label>
                <Input value={newCustomerForm.city} onChange={e => setNewCustomerForm({...newCustomerForm, city: e.target.value})} className="h-8 text-xs" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowAddCustomerModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveNewCustomer} className="bg-emerald-600">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Selection Modal - Shows GST Rate */}
      <Dialog open={showBatchModal} onOpenChange={setShowBatchModal}>
        <DialogContent className="bg-white max-w-xl p-0 gap-0">
          <DialogHeader className="bg-emerald-600 text-white px-4 py-3">
            <DialogTitle className="text-sm">{selectedProduct?.name}</DialogTitle>
            <p className="text-emerald-200 text-xs">
              {selectedProduct?.packingInfo} • {selectedProduct?.saltComposition} • GST: {selectedProduct?.gstRate || 12}%
            </p>
          </DialogHeader>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-500">Quantity *</label>
                <Input ref={quantityInputRef} type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="h-10 text-lg font-bold text-center" min={1} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Discount %</label>
                <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="h-10 text-lg font-bold text-center" min={0} max={100} />
              </div>
            </div>
            
            {selectedProduct?.rackLocation && (
              <div className="mb-4 bg-blue-50 border border-blue-200 rounded p-3 text-center">
                <span className="text-sm text-blue-700 font-semibold">🗂️ Shelf Location: {selectedProduct.rackLocation}</span>
              </div>
            )}
            
            <table className="w-full text-xs border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Batch</th>
                  <th className="p-2">Expiry</th>
                  <th className="p-2 text-right">Stock</th>
                  <th className="p-2 text-right">Rate</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {selectedProduct?.batches?.map((b: any, i: number) => (
                  <tr key={b.id} className={`border-t ${i === 0 ? 'bg-yellow-50' : ''}`}>
                    <td className="p-2 font-medium">{b.batchNo}</td>
                    <td className="p-2 text-center">{new Date(b.expiryDate).toLocaleDateString('en-IN')}</td>
                    <td className="p-2 text-right text-emerald-600 font-semibold">{b.currentStock}</td>
                    <td className="p-2 text-right font-bold">₹{Number(b.saleRate).toFixed(2)}</td>
                    <td className="p-2"><Button onClick={() => handleSelectBatch(b)} size="sm" className="h-6 text-xs bg-emerald-600">Select</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="bg-white max-w-md p-0 gap-0">
          <DialogHeader className="bg-emerald-600 text-white px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Payment Details</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            {/* Grand Total */}
            <div className="bg-emerald-50 p-4 rounded-lg text-center">
              <div className="text-sm text-emerald-600">Bill Amount</div>
              <div className="text-3xl font-bold text-emerald-700">₹{totals.grandTotal.toFixed(2)}</div>
            </div>

            {/* Advance Available */}
            {hasAdvance && (
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-green-700 font-medium">💰 Advance Available</div>
                    <div className="text-xl font-bold text-green-700">₹{advanceAvailable.toFixed(2)}</div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={useAdvance}
                      onChange={(e) => {
                        setUseAdvance(e.target.checked);
                        if (e.target.checked) {
                          setAdvanceToUse(Math.min(advanceAvailable, totals.grandTotal));
                        } else {
                          setAdvanceToUse(0);
                        }
                      }}
                      className="w-5 h-5 rounded text-green-600"
                    />
                    <span className="text-sm text-green-700">Use Advance</span>
                  </label>
                </div>
                
                {useAdvance && (
                  <div className="mt-3">
                    <label className="text-xs text-green-600">Amount to use from advance:</label>
                    <Input 
                      type="number" 
                      value={advanceToUse || ''} 
                      onChange={e => setAdvanceToUse(Math.min(Number(e.target.value), advanceAvailable, totals.grandTotal))}
                      className="h-10 text-lg font-bold text-center mt-1"
                      max={Math.min(advanceAvailable, totals.grandTotal)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Remaining to Pay */}
            {effectiveAdvance > 0 && (
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <div className="text-sm text-blue-600">Remaining to Pay</div>
                <div className="text-2xl font-bold text-blue-700">₹{remainingToPay.toFixed(2)}</div>
              </div>
            )}

            {/* Payment Mode */}
            <div>
              <label className="text-xs text-gray-500 uppercase mb-1 block">Payment Mode</label>
              <div className="grid grid-cols-4 gap-2">
                {['CASH', 'UPI', 'CARD', 'CREDIT'].map(mode => (
                  <button 
                    key={mode}
                    onClick={() => {
                      setPaymentMode(mode);
                      if (mode === 'CREDIT') setPaymentAmount(0);
                      else setPaymentAmount(remainingToPay);
                    }}
                    className={`py-2 px-3 rounded text-xs font-semibold border ${paymentMode === mode ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-gray-300'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Received */}
            <div>
              <label className="text-xs text-gray-500 uppercase mb-1 block">Amount Received (Cash/UPI/Card)</label>
              <Input 
                ref={paymentInputRef}
                type="number" 
                value={paymentAmount || ''} 
                onChange={e => setPaymentAmount(Number(e.target.value))}
                className="h-12 text-xl font-bold text-center"
                placeholder="0.00"
              />
            </div>

            {/* Reference */}
            {paymentMode !== 'CASH' && paymentMode !== 'CREDIT' && (
              <div>
                <label className="text-xs text-gray-500 uppercase mb-1 block">Reference / Txn ID</label>
                <Input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} className="h-8 text-xs" />
              </div>
            )}

            {/* Due Amount */}
            {dueAfterPayment > 0 && (
              <div className="bg-orange-50 p-3 rounded-lg text-center">
                <div className="text-sm text-orange-600">Due Amount</div>
                <div className="text-2xl font-bold text-orange-700">₹{dueAfterPayment.toFixed(2)}</div>
              </div>
            )}

            {/* Overpayment (Advance) */}
            {dueAfterPayment < 0 && (
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <div className="text-sm text-green-600">New Advance (Overpayment)</div>
                <div className="text-2xl font-bold text-green-700">₹{Math.abs(dueAfterPayment).toFixed(2)}</div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
              <Button onClick={handleSaveBill} disabled={isSaving} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {isSaving ? 'Saving...' : 'Save & Print'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Invoice Modal */}
      <Dialog open={showViewInvoiceModal} onOpenChange={setShowViewInvoiceModal}>
        <DialogContent className="bg-white max-w-2xl p-0 gap-0 max-h-[80vh] overflow-y-auto">
          <DialogHeader className="bg-gray-100 px-4 py-3 sticky top-0">
            <DialogTitle className="text-sm font-semibold">Invoice #{selectedViewInvoice?.invoiceNo}</DialogTitle>
          </DialogHeader>
          {selectedViewInvoice && (
            <div className="p-4">
              <div className="grid grid-cols-3 gap-4 mb-4 text-xs">
                <div><span className="text-gray-500">Customer:</span> <b>{selectedViewInvoice.customer?.name}</b></div>
                <div><span className="text-gray-500">Date:</span> {new Date(selectedViewInvoice.invoiceDate).toLocaleDateString('en-IN')}</div>
                <div><span className="text-gray-500">Type:</span> {selectedViewInvoice.invoiceType}</div>
              </div>
              
              <table className="w-full text-xs border mb-4">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left border">#</th>
                    <th className="p-2 text-left border">Product</th>
                    <th className="p-2 text-center border">Qty</th>
                    <th className="p-2 text-right border">Rate</th>
                    <th className="p-2 text-center border">GST%</th>
                    <th className="p-2 text-right border">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedViewInvoice.items?.map((item: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 border">{i + 1}</td>
                      <td className="p-2 border">{item.product?.name}</td>
                      <td className="p-2 text-center border">{item.quantity}</td>
                      <td className="p-2 text-right border">₹{Number(item.unitRate).toFixed(2)}</td>
                      <td className="p-2 text-center border text-purple-600 font-semibold">{Number(item.gstPct)}%</td>
                      <td className="p-2 text-right border font-semibold">₹{Number(item.totalAmount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Grand Total:</span><b>₹{Number(selectedViewInvoice.grandTotal).toFixed(2)}</b></div>
                  <div className="flex justify-between"><span>Paid:</span><span className="text-green-600">₹{Number(selectedViewInvoice.paidAmount).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Due:</span><span className="text-orange-600 font-bold">₹{Number(selectedViewInvoice.dueAmount).toFixed(2)}</span></div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded text-xs ${Number(selectedViewInvoice.dueAmount) > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                    {Number(selectedViewInvoice.dueAmount) > 0 ? 'PENDING' : 'PAID'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <Button variant="outline" size="sm" onClick={() => setShowViewInvoiceModal(false)}>Close</Button>
                <Button size="sm" onClick={handleReprintInvoice} className="bg-emerald-600">🖨️ Reprint</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Print Preview Modal */}
      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="bg-white max-w-5xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="bg-emerald-600 text-white px-4 py-3 sticky top-0 z-10">
            <DialogTitle className="text-sm font-semibold">Invoice #{savedInvoice?.invoiceNo} - Print Preview</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <div ref={printRef}>
              {savedInvoice && <InvoicePrint invoice={savedInvoice} customer={savedInvoice.customer} items={savedInvoice.items} />}
            </div>
            <div className="flex justify-between mt-6 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={handleNewBill}>New Bill</Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowPrintModal(false)}>Close</Button>
                <Button size="sm" onClick={handlePrint} className="bg-emerald-600">🖨️ Print</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
