"use client";

import { useState, useEffect, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { usePurchaseStore } from '@/lib/purchaseStore';
import { productsAPI, accountsAPI, purchasesAPI, manufacturersAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from "sonner";
import dynamic from 'next/dynamic';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatExpiryDisplay, formatExpiryOnType, parseExpiryInput } from "@/lib/expiryUtils";

// Dynamic import for Scanner component to avoid SSR issues
const BillScanner = dynamic(() => import('@/components/BillScanner'), { 
  ssr: false,
  loading: () => <div className="p-8 text-center text-gray-500">Loading Scanner...</div>
});

export default function PurchasePage() {
  const { supplier, billNo, billDate, items, setSupplier, setBillInfo, addItem, removeItem, clearPurchase, getTotals } = usePurchaseStore();
  
  // Supplier states
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierResults, setSupplierResults] = useState<any[]>([]);
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  
  // Product states
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  
  // Modal states
  const [showItemModal, setShowItemModal] = useState(false);
  const [showBulkEntryModal, setShowBulkEntryModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  
  // Item form state
  const [batchNo, setBatchNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [freeQuantity, setFreeQuantity] = useState(0);
  const [purchaseRate, setPurchaseRate] = useState(0);
  const [mrp, setMrp] = useState(0);
  const [saleRate, setSaleRate] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [gstPct, setGstPct] = useState(12);
  const [existingBatch, setExistingBatch] = useState<any>(null);

  // Bulk entry state
  const [bulkText, setBulkText] = useState('');
  const [parsedBulkItems, setParsedBulkItems] = useState<any[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  // New Supplier Form
  const [newSupplierForm, setNewSupplierForm] = useState({
    name: '',
    contactPerson: '',
    mobile: '',
    city: '',
    address: '',
    gstin: '',
    dlNumber: ''
  });

  // Recent purchases & view
  const [recentPurchases, setRecentPurchases] = useState<any[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);

  // Manufacturers for quick add
  const [manufacturers, setManufacturers] = useState<any[]>([]);

  // Refs
  const supplierInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const newSupplierNameRef = useRef<HTMLInputElement>(null);
  
  const totals = getTotals();

  // Hotkeys
  useHotkeys('f2', () => productInputRef.current?.focus(), { preventDefault: true });
  useHotkeys('f3', () => supplierInputRef.current?.focus(), { preventDefault: true });
  useHotkeys('f4', () => setShowBulkEntryModal(true), { preventDefault: true });
  useHotkeys('f5', () => setShowScannerModal(true), { preventDefault: true });
  useHotkeys('f10', () => handleSavePurchase(), { preventDefault: true });
  useHotkeys('escape', () => { 
    setShowItemModal(false); 
    setShowProductSearch(false); 
    setShowSupplierSearch(false);
    setShowAddSupplierModal(false);
    setShowBulkEntryModal(false);
    setShowScannerModal(false);
    setShowViewModal(false);
  });

  // Initial load
  useEffect(() => {
    fetchRecentPurchases();
    fetchManufacturers();
  }, []);

  // Supplier search
  useEffect(() => {
    if (supplierSearch.length > 0) {
      accountsAPI.getAll('SUPPLIER', supplierSearch).then(res => {
        setSupplierResults(res.data);
      }).catch(() => setSupplierResults([]));
    } else {
      setSupplierResults([]);
    }
  }, [supplierSearch]);

  // Product search
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

  // Focus batch input when item modal opens
  useEffect(() => {
    if (showItemModal && batchInputRef.current) {
      setTimeout(() => batchInputRef.current?.focus(), 100);
    }
  }, [showItemModal]);

  const fetchRecentPurchases = async () => {
    try {
      const res = await purchasesAPI.getAll();
      setRecentPurchases(res.data || []);
    } catch (err) {
      console.error('Failed to fetch purchases');
    }
  };

  const fetchManufacturers = async () => {
    try {
      const res = await manufacturersAPI.getAll();
      setManufacturers(res.data || []);
    } catch (err) {}
  };

  // Supplier handlers
  const handleSelectSupplier = (sup: any) => {
    setSupplier({ id: sup.id, name: sup.name });
    setShowSupplierSearch(false);
    setSupplierSearch('');
    productInputRef.current?.focus();
  };

  const handleAddNewSupplier = () => {
    setNewSupplierForm({ ...newSupplierForm, name: supplierSearch });
    setShowAddSupplierModal(true);
    setShowSupplierSearch(false);
  };

  const handleSaveNewSupplier = async () => {
    if (!newSupplierForm.name) {
      toast.error("Supplier name required");
      return;
    }
    try {
      const res = await accountsAPI.create({
        accountType: 'SUPPLIER',
        name: newSupplierForm.name,
        contactPerson: newSupplierForm.contactPerson || null,
        mobile: newSupplierForm.mobile || null,
        city: newSupplierForm.city || 'Local',
        address: newSupplierForm.address || null,
        gstin: newSupplierForm.gstin || null,
        dlNumber: newSupplierForm.dlNumber || null,
        openingBalance: 0
      });
      handleSelectSupplier(res.data);
      setNewSupplierForm({ name: '', contactPerson: '', mobile: '', city: '', address: '', gstin: '', dlNumber: '' });
      setShowAddSupplierModal(false);
      toast.success(`Supplier "${res.data.name}" added`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add supplier");
    }
  };

  // Product handlers
  const handleSelectProduct = async (product: any) => {
    setSelectedProduct(product);
    setShowProductSearch(false);
    setProductSearch('');
    
    // Reset form
    setBatchNo('');
    setExpiryDate('');
    setQuantity(0);
    setFreeQuantity(0);
    setPurchaseRate(0);
    setMrp(0);
    setSaleRate(0);
    setDiscountPct(0);
    setGstPct(Number(product.gstRate) || 12);
    setExistingBatch(null);
    
    // Suggest rates from last batch
    if (product.batches && product.batches.length > 0) {
      const lastBatch = product.batches[product.batches.length - 1];
      setMrp(Number(lastBatch.mrp));
      setSaleRate(Number(lastBatch.saleRate));
      setPurchaseRate(Number(lastBatch.purchaseRate));
      toast.info(`${product.batches.length} existing batch(es) found`);
    }
    
    setShowItemModal(true);
  };

  // Check if batch exists
  const checkExistingBatch = () => {
    if (!selectedProduct || !batchNo) return;
    const existing = selectedProduct.batches?.find((b: any) => 
      b.batchNo.toUpperCase() === batchNo.toUpperCase()
    );
    if (existing) {
      setExistingBatch(existing);
      toast.warning(`Batch ${batchNo} exists with ${existing.currentStock} stock - will be added`);
    } else {
      setExistingBatch(null);
    }
  };

  // Auto-calculate rates
  const handleMrpChange = (value: number) => {
    setMrp(value);
    if (!purchaseRate) setPurchaseRate(Math.round(value * 0.70 * 100) / 100);
    if (!saleRate) setSaleRate(Math.round(value * 0.85 * 100) / 100);
  };

  // Add single item
  const handleAddItem = () => {
    if (!batchNo || !expiryDate || quantity <= 0 || purchaseRate <= 0 || mrp <= 0 || saleRate <= 0) {
      toast.error("Fill all required fields");
      return;
    }

    const itemAmount = quantity * purchaseRate * (1 - discountPct / 100);

    addItem({
      id: `${Date.now()}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      batchNo: batchNo.toUpperCase(),
      expiryDate: parseExpiryInput(expiryDate),
      quantity,
      freeQuantity,
      purchaseRate,
      mrp,
      saleRate,
      discountPct,
      gstPct,
      amount: itemAmount,
      isExistingBatch: !!existingBatch,
      previousStock: existingBatch?.currentStock || 0
    });
    
    setShowItemModal(false);
    
    if (existingBatch) {
      toast.success(`Added to existing batch - New total: ${existingBatch.currentStock + quantity + freeQuantity}`);
    } else {
      toast.success("New batch added");
    }
    
    setTimeout(() => productInputRef.current?.focus(), 50);
  };

  // Save purchase
  const handleSavePurchase = async () => {
    if (!supplier) { 
      toast.error("Select Supplier (F3)"); 
      return; 
    }
    if (items.length === 0) { 
      toast.error("Add items (F2)"); 
      return; 
    }
    if (!billNo) { 
      toast.error("Enter Supplier Bill No"); 
      return; 
    }

    setIsSaving(true);
    try {
      const res = await purchasesAPI.create({ 
        supplierId: supplier.id, 
        billNo, 
        billDate, 
        items, 
        totals 
      });
      toast.success(`Purchase #${res.data.purchaseNo} saved!`);
      clearPurchase();
      setSupplierSearch('');
      fetchRecentPurchases();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error saving purchase");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Scanner extracted data
  const handleScannerExtractedData = async (extractedItems: any[]) => {
    let added = 0;
    let created = 0;
    let failed = 0;

    for (const item of extractedItems) {
      try {
        // Search for product
        const res = await productsAPI.getAll({ search: item.productName });
        const products = res.data.products || res.data || [];
        
        let product = products.length > 0 ? products[0] : null;
        
        // If product not found, try to create it
        if (!product && item.productName) {
          try {
            // Find or create manufacturer
            let mfg = manufacturers.find(m => 
              m.name.toLowerCase().includes(item.manufacturer?.toLowerCase() || '') ||
              item.manufacturer?.toLowerCase().includes(m.name.toLowerCase())
            );
            
            if (!mfg && item.manufacturer) {
              const mfgRes = await manufacturersAPI.create({ 
                name: item.manufacturer.toUpperCase(),
                shortName: item.manufacturer.substring(0, 10).toUpperCase()
              });
              mfg = mfgRes.data;
              fetchManufacturers();
            }
            
            if (!mfg) {
              // Use first manufacturer as default
              mfg = manufacturers[0];
            }
            
            if (mfg) {
              const productRes = await productsAPI.create({
                name: item.productName.toUpperCase(),
                manufacturerId: mfg.id,
                packingInfo: item.pack || null,
                hsnCode: item.hsn || '3004',
                gstRate: item.gst || 12
              });
              product = productRes.data;
              created++;
            }
          } catch (createErr) {
            console.error('Failed to create product:', createErr);
          }
        }
        
        if (product) {
          addItem({
            id: `${Date.now()}-${added}`,
            productId: product.id,
            productName: product.name,
            batchNo: item.batchNo || 'BATCH001',
            expiryDate: item.expiry || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
            quantity: item.qty || 1,
            freeQuantity: item.freeQty || 0,
            purchaseRate: item.pRate || (item.mrp * 0.70),
            mrp: item.mrp || 0,
            saleRate: item.sRate || (item.mrp * 0.85),
            discountPct: item.discount || 0,
            gstPct: item.gst || product.gstRate || 12,
            amount: (item.qty || 1) * (item.pRate || (item.mrp * 0.70)) * (1 - (item.discount || 0) / 100)
          });
          added++;
        } else {
          failed++;
        }
      } catch (e) {
        console.error('Error processing item:', e);
        failed++;
      }
    }

    let message = `Added ${added} items`;
    if (created > 0) message += `, created ${created} new products`;
    if (failed > 0) message += `, ${failed} failed`;
    
    toast.success(message);
    setShowScannerModal(false);
  };

  // Bulk entry parsing
  const handleBulkParse = () => {
    if (!bulkText.trim()) {
      toast.error("Paste data first");
      return;
    }

    const lines = bulkText.split('\n').filter(line => line.trim());
    const parsed: any[] = [];

    for (const line of lines) {
      // Try different delimiters
      let parts = line.split('\t');
      if (parts.length < 4) parts = line.split(',');
      if (parts.length < 4) parts = line.split('|');

      if (parts.length >= 4) {
        parsed.push({
          productName: parts[0]?.trim().toUpperCase() || '',
          batchNo: parts[1]?.trim().toUpperCase() || 'BATCH001',
          expiry: parts[2]?.trim() || '',
          qty: parseInt(parts[3]?.trim()) || 0,
          mrp: parseFloat(parts[4]?.trim()) || 0,
          pRate: parseFloat(parts[5]?.trim()) || 0,
          sRate: parseFloat(parts[6]?.trim()) || 0,
          gst: parseFloat(parts[7]?.trim()) || 12
        });
      }
    }

    if (parsed.length > 0) {
      // Auto-calculate missing rates
      parsed.forEach(item => {
        if (!item.pRate && item.mrp) item.pRate = Math.round(item.mrp * 0.70 * 100) / 100;
        if (!item.sRate && item.mrp) item.sRate = Math.round(item.mrp * 0.85 * 100) / 100;
      });
      setParsedBulkItems(parsed);
      toast.success(`Parsed ${parsed.length} items - Review and add`);
    } else {
      toast.error("Could not parse. Format: Name | Batch | Expiry | Qty | MRP | PRate | SRate | GST");
    }
  };

  // Add parsed bulk items
  const handleAddBulkItems = async () => {
    let added = 0;
    let failed = 0;

    for (const item of parsedBulkItems) {
      try {
        const res = await productsAPI.getAll({ search: item.productName });
        const products = res.data.products || res.data || [];
        
        if (products.length > 0) {
          const product = products[0];
          addItem({
            id: `${Date.now()}-${added}`,
            productId: product.id,
            productName: product.name,
            batchNo: item.batchNo,
            expiryDate: item.expiry || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
            quantity: item.qty,
            freeQuantity: 0,
            purchaseRate: item.pRate,
            mrp: item.mrp,
            saleRate: item.sRate,
            discountPct: 0,
            gstPct: item.gst || product.gstRate || 12,
            amount: item.qty * item.pRate
          });
          added++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }

    toast.success(`Added ${added} items${failed > 0 ? `, ${failed} not found in inventory` : ''}`);
    setShowBulkEntryModal(false);
    setBulkText('');
    setParsedBulkItems([]);
  };

  // View purchase details
  const handleViewPurchase = async (purchase: any) => {
    try {
      const res = await purchasesAPI.getById(purchase.id);
      setSelectedPurchase(res.data);
      setShowViewModal(true);
    } catch (err) {
      toast.error("Failed to load purchase");
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar */}
      <header className="h-11 bg-purple-700 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-6">
          <h1 className="text-white font-semibold text-sm">Purchase Entry</h1>
          <div className="flex gap-1 text-[10px]">
            <kbd className="bg-purple-600 text-purple-100 px-1.5 py-0.5 rounded">F2</kbd>
            <span className="text-purple-200">Product</span>
            <kbd className="bg-purple-600 text-purple-100 px-1.5 py-0.5 rounded ml-2">F3</kbd>
            <span className="text-purple-200">Supplier</span>
            <kbd className="bg-purple-600 text-purple-100 px-1.5 py-0.5 rounded ml-2">F4</kbd>
            <span className="text-purple-200">Bulk</span>
            <kbd className="bg-purple-600 text-purple-100 px-1.5 py-0.5 rounded ml-2">F5</kbd>
            <span className="text-purple-200">Scan</span>
            <kbd className="bg-purple-600 text-purple-100 px-1.5 py-0.5 rounded ml-2">F10</kbd>
            <span className="text-purple-200">Save</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowScannerModal(true)}
            size="sm"
            className="h-7 bg-white text-purple-700 hover:bg-purple-50 text-xs font-semibold"
          >
            📷 Scan Bill (F5)
          </Button>
          <Button 
            onClick={() => setShowBulkEntryModal(true)}
            size="sm"
            className="h-7 bg-white text-purple-700 hover:bg-purple-50 text-xs font-semibold"
          >
            📋 Bulk Entry (F4)
          </Button>
          <Button 
            onClick={handleSavePurchase} 
            disabled={isSaving}
            size="sm"
            className="h-7 bg-white text-purple-700 hover:bg-purple-50 text-xs font-semibold"
          >
            {isSaving ? 'Saving...' : 'Save (F10)'}
          </Button>
        </div>
      </header>

      {/* Purchase Header */}
      <div className="bg-white border-b px-4 py-2 shrink-0">
        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-2 relative">
            <label className="text-[10px] text-gray-500 uppercase">Supplier (F3) *</label>
            <Input 
              ref={supplierInputRef}
              placeholder="Search or type new..."
              value={supplier ? supplier.name : supplierSearch}
              onChange={(e) => { 
                if(supplier) setSupplier(null);
                setSupplierSearch(e.target.value); 
                setShowSupplierSearch(true); 
              }}
              onFocus={() => supplierSearch && setShowSupplierSearch(true)}
              className="h-8 text-xs"
            />
            {showSupplierSearch && (
              <div className="absolute z-50 w-full bg-white border shadow-lg mt-1 rounded max-h-64 overflow-y-auto">
                {supplierSearch.length > 0 && (
                  <div 
                    className="px-3 py-3 bg-purple-50 hover:bg-purple-100 cursor-pointer border-b-2 border-purple-200"
                    onClick={handleAddNewSupplier}
                  >
                    <span className="text-purple-700">➕ Add "{supplierSearch}"</span>
                  </div>
                )}
                {supplierResults.map((s) => (
                  <div 
                    key={s.id} 
                    className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-xs border-b"
                    onClick={() => handleSelectSupplier(s)}
                  >
                    <div className="font-medium">{s.name}</div>
                    <div className="text-[10px] text-gray-500">
                      {s.city || 'Local'} • {s.mobile || 'No phone'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Supplier Bill No *</label>
            <Input 
              value={billNo}
              onChange={(e) => setBillInfo(e.target.value, billDate)}
              placeholder="INV-123"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Bill Date</label>
            <Input 
              type="date"
              value={billDate}
              onChange={(e) => setBillInfo(billNo, e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Our Entry No</label>
            <div className="h-8 bg-gray-100 rounded flex items-center px-2 text-xs font-medium text-gray-600">AUTO</div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-2 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2 text-purple-700">
              <span>🎯</span>
              <span><b>Smart Batch:</b> Same batch = Auto-add qty</span>
            </div>
            <div className="flex items-center gap-2 text-blue-700">
              <span>📷</span>
              <span><b>Scanner:</b> Scan bills + Manual table</span>
            </div>
            <div className="flex items-center gap-2 text-green-700">
              <span>📋</span>
              <span><b>Bulk:</b> Paste from Excel</span>
            </div>
          </div>
        </div>
      </div>

      {/* Product Search */}
      <div className="bg-gray-100 px-4 py-2 border-b shrink-0">
        <div className="relative">
          <Input 
            ref={productInputRef}
            placeholder="🔍 Search product to add stock... (F2)"
            value={productSearch}
            onChange={(e) => { 
              setProductSearch(e.target.value); 
              setShowProductSearch(true); 
            }}
            onFocus={() => productSearch && setShowProductSearch(true)}
            className="h-8 text-xs bg-white"
          />
          {showProductSearch && productResults.length > 0 && (
            <div className="absolute z-50 w-full bg-white border shadow-lg mt-1 rounded max-h-72 overflow-y-auto">
              {productResults.map((p) => {
                const totalStock = p.batches?.reduce((sum: number, b: any) => sum + b.currentStock, 0) || 0;
                return (
                  <div 
                    key={p.id} 
                    className="px-3 py-2 hover:bg-purple-50 cursor-pointer text-xs border-b flex justify-between"
                    onClick={() => handleSelectProduct(p)}
                  >
                    <div>
                      <div className="font-medium">
                        {p.name}
                        {p.rackLocation && (
                          <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 px-1 rounded">
                            📍 {p.rackLocation}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {p.manufacturer?.name || ''} • {p.packingInfo || ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${totalStock > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                        Stock: {totalStock}
                      </div>
                      <div className="text-[10px] text-purple-600">GST: {p.gstRate || 12}%</div>
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
              <th className="w-10 py-2 px-2 text-left font-semibold text-gray-600">#</th>
              <th className="py-2 px-2 text-left font-semibold text-gray-600">Product</th>
              <th className="w-20 py-2 px-2 text-center font-semibold text-gray-600">Batch</th>
              <th className="w-24 py-2 px-2 text-center font-semibold text-gray-600">Expiry</th>
              <th className="w-14 py-2 px-2 text-center font-semibold text-gray-600">Qty</th>
              <th className="w-14 py-2 px-2 text-center font-semibold text-gray-600">Free</th>
              <th className="w-16 py-2 px-2 text-right font-semibold text-gray-600">P.Rate</th>
              <th className="w-16 py-2 px-2 text-right font-semibold text-gray-600">MRP</th>
              <th className="w-16 py-2 px-2 text-right font-semibold text-gray-600">S.Rate</th>
              <th className="w-12 py-2 px-2 text-center font-semibold text-gray-600">GST%</th>
              <th className="w-20 py-2 px-2 text-right font-semibold text-gray-600">Amount</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center py-20 text-gray-400">
                  <div className="text-4xl mb-3">📦</div>
                  <p className="text-sm">No items added yet</p>
                  <p className="text-xs mt-1">Press F2 to search products or F5 to scan a bill</p>
                </td>
              </tr>
            ) : (
              items.map((item: any, i) => (
                <tr key={i} className={`border-b hover:bg-gray-50 ${item.isExistingBatch ? 'bg-green-50' : ''}`}>
                  <td className="py-1.5 px-2 text-gray-500">{i + 1}</td>
                  <td className="py-1.5 px-2 font-medium">
                    {item.productName}
                    {item.isExistingBatch && (
                      <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        +{item.previousStock} existing
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-center font-mono">{item.batchNo}</td>
                  <td className="py-1.5 px-2 text-center">{formatExpiryDisplay(item.expiryDate)}</td>
                  <td className="py-1.5 px-2 text-center font-semibold">{item.quantity}</td>
                  <td className="py-1.5 px-2 text-center text-green-600">{item.freeQuantity || 0}</td>
                  <td className="py-1.5 px-2 text-right">₹{Number(item.purchaseRate).toFixed(2)}</td>
                  <td className="py-1.5 px-2 text-right">₹{Number(item.mrp).toFixed(2)}</td>
                  <td className="py-1.5 px-2 text-right">₹{Number(item.saleRate).toFixed(2)}</td>
                  <td className="py-1.5 px-2 text-center text-purple-600 font-semibold">{item.gstPct}%</td>
                  <td className="py-1.5 px-2 text-right font-semibold text-purple-700">₹{Number(item.amount).toFixed(2)}</td>
                  <td className="py-1.5 px-2">
                    <button 
                      onClick={() => removeItem(i)} 
                      className="text-red-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Summary */}
      <div className="bg-white border-t px-4 py-2 shrink-0">
        <div className="flex justify-between items-center">
          <div className="flex gap-6 text-xs">
            <span>Items: <b>{items.length}</b></span>
            <span>Qty: <b>{items.reduce((s, i) => s + i.quantity, 0)}</b></span>
            {items.reduce((s, i) => s + (i.freeQuantity || 0), 0) > 0 && (
              <span className="text-green-600">(+{items.reduce((s, i) => s + (i.freeQuantity || 0), 0)} free)</span>
            )}
            <span>Gross: <b>₹{totals.grossAmount.toFixed(2)}</b></span>
            <span className="text-orange-600">Disc: ₹{totals.totalDiscount.toFixed(2)}</span>
            <span className="text-blue-600">GST: ₹{totals.gstAmount.toFixed(2)}</span>
          </div>
          <div className="bg-purple-600 text-white px-6 py-2 rounded">
            <span className="text-purple-200 text-xs mr-2">Net Payable:</span>
            <span className="text-xl font-bold">₹{totals.grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Recent Purchases */}
      <div className="bg-gray-50 border-t px-4 py-2 shrink-0 max-h-24 overflow-y-auto">
        <span className="text-[10px] text-gray-500 uppercase font-semibold">Recent Purchases</span>
        <div className="flex gap-2 overflow-x-auto pb-1 mt-1">
          {recentPurchases.slice(0, 10).map((p) => (
            <div 
              key={p.id} 
              onClick={() => handleViewPurchase(p)}
              className="bg-white border rounded px-3 py-1.5 cursor-pointer hover:border-purple-500 text-xs min-w-[140px] shrink-0"
            >
              <div className="flex justify-between">
                <span className="font-semibold">#{p.purchaseNo}</span>
                <span className="text-[10px] text-purple-600">{p.items?.length || 0} items</span>
              </div>
              <div className="text-[10px] text-gray-500 truncate">{p.supplier?.name}</div>
              <div className="font-semibold">₹{Number(p.grandTotal).toFixed(0)}</div>
            </div>
          ))}
          {recentPurchases.length === 0 && (
            <span className="text-xs text-gray-400">No recent purchases</span>
          )}
        </div>
      </div>

      {/* ============ ALL MODALS ============ */}

      {/* Item Entry Modal */}
      <Dialog open={showItemModal} onOpenChange={setShowItemModal}>
        <DialogContent className="bg-white max-w-lg p-0 gap-0">
          <DialogHeader className="bg-purple-600 text-white px-4 py-3">
            <DialogTitle className="text-sm font-semibold">
              Add: {selectedProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            {/* Existing batches info */}
            {selectedProduct?.batches?.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 mb-2">Existing Batches:</p>
                <div className="flex gap-2 overflow-x-auto">
                  {selectedProduct.batches.slice(-3).map((b: any) => (
                    <div key={b.id} className="bg-white border rounded px-2 py-1 text-xs min-w-[100px]">
                      <div className="font-semibold">{b.batchNo}</div>
                      <div className="text-gray-500">Stock: {b.currentStock}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Batch & Expiry */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Batch No *</label>
                <Input 
                  ref={batchInputRef}
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value.toUpperCase())}
                  onBlur={checkExistingBatch}
                  placeholder="Enter batch"
                  className="h-9 text-sm font-semibold"
                />
                {existingBatch && (
                  <p className="text-[10px] text-green-600 mt-1">
                    ✓ Exists with {existingBatch.currentStock} stock - will add
                  </p>
                )}
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Expiry Date *</label>
                <Input 
                  type="text"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(formatExpiryOnType(e.target.value, expiryDate))}
                  className="h-9 text-sm text-center font-semibold"
                  placeholder="MM/YY"
                  maxLength={5}
                />
              </div>
            </div>

            {/* Quantity */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Quantity *</label>
                <Input 
                  type="number"
                  value={quantity || ''}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  placeholder="0"
                  className="h-9 text-lg font-bold text-center"
                  min={1}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Free Qty</label>
                <Input 
                  type="number"
                  value={freeQuantity || ''}
                  onChange={(e) => setFreeQuantity(Number(e.target.value))}
                  placeholder="0"
                  className="h-9 text-lg font-bold text-center text-green-600"
                  min={0}
                />
              </div>
            </div>

            {/* Rates */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase">MRP *</label>
                <Input 
                  type="number"
                  value={mrp || ''}
                  onChange={(e) => handleMrpChange(Number(e.target.value))}
                  placeholder="0.00"
                  className="h-9 text-sm font-semibold text-center"
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Purchase Rate *</label>
                <Input 
                  type="number"
                  value={purchaseRate || ''}
                  onChange={(e) => setPurchaseRate(Number(e.target.value))}
                  placeholder="Auto 70%"
                  className="h-9 text-sm text-center"
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Sale Rate *</label>
                <Input 
                  type="number"
                  value={saleRate || ''}
                  onChange={(e) => setSaleRate(Number(e.target.value))}
                  placeholder="Auto 85%"
                  className="h-9 text-sm text-center"
                  step="0.01"
                />
              </div>
            </div>

            {/* Discount & GST */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Discount %</label>
                <Input 
                  type="number"
                  value={discountPct || ''}
                  onChange={(e) => setDiscountPct(Number(e.target.value))}
                  placeholder="0"
                  className="h-9 text-sm text-center"
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">GST %</label>
                <select
                  value={gstPct}
                  onChange={(e) => setGstPct(Number(e.target.value))}
                  className="w-full h-9 text-sm border rounded px-2"
                >
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                  <option value={28}>28%</option>
                </select>
              </div>
            </div>

            {/* Amount Preview */}
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <span className="text-xs text-purple-600">Item Amount: </span>
              <span className="text-xl font-bold text-purple-700">
                ₹{(quantity * purchaseRate * (1 - discountPct / 100)).toFixed(2)}
              </span>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowItemModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddItem} className="bg-purple-600 hover:bg-purple-700">
                Add Item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bill Scanner Modal */}
      <Dialog open={showScannerModal} onOpenChange={setShowScannerModal}>
        <DialogContent className="bg-white max-w-6xl p-0 gap-0 max-h-[95vh] overflow-hidden">
          <DialogHeader className="bg-purple-600 text-white px-4 py-3">
            <DialogTitle className="text-sm font-semibold">📷 Bill Scanner - Scan, Paste, or Manual Entry</DialogTitle>
          </DialogHeader>
          <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 60px)' }}>
            <BillScanner 
              onExtractedData={handleScannerExtractedData}
              onClose={() => setShowScannerModal(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Entry Modal */}
      <Dialog open={showBulkEntryModal} onOpenChange={setShowBulkEntryModal}>
        <DialogContent className="bg-white max-w-3xl p-0 gap-0 max-h-[90vh] overflow-hidden">
          <DialogHeader className="bg-green-600 text-white px-4 py-3">
            <DialogTitle className="text-sm font-semibold">📋 Bulk Entry - Paste from Excel</DialogTitle>
          </DialogHeader>
          <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 60px)' }}>
            {/* Instructions */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-green-700 mb-2"><b>Paste data in this format:</b></p>
              <code className="text-[10px] block bg-white p-2 rounded font-mono border">
                ProductName | Batch | Expiry | Qty | MRP | PRate | SRate | GST
              </code>
              <p className="text-[10px] text-green-600 mt-2">
                Supports: Tab-separated (Excel), Comma, or Pipe (|) delimiter
              </p>
            </div>

            {/* Text Area */}
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full h-40 text-xs border rounded-lg p-3 font-mono"
              placeholder="Paste your data here...

Example:
TAB DOLO 650	B123	2025-12-01	100	25.50	17.85	21.68	12
CAP OMEZ 20	D456	2026-06-01	50	85.00	59.50	72.25	12"
            />

            <div className="flex justify-between mt-3">
              <Button variant="outline" size="sm" onClick={() => { setBulkText(''); setParsedBulkItems([]); }}>
                Clear
              </Button>
              <Button size="sm" onClick={handleBulkParse} className="bg-green-600 hover:bg-green-700">
                Parse Data
              </Button>
            </div>

            {/* Parsed Items Preview */}
            {parsedBulkItems.length > 0 && (
              <div className="mt-4 border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-3 py-2 text-xs font-semibold">
                  Parsed Items ({parsedBulkItems.length})
                </div>
                <div className="max-h-48 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-left">Product</th>
                        <th className="p-2">Batch</th>
                        <th className="p-2">Expiry</th>
                        <th className="p-2">Qty</th>
                        <th className="p-2">MRP</th>
                        <th className="p-2">P.Rate</th>
                        <th className="p-2">S.Rate</th>
                        <th className="p-2">GST</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedBulkItems.map((item, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 font-medium">{item.productName}</td>
                          <td className="p-2 text-center">{item.batchNo}</td>
                          <td className="p-2 text-center">{item.expiry}</td>
                          <td className="p-2 text-center font-semibold">{item.qty}</td>
                          <td className="p-2 text-center">₹{item.mrp}</td>
                          <td className="p-2 text-center">₹{item.pRate}</td>
                          <td className="p-2 text-center">₹{item.sRate}</td>
                          <td className="p-2 text-center">{item.gst}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 bg-gray-50 border-t flex justify-end">
                  <Button size="sm" onClick={handleAddBulkItems} className="bg-green-600 hover:bg-green-700">
                    Add {parsedBulkItems.length} Items to Purchase
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Supplier Modal */}
      <Dialog open={showAddSupplierModal} onOpenChange={setShowAddSupplierModal}>
        <DialogContent className="bg-white max-w-md p-0 gap-0">
          <DialogHeader className="bg-purple-600 text-white px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Add New Supplier</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Name *</label>
              <Input 
                ref={newSupplierNameRef}
                value={newSupplierForm.name} 
                onChange={e => setNewSupplierForm({...newSupplierForm, name: e.target.value})} 
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Mobile</label>
                <Input 
                  value={newSupplierForm.mobile} 
                  onChange={e => setNewSupplierForm({...newSupplierForm, mobile: e.target.value})} 
                  className="h-8 text-xs"
                  maxLength={10}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">City</label>
                <Input 
                  value={newSupplierForm.city} 
                  onChange={e => setNewSupplierForm({...newSupplierForm, city: e.target.value})} 
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase">GSTIN</label>
              <Input 
                value={newSupplierForm.gstin} 
                onChange={e => setNewSupplierForm({...newSupplierForm, gstin: e.target.value.toUpperCase()})} 
                className="h-8 text-xs font-mono"
                maxLength={15}
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowAddSupplierModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveNewSupplier} className="bg-purple-600">Save Supplier</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Purchase Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="bg-white max-w-3xl p-0 gap-0 max-h-[85vh] overflow-hidden">
          <DialogHeader className="bg-gray-100 px-4 py-3 border-b">
            <DialogTitle className="text-sm font-semibold">
              Purchase #{selectedPurchase?.purchaseNo} - {selectedPurchase?.supplier?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedPurchase && (
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 60px)' }}>
              {/* Header Info */}
              <div className="grid grid-cols-4 gap-4 mb-4 text-xs">
                <div>
                  <span className="text-gray-500">Bill No:</span>
                  <span className="ml-2 font-semibold">{selectedPurchase.billNo}</span>
                </div>
                <div>
                  <span className="text-gray-500">Bill Date:</span>
                  <span className="ml-2 font-semibold">
                    {new Date(selectedPurchase.billDate).toLocaleDateString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Entry Date:</span>
                  <span className="ml-2 font-semibold">
                    {new Date(selectedPurchase.purchaseDate).toLocaleDateString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Total:</span>
                  <span className="ml-2 font-bold text-purple-700">
                    ₹{Number(selectedPurchase.grandTotal).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-xs border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left border">#</th>
                    <th className="p-2 text-left border">Product</th>
                    <th className="p-2 text-center border">Batch</th>
                    <th className="p-2 text-center border">Qty</th>
                    <th className="p-2 text-right border">Rate</th>
                    <th className="p-2 text-center border">GST%</th>
                    <th className="p-2 text-right border">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurchase.items?.map((item: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 border">{i + 1}</td>
                      <td className="p-2 border font-medium">{item.product?.name}</td>
                      <td className="p-2 border text-center font-mono">{item.batch?.batchNo}</td>
                      <td className="p-2 border text-center">
                        {item.quantity}
                        {item.freeQuantity > 0 && (
                          <span className="text-green-600">+{item.freeQuantity}</span>
                        )}
                      </td>
                      <td className="p-2 border text-right">₹{Number(item.unitRate).toFixed(2)}</td>
                      <td className="p-2 border text-center">{item.gstPct}%</td>
                      <td className="p-2 border text-right font-semibold">₹{Number(item.totalAmount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr className="border-t-2">
                    <td colSpan={5}></td>
                    <td className="p-2 text-right font-semibold border">Gross:</td>
                    <td className="p-2 text-right font-semibold border">₹{Number(selectedPurchase.grossAmount).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td colSpan={5}></td>
                    <td className="p-2 text-right font-semibold border">GST:</td>
                    <td className="p-2 text-right font-semibold border text-blue-600">
                      ₹{(Number(selectedPurchase.cgstAmount) + Number(selectedPurchase.sgstAmount)).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={5}></td>
                    <td className="p-2 text-right font-bold border bg-purple-50">Total:</td>
                    <td className="p-2 text-right font-bold border bg-purple-50 text-purple-700">
                      ₹{Number(selectedPurchase.grandTotal).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <div className="flex justify-end mt-4">
                <Button variant="outline" size="sm" onClick={() => setShowViewModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
