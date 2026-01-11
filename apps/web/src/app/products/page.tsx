"use client";

import { useState, useEffect, useRef } from 'react';
import { productsAPI, manufacturersAPI, categoriesAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type TabType = 'products' | 'manufacturers' | 'categories' | 'quickentry';

export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('quickentry');
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  const [showProductModal, setShowProductModal] = useState(false);
  const [showManufacturerModal, setShowManufacturerModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showBatchSuggestionModal, setShowBatchSuggestionModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);

  // Product Form with ALL fields including GST
  const [productForm, setProductForm] = useState({
    name: '', 
    barcode: '', 
    saltComposition: '', 
    hsnCode: '3004', 
    manufacturerId: '', 
    categoryId: '', 
    packingInfo: '', 
    rackLocation: '', 
    gstRate: 12,
    minStockAlert: 50
  });

  const [addInitialStock, setAddInitialStock] = useState(false);
  const [stockForm, setStockForm] = useState({
    batchNo: '', expiryDate: '', quantity: 0, purchaseRate: 0, mrp: 0, saleRate: 0
  });

  const [batchForm, setBatchForm] = useState({
    batchNo: '', expiryDate: '', quantity: 0, purchaseRate: 0, mrp: 0, saleRate: 0
  });

  const [mfgForm, setMfgForm] = useState({ name: '', shortName: '', address: '', gstin: '' });
  const [catForm, setCatForm] = useState({ name: '', description: '' });
  const [csvData, setCsvData] = useState('');

  // Quick Entry - ENHANCED with rack location & category
  const [quickProducts, setQuickProducts] = useState<any[]>([]);
  const [existingBatches, setExistingBatches] = useState<any[]>([]);
  const quickBarcodeRef = useRef<HTMLInputElement>(null);
  const quickNameRef = useRef<HTMLInputElement>(null);
  const quickMfgRef = useRef<HTMLInputElement>(null);
  const quickCategoryRef = useRef<HTMLInputElement>(null);
  const quickSaltRef = useRef<HTMLInputElement>(null);
  const quickPackRef = useRef<HTMLInputElement>(null);
  const quickRackRef = useRef<HTMLInputElement>(null);
  const quickGstRef = useRef<HTMLSelectElement>(null);
  const quickBatchRef = useRef<HTMLInputElement>(null);
  const quickExpiryRef = useRef<HTMLInputElement>(null);
  const quickQtyRef = useRef<HTMLInputElement>(null);
  const quickPRateRef = useRef<HTMLInputElement>(null);
  const quickMrpRef = useRef<HTMLInputElement>(null);
  const quickSRateRef = useRef<HTMLInputElement>(null);

  const [quickForm, setQuickForm] = useState({
    barcode: '', 
    name: '', 
    manufacturer: '', 
    category: '',
    salt: '',
    packing: '', 
    rackLocation: '',
    gstRate: 12,
    batchNo: '', 
    expiry: '', 
    qty: 0, 
    pRate: 0, 
    mrp: 0, 
    sRate: 0
  });

  useEffect(() => {
    fetchProducts();
    fetchManufacturers();
    fetchCategories();
  }, [search, stockFilter]);

  useEffect(() => {
    if (activeTab === 'quickentry') {
      quickBarcodeRef.current?.focus();
    }
  }, [activeTab]);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await productsAPI.getAll({ search, stockStatus: stockFilter !== 'all' ? stockFilter : undefined });
      setProducts(res.data.products || []);
    } catch (err) {
      toast.error('Failed to load products');
    }
    setLoadingProducts(false);
  };

  const fetchManufacturers = async () => {
    try { const res = await manufacturersAPI.getAll(); setManufacturers(res.data); } catch (err) {}
  };

  const fetchCategories = async () => {
    try { const res = await categoriesAPI.getAll(); setCategories(res.data); } catch (err) {}
  };

  const handleSaveProduct = async () => {
    if (!productForm.name || !productForm.manufacturerId) {
      toast.error('Name and Manufacturer required');
      return;
    }

    if (addInitialStock) {
      if (!stockForm.batchNo || !stockForm.expiryDate || stockForm.quantity <= 0 || stockForm.mrp <= 0 || stockForm.saleRate <= 0) {
        toast.error('Fill all stock details');
        return;
      }
    }

    try {
      let product;
      if (editMode && selectedProduct) {
        product = await productsAPI.update(selectedProduct.id, productForm);
        toast.success('Product updated');
      } else {
        const res = await productsAPI.create(productForm);
        product = res.data;
        toast.success('Product created');

        if (addInitialStock && product.id) {
          await productsAPI.addBatch({
            productId: product.id,
            batchNo: stockForm.batchNo,
            expiryDate: stockForm.expiryDate,
            currentStock: stockForm.quantity,
            purchaseRate: stockForm.purchaseRate || stockForm.saleRate * 0.8,
            mrp: stockForm.mrp,
            saleRate: stockForm.saleRate
          });
          toast.success('Initial stock added');
        }
      }
      
      setShowProductModal(false);
      resetProductForm();
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleEditProduct = (product: any) => {
    setSelectedProduct(product);
    setProductForm({
      name: product.name,
      barcode: product.barcode || '',
      saltComposition: product.saltComposition || '',
      hsnCode: product.hsnCode || '3004',
      manufacturerId: product.manufacturerId,
      categoryId: product.categoryId || '',
      packingInfo: product.packingInfo || '',
      rackLocation: product.rackLocation || '',
      gstRate: product.gstRate || 12,
      minStockAlert: product.minStockAlert || 50
    });
    setAddInitialStock(false);
    setEditMode(true);
    setShowProductModal(true);
  };

  const handleViewProduct = async (product: any) => {
    try {
      const res = await productsAPI.getById(product.id);
      setSelectedProduct(res.data);
      setShowViewModal(true);
    } catch (e) {
      toast.error("Failed to open");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Deactivate this product?')) return;
    try {
      await productsAPI.delete(id);
      toast.success('Deactivated');
      fetchProducts();
    } catch (err) {
      toast.error('Failed');
    }
  };

  const resetProductForm = () => {
    setProductForm({ 
      name: '', barcode: '', saltComposition: '', hsnCode: '3004', 
      manufacturerId: '', categoryId: '', packingInfo: '', 
      rackLocation: '', gstRate: 12, minStockAlert: 50 
    });
    setStockForm({ batchNo: '', expiryDate: '', quantity: 0, purchaseRate: 0, mrp: 0, saleRate: 0 });
    setAddInitialStock(false);
    setSelectedProduct(null);
    setEditMode(false);
  };

  const handleSaveManufacturer = async () => {
    if (!mfgForm.name) { toast.error('Name required'); return; }
    try {
      await manufacturersAPI.create(mfgForm);
      toast.success('Created');
      setShowManufacturerModal(false);
      setMfgForm({ name: '', shortName: '', address: '', gstin: '' });
      fetchManufacturers();
    } catch (err) { toast.error('Failed'); }
  };

  const handleSaveCategory = async () => {
    if (!catForm.name) { toast.error('Name required'); return; }
    try {
      await categoriesAPI.create(catForm);
      toast.success('Created');
      setShowCategoryModal(false);
      setCatForm({ name: '', description: '' });
      fetchCategories();
    } catch (err) { toast.error('Failed'); }
  };

  const handleImport = async () => {
    try {
      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const products = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj: any = {};
        headers.forEach((h, i) => obj[h] = values[i]?.trim());
        return obj;
      });
      
      const res = await productsAPI.import(products);
      toast.success(`Created: ${res.data.created}, Updated: ${res.data.updated}`);
      setShowImportModal(false);
      setCsvData('');
      fetchProducts();
    } catch (err) {
      toast.error('Import failed');
    }
  };

  const openBatchModal = () => {
    setBatchForm({ batchNo: '', expiryDate: '', quantity: 0, purchaseRate: 0, mrp: 0, saleRate: 0 });
    setShowBatchModal(true);
  };

  const handleSaveBatch = async () => {
    if (!selectedProduct?.id) return;
    if (!batchForm.batchNo || !batchForm.expiryDate || batchForm.quantity <= 0 || batchForm.mrp <= 0 || batchForm.saleRate <= 0) {
      toast.error("Fill all fields");
      return;
    }
    try {
      await productsAPI.addBatch({
        productId: selectedProduct.id,
        batchNo: batchForm.batchNo,
        expiryDate: batchForm.expiryDate,
        currentStock: batchForm.quantity,
        purchaseRate: batchForm.purchaseRate || batchForm.saleRate * 0.8,
        mrp: batchForm.mrp,
        saleRate: batchForm.saleRate
      });
      toast.success("Stock added");
      const res = await productsAPI.getById(selectedProduct.id);
      setSelectedProduct(res.data);
      fetchProducts();
      setShowBatchModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed");
    }
  };

  // ENHANCED Quick Entry with Rack & GST
  const handleQuickBarcodeScan = async () => {
    if (!quickForm.barcode) return;
    
    try {
      const res = await productsAPI.getByBarcode(quickForm.barcode);
      
      // Product found - Fill ALL product info including rack & GST
      toast.success(`Found: ${res.data.name}`);
      
      setQuickForm(prev => ({
        ...prev,
        name: res.data.name,
        manufacturer: res.data.manufacturer?.name || '',
        category: res.data.category?.name || '',
        salt: res.data.saltComposition || '',
        packing: res.data.packingInfo || '',
        rackLocation: res.data.rackLocation || '',
        gstRate: res.data.gstRate || 12
      }));
      
      if (res.data.batches && res.data.batches.length > 0) {
        setExistingBatches(res.data.batches);
        
        const lastBatch = res.data.batches[res.data.batches.length - 1];
        setQuickForm(prev => ({
          ...prev,
          mrp: Number(lastBatch.mrp),
          sRate: Number(lastBatch.saleRate),
          pRate: Number(lastBatch.purchaseRate)
        }));
        
        setShowBatchSuggestionModal(true);
      } else {
        quickBatchRef.current?.focus();
      }
      
    } catch (err) {
      toast.info("New product - Enter all details");
      quickNameRef.current?.focus();
    }
  };

  const handleSelectExistingBatch = (batch: any) => {
    setQuickForm(prev => ({
      ...prev,
      batchNo: batch.batchNo,
      expiry: batch.expiryDate.split('T')[0],
      mrp: Number(batch.mrp),
      sRate: Number(batch.saleRate),
      pRate: Number(batch.purchaseRate),
      qty: 0
    }));
    setShowBatchSuggestionModal(false);
    quickQtyRef.current?.focus();
  };

  const handleQuickKeyDown = (e: React.KeyboardEvent, nextRef: { current: { focus: () => void } | null } | null) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRef && nextRef.current) {
        nextRef.current.focus();
      } else {
        handleQuickAdd();
      }
    }
  };

  const autoCalculateSaleRate = () => {
    if (quickForm.mrp) {
      const suggestedRate = Math.round(quickForm.mrp * 0.80);
      setQuickForm(prev => ({ ...prev, sRate: suggestedRate }));
    }
  };

  const autoCalculatePurchaseRate = () => {
    if (quickForm.sRate) {
      const suggestedPRate = Math.round(quickForm.sRate * 0.75);
      setQuickForm(prev => ({ ...prev, pRate: suggestedPRate }));
    }
  };

  const handleQuickAdd = async () => {
    if (!quickForm.name || !quickForm.manufacturer) {
      toast.error("Name and Manufacturer required");
      return;
    }
    
    if (!quickForm.batchNo || !quickForm.expiry || !quickForm.qty || !quickForm.mrp || !quickForm.sRate) {
      toast.error("Batch, Expiry, Qty, MRP, and Sale Rate required");
      return;
    }

    try {
      // Find or create manufacturer
      let mfg = manufacturers.find(m => m.name.toLowerCase() === quickForm.manufacturer.toLowerCase());
      if (!mfg) {
        const mfgRes = await manufacturersAPI.create({ 
          name: quickForm.manufacturer, 
          shortName: quickForm.manufacturer.substring(0, 10) 
        });
        mfg = mfgRes.data;
        fetchManufacturers();
      }

      // Find or create category
      let categoryId = null;
      if (quickForm.category) {
        let cat = categories.find(c => c.name.toLowerCase() === quickForm.category.toLowerCase());
        if (!cat) {
          const catRes = await categoriesAPI.create({ 
            name: quickForm.category 
          });
          cat = catRes.data;
          fetchCategories();
        }
        categoryId = cat.id;
      }

      // Check if product exists by barcode
      let productId = null;
      if (quickForm.barcode) {
        try {
          const res = await productsAPI.getByBarcode(quickForm.barcode);
          productId = res.data.id;
        } catch (e) {}
      }

      if (!productId) {
        // Create new product with rack location & GST
        const productRes = await productsAPI.create({
          name: quickForm.name,
          barcode: quickForm.barcode || null,
          saltComposition: quickForm.salt,
          manufacturerId: mfg.id,
          categoryId: categoryId,
          packingInfo: quickForm.packing,
          rackLocation: quickForm.rackLocation,
          gstRate: quickForm.gstRate,
          hsnCode: '3004'
        });
        productId = productRes.data.id;
        toast.info("New product created");
      }

      // Add batch/stock
      await productsAPI.addBatch({
        productId,
        batchNo: quickForm.batchNo,
        expiryDate: quickForm.expiry,
        currentStock: quickForm.qty,
        purchaseRate: quickForm.pRate || quickForm.sRate * 0.75,
        mrp: quickForm.mrp,
        saleRate: quickForm.sRate
      });

      toast.success(`✓ Added: ${quickForm.name} | Batch: ${quickForm.batchNo} | Qty: ${quickForm.qty}`);
      
      // Add to recent entries
      setQuickProducts([{
        ...quickForm,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now()
      }, ...quickProducts.slice(0, 19)]);

      // Clear form
      setQuickForm({ 
        barcode: '', name: '', manufacturer: '', category: '', salt: '', 
        packing: '', rackLocation: '', gstRate: 12,
        batchNo: '', expiry: '', qty: 0, pRate: 0, mrp: 0, sRate: 0 
      });
      setExistingBatches([]);
      
      fetchProducts();
      quickBarcodeRef.current?.focus();

    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed");
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-11 bg-blue-700 flex items-center justify-between px-4 shrink-0">
        <h1 className="text-white font-semibold text-sm">Master Data</h1>
        <div className="flex gap-2">
          {activeTab === 'products' && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs bg-white text-blue-700" onClick={() => setShowImportModal(true)}>
                📥 Import CSV
              </Button>
              <Button size="sm" className="h-7 text-xs bg-white text-blue-700" onClick={() => { resetProductForm(); setShowProductModal(true); }}>
                + Add Product
              </Button>
            </>
          )}
          {activeTab === 'manufacturers' && (
            <Button size="sm" className="h-7 text-xs bg-white text-blue-700" onClick={() => setShowManufacturerModal(true)}>
              + Add Manufacturer
            </Button>
          )}
          {activeTab === 'categories' && (
            <Button size="sm" className="h-7 text-xs bg-white text-blue-700" onClick={() => setShowCategoryModal(true)}>
              + Add Category
            </Button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b px-4 shrink-0">
        <div className="flex gap-0">
          {(['quickentry', 'products', 'manufacturers', 'categories'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition ${
                activeTab === tab 
                  ? 'border-blue-600 text-blue-700' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'quickentry' ? '⚡ Quick Entry' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ENHANCED Quick Entry Tab with Rack & Category */}
      {activeTab === 'quickentry' && (
        <div className="flex-1 overflow-auto bg-white p-4">
          <div className="max-w-7xl mx-auto">
            {/* Instructions */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-bold text-blue-800 mb-2">⚡ Quick Stock Entry - Professional Mode</h3>
              <div className="grid grid-cols-3 gap-4 text-xs text-gray-700">
                <div>
                  <p className="font-semibold text-blue-700 mb-1">Barcode Scan Features:</p>
                  <ul className="space-y-0.5 ml-4">
                    <li>✓ Auto-fills: Product, Company, Category</li>
                    <li>✓ Shows shelf/rack location</li>
                    <li>✓ Gets GST rate automatically</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-purple-700 mb-1">Manual Entry Required:</p>
                  <ul className="space-y-0.5 ml-4">
                    <li>• Batch No (each purchase differs)</li>
                    <li>• Expiry Date (each batch differs)</li>
                    <li>• Quantity (you decide)</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-green-700 mb-1">🏪 Shelf Location:</p>
                  <ul className="space-y-0.5 ml-4">
                    <li>• Enter like: A-1, B-2, C-3</li>
                    <li>• Helps find medicine quickly</li>
                    <li>• Shows in product list</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Show existing batches if product found */}
            {existingBatches.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-xs font-semibold text-yellow-800 mb-2">📋 Existing Batches for Reference:</p>
                <div className="flex gap-3">
                  {existingBatches.slice(-3).map(batch => (
                    <div key={batch.id} className="bg-white border rounded p-2 text-xs">
                      <div className="font-semibold">{batch.batchNo}</div>
                      <div>Exp: {new Date(batch.expiryDate).toLocaleDateString('en-IN')}</div>
                      <div>Stock: {batch.currentStock}</div>
                      <div>MRP: ₹{Number(batch.mrp)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Entry Form */}
            <div className="bg-white border-2 border-gray-300 rounded-lg p-4 mb-4">
              {/* Row 1: Product Info */}
              <div className="grid grid-cols-12 gap-3 mb-3">
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Barcode (Scan/Type)</label>
                  <Input 
                    ref={quickBarcodeRef}
                    value={quickForm.barcode}
                    onChange={e => setQuickForm({...quickForm, barcode: e.target.value})}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleQuickBarcodeScan();
                      }
                    }}
                    className="h-9 text-sm font-mono bg-yellow-50 border-2"
                    placeholder="Scan here..."
                    autoFocus
                  />
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Product Name *</label>
                  <Input 
                    ref={quickNameRef}
                    value={quickForm.name}
                    onChange={e => setQuickForm({...quickForm, name: e.target.value})}
                    onKeyDown={e => handleQuickKeyDown(e, quickMfgRef)}
                    className="h-9 text-sm font-semibold"
                    placeholder="e.g., Paracetamol 500mg"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Manufacturer *</label>
                  <Input 
                    ref={quickMfgRef}
                    value={quickForm.manufacturer}
                    onChange={e => setQuickForm({...quickForm, manufacturer: e.target.value})}
                    onKeyDown={e => handleQuickKeyDown(e, quickCategoryRef)}
                    list="quick-mfg-list"
                    className="h-9 text-sm"
                    placeholder="e.g., Cipla"
                  />
                  <datalist id="quick-mfg-list">
                    {manufacturers.map(m => <option key={m.id} value={m.name} />)}
                  </datalist>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Category</label>
                  <Input 
                    ref={quickCategoryRef}
                    value={quickForm.category}
                    onChange={e => setQuickForm({...quickForm, category: e.target.value})}
                    onKeyDown={e => handleQuickKeyDown(e, quickSaltRef)}
                    list="quick-cat-list"
                    className="h-9 text-sm"
                    placeholder="e.g., Tablet"
                  />
                  <datalist id="quick-cat-list">
                    {categories.map(c => <option key={c.id} value={c.name} />)}
                  </datalist>
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Salt/Composition</label>
                  <Input 
                    ref={quickSaltRef}
                    value={quickForm.salt}
                    onChange={e => setQuickForm({...quickForm, salt: e.target.value})}
                    onKeyDown={e => handleQuickKeyDown(e, quickPackRef)}
                    className="h-9 text-sm"
                    placeholder="e.g., Paracetamol IP"
                  />
                </div>
              </div>

              {/* Row 2: Packing, Rack, GST */}
              <div className="grid grid-cols-12 gap-3 mb-3 pb-3 border-b">
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Packing</label>
                  <Input 
                    ref={quickPackRef}
                    value={quickForm.packing}
                    onChange={e => setQuickForm({...quickForm, packing: e.target.value})}
                    onKeyDown={e => handleQuickKeyDown(e, quickRackRef)}
                    className="h-9 text-sm"
                    placeholder="10x15"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold text-purple-600">📍 Shelf/Rack</label>
                  <Input 
                    ref={quickRackRef}
                    value={quickForm.rackLocation}
                    onChange={e => setQuickForm({...quickForm, rackLocation: e.target.value.toUpperCase()})}
                    onKeyDown={e => handleQuickKeyDown(e, quickGstRef)}
                    className="h-9 text-sm font-bold bg-purple-50 border-purple-200"
                    placeholder="A-1, B-2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">GST %</label>
                  <select 
                    ref={quickGstRef}
                    value={quickForm.gstRate}
                    onChange={e => setQuickForm({...quickForm, gstRate: Number(e.target.value)})}
                    onKeyDown={e => handleQuickKeyDown(e, quickBatchRef)}
                    className="w-full h-9 text-sm border rounded px-2 bg-white"
                  >
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
                <div className="col-span-6 flex items-end">
                  <div className="text-xs text-gray-500">
                    {quickForm.rackLocation && (
                      <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded font-semibold">
                        📍 Medicine Location: {quickForm.rackLocation}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Stock Details */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold text-red-600">Batch No * (NEW)</label>
                  <Input 
                    ref={quickBatchRef}
                    value={quickForm.batchNo}
                    onChange={e => setQuickForm({...quickForm, batchNo: e.target.value.toUpperCase()})}
                    onKeyDown={e => handleQuickKeyDown(e, quickExpiryRef)}
                    className="h-9 text-sm font-bold bg-red-50 border-2"
                    placeholder="Enter NEW"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold text-red-600">Expiry Date * (NEW)</label>
                  <Input 
                    ref={quickExpiryRef}
                    type="date"
                    value={quickForm.expiry}
                    onChange={e => setQuickForm({...quickForm, expiry: e.target.value})}
                    onKeyDown={e => handleQuickKeyDown(e, quickQtyRef)}
                    className="h-9 text-sm bg-red-50 border-2"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold text-blue-600">Quantity * (NEW)</label>
                  <Input 
                    ref={quickQtyRef}
                    type="number"
                    value={quickForm.qty || ''}
                    onChange={e => setQuickForm({...quickForm, qty: Number(e.target.value)})}
                    onKeyDown={e => handleQuickKeyDown(e, quickPRateRef)}
                    className="h-9 text-sm font-bold text-center bg-blue-50 border-2"
                    placeholder="0"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Purchase Rate</label>
                  <div className="relative">
                    <Input 
                      ref={quickPRateRef}
                      type="number"
                      value={quickForm.pRate || ''}
                      onChange={e => setQuickForm({...quickForm, pRate: Number(e.target.value)})}
                      onKeyDown={e => handleQuickKeyDown(e, quickMrpRef)}
                      className="h-9 text-sm"
                      placeholder="0.00"
                    />
                    {quickForm.sRate && !quickForm.pRate && (
                      <button 
                        onClick={autoCalculatePurchaseRate}
                        className="absolute right-1 top-1 text-[9px] bg-blue-100 px-1 rounded hover:bg-blue-200"
                      >
                        AUTO
                      </button>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">MRP *</label>
                  <Input 
                    ref={quickMrpRef}
                    type="number"
                    value={quickForm.mrp || ''}
                    onChange={e => setQuickForm({...quickForm, mrp: Number(e.target.value)})}
                    onKeyDown={e => handleQuickKeyDown(e, quickSRateRef)}
                    onBlur={autoCalculateSaleRate}
                    className="h-9 text-sm font-semibold"
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Sale Rate *</label>
                  <div className="relative">
                    <Input 
                      ref={quickSRateRef}
                      type="number"
                      value={quickForm.sRate || ''}
                      onChange={e => setQuickForm({...quickForm, sRate: Number(e.target.value)})}
                      onKeyDown={e => handleQuickKeyDown(e, null as any)}
                      onBlur={autoCalculatePurchaseRate}
                      className="h-9 text-sm font-semibold"
                      placeholder="0.00"
                    />
                    {quickForm.mrp && !quickForm.sRate && (
                      <button 
                        onClick={autoCalculateSaleRate}
                        className="absolute right-1 top-1 text-[9px] bg-green-100 px-1 rounded hover:bg-green-200"
                      >
                        AUTO
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center mt-4 pt-3 border-t">
                <div className="text-xs text-gray-500">
                  <span className="font-semibold">Navigation:</span> Tab / Enter • 
                  <span className="ml-2 text-purple-600 font-semibold">Purple = Shelf location</span> •
                  <span className="ml-2 text-red-600 font-semibold">Red = Manual entry</span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setQuickForm({ 
                        barcode: '', name: '', manufacturer: '', category: '', salt: '', 
                        packing: '', rackLocation: '', gstRate: 12,
                        batchNo: '', expiry: '', qty: 0, pRate: 0, mrp: 0, sRate: 0 
                      });
                      setExistingBatches([]);
                      quickBarcodeRef.current?.focus();
                    }}
                  >
                    Clear (Esc)
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleQuickAdd}
                    className="bg-emerald-600 hover:bg-emerald-700 px-8 font-semibold"
                  >
                    ✓ Add Stock (Enter)
                  </Button>
                </div>
              </div>
            </div>

            {/* Recent Entries */}
            {quickProducts.length > 0 && (
              <div className="border-2 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-gray-100 to-gray-50 px-4 py-2 border-b">
                  <span className="text-sm font-bold text-gray-700">
                    📋 Recent Entries ({quickProducts.length} today)
                  </span>
                </div>
                <div className="overflow-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="py-2 px-2 text-left font-semibold">Time</th>
                        <th className="py-2 px-2 text-left font-semibold">Product Name</th>
                        <th className="py-2 px-2 text-left font-semibold">Company</th>
                        <th className="py-2 px-2 text-left font-semibold">Category</th>
                        <th className="py-2 px-2 text-center font-semibold text-purple-600">📍 Rack</th>
                        <th className="py-2 px-2 text-center font-semibold">GST</th>
                        <th className="py-2 px-2 text-center font-semibold text-red-600">Batch</th>
                        <th className="py-2 px-2 text-center font-semibold text-red-600">Expiry</th>
                        <th className="py-2 px-2 text-right font-semibold text-blue-600">Qty</th>
                        <th className="py-2 px-2 text-right font-semibold">MRP</th>
                        <th className="py-2 px-2 text-right font-semibold">S.Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quickProducts.map((p) => (
                        <tr key={p.id} className="border-t hover:bg-gray-50">
                          <td className="py-1.5 px-2 text-gray-500">{p.timestamp}</td>
                          <td className="py-1.5 px-2 font-semibold">{p.name}</td>
                          <td className="py-1.5 px-2">{p.manufacturer}</td>
                          <td className="py-1.5 px-2">{p.category || '-'}</td>
                          <td className="py-1.5 px-2 text-center font-bold text-purple-600">{p.rackLocation || '-'}</td>
                          <td className="py-1.5 px-2 text-center">{p.gstRate}%</td>
                          <td className="py-1.5 px-2 text-center font-bold text-red-600">{p.batchNo}</td>
                          <td className="py-1.5 px-2 text-center text-red-600">{p.expiry}</td>
                          <td className="py-1.5 px-2 text-right font-bold text-blue-600">{p.qty}</td>
                          <td className="py-1.5 px-2 text-right">₹{p.mrp}</td>
                          <td className="py-1.5 px-2 text-right font-semibold">₹{p.sRate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Products Tab - WITH RACK LOCATION */}
      {activeTab === 'products' && (
        <>
          <div className="bg-gray-50 px-4 py-2 border-b shrink-0 flex gap-4">
            <Input 
              placeholder="🔍 Search by name, salt, barcode, or rack location..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 text-xs flex-1 max-w-md"
            />
            <select value={stockFilter} onChange={e => setStockFilter(e.target.value)} className="h-8 text-xs border rounded px-2">
              <option value="all">All Products</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
              <option value="expiring">Expiring Soon</option>
            </select>
          </div>

          <div className="flex-1 overflow-auto bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="border-b">
                  <th className="w-10 py-2 px-2 text-left font-semibold text-gray-600">#</th>
                  <th className="w-28 py-2 px-2 text-left font-semibold text-gray-600">Barcode</th>
                  <th className="py-2 px-2 text-left font-semibold text-gray-600">Product Name</th>
                  <th className="py-2 px-2 text-left font-semibold text-gray-600">Salt</th>
                  <th className="w-24 py-2 px-2 text-left font-semibold text-gray-600">Company</th>
                  <th className="w-16 py-2 px-2 text-center font-semibold text-purple-600">📍 Rack</th>
                  <th className="w-12 py-2 px-2 text-center font-semibold text-gray-600">GST%</th>
                  <th className="w-16 py-2 px-2 text-right font-semibold text-gray-600">Stock</th>
                  <th className="w-16 py-2 px-2 text-right font-semibold text-gray-600">Rate</th>
                  <th className="w-20 py-2 px-2 text-center font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingProducts ? (
                  <tr><td colSpan={10} className="text-center py-10 text-gray-400">Loading...</td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-10 text-gray-400">No products found</td></tr>
                ) : (
                  products.map((p, i) => (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="py-1.5 px-2 text-gray-500">{i + 1}</td>
                      <td className="py-1.5 px-2 text-gray-500 font-mono text-[10px]">{p.barcode || '-'}</td>
                      <td className="py-1.5 px-2 font-medium">{p.name}</td>
                      <td className="py-1.5 px-2 text-gray-600">{p.saltComposition || '-'}</td>
                      <td className="py-1.5 px-2 text-gray-600">{p.manufacturer?.shortName || p.manufacturer?.name}</td>
                      <td className="py-1.5 px-2 text-center">
                        {p.rackLocation ? (
                          <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs font-bold">
                            {p.rackLocation}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-center font-semibold">{p.gstRate || 12}%</td>
                      <td className={`py-1.5 px-2 text-right font-semibold ${p.totalStock === 0 ? 'text-red-600' : p.totalStock < 50 ? 'text-orange-600' : 'text-green-600'}`}>
                        {p.totalStock}
                      </td>
                      <td className="py-1.5 px-2 text-right">₹{p.avgRate?.toFixed(2) || '0.00'}</td>
                      <td className="py-1.5 px-2 text-center">
                        <button onClick={() => handleViewProduct(p)} className="text-blue-600 hover:text-blue-800 mx-1">👁️</button>
                        <button onClick={() => handleEditProduct(p)} className="text-gray-600 hover:text-gray-800 mx-1">✏️</button>
                        <button onClick={() => handleDeleteProduct(p.id)} className="text-red-400 hover:text-red-600 mx-1">🗑️</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Manufacturers Tab */}
      {activeTab === 'manufacturers' && (
        <div className="flex-1 overflow-auto bg-white p-4">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr className="border-b">
                <th className="py-2 px-3 text-left font-semibold">#</th>
                <th className="py-2 px-3 text-left font-semibold">Name</th>
                <th className="py-2 px-3 text-left font-semibold">Short Name</th>
                <th className="py-2 px-3 text-left font-semibold">GSTIN</th>
                <th className="py-2 px-3 text-right font-semibold">Products</th>
              </tr>
            </thead>
            <tbody>
              {manufacturers.map((m, i) => (
                <tr key={m.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3">{i + 1}</td>
                  <td className="py-2 px-3 font-medium">{m.name}</td>
                  <td className="py-2 px-3">{m.shortName}</td>
                  <td className="py-2 px-3">{m.gstin || '-'}</td>
                  <td className="py-2 px-3 text-right">{m._count?.products || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="flex-1 overflow-auto bg-white p-4">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr className="border-b">
                <th className="py-2 px-3 text-left font-semibold">#</th>
                <th className="py-2 px-3 text-left font-semibold">Category</th>
                <th className="py-2 px-3 text-left font-semibold">Description</th>
                <th className="py-2 px-3 text-right font-semibold">Products</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c, i) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3">{i + 1}</td>
                  <td className="py-2 px-3 font-medium">{c.name}</td>
                  <td className="py-2 px-3">{c.description || '-'}</td>
                  <td className="py-2 px-3 text-right">{c._count?.products || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Batch Suggestion Modal */}
      <Dialog open={showBatchSuggestionModal} onOpenChange={setShowBatchSuggestionModal}>
        <DialogContent className="bg-white max-w-2xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-sm font-bold text-gray-800">
              Previous Batches Found - Select or Enter New
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <p className="text-xs text-gray-600 mb-3">
              These batches exist for this product. You can select one to copy rates or close to enter new batch.
            </p>
            <table className="w-full text-xs border rounded">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Batch No</th>
                  <th className="p-2 text-left">Expiry</th>
                  <th className="p-2 text-right">Stock</th>
                  <th className="p-2 text-right">P.Rate</th>
                  <th className="p-2 text-right">MRP</th>
                  <th className="p-2 text-right">S.Rate</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {existingBatches.map(batch => (
                  <tr key={batch.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-semibold">{batch.batchNo}</td>
                    <td className="p-2">{new Date(batch.expiryDate).toLocaleDateString('en-IN')}</td>
                    <td className="p-2 text-right font-semibold">{batch.currentStock}</td>
                    <td className="p-2 text-right">₹{Number(batch.purchaseRate)}</td>
                    <td className="p-2 text-right">₹{Number(batch.mrp)}</td>
                    <td className="p-2 text-right font-semibold">₹{Number(batch.saleRate)}</td>
                    <td className="p-2">
                      <Button 
                        size="sm" 
                        className="h-6 text-xs"
                        onClick={() => handleSelectExistingBatch(batch)}
                      >
                        Use This
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setShowBatchSuggestionModal(false);
                  quickBatchRef.current?.focus();
                }}
              >
                Enter New Batch
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Modal - WITH RACK & GST */}
      <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
        <DialogContent className="bg-white max-w-xl p-0 gap-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="bg-blue-600 text-white px-4 py-3 sticky top-0 z-10">
            <DialogTitle className="text-sm font-semibold">{editMode ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase border-b pb-1">Product Details</p>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Product Name *</label>
                <Input value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Barcode (Optional)</label>
                <Input value={productForm.barcode} onChange={e => setProductForm({...productForm, barcode: e.target.value})} className="h-8 text-xs font-mono" placeholder="Scan or type" />
              </div>
            </div>
            
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Salt / Composition</label>
              <Input value={productForm.saltComposition} onChange={e => setProductForm({...productForm, saltComposition: e.target.value})} className="h-8 text-xs" />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Manufacturer *</label>
                <select value={productForm.manufacturerId} onChange={e => setProductForm({...productForm, manufacturerId: e.target.value})} className="w-full h-8 text-xs border rounded px-2">
                  <option value="">Select...</option>
                  {manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Category</label>
                <select value={productForm.categoryId} onChange={e => setProductForm({...productForm, categoryId: e.target.value})} className="w-full h-8 text-xs border rounded px-2">
                  <option value="">Select...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Packing</label>
                <Input value={productForm.packingInfo} onChange={e => setProductForm({...productForm, packingInfo: e.target.value})} placeholder="10x15" className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase text-purple-600 font-bold">📍 Rack</label>
                <Input value={productForm.rackLocation} onChange={e => setProductForm({...productForm, rackLocation: e.target.value.toUpperCase()})} placeholder="A-1" className="h-8 text-xs font-bold bg-purple-50" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">GST %</label>
                <select value={productForm.gstRate} onChange={e => setProductForm({...productForm, gstRate: Number(e.target.value)})} className="w-full h-8 text-xs border rounded px-2">
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                  <option value={28}>28%</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">HSN</label>
                <Input value={productForm.hsnCode} onChange={e => setProductForm({...productForm, hsnCode: e.target.value})} className="h-8 text-xs" />
              </div>
            </div>
            
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Min Stock Alert</label>
              <Input type="number" value={productForm.minStockAlert} onChange={e => setProductForm({...productForm, minStockAlert: Number(e.target.value)})} className="h-8 text-xs" />
            </div>

            {!editMode && (
              <>
                <div className="flex items-center gap-2 pt-3 border-t mt-4">
                  <input type="checkbox" id="addStock" checked={addInitialStock} onChange={e => setAddInitialStock(e.target.checked)} className="w-4 h-4" />
                  <label htmlFor="addStock" className="text-xs font-semibold text-gray-700">Add Initial Stock</label>
                </div>

                {addInitialStock && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase">Batch No *</label>
                        <Input value={stockForm.batchNo} onChange={e => setStockForm({...stockForm, batchNo: e.target.value.toUpperCase()})} className="h-8 text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase">Expiry *</label>
                        <Input type="date" value={stockForm.expiryDate} onChange={e => setStockForm({...stockForm, expiryDate: e.target.value})} className="h-8 text-xs" />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase">Qty *</label>
                        <Input type="number" value={stockForm.quantity || ''} onChange={e => setStockForm({...stockForm, quantity: Number(e.target.value)})} className="h-8 text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase">P.Rate</label>
                        <Input type="number" value={stockForm.purchaseRate || ''} onChange={e => setStockForm({...stockForm, purchaseRate: Number(e.target.value)})} className="h-8 text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase">MRP *</label>
                        <Input type="number" value={stockForm.mrp || ''} onChange={e => setStockForm({...stockForm, mrp: Number(e.target.value)})} className="h-8 text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase">S.Rate *</label>
                        <Input type="number" value={stockForm.saleRate || ''} onChange={e => setStockForm({...stockForm, saleRate: Number(e.target.value)})} className="h-8 text-xs" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowProductModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveProduct} className="bg-blue-600 hover:bg-blue-700">
                {editMode ? 'Update' : (addInitialStock ? 'Save + Stock' : 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Product Modal - WITH RACK LOCATION */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="bg-white max-w-2xl p-0 gap-0">
          <DialogHeader className="bg-gray-100 px-4 py-3 border-b flex flex-row items-center justify-between">
            <DialogTitle className="text-sm font-semibold">{selectedProduct?.name}</DialogTitle>
            <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={openBatchModal}>+ Add Stock</Button>
          </DialogHeader>
          <div className="p-4">
            <div className="grid grid-cols-5 gap-4 text-xs mb-4">
              <div><span className="text-gray-500">Barcode:</span> <span className="font-mono">{selectedProduct?.barcode || '-'}</span></div>
              <div><span className="text-gray-500">Salt:</span> <span className="font-medium">{selectedProduct?.saltComposition || '-'}</span></div>
              <div><span className="text-gray-500">Company:</span> <span className="font-medium">{selectedProduct?.manufacturer?.name}</span></div>
              <div>
                <span className="text-gray-500">Rack:</span> 
                {selectedProduct?.rackLocation ? (
                  <span className="ml-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">{selectedProduct.rackLocation}</span>
                ) : (
                  <span className="font-medium"> -</span>
                )}
              </div>
              <div><span className="text-gray-500">GST:</span> <span className="font-bold">{selectedProduct?.gstRate || 12}%</span></div>
            </div>
            
            {selectedProduct?.rackLocation && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4 text-center">
                <p className="text-lg font-bold text-purple-700">📍 Medicine Location: {selectedProduct.rackLocation}</p>
                <p className="text-xs text-purple-600 mt-1">Find this medicine on shelf/rack {selectedProduct.rackLocation}</p>
              </div>
            )}
            
            <p className="text-xs font-semibold text-gray-600 mb-2">Batches & Stock:</p>
            <table className="w-full text-xs border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-2 text-left border">Batch</th>
                  <th className="py-2 px-2 text-left border">Expiry</th>
                  <th className="py-2 px-2 text-right border">Stock</th>
                  <th className="py-2 px-2 text-right border">P.Rate</th>
                  <th className="py-2 px-2 text-right border">MRP</th>
                  <th className="py-2 px-2 text-right border">S.Rate</th>
                </tr>
              </thead>
              <tbody>
                {selectedProduct?.batches?.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-4 text-gray-400">No batches</td></tr>
                ) : (
                  selectedProduct?.batches?.map((b: any) => (
                    <tr key={b.id} className="border-t">
                      <td className="py-1.5 px-2 border">{b.batchNo}</td>
                      <td className="py-1.5 px-2 border">{new Date(b.expiryDate).toLocaleDateString('en-IN')}</td>
                      <td className="py-1.5 px-2 text-right border font-semibold">{b.currentStock}</td>
                      <td className="py-1.5 px-2 text-right border">₹{Number(b.purchaseRate).toFixed(2)}</td>
                      <td className="py-1.5 px-2 text-right border">₹{Number(b.mrp).toFixed(2)}</td>
                      <td className="py-1.5 px-2 text-right border font-semibold">₹{Number(b.saleRate).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Other modals remain unchanged... */}
      <Dialog open={showManufacturerModal} onOpenChange={setShowManufacturerModal}>
        <DialogContent className="bg-white max-w-md p-0 gap-0">
          <DialogHeader className="bg-blue-600 text-white px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Add Manufacturer</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Name *</label>
              <Input value={mfgForm.name} onChange={e => setMfgForm({...mfgForm, name: e.target.value})} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Short Name</label>
              <Input value={mfgForm.shortName} onChange={e => setMfgForm({...mfgForm, shortName: e.target.value})} className="h-8 text-xs" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowManufacturerModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveManufacturer} className="bg-blue-600 hover:bg-blue-700">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="bg-white max-w-md p-0 gap-0">
          <DialogHeader className="bg-blue-600 text-white px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Add Category</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Name *</label>
              <Input value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Description</label>
              <Input value={catForm.description} onChange={e => setCatForm({...catForm, description: e.target.value})} className="h-8 text-xs" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowCategoryModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveCategory} className="bg-blue-600 hover:bg-blue-700">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBatchModal} onOpenChange={setShowBatchModal}>
        <DialogContent className="bg-white max-w-md p-0 gap-0">
          <DialogHeader className="bg-emerald-600 text-white px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Add Stock: {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Batch No *</label>
                <Input value={batchForm.batchNo} onChange={e => setBatchForm({...batchForm, batchNo: e.target.value.toUpperCase()})} className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Expiry *</label>
                <Input type="date" value={batchForm.expiryDate} onChange={e => setBatchForm({...batchForm, expiryDate: e.target.value})} className="h-8 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Qty *</label>
                <Input type="number" value={batchForm.quantity || ''} onChange={e => setBatchForm({...batchForm, quantity: Number(e.target.value)})} className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">P.Rate</label>
                <Input type="number" value={batchForm.purchaseRate || ''} onChange={e => setBatchForm({...batchForm, purchaseRate: Number(e.target.value)})} className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">MRP *</label>
                <Input type="number" value={batchForm.mrp || ''} onChange={e => setBatchForm({...batchForm, mrp: Number(e.target.value)})} className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">S.Rate *</label>
                <Input type="number" value={batchForm.saleRate || ''} onChange={e => setBatchForm({...batchForm, saleRate: Number(e.target.value)})} className="h-8 text-xs" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowBatchModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveBatch} className="bg-emerald-600 hover:bg-emerald-700">Add Stock</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="bg-white max-w-2xl p-0 gap-0">
          <DialogHeader className="bg-blue-600 text-white px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Import from CSV</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-3">
            <div className="bg-gray-50 p-3 rounded text-xs">
              <p className="font-semibold mb-1">CSV Format (with stock):</p>
              <code className="text-[10px] text-gray-600 block">barcode,name,salt,manufacturer,packing,rack,gst,hsn,batchNo,expiry,qty,mrp,saleRate,purchaseRate</code>
              <p className="mt-2 text-gray-500">Example:</p>
              <code className="text-[10px] text-gray-600 block">8901234567890,Paracetamol 500mg,Paracetamol,Cipla,10x15,A-1,12,3004,BATCH001,2025-12-31,100,35,28,22</code>
            </div>
            <textarea value={csvData} onChange={e => setCsvData(e.target.value)} placeholder="Paste CSV..." className="w-full h-40 border rounded p-2 text-xs font-mono" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowImportModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleImport} className="bg-blue-600 hover:bg-blue-700">Import</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
