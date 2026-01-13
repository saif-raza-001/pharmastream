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
import { formatExpiryDisplay, formatExpiryOnType, parseExpiryInput } from "@/lib/expiryUtils";

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
  const [editingBatch, setEditingBatch] = useState<any>(null);

  // Edit mode for manufacturers and categories
  const [editingManufacturer, setEditingManufacturer] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  // Inline add forms inside Add Product modal
  const [showInlineMfgForm, setShowInlineMfgForm] = useState(false);
  const [showInlineCatForm, setShowInlineCatForm] = useState(false);
  const [inlineMfgName, setInlineMfgName] = useState('');
  const [inlineCatName, setInlineCatName] = useState('');
  const [savingInlineMfg, setSavingInlineMfg] = useState(false);
  const [savingInlineCat, setSavingInlineCat] = useState(false);

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

  // Batches for edit mode
  const [productBatches, setProductBatches] = useState<any[]>([]);

  const [addInitialStock, setAddInitialStock] = useState(false);
  const [stockForm, setStockForm] = useState({
    batchNo: '', expiryDate: '', quantity: 0, purchaseRate: 0, mrp: 0, saleRate: 0
  });

  const [batchForm, setBatchForm] = useState({
    batchNo: '', expiryDate: '', quantity: 0, purchaseRate: 0, mrp: 0, saleRate: 0
  });

  const [mfgForm, setMfgForm] = useState({ name: '', shortName: '', address: '', gstin: '' });
  const [catForm, setCatForm] = useState({ name: '', description: '' });
  const [excelData, setExcelData] = useState('');

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
  const inlineMfgInputRef = useRef<HTMLInputElement>(null);
  const inlineCatInputRef = useRef<HTMLInputElement>(null);

  const [quickForm, setQuickForm] = useState({
    barcode: '', name: '', manufacturer: '', category: '', salt: '',
    packing: '', rackLocation: '', gstRate: 12,
    batchNo: '', expiry: '', qty: 0, pRate: 0, mrp: 0, sRate: 0
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

  useEffect(() => {
    if (showInlineMfgForm && inlineMfgInputRef.current) {
      setTimeout(() => inlineMfgInputRef.current?.focus(), 100);
    }
  }, [showInlineMfgForm]);

  useEffect(() => {
    if (showInlineCatForm && inlineCatInputRef.current) {
      setTimeout(() => inlineCatInputRef.current?.focus(), 100);
    }
  }, [showInlineCatForm]);

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

  const handleInlineAddMfg = async () => {
    if (!inlineMfgName.trim()) { toast.error('Enter manufacturer name'); return; }
    setSavingInlineMfg(true);
    try {
      const res = await manufacturersAPI.create({ name: inlineMfgName.trim(), shortName: inlineMfgName.trim().substring(0, 10) });
      toast.success(`Manufacturer "${res.data.name}" added`);
      await fetchManufacturers();
      setProductForm({ ...productForm, manufacturerId: res.data.id });
      setInlineMfgName('');
      setShowInlineMfgForm(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add manufacturer');
    } finally {
      setSavingInlineMfg(false);
    }
  };

  const handleInlineAddCat = async () => {
    if (!inlineCatName.trim()) { toast.error('Enter category name'); return; }
    setSavingInlineCat(true);
    try {
      const res = await categoriesAPI.create({ name: inlineCatName.trim() });
      toast.success(`Category "${res.data.name}" added`);
      await fetchCategories();
      setProductForm({ ...productForm, categoryId: res.data.id });
      setInlineCatName('');
      setShowInlineCatForm(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add category');
    } finally {
      setSavingInlineCat(false);
    }
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
            expiryDate: parseExpiryInput(stockForm.expiryDate),
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

  const handleEditProduct = async (product: any) => {
    try {
      const res = await productsAPI.getById(product.id);
      const fullProduct = res.data;
      setSelectedProduct(fullProduct);
      setProductForm({
        name: fullProduct.name,
        barcode: fullProduct.barcode || '',
        saltComposition: fullProduct.saltComposition || '',
        hsnCode: fullProduct.hsnCode || '3004',
        manufacturerId: fullProduct.manufacturerId,
        categoryId: fullProduct.categoryId || '',
        packingInfo: fullProduct.packingInfo || '',
        rackLocation: fullProduct.rackLocation || '',
        gstRate: fullProduct.gstRate || 12,
        minStockAlert: fullProduct.minStockAlert || 50
      });
      setProductBatches(fullProduct.batches || []);
      setAddInitialStock(false);
      setEditMode(true);
      setShowProductModal(true);
    } catch (e) {
      toast.error("Failed to load product details");
    }
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
    setProductForm({ name: '', barcode: '', saltComposition: '', hsnCode: '3004', manufacturerId: '', categoryId: '', packingInfo: '', rackLocation: '', gstRate: 12, minStockAlert: 50 });
    setStockForm({ batchNo: '', expiryDate: '', quantity: 0, purchaseRate: 0, mrp: 0, saleRate: 0 });
    setProductBatches([]);
    setAddInitialStock(false);
    setSelectedProduct(null);
    setEditMode(false);
    setShowInlineMfgForm(false);
    setShowInlineCatForm(false);
    setInlineMfgName('');
    setInlineCatName('');
  };

  // MANUFACTURER EDIT/DELETE
  const handleEditManufacturer = (mfg: any) => {
    setEditingManufacturer(mfg);
    setMfgForm({ name: mfg.name, shortName: mfg.shortName || '', address: mfg.address || '', gstin: mfg.gstin || '' });
    setShowManufacturerModal(true);
  };

  const handleDeleteManufacturer = async (id: string) => {
    if (!confirm('Delete this manufacturer?')) return;
    try {
      await manufacturersAPI.delete(id);
      toast.success('Manufacturer deleted');
      fetchManufacturers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleSaveManufacturer = async () => {
    if (!mfgForm.name) { toast.error('Name required'); return; }
    try {
      if (editingManufacturer) {
        await manufacturersAPI.update(editingManufacturer.id, mfgForm);
        toast.success('Manufacturer updated');
      } else {
        await manufacturersAPI.create(mfgForm);
        toast.success('Manufacturer created');
      }
      setShowManufacturerModal(false);
      setMfgForm({ name: '', shortName: '', address: '', gstin: '' });
      setEditingManufacturer(null);
      fetchManufacturers();
    } catch (err) { toast.error('Failed'); }
  };

  // CATEGORY EDIT/DELETE
  const handleEditCategory = (cat: any) => {
    setEditingCategory(cat);
    setCatForm({ name: cat.name, description: cat.description || '' });
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try {
      await categoriesAPI.delete(id);
      toast.success('Category deleted');
      fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleSaveCategory = async () => {
    if (!catForm.name) { toast.error('Name required'); return; }
    try {
      if (editingCategory) {
        await categoriesAPI.update(editingCategory.id, catForm);
        toast.success('Category updated');
      } else {
        await categoriesAPI.create(catForm);
        toast.success('Category created');
      }
      setShowCategoryModal(false);
      setCatForm({ name: '', description: '' });
      setEditingCategory(null);
      fetchCategories();
    } catch (err) { toast.error('Failed'); }
  };

  // PASTE FROM EXCEL IMPORT
  const handleExcelImport = async () => {
    if (!excelData.trim()) { toast.error('Paste data from Excel first'); return; }
    try {
      const lines = excelData.trim().split('\n');
      const products = [];
      for (const line of lines) {
        const cols = line.split(/\t/).map(c => c.trim());
        if (cols.length < 2) continue;
        const [name, salt, manufacturer, category, packing, rack, gst, hsn, batchNo, expiry, qty, pRate, mrp, sRate] = cols;
        if (!name || !manufacturer) continue;
        products.push({
          name, salt: salt || '', manufacturer, category: category || '', packing: packing || '', rack: rack || '',
          gst: parseFloat(gst) || 12, hsn: hsn || '3004', batchNo: batchNo || '', expiry: expiry || '',
          quantity: parseInt(qty) || 0, purchaseRate: parseFloat(pRate) || 0, mrp: parseFloat(mrp) || 0, saleRate: parseFloat(sRate) || 0
        });
      }
      if (products.length === 0) { toast.error('No valid data found'); return; }
      const res = await productsAPI.import(products);
      toast.success(`Created: ${res.data.created}, Updated: ${res.data.updated}`);
      setShowImportModal(false);
      setExcelData('');
      fetchProducts();
      fetchManufacturers();
      fetchCategories();
    } catch (err) {
      toast.error('Import failed');
    }
  };

  // BATCH HANDLERS
  const handleEditBatch = (batch: any) => {
    setEditingBatch(batch);
    setBatchForm({
      batchNo: batch.batchNo,
      expiryDate: formatExpiryDisplay(batch.expiryDate),
      quantity: batch.currentStock,
      purchaseRate: Number(batch.purchaseRate),
      mrp: Number(batch.mrp),
      saleRate: Number(batch.saleRate)
    });
    setShowBatchModal(true);
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm("Delete this batch?")) return;
    try {
      await productsAPI.deleteBatch(batchId);
      toast.success("Batch deleted");
      if (selectedProduct?.id) {
        const res = await productsAPI.getById(selectedProduct.id);
        setSelectedProduct(res.data);
        setProductBatches(res.data.batches || []);
      }
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete");
    }
  };

  const openAddBatchModal = () => {
    setEditingBatch(null);
    setBatchForm({ batchNo: '', expiryDate: '', quantity: 0, purchaseRate: 0, mrp: 0, saleRate: 0 });
    setShowBatchModal(true);
  };

  const handleSaveBatch = async () => {
    const productId = selectedProduct?.id;
    if (!productId) return;
    if (!batchForm.batchNo || !batchForm.expiryDate || batchForm.quantity <= 0 || batchForm.mrp <= 0 || batchForm.saleRate <= 0) {
      toast.error("Fill all fields"); return;
    }
    try {
      await productsAPI.addBatch({
        productId,
        batchNo: batchForm.batchNo,
        expiryDate: parseExpiryInput(batchForm.expiryDate),
        currentStock: batchForm.quantity,
        purchaseRate: batchForm.purchaseRate || batchForm.saleRate * 0.8,
        mrp: batchForm.mrp,
        saleRate: batchForm.saleRate
      });
      toast.success("Stock added");
      const res = await productsAPI.getById(productId);
      setSelectedProduct(res.data);
      setProductBatches(res.data.batches || []);
      fetchProducts();
      setShowBatchModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed");
    }
  };

  const handleUpdateBatch = async () => {
    if (!editingBatch?.id) return;
    if (!batchForm.batchNo || !batchForm.expiryDate || batchForm.quantity < 0 || batchForm.mrp <= 0 || batchForm.saleRate <= 0) {
      toast.error("Fill all fields correctly"); return;
    }
    try {
      await productsAPI.updateBatch(editingBatch.id, {
        batchNo: batchForm.batchNo,
        expiryDate: parseExpiryInput(batchForm.expiryDate),
        currentStock: batchForm.quantity,
        purchaseRate: batchForm.purchaseRate || batchForm.saleRate * 0.8,
        mrp: batchForm.mrp,
        saleRate: batchForm.saleRate
      });
      toast.success("Batch updated");
      if (selectedProduct?.id) {
        const res = await productsAPI.getById(selectedProduct.id);
        setSelectedProduct(res.data);
        setProductBatches(res.data.batches || []);
      }
      fetchProducts();
      setShowBatchModal(false);
      setEditingBatch(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update");
    }
  };

  // QUICK ENTRY HANDLERS
  const handleQuickBarcodeScan = async () => {
    if (!quickForm.barcode) return;
    try {
      const res = await productsAPI.getByBarcode(quickForm.barcode);
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
        setQuickForm(prev => ({ ...prev, mrp: Number(lastBatch.mrp), sRate: Number(lastBatch.saleRate), pRate: Number(lastBatch.purchaseRate) }));
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

  const handleQuickKeyDown = (e: React.KeyboardEvent, nextRef: any) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRef?.current) { nextRef.current.focus(); } else { handleQuickAdd(); }
    }
  };

  const autoCalculateSaleRate = () => {
    if (quickForm.mrp) { setQuickForm(prev => ({ ...prev, sRate: Math.round(quickForm.mrp * 0.80) })); }
  };

  const autoCalculatePurchaseRate = () => {
    if (quickForm.sRate) { setQuickForm(prev => ({ ...prev, pRate: Math.round(quickForm.sRate * 0.75) })); }
  };

  const handleQuickAdd = async () => {
    if (!quickForm.name || !quickForm.manufacturer) { toast.error("Name and Manufacturer required"); return; }
    if (!quickForm.batchNo || !quickForm.expiry || !quickForm.qty || !quickForm.mrp || !quickForm.sRate) {
      toast.error("Batch, Expiry, Qty, MRP, and Sale Rate required"); return;
    }
    try {
      let mfg = manufacturers.find(m => m.name.toLowerCase() === quickForm.manufacturer.toLowerCase());
      if (!mfg) {
        const mfgRes = await manufacturersAPI.create({ name: quickForm.manufacturer, shortName: quickForm.manufacturer.substring(0, 10) });
        mfg = mfgRes.data;
        fetchManufacturers();
      }
      let categoryId = null;
      if (quickForm.category) {
        let cat = categories.find(c => c.name.toLowerCase() === quickForm.category.toLowerCase());
        if (!cat) {
          const catRes = await categoriesAPI.create({ name: quickForm.category });
          cat = catRes.data;
          fetchCategories();
        }
        categoryId = cat.id;
      }
      let productId = null;
      if (quickForm.barcode) {
        try { const res = await productsAPI.getByBarcode(quickForm.barcode); productId = res.data.id; } catch (e) {}
      }
      if (!productId) {
        const productRes = await productsAPI.create({
          name: quickForm.name, barcode: quickForm.barcode || null, saltComposition: quickForm.salt,
          manufacturerId: mfg.id, categoryId, packingInfo: quickForm.packing, rackLocation: quickForm.rackLocation,
          gstRate: quickForm.gstRate, hsnCode: '3004'
        });
        productId = productRes.data.id;
        toast.info("New product created");
      }
      await productsAPI.addBatch({
        productId, batchNo: quickForm.batchNo, expiryDate: parseExpiryInput(quickForm.expiry),
        currentStock: quickForm.qty, purchaseRate: quickForm.pRate || quickForm.sRate * 0.75,
        mrp: quickForm.mrp, saleRate: quickForm.sRate
      });
      toast.success(`✓ Added: ${quickForm.name} | Batch: ${quickForm.batchNo} | Qty: ${quickForm.qty}`);
      setQuickProducts([{ ...quickForm, timestamp: new Date().toLocaleTimeString(), id: Date.now() }, ...quickProducts.slice(0, 19)]);
      setQuickForm({ barcode: '', name: '', manufacturer: '', category: '', salt: '', packing: '', rackLocation: '', gstRate: 12, batchNo: '', expiry: '', qty: 0, pRate: 0, mrp: 0, sRate: 0 });
      setExistingBatches([]);
      fetchProducts();
      quickBarcodeRef.current?.focus();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed");
    }
  };

  const calculateNetPrice = (rate: number, gstPct: number): number => rate * (1 + gstPct / 100);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-11 bg-blue-700 flex items-center justify-between px-4 shrink-0">
        <h1 className="text-white font-semibold text-sm">Master Data</h1>
        <div className="flex gap-2">
          {activeTab === 'products' && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs bg-white text-blue-700" onClick={() => setShowImportModal(true)}>
                📋 Paste from Excel
              </Button>
              <Button size="sm" className="h-7 text-xs bg-white text-blue-700" onClick={() => { resetProductForm(); setShowProductModal(true); }}>
                + Add Product
              </Button>
            </>
          )}
          {activeTab === 'manufacturers' && (
            <Button size="sm" className="h-7 text-xs bg-white text-blue-700" onClick={() => { setEditingManufacturer(null); setMfgForm({ name: '', shortName: '', address: '', gstin: '' }); setShowManufacturerModal(true); }}>
              + Add Manufacturer
            </Button>
          )}
          {activeTab === 'categories' && (
            <Button size="sm" className="h-7 text-xs bg-white text-blue-700" onClick={() => { setEditingCategory(null); setCatForm({ name: '', description: '' }); setShowCategoryModal(true); }}>
              + Add Category
            </Button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b px-4 shrink-0">
        <div className="flex gap-0">
          {(['quickentry', 'products', 'manufacturers', 'categories'] as TabType[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition ${activeTab === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab === 'quickentry' ? '⚡ Quick Entry' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Entry Tab */}
      {activeTab === 'quickentry' && (
        <div className="flex-1 overflow-auto bg-white p-4">
          <div className="max-w-7xl mx-auto">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-bold text-blue-800 mb-2">⚡ Quick Stock Entry - Professional Mode</h3>
              <div className="grid grid-cols-3 gap-4 text-xs text-gray-700">
                <div><p className="font-semibold text-blue-700 mb-1">Barcode Scan:</p><ul className="ml-4"><li>✓ Auto-fills Product, Company</li><li>✓ Shows rack location</li></ul></div>
                <div><p className="font-semibold text-purple-700 mb-1">Manual Entry:</p><ul className="ml-4"><li>• Batch No</li><li>• Expiry & Quantity</li></ul></div>
                <div><p className="font-semibold text-green-700 mb-1">📍 Rack Location:</p><ul className="ml-4"><li>• Enter: A-1, B-2</li><li>• Find medicine fast</li></ul></div>
              </div>
            </div>

            <div className="bg-white border-2 border-gray-300 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-12 gap-3 mb-3">
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Barcode</label>
                  <Input ref={quickBarcodeRef} value={quickForm.barcode} onChange={e => setQuickForm({...quickForm, barcode: e.target.value})}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleQuickBarcodeScan(); }}}
                    className="h-9 text-sm font-mono bg-yellow-50 border-2" placeholder="Scan..." autoFocus />
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Product Name *</label>
                  <Input ref={quickNameRef} value={quickForm.name} onChange={e => setQuickForm({...quickForm, name: e.target.value})}
                    onKeyDown={e => handleQuickKeyDown(e, quickMfgRef)} className="h-9 text-sm font-semibold" placeholder="Paracetamol 500mg" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Manufacturer *</label>
                  <Input ref={quickMfgRef} value={quickForm.manufacturer} onChange={e => setQuickForm({...quickForm, manufacturer: e.target.value})}
                    onKeyDown={e => handleQuickKeyDown(e, quickCategoryRef)} list="mfg-list" className="h-9 text-sm" placeholder="Cipla" />
                  <datalist id="mfg-list">{manufacturers.map(m => <option key={m.id} value={m.name} />)}</datalist>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Category</label>
                  <Input ref={quickCategoryRef} value={quickForm.category} onChange={e => setQuickForm({...quickForm, category: e.target.value})}
                    onKeyDown={e => handleQuickKeyDown(e, quickSaltRef)} list="cat-list" className="h-9 text-sm" placeholder="Tablet" />
                  <datalist id="cat-list">{categories.map(c => <option key={c.id} value={c.name} />)}</datalist>
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Salt</label>
                  <Input ref={quickSaltRef} value={quickForm.salt} onChange={e => setQuickForm({...quickForm, salt: e.target.value})}
                    onKeyDown={e => handleQuickKeyDown(e, quickPackRef)} className="h-9 text-sm" placeholder="Paracetamol IP" />
                </div>
              </div>
              <div className="grid grid-cols-12 gap-3 mb-3 pb-3 border-b">
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Packing</label>
                  <Input ref={quickPackRef} value={quickForm.packing} onChange={e => setQuickForm({...quickForm, packing: e.target.value})}
                    onKeyDown={e => handleQuickKeyDown(e, quickRackRef)} className="h-9 text-sm" placeholder="10x15" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold text-purple-600">📍 Rack</label>
                  <Input ref={quickRackRef} value={quickForm.rackLocation} onChange={e => setQuickForm({...quickForm, rackLocation: e.target.value.toUpperCase()})}
                    onKeyDown={e => handleQuickKeyDown(e, quickGstRef)} className="h-9 text-sm font-bold bg-purple-50" placeholder="A-1" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">GST %</label>
                  <select ref={quickGstRef} value={quickForm.gstRate} onChange={e => setQuickForm({...quickForm, gstRate: Number(e.target.value)})}
                    onKeyDown={e => handleQuickKeyDown(e, quickBatchRef)} className="w-full h-9 text-sm border rounded px-2">
                    <option value={5}>5%</option><option value={12}>12%</option><option value={18}>18%</option><option value={28}>28%</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold text-red-600">Batch *</label>
                  <Input ref={quickBatchRef} value={quickForm.batchNo} onChange={e => setQuickForm({...quickForm, batchNo: e.target.value.toUpperCase()})}
                    onKeyDown={e => handleQuickKeyDown(e, quickExpiryRef)} className="h-9 text-sm font-bold bg-red-50 border-2" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold text-red-600">Expiry *</label>
                  <Input ref={quickExpiryRef} value={quickForm.expiry} onChange={e => setQuickForm({...quickForm, expiry: formatExpiryOnType(e.target.value, quickForm.expiry)})}
                    onKeyDown={e => handleQuickKeyDown(e, quickQtyRef)} className="h-9 text-sm bg-red-50 border-2 text-center font-semibold" placeholder="MM/YY" maxLength={5} />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold text-blue-600">Qty *</label>
                  <Input ref={quickQtyRef} type="number" value={quickForm.qty || ''} onChange={e => setQuickForm({...quickForm, qty: Number(e.target.value)})}
                    onKeyDown={e => handleQuickKeyDown(e, quickPRateRef)} className="h-9 text-sm font-bold text-center bg-blue-50 border-2" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">P.Rate</label>
                  <Input ref={quickPRateRef} type="number" value={quickForm.pRate || ''} onChange={e => setQuickForm({...quickForm, pRate: Number(e.target.value)})}
                    onKeyDown={e => handleQuickKeyDown(e, quickMrpRef)} className="h-9 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">MRP *</label>
                  <Input ref={quickMrpRef} type="number" value={quickForm.mrp || ''} onChange={e => setQuickForm({...quickForm, mrp: Number(e.target.value)})}
                    onKeyDown={e => handleQuickKeyDown(e, quickSRateRef)} onBlur={autoCalculateSaleRate} className="h-9 text-sm font-semibold" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">S.Rate *</label>
                  <Input ref={quickSRateRef} type="number" value={quickForm.sRate || ''} onChange={e => setQuickForm({...quickForm, sRate: Number(e.target.value)})}
                    onKeyDown={e => handleQuickKeyDown(e, null)} onBlur={autoCalculatePurchaseRate} className="h-9 text-sm font-semibold" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                <Button variant="outline" size="sm" onClick={() => { setQuickForm({ barcode: '', name: '', manufacturer: '', category: '', salt: '', packing: '', rackLocation: '', gstRate: 12, batchNo: '', expiry: '', qty: 0, pRate: 0, mrp: 0, sRate: 0 }); setExistingBatches([]); quickBarcodeRef.current?.focus(); }}>Clear</Button>
                <Button size="sm" onClick={handleQuickAdd} className="bg-emerald-600 hover:bg-emerald-700 px-8 font-semibold">✓ Add Stock</Button>
              </div>
            </div>

            {quickProducts.length > 0 && (
              <div className="border-2 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b"><span className="text-sm font-bold">📋 Recent ({quickProducts.length})</span></div>
                <div className="overflow-auto max-h-60">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr><th className="py-2 px-2 text-left">Time</th><th className="py-2 px-2 text-left">Product</th><th className="py-2 px-2 text-left">Company</th><th className="py-2 px-2 text-center">Batch</th><th className="py-2 px-2 text-center">Expiry</th><th className="py-2 px-2 text-right">Qty</th><th className="py-2 px-2 text-right">MRP</th></tr>
                    </thead>
                    <tbody>
                      {quickProducts.map(p => (
                        <tr key={p.id} className="border-t hover:bg-gray-50">
                          <td className="py-1.5 px-2 text-gray-500">{p.timestamp}</td>
                          <td className="py-1.5 px-2 font-semibold">{p.name}</td>
                          <td className="py-1.5 px-2">{p.manufacturer}</td>
                          <td className="py-1.5 px-2 text-center font-bold text-red-600">{p.batchNo}</td>
                          <td className="py-1.5 px-2 text-center">{p.expiry}</td>
                          <td className="py-1.5 px-2 text-right font-bold text-blue-600">{p.qty}</td>
                          <td className="py-1.5 px-2 text-right">₹{p.mrp}</td>
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

      {/* Products Tab */}
      {activeTab === 'products' && (
        <>
          <div className="bg-gray-50 px-4 py-2 border-b shrink-0 flex gap-4">
            <Input placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-xs flex-1 max-w-md" />
            <select value={stockFilter} onChange={e => setStockFilter(e.target.value)} className="h-8 text-xs border rounded px-2">
              <option value="all">All</option><option value="low">Low Stock</option><option value="out">Out</option><option value="expiring">Expiring</option>
            </select>
          </div>
          <div className="flex-1 overflow-auto bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="border-b">
                  <th className="w-8 py-2 px-2 text-left">#</th>
                  <th className="py-2 px-2 text-left">Product</th>
                  <th className="w-24 py-2 px-2 text-left">Company</th>
                  <th className="w-16 py-2 px-2 text-center text-purple-600">📍 Rack</th>
                  <th className="w-12 py-2 px-2 text-center">GST</th>
                  <th className="w-16 py-2 px-2 text-right">Stock</th>
                  <th className="w-16 py-2 px-2 text-right">Rate</th>
                  <th className="w-20 py-2 px-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingProducts ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">Loading...</td></tr> :
                 products.length === 0 ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">No products</td></tr> :
                 products.map((p, i) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="py-1.5 px-2 text-gray-500">{i + 1}</td>
                    <td className="py-1.5 px-2"><div className="font-medium">{p.name}</div><div className="text-[10px] text-gray-400">{p.saltComposition || '-'}</div></td>
                    <td className="py-1.5 px-2 text-[10px]">{p.manufacturer?.shortName || p.manufacturer?.name}</td>
                    <td className="py-1.5 px-2 text-center">{p.rackLocation ? <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{p.rackLocation}</span> : '-'}</td>
                    <td className="py-1.5 px-2 text-center"><span className="bg-blue-50 text-blue-700 px-1 py-0.5 rounded text-[10px]">{p.gstRate || 12}%</span></td>
                    <td className={`py-1.5 px-2 text-right font-semibold ${p.totalStock === 0 ? 'text-red-600' : p.totalStock < 50 ? 'text-orange-600' : 'text-green-600'}`}>{p.totalStock}</td>
                    <td className="py-1.5 px-2 text-right">₹{(p.avgRate || 0).toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-center">
                      <button onClick={() => handleViewProduct(p)} className="text-blue-600 hover:text-blue-800 mx-1">👁️</button>
                      <button onClick={() => handleEditProduct(p)} className="text-gray-600 hover:text-gray-800 mx-1">✏️</button>
                      <button onClick={() => handleDeleteProduct(p.id)} className="text-red-400 hover:text-red-600 mx-1">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Manufacturers Tab */}
      {activeTab === 'manufacturers' && (
        <div className="flex-1 overflow-auto bg-white p-4">
          <table className="w-full text-xs">
            <thead className="bg-gray-50"><tr className="border-b"><th className="py-2 px-3 text-left">#</th><th className="py-2 px-3 text-left">Name</th><th className="py-2 px-3 text-left">Short</th><th className="py-2 px-3 text-left">GSTIN</th><th className="py-2 px-3 text-right">Products</th><th className="py-2 px-3 text-center">Actions</th></tr></thead>
            <tbody>
              {manufacturers.map((m, i) => (
                <tr key={m.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3">{i + 1}</td>
                  <td className="py-2 px-3 font-medium">{m.name}</td>
                  <td className="py-2 px-3">{m.shortName || '-'}</td>
                  <td className="py-2 px-3">{m.gstin || '-'}</td>
                  <td className="py-2 px-3 text-right">{m._count?.products || 0}</td>
                  <td className="py-2 px-3 text-center">
                    <button onClick={() => handleEditManufacturer(m)} className="text-blue-600 hover:text-blue-800 mx-1">✏️</button>
                    <button onClick={() => handleDeleteManufacturer(m.id)} className="text-red-400 hover:text-red-600 mx-1">🗑️</button>
                  </td>
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
            <thead className="bg-gray-50"><tr className="border-b"><th className="py-2 px-3 text-left">#</th><th className="py-2 px-3 text-left">Category</th><th className="py-2 px-3 text-left">Description</th><th className="py-2 px-3 text-right">Products</th><th className="py-2 px-3 text-center">Actions</th></tr></thead>
            <tbody>
              {categories.map((c, i) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3">{i + 1}</td>
                  <td className="py-2 px-3 font-medium">{c.name}</td>
                  <td className="py-2 px-3">{c.description || '-'}</td>
                  <td className="py-2 px-3 text-right">{c._count?.products || 0}</td>
                  <td className="py-2 px-3 text-center">
                    <button onClick={() => handleEditCategory(c)} className="text-blue-600 hover:text-blue-800 mx-1">✏️</button>
                    <button onClick={() => handleDeleteCategory(c.id)} className="text-red-400 hover:text-red-600 mx-1">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Batch Suggestion Modal */}
      <Dialog open={showBatchSuggestionModal} onOpenChange={setShowBatchSuggestionModal}>
        <DialogContent className="bg-white max-w-2xl">
          <DialogHeader className="border-b pb-3"><DialogTitle className="text-sm font-bold">Previous Batches - Select or Enter New</DialogTitle></DialogHeader>
          <div className="mt-4">
            <table className="w-full text-xs border rounded">
              <thead className="bg-gray-100"><tr><th className="p-2 text-left">Batch</th><th className="p-2 text-left">Expiry</th><th className="p-2 text-right">Stock</th><th className="p-2 text-right">MRP</th><th className="p-2"></th></tr></thead>
              <tbody>
                {existingBatches.map(batch => (
                  <tr key={batch.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-semibold">{batch.batchNo}</td>
                    <td className="p-2">{formatExpiryDisplay(batch.expiryDate)}</td>
                    <td className="p-2 text-right">{batch.currentStock}</td>
                    <td className="p-2 text-right">₹{Number(batch.mrp)}</td>
                    <td className="p-2"><Button size="sm" className="h-6 text-xs" onClick={() => handleSelectExistingBatch(batch)}>Use</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mt-4 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => { setShowBatchSuggestionModal(false); quickBatchRef.current?.focus(); }}>Enter New Batch</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Modal - WITH BATCH SECTION IN EDIT MODE */}
      <Dialog open={showProductModal} onOpenChange={(open) => { setShowProductModal(open); if (!open) { setShowInlineMfgForm(false); setShowInlineCatForm(false); } }}>
        <DialogContent className="bg-white max-w-2xl p-0 gap-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="bg-blue-600 text-white px-4 py-3 sticky top-0 z-10">
            <DialogTitle className="text-sm font-semibold">{editMode ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase border-b pb-1">Product Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-gray-500 uppercase">Product Name *</label><Input value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="h-8 text-xs" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase">Barcode</label><Input value={productForm.barcode} onChange={e => setProductForm({...productForm, barcode: e.target.value})} className="h-8 text-xs font-mono" /></div>
            </div>
            <div><label className="text-[10px] text-gray-500 uppercase">Salt / Composition</label><Input value={productForm.saltComposition} onChange={e => setProductForm({...productForm, saltComposition: e.target.value})} className="h-8 text-xs" /></div>
            
            {/* Manufacturer */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-gray-500 uppercase">Manufacturer *</label>
                {!showInlineMfgForm && <button type="button" onClick={() => setShowInlineMfgForm(true)} className="text-[10px] text-blue-600 font-semibold">➕ Add</button>}
              </div>
              {showInlineMfgForm ? (
                <div className="bg-blue-50 border border-blue-200 rounded p-2 flex gap-2">
                  <Input ref={inlineMfgInputRef} value={inlineMfgName} onChange={e => setInlineMfgName(e.target.value)} placeholder="New manufacturer" className="h-8 text-xs flex-1"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleInlineAddMfg(); } else if (e.key === 'Escape') { setShowInlineMfgForm(false); setInlineMfgName(''); }}} />
                  <Button size="sm" className="h-8 text-xs bg-blue-600" onClick={handleInlineAddMfg} disabled={savingInlineMfg}>{savingInlineMfg ? '...' : '✓'}</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setShowInlineMfgForm(false); setInlineMfgName(''); }}>✕</Button>
                </div>
              ) : (
                <select value={productForm.manufacturerId} onChange={e => setProductForm({...productForm, manufacturerId: e.target.value})} className="w-full h-8 text-xs border rounded px-2">
                  <option value="">Select...</option>{manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )}
            </div>

            {/* Category */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-gray-500 uppercase">Category</label>
                {!showInlineCatForm && <button type="button" onClick={() => setShowInlineCatForm(true)} className="text-[10px] text-blue-600 font-semibold">➕ Add</button>}
              </div>
              {showInlineCatForm ? (
                <div className="bg-green-50 border border-green-200 rounded p-2 flex gap-2">
                  <Input ref={inlineCatInputRef} value={inlineCatName} onChange={e => setInlineCatName(e.target.value)} placeholder="New category" className="h-8 text-xs flex-1"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleInlineAddCat(); } else if (e.key === 'Escape') { setShowInlineCatForm(false); setInlineCatName(''); }}} />
                  <Button size="sm" className="h-8 text-xs bg-green-600" onClick={handleInlineAddCat} disabled={savingInlineCat}>{savingInlineCat ? '...' : '✓'}</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setShowInlineCatForm(false); setInlineCatName(''); }}>✕</Button>
                </div>
              ) : (
                <select value={productForm.categoryId} onChange={e => setProductForm({...productForm, categoryId: e.target.value})} className="w-full h-8 text-xs border rounded px-2">
                  <option value="">Select...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div><label className="text-[10px] text-gray-500 uppercase">Packing</label><Input value={productForm.packingInfo} onChange={e => setProductForm({...productForm, packingInfo: e.target.value})} className="h-8 text-xs" placeholder="10x15" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase text-purple-600">📍 Rack</label><Input value={productForm.rackLocation} onChange={e => setProductForm({...productForm, rackLocation: e.target.value.toUpperCase()})} className="h-8 text-xs bg-purple-50" placeholder="A-1" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase">GST %</label><select value={productForm.gstRate} onChange={e => setProductForm({...productForm, gstRate: Number(e.target.value)})} className="w-full h-8 text-xs border rounded px-2"><option value={5}>5%</option><option value={12}>12%</option><option value={18}>18%</option><option value={28}>28%</option></select></div>
              <div><label className="text-[10px] text-gray-500 uppercase">HSN</label><Input value={productForm.hsnCode} onChange={e => setProductForm({...productForm, hsnCode: e.target.value})} className="h-8 text-xs" /></div>
            </div>
            <div><label className="text-[10px] text-gray-500 uppercase">Min Stock Alert</label><Input type="number" value={productForm.minStockAlert} onChange={e => setProductForm({...productForm, minStockAlert: Number(e.target.value)})} className="h-8 text-xs" /></div>

            {/* BATCH SECTION - ONLY IN EDIT MODE */}
            {editMode && productBatches.length > 0 && (
              <div className="mt-4 pt-3 border-t">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600">📦 Batches & Stock</p>
                  <Button size="sm" className="h-6 text-xs bg-emerald-600" onClick={openAddBatchModal}>+ Add Batch</Button>
                </div>
                <table className="w-full text-xs border rounded">
                  <thead className="bg-gray-50"><tr><th className="py-1.5 px-2 text-left border">Batch</th><th className="py-1.5 px-2 text-left border">Expiry</th><th className="py-1.5 px-2 text-right border">Stock</th><th className="py-1.5 px-2 text-right border">MRP</th><th className="py-1.5 px-2 text-right border">S.Rate</th><th className="py-1.5 px-2 text-center border">Actions</th></tr></thead>
                  <tbody>
                    {productBatches.map(b => (
                      <tr key={b.id} className="border-t">
                        <td className="py-1 px-2 border font-semibold">{b.batchNo}</td>
                        <td className="py-1 px-2 border">{formatExpiryDisplay(b.expiryDate)}</td>
                        <td className="py-1 px-2 border text-right font-semibold">{b.currentStock}</td>
                        <td className="py-1 px-2 border text-right">₹{Number(b.mrp).toFixed(2)}</td>
                        <td className="py-1 px-2 border text-right">₹{Number(b.saleRate).toFixed(2)}</td>
                        <td className="py-1 px-2 border text-center">
                          <button onClick={() => handleEditBatch(b)} className="text-blue-600 mx-1">✏️</button>
                          <button onClick={() => handleDeleteBatch(b.id)} className="text-red-400 mx-1">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Initial Stock for NEW products */}
            {!editMode && (
              <>
                <div className="flex items-center gap-2 pt-3 border-t mt-4">
                  <input type="checkbox" id="addStock" checked={addInitialStock} onChange={e => setAddInitialStock(e.target.checked)} className="w-4 h-4" />
                  <label htmlFor="addStock" className="text-xs font-semibold">Add Initial Stock</label>
                </div>
                {addInitialStock && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-[10px] text-gray-500 uppercase">Batch *</label><Input value={stockForm.batchNo} onChange={e => setStockForm({...stockForm, batchNo: e.target.value.toUpperCase()})} className="h-8 text-xs" /></div>
                      <div><label className="text-[10px] text-gray-500 uppercase">Expiry *</label><Input value={stockForm.expiryDate} onChange={e => setStockForm({...stockForm, expiryDate: formatExpiryOnType(e.target.value, stockForm.expiryDate)})} placeholder="MM/YY" maxLength={5} className="h-8 text-xs text-center" /></div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div><label className="text-[10px] text-gray-500 uppercase">Qty *</label><Input type="number" value={stockForm.quantity || ''} onChange={e => setStockForm({...stockForm, quantity: Number(e.target.value)})} className="h-8 text-xs" /></div>
                      <div><label className="text-[10px] text-gray-500 uppercase">P.Rate</label><Input type="number" value={stockForm.purchaseRate || ''} onChange={e => setStockForm({...stockForm, purchaseRate: Number(e.target.value)})} className="h-8 text-xs" /></div>
                      <div><label className="text-[10px] text-gray-500 uppercase">MRP *</label><Input type="number" value={stockForm.mrp || ''} onChange={e => setStockForm({...stockForm, mrp: Number(e.target.value)})} className="h-8 text-xs" /></div>
                      <div><label className="text-[10px] text-gray-500 uppercase">S.Rate *</label><Input type="number" value={stockForm.saleRate || ''} onChange={e => setStockForm({...stockForm, saleRate: Number(e.target.value)})} className="h-8 text-xs" /></div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowProductModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveProduct} className="bg-blue-600">{editMode ? 'Update Product' : (addInitialStock ? 'Save + Stock' : 'Save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Product Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="bg-white max-w-2xl p-0 gap-0">
          <DialogHeader className="bg-gray-100 px-4 py-3 border-b flex flex-row items-center justify-between">
            <DialogTitle className="text-sm font-semibold">{selectedProduct?.name}</DialogTitle>
            <Button size="sm" className="h-7 text-xs bg-emerald-600" onClick={openAddBatchModal}>+ Add Stock</Button>
          </DialogHeader>
          <div className="p-4">
            <div className="grid grid-cols-4 gap-4 text-xs mb-4">
              <div><span className="text-gray-500">Barcode:</span> <span className="font-mono">{selectedProduct?.barcode || '-'}</span></div>
              <div><span className="text-gray-500">Company:</span> {selectedProduct?.manufacturer?.name}</div>
              <div><span className="text-gray-500">Rack:</span> {selectedProduct?.rackLocation ? <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">{selectedProduct.rackLocation}</span> : '-'}</div>
              <div><span className="text-gray-500">GST:</span> {selectedProduct?.gstRate || 12}%</div>
            </div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Batches:</p>
            <table className="w-full text-xs border">
              <thead className="bg-gray-50"><tr><th className="py-2 px-2 text-left border">Batch</th><th className="py-2 px-2 text-left border">Expiry</th><th className="py-2 px-2 text-right border">Stock</th><th className="py-2 px-2 text-right border">MRP</th><th className="py-2 px-2 text-right border">S.Rate</th><th className="py-2 px-2 text-center border">Actions</th></tr></thead>
              <tbody>
                {selectedProduct?.batches?.length === 0 ? <tr><td colSpan={6} className="text-center py-4 text-gray-400">No batches</td></tr> :
                 selectedProduct?.batches?.map((b: any) => (
                  <tr key={b.id} className="border-t">
                    <td className="py-1.5 px-2 border">{b.batchNo}</td>
                    <td className="py-1.5 px-2 border">{formatExpiryDisplay(b.expiryDate)}</td>
                    <td className="py-1.5 px-2 text-right border font-semibold">{b.currentStock}</td>
                    <td className="py-1.5 px-2 text-right border">₹{Number(b.mrp).toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-right border">₹{Number(b.saleRate).toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-center border">
                      <button onClick={() => handleEditBatch(b)} className="text-blue-600 mx-1">✏️</button>
                      <button onClick={() => handleDeleteBatch(b.id)} className="text-red-400 mx-1">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manufacturer Modal */}
      <Dialog open={showManufacturerModal} onOpenChange={setShowManufacturerModal}>
        <DialogContent className="bg-white max-w-md p-0 gap-0">
          <DialogHeader className="bg-blue-600 text-white px-4 py-3"><DialogTitle className="text-sm font-semibold">{editingManufacturer ? 'Edit Manufacturer' : 'Add Manufacturer'}</DialogTitle></DialogHeader>
          <div className="p-4 space-y-3">
            <div><label className="text-[10px] text-gray-500 uppercase">Name *</label><Input value={mfgForm.name} onChange={e => setMfgForm({...mfgForm, name: e.target.value})} className="h-8 text-xs" /></div>
            <div><label className="text-[10px] text-gray-500 uppercase">Short Name</label><Input value={mfgForm.shortName} onChange={e => setMfgForm({...mfgForm, shortName: e.target.value})} className="h-8 text-xs" /></div>
            <div><label className="text-[10px] text-gray-500 uppercase">GSTIN</label><Input value={mfgForm.gstin} onChange={e => setMfgForm({...mfgForm, gstin: e.target.value})} className="h-8 text-xs" /></div>
            <div><label className="text-[10px] text-gray-500 uppercase">Address</label><Input value={mfgForm.address} onChange={e => setMfgForm({...mfgForm, address: e.target.value})} className="h-8 text-xs" /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowManufacturerModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveManufacturer} className="bg-blue-600">{editingManufacturer ? 'Update' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="bg-white max-w-md p-0 gap-0">
          <DialogHeader className="bg-blue-600 text-white px-4 py-3"><DialogTitle className="text-sm font-semibold">{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle></DialogHeader>
          <div className="p-4 space-y-3">
            <div><label className="text-[10px] text-gray-500 uppercase">Name *</label><Input value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} className="h-8 text-xs" /></div>
            <div><label className="text-[10px] text-gray-500 uppercase">Description</label><Input value={catForm.description} onChange={e => setCatForm({...catForm, description: e.target.value})} className="h-8 text-xs" /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowCategoryModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveCategory} className="bg-blue-600">{editingCategory ? 'Update' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Modal */}
      <Dialog open={showBatchModal} onOpenChange={setShowBatchModal}>
        <DialogContent className="bg-white max-w-md p-0 gap-0">
          <DialogHeader className="bg-emerald-600 text-white px-4 py-3"><DialogTitle className="text-sm font-semibold">{editingBatch ? 'Edit Batch' : 'Add Stock'}</DialogTitle></DialogHeader>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-gray-500 uppercase">Batch No *</label><Input value={batchForm.batchNo} onChange={e => setBatchForm({...batchForm, batchNo: e.target.value.toUpperCase()})} className="h-8 text-xs" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase">Expiry *</label><Input value={batchForm.expiryDate} onChange={e => setBatchForm({...batchForm, expiryDate: formatExpiryOnType(e.target.value, batchForm.expiryDate)})} placeholder="MM/YY" maxLength={5} className="h-8 text-xs text-center" /></div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div><label className="text-[10px] text-gray-500 uppercase">Qty *</label><Input type="number" value={batchForm.quantity || ''} onChange={e => setBatchForm({...batchForm, quantity: Number(e.target.value)})} className="h-8 text-xs" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase">P.Rate</label><Input type="number" value={batchForm.purchaseRate || ''} onChange={e => setBatchForm({...batchForm, purchaseRate: Number(e.target.value)})} className="h-8 text-xs" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase">MRP *</label><Input type="number" value={batchForm.mrp || ''} onChange={e => setBatchForm({...batchForm, mrp: Number(e.target.value)})} className="h-8 text-xs" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase">S.Rate *</label><Input type="number" value={batchForm.saleRate || ''} onChange={e => setBatchForm({...batchForm, saleRate: Number(e.target.value)})} className="h-8 text-xs" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setShowBatchModal(false); setEditingBatch(null); }}>Cancel</Button>
              <Button size="sm" onClick={editingBatch ? handleUpdateBatch : handleSaveBatch} className="bg-emerald-600">{editingBatch ? 'Update' : 'Add Stock'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Modal - PASTE FROM EXCEL */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="bg-white max-w-3xl p-0 gap-0">
          <DialogHeader className="bg-blue-600 text-white px-4 py-3"><DialogTitle className="text-sm font-semibold">📋 Paste from Excel</DialogTitle></DialogHeader>
          <div className="p-4 space-y-3">
            <div className="bg-gray-50 p-3 rounded text-xs">
              <p className="font-semibold mb-2">Expected Columns (Tab-separated from Excel):</p>
              <code className="text-[10px] text-gray-600 block bg-white p-2 rounded border">
                Name | Salt | Manufacturer | Category | Packing | Rack | GST | HSN | BatchNo | Expiry | Qty | PRate | MRP | SRate
              </code>
              <p className="mt-2 text-gray-500">Copy rows from Excel and paste below. New manufacturers/categories will be auto-created.</p>
            </div>
            <textarea 
              value={excelData} 
              onChange={e => setExcelData(e.target.value)} 
              placeholder="Paste data from Excel here (Ctrl+V)..."
              className="w-full h-48 border rounded p-2 text-xs font-mono"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">{excelData.trim().split('\n').filter(l => l.trim()).length} rows detected</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowImportModal(false); setExcelData(''); }}>Cancel</Button>
                <Button size="sm" onClick={handleExcelImport} className="bg-blue-600">Import Products</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
