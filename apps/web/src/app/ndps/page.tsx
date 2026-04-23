"use client";

import { useState, useEffect, useRef } from 'react';
import { ndpsAPI, productsAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type TabType = 'products' | 'licenses' | 'transactions' | 'register' | 'summary' | 'govreport';

export default function NDPSPage() {
  const [activeTab, setActiveTab] = useState<TabType>('products');
  
  // NDPS Products
  const [ndpsProducts, setNdpsProducts] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [markForm, setMarkForm] = useState({
    productId: '',
    scheduleType: 'H1',
    maxQtyPerSale: '',
    requiresRx: true
  });

  // Licenses
  const [licenses, setLicenses] = useState<any[]>([]);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [editingLicense, setEditingLicense] = useState<any>(null);
  const [licenseForm, setLicenseForm] = useState({
    buyerName: '',
    buyerType: 'WHOLESALER',
    licenseNo: '',
    issuedBy: '',
    validFrom: '',
    validTo: '',
    address: '',
    mobile: ''
  });

  // Transactions
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionForm, setTransactionForm] = useState({
    transactionType: 'SALE',
    ndpsProductId: '',
    ndpsLicenseId: '',
    batchNo: '',
    expiryDate: '',
    quantity: '',
    unit: 'units',
    supplierName: '',
    supplierLicense: '',
    invoiceNo: '',
    prescriptionNo: '',
    doctorName: '',
    patientName: '',
    purposeOfUse: '',
    remarks: '',
    prescriptionDate: '',
    doctorRegistrationNo: '',
    patientAadhaar: '',
    patientAge: '',
    patientGender: '',
    patientMobile: '',
    patientAddress: ''
  });

  // Register
  const [registerData, setRegisterData] = useState<any[]>([]);
  const [registerFrom, setRegisterFrom] = useState('');
  const [registerTo, setRegisterTo] = useState('');

  // Stock Summary
  const [stockSummary, setStockSummary] = useState<any[]>([]);

  // Government Report
  const [govReportFrom, setGovReportFrom] = useState('');
  const [govReportTo, setGovReportTo] = useState('');
  const [govReportType, setGovReportType] = useState('quarterly');
  const [govReportData, setGovReportData] = useState<any>(null);
  const [loadingGovReport, setLoadingGovReport] = useState(false);

  const productSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchNDPSProducts();
    fetchLicenses();
    fetchTransactions();
    fetchStockSummary();
  }, []);

  // Product search for marking
  useEffect(() => {
    if (productSearch.length > 0 && showProductSearch) {
      productsAPI.getAll({ search: productSearch }).then(res => {
        const allProducts = res.data.products || res.data || [];
        setAllProducts(allProducts);
      }).catch(() => setAllProducts([]));
    } else {
      setAllProducts([]);
    }
  }, [productSearch, showProductSearch]);

  const fetchNDPSProducts = async () => {
    try {
      const res = await ndpsAPI.getNDPSProducts();
      setNdpsProducts(res.data);
    } catch (err) {
      toast.error('Failed to fetch NDPS products');
    }
  };

  const fetchLicenses = async () => {
    try {
      const res = await ndpsAPI.getLicenses();
      setLicenses(res.data);
    } catch (err) {
      toast.error('Failed to fetch licenses');
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await ndpsAPI.getTransactions();
      setTransactions(res.data);
    } catch (err) {
      toast.error('Failed to fetch transactions');
    }
  };

  const fetchStockSummary = async () => {
    try {
      const res = await ndpsAPI.getStockSummary();
      setStockSummary(res.data);
    } catch (err) {
      toast.error('Failed to fetch stock summary');
    }
  };

  const [selectedProductId, setSelectedProductId] = useState("");

  const handleSelectProduct = (product: any) => {
    setSelectedProductId(product.id);
    setMarkForm(prev => ({...prev, productId: product.id}));
    setProductSearch(product.name);
    setShowProductSearch(false);
  };

  const handleMarkNDPS = async () => {
    if (!markForm.productId && !selectedProductId) {
      toast.error('Select a product first');
      return;
    }
    try {
      const dataToSend = {...markForm, productId: markForm.productId || selectedProductId};
      await ndpsAPI.markProductAsNDPS(dataToSend);
      toast.success('Product marked as NDPS');
      setShowMarkModal(false);
      fetchNDPSProducts();
      fetchStockSummary();
      resetMarkForm();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to mark product');
    }
  };

  const handleSaveLicense = async () => {
    if (!licenseForm.buyerName || !licenseForm.licenseNo || !licenseForm.validFrom || !licenseForm.validTo) {
      toast.error('Fill all required fields');
      return;
    }
    try {
      if (editingLicense) {
        await ndpsAPI.updateLicense(editingLicense.id, licenseForm);
        toast.success('License updated');
      } else {
        await ndpsAPI.createLicense(licenseForm);
        toast.success('License created');
      }
      setShowLicenseModal(false);
      fetchLicenses();
      resetLicenseForm();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save license');
    }
  };

  const handleCreateTransaction = async () => {
    if (!transactionForm.ndpsProductId || !transactionForm.quantity) {
      toast.error('Select product and enter quantity');
      return;
    }
    try {
      await ndpsAPI.createTransaction(transactionForm);
      toast.success('Transaction recorded');
      setShowTransactionModal(false);
      fetchTransactions();
      fetchStockSummary();
      resetTransactionForm();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create transaction');
    }
  };

  const handleFetchRegister = async () => {
    if (!registerFrom || !registerTo) {
      toast.error('Select date range');
      return;
    }
    try {
      const res = await ndpsAPI.getRegister(registerFrom, registerTo);
      setRegisterData(res.data);
      toast.success(`Loaded ${res.data.length} transactions`);
    } catch (err) {
      toast.error('Failed to fetch register');
    }
  };

  const handleGenerateGovReport = async () => {
    if (!govReportFrom || !govReportTo) {
      toast.error('Select date range for report');
      return;
    }
    setLoadingGovReport(true);
    try {
      const res = await ndpsAPI.getGovernmentReport(govReportFrom, govReportTo, govReportType);
      setGovReportData(res.data);
      toast.success('Government report generated successfully');
    } catch (err) {
      toast.error('Failed to generate government report');
    } finally {
      setLoadingGovReport(false);
    }
  };

  const resetMarkForm = () => {
    setSelectedProductId("");
    setMarkForm({
      productId: '',
      scheduleType: 'H1',
      maxQtyPerSale: '',
      requiresRx: true
    });
    setProductSearch('');
  };

  const resetLicenseForm = () => {
    setLicenseForm({
      buyerName: '',
      buyerType: 'WHOLESALER',
      licenseNo: '',
      issuedBy: '',
      validFrom: '',
      validTo: '',
      address: '',
      mobile: ''
    });
    setEditingLicense(null);
  };

  const resetTransactionForm = () => {
    setTransactionForm({
      transactionType: 'SALE',
      ndpsProductId: '',
      ndpsLicenseId: '',
      batchNo: '',
      expiryDate: '',
      quantity: '',
      unit: 'units',
      supplierName: '',
      supplierLicense: '',
      invoiceNo: '',
      prescriptionNo: '',
      doctorName: '',
      patientName: '',
      purposeOfUse: '',
      remarks: '',
      prescriptionDate: '',
      doctorRegistrationNo: '',
      patientAadhaar: '',
      patientAge: '',
      patientGender: '',
      patientMobile: '',
      patientAddress: ''
    });
  };

  const openMarkModal = () => {
    resetMarkForm();
    setShowMarkModal(true);
    setTimeout(() => productSearchRef.current?.focus(), 100);
  };

  const openLicenseModal = (license?: any) => {
    if (license) {
      setEditingLicense(license);
      setLicenseForm({
        buyerName: license.buyerName,
        buyerType: license.buyerType,
        licenseNo: license.licenseNo,
        issuedBy: license.issuedBy || '',
        validFrom: new Date(license.validFrom).toISOString().split('T')[0],
        validTo: new Date(license.validTo).toISOString().split('T')[0],
        address: license.address || '',
        mobile: license.mobile || ''
      });
    }
    setShowLicenseModal(true);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar */}
      <header className="h-11 bg-red-700 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-6">
          <h1 className="text-white font-semibold text-sm">🛡️ NDPS / Narcotic Drugs Management</h1>
          <div className="text-[10px] text-red-100">
            As per NDPS Act, 1985 & Rules, 1985
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b px-4 py-2 flex gap-1 shrink-0 overflow-x-auto">
        {[
          { id: 'products', label: 'NDPS Products', icon: '💊' },
          { id: 'licenses', label: 'Buyer Licenses', icon: '📜' },
          { id: 'transactions', label: 'Transactions', icon: '📝' },
          { id: 'register', label: 'NDPS Register', icon: '📋' },
          { id: 'summary', label: 'Stock Summary', icon: '📊' },
          { id: 'govreport', label: 'Govt Report', icon: '🏛️' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-4 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-4">
        
        {/* NDPS Products Tab */}
        {activeTab === 'products' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-gray-700">
                Narcotic & Psychotropic Substances (Schedule H/H1/X)
              </h2>
              <Button onClick={openMarkModal} className="h-8 text-xs bg-red-600 hover:bg-red-700">
                + Mark Product as NDPS
              </Button>
            </div>
            
            <div className="bg-white rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-600">Product Name</th>
                    <th className="text-left p-3 font-semibold text-gray-600">Manufacturer</th>
                    <th className="text-left p-3 font-semibold text-gray-600">Schedule</th>
                    <th className="text-left p-3 font-semibold text-gray-600">Max Qty/Sale</th>
                    <th className="text-left p-3 font-semibold text-gray-600">Requires Rx</th>
                    <th className="text-left p-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ndpsProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400">
                        <div className="text-3xl mb-2">🛡️</div>
                        <p className="text-sm">No NDPS products marked yet</p>
                        <p className="text-xs mt-1">Mark products that require special tracking</p>
                      </td>
                    </tr>
                  ) : (
                    ndpsProducts.map(np => (
                      <tr key={np.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{np.product?.name || 'Unknown Product'}</td>
                        <td className="p-3 text-gray-600">{np.product?.manufacturer?.name || '-'}</td>
                        <td className="p-3">
                          <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-semibold">
                            Schedule {np.scheduleType}
                          </span>
                        </td>
                        <td className="p-3">{np.maxQtyPerSale || 'Unlimited'}</td>
                        <td className="p-3">{np.requiresRx ? '✅ Yes' : '❌ No'}</td>
                        <td className="p-3">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs"
                            onClick={() => {
                              if (confirm('Unmark this product from NDPS?')) {
                                ndpsAPI.unmarkNDPS(np.id).then(() => {
                                  fetchNDPSProducts();
                                  fetchStockSummary();
                                  toast.success('Product unmarked');
                                });
                              }
                            }}
                          >
                            Unmark
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Licenses Tab */}
        {activeTab === 'licenses' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Authorized Buyer Licenses</h2>
              <Button onClick={() => openLicenseModal()} className="h-8 text-xs bg-red-600 hover:bg-red-700">
                + Add License
              </Button>
            </div>
            
            <div className="bg-white rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-600">License No</th>
                    <th className="text-left p-3 font-semibold text-gray-600">Buyer Name</th>
                    <th className="text-left p-3 font-semibold text-gray-600">Type</th>
                    <th className="text-left p-3 font-semibold text-gray-600">Valid From</th>
                    <th className="text-left p-3 font-semibold text-gray-600">Valid To</th>
                    <th className="text-left p-3 font-semibold text-gray-600">Mobile</th>
                    <th className="text-left p-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-400">
                        <div className="text-3xl mb-2">📜</div>
                        <p className="text-sm">No buyer licenses registered</p>
                        <p className="text-xs mt-1">Add authorized buyer licenses for compliance</p>
                      </td>
                    </tr>
                  ) : (
                    licenses.map(license => {
                      const validTo = new Date(license.validTo);
                      const isExpired = validTo < new Date();
                      const isExpiringSoon = !isExpired && validTo < new Date(Date.now() + 30*24*60*60*1000);
                      
                      return (
                        <tr key={license.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-mono text-xs font-semibold">{license.licenseNo}</td>
                          <td className="p-3 font-medium">{license.buyerName}</td>
                          <td className="p-3">
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
                              {license.buyerType}
                            </span>
                          </td>
                          <td className="p-3">{new Date(license.validFrom).toLocaleDateString('en-IN')}</td>
                          <td className="p-3">
                            <span className={`${isExpired ? 'text-red-600 font-semibold' : isExpiringSoon ? 'text-orange-600' : ''}`}>
                              {new Date(license.validTo).toLocaleDateString('en-IN')}
                              {isExpired && ' ⚠️ EXPIRED'}
                              {isExpiringSoon && ' ⚠️'}
                            </span>
                          </td>
                          <td className="p-3">{license.mobile || '-'}</td>
                          <td className="p-3">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-xs"
                              onClick={() => openLicenseModal(license)}
                            >
                              Edit
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-gray-700">NDPS Transaction Log</h2>
              <Button onClick={() => setShowTransactionModal(true)} className="h-8 text-xs bg-red-600 hover:bg-red-700">
                + Record Transaction
              </Button>
            </div>
            
            <div className="bg-white rounded-lg border overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-2 font-semibold text-gray-600">Date</th>
                    <th className="text-left p-2 font-semibold text-gray-600">Type</th>
                    <th className="text-left p-2 font-semibold text-gray-600">Product</th>
                    <th className="text-right p-2 font-semibold text-gray-600">Qty</th>
                    <th className="text-right p-2 font-semibold text-gray-600">Opening</th>
                    <th className="text-right p-2 font-semibold text-gray-600">Closing</th>
                    <th className="text-left p-2 font-semibold text-gray-600">License</th>
                    <th className="text-left p-2 font-semibold text-gray-600">Prescription</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-400">
                        <div className="text-3xl mb-2">📝</div>
                        <p className="text-sm">No transactions recorded</p>
                        <p className="text-xs mt-1">Transactions will be auto-created from sales</p>
                      </td>
                    </tr>
                  ) : (
                    transactions.map(txn => (
                      <tr key={txn.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{new Date(txn.transactionDate).toLocaleDateString('en-IN')}</td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            txn.transactionType === 'SALE' || txn.transactionType === 'ISSUE' 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {txn.transactionType}
                          </span>
                        </td>
                        <td className="p-2 font-medium">{txn.product?.name || 'Unknown'}</td>
                        <td className="p-2 text-right font-semibold">{txn.quantity} {txn.unit}</td>
                        <td className="p-2 text-right">{txn.openingBalance}</td>
                        <td className="p-2 text-right font-bold text-red-600">{txn.closingBalance}</td>
                        <td className="p-2">{txn.ndpsLicense?.licenseNo || '-'}</td>
                        <td className="p-2">{txn.prescriptionNo || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Register Tab */}
        {activeTab === 'register' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-gray-700">NDPS Register (Form 7) - Mandatory Record</h2>
              <div className="flex gap-2">
                <Input 
                  type="date" 
                  value={registerFrom} 
                  onChange={e => setRegisterFrom(e.target.value)} 
                  className="h-8 text-xs"
                />
                <Input 
                  type="date" 
                  value={registerTo} 
                  onChange={e => setRegisterTo(e.target.value)} 
                  className="h-8 text-xs"
                />
                <Button onClick={handleFetchRegister} className="h-8 text-xs bg-red-600">
                  Generate Register
                </Button>
                {registerData.length > 0 && (
                  <Button 
                    onClick={() => window.print()} 
                    variant="outline" 
                    className="h-8 text-xs"
                  >
                    🖨️ Print
                  </Button>
                )}
              </div>
            </div>
            
            {registerData.length > 0 ? (
              <div className="bg-white rounded-lg border p-6 print-content">
                <div className="text-center mb-6">
                  <h3 className="font-bold text-lg">REGISTER OF NARCOTIC DRUGS AND PSYCHOTROPIC SUBSTANCES</h3>
                  <p className="text-xs mt-1">(As per Form No. 7 of NDPS Rules, 1985)</p>
                  <p className="text-xs font-semibold mt-2">
                    Period: {new Date(registerFrom).toLocaleDateString('en-IN')} to {new Date(registerTo).toLocaleDateString('en-IN')}
                  </p>
                </div>
                
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 p-2">S.No.</th>
                      <th className="border border-gray-400 p-2">Date</th>
                      <th className="border border-gray-400 p-2">Type</th>
                      <th className="border border-gray-400 p-2">Product</th>
                      <th className="border border-gray-400 p-2">Receipt (Qty)</th>
                      <th className="border border-gray-400 p-2">Issue (Qty)</th>
                      <th className="border border-gray-400 p-2">Balance</th>
                      <th className="border border-gray-400 p-2">License/Prescription</th>
                      <th className="border border-gray-400 p-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registerData.map((entry, index) => (
                      <tr key={entry.id}>
                        <td className="border border-gray-400 p-2 text-center">{index + 1}</td>
                        <td className="border border-gray-400 p-2">{new Date(entry.transactionDate).toLocaleDateString('en-IN')}</td>
                        <td className="border border-gray-400 p-2">{entry.transactionType}</td>
                        <td className="border border-gray-400 p-2">{entry.product?.name || 'Unknown Product'}</td>
                        <td className="border border-gray-400 p-2 text-right">
                          {(entry.transactionType === 'RECEIPT' || entry.transactionType === 'PURCHASE') ? entry.quantity : '-'}
                        </td>
                        <td className="border border-gray-400 p-2 text-right">
                          {(entry.transactionType === 'SALE' || entry.transactionType === 'ISSUE') ? entry.quantity : '-'}
                        </td>
                        <td className="border border-gray-400 p-2 text-right font-semibold">{entry.closingBalance}</td>
                        <td className="border border-gray-400 p-2 font-mono text-[10px]">
                          {entry.prescriptionNo || entry.ndpsLicense?.licenseNo || '-'}
                        </td>
                        <td className="border border-gray-400 p-2">{entry.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-8 text-xs">
                  <p className="mb-2"><b>Note:</b> This register must be preserved for a minimum of 2 years from the date of last entry as per NDPS Rules.</p>
                  <div className="grid grid-cols-2 gap-8 mt-6">
                    <div>
                      <p>Date: _______________</p>
                    </div>
                    <div className="text-right">
                      <p>Authorized Signatory</p>
                      <p className="mt-8">_________________________</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border p-12 text-center text-gray-400">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-sm">Select date range and click "Generate Register"</p>
                <p className="text-xs mt-1">This register is mandatory as per NDPS Act, 1985</p>
              </div>
            )}
          </div>
        )}

        {/* Stock Summary Tab */}
        {activeTab === 'summary' && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Current NDPS Stock Summary</h2>
            
            {stockSummary.length === 0 ? (
              <div className="bg-white rounded-lg border p-12 text-center text-gray-400">
                <div className="text-4xl mb-3">📊</div>
                <p className="text-sm">No NDPS products in stock</p>
                <p className="text-xs mt-1">Mark products as NDPS to track them here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stockSummary.map(item => (
                  <div key={item.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase">Product Name</p>
                        <p className="font-semibold text-sm">{item.product?.name || 'Unknown Product'}</p>
                        <p className="text-[10px] text-gray-400">{item.product?.manufacturer?.name || ''}</p>
                      </div>
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-semibold">
                        Sch. {item.scheduleType}
                      </span>
                    </div>
                    
                    <div className="bg-red-50 rounded-lg p-3 text-center mb-3">
                      <p className="text-xs text-red-600 mb-1">Current Stock</p>
                      <p className="text-3xl font-bold text-red-700">{item.currentStock}</p>
                      <p className="text-xs text-gray-500">units</p>
                    </div>
                    
                    <p className="text-[10px] text-gray-400">
                      Last updated: {new Date(item.lastUpdated).toLocaleString('en-IN')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Government Report Tab */}
        {activeTab === 'govreport' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">NDPS Quarterly/Monthly Return for Government Submission</h2>
                <p className="text-xs text-gray-500 mt-1">As per NDPS Rules, 1985 - Rule 67</p>
              </div>
              <div className="flex gap-2">
                <select
                  value={govReportType}
                  onChange={e => setGovReportType(e.target.value)}
                  className="h-8 text-xs border rounded px-2"
                >
                  <option value="monthly">Monthly Return</option>
                  <option value="quarterly">Quarterly Return</option>
                  <option value="annual">Annual Return</option>
                </select>
                <Input 
                  type="date" 
                  value={govReportFrom} 
                  onChange={e => setGovReportFrom(e.target.value)} 
                  className="h-8 text-xs w-36"
                />
                <Input 
                  type="date" 
                  value={govReportTo} 
                  onChange={e => setGovReportTo(e.target.value)} 
                  className="h-8 text-xs w-36"
                />
                <Button 
                  onClick={handleGenerateGovReport} 
                  disabled={loadingGovReport}
                  className="h-8 text-xs bg-red-600"
                >
                  {loadingGovReport ? 'Generating...' : '🏛️ Generate Report'}
                </Button>
                {govReportData && (
                  <Button 
                    onClick={() => window.print()} 
                    variant="outline" 
                    className="h-8 text-xs"
                  >
                    🖨️ Print
                  </Button>
                )}
              </div>
            </div>
            
            {govReportData ? (
              <div className="bg-white rounded-lg border p-6 print-content">
                {/* Report Header */}
                <div className="text-center mb-6 border-b pb-4">
                  <h3 className="font-bold text-lg uppercase">
                    {govReportData.summary.reportType.toUpperCase()} RETURN OF NARCOTIC DRUGS AND PSYCHOTROPIC SUBSTANCES
                  </h3>
                  <p className="text-xs mt-2">(To be submitted to State Drug Controller / Narcotics Commissioner)</p>
                  <p className="text-sm font-semibold mt-3">
                    Report Period: {govReportData.summary.reportPeriod.from} to {govReportData.summary.reportPeriod.to}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Generated on: {new Date(govReportData.summary.generatedAt).toLocaleString('en-IN')}
                  </p>
                </div>

                {/* Summary Statistics */}
                <div className="grid grid-cols-4 gap-4 mb-6 bg-gray-50 rounded-lg p-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Total Products</p>
                    <p className="text-2xl font-bold text-red-600">{govReportData.summary.totalProducts}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Total Receipts</p>
                    <p className="text-2xl font-bold text-green-600">{govReportData.summary.totalReceipts}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Total Issues</p>
                    <p className="text-2xl font-bold text-orange-600">{govReportData.summary.totalIssues}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Schedule Types</p>
                    <p className="text-sm font-semibold">
                      H: {govReportData.summary.scheduleWiseSummary.H} | 
                      H1: {govReportData.summary.scheduleWiseSummary.H1} | 
                      X: {govReportData.summary.scheduleWiseSummary.X}
                    </p>
                  </div>
                </div>

                {/* Product-wise Details */}
                <table className="w-full text-xs border-collapse mb-6">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 p-2 text-left">S.No.</th>
                      <th className="border border-gray-400 p-2 text-left">Product Name</th>
                      <th className="border border-gray-400 p-2 text-left">Manufacturer</th>
                      <th className="border border-gray-400 p-2">Schedule</th>
                      <th className="border border-gray-400 p-2 text-right">Opening</th>
                      <th className="border border-gray-400 p-2 text-right">Receipts</th>
                      <th className="border border-gray-400 p-2 text-right">Issues</th>
                      <th className="border border-gray-400 p-2 text-right">Closing</th>
                      <th className="border border-gray-400 p-2">Txns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {govReportData.products.map((product: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="border border-gray-400 p-2">{index + 1}</td>
                        <td className="border border-gray-400 p-2 font-medium">
                          {product.productName}
                        </td>
                        <td className="border border-gray-400 p-2 text-gray-600">
                          {product.manufacturer}
                        </td>
                        <td className="border border-gray-400 p-2 text-center">
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-semibold">
                            Sch. {product.scheduleType}
                          </span>
                        </td>
                        <td className="border border-gray-400 p-2 text-right font-semibold">
                          {product.openingBalance}
                        </td>
                        <td className="border border-gray-400 p-2 text-right text-green-600 font-semibold">
                          {product.totalReceipts}
                        </td>
                        <td className="border border-gray-400 p-2 text-right text-red-600 font-semibold">
                          {product.totalIssues}
                        </td>
                        <td className="border border-gray-400 p-2 text-right font-bold">
                          {product.closingBalance}
                        </td>
                        <td className="border border-gray-400 p-2 text-center">
                          {product.transactions}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td colSpan={4} className="border border-gray-400 p-2 text-right">TOTAL:</td>
                      <td className="border border-gray-400 p-2 text-right">
                        {govReportData.products.reduce((sum: number, p: any) => sum + p.openingBalance, 0)}
                      </td>
                      <td className="border border-gray-400 p-2 text-right text-green-600">
                        {govReportData.summary.totalReceipts}
                      </td>
                      <td className="border border-gray-400 p-2 text-right text-red-600">
                        {govReportData.summary.totalIssues}
                      </td>
                      <td className="border border-gray-400 p-2 text-right">
                        {govReportData.products.reduce((sum: number, p: any) => sum + p.closingBalance, 0)}
                      </td>
                      <td className="border border-gray-400 p-2"></td>
                    </tr>
                  </tfoot>
                </table>

                {/* License-wise Sales Breakdown */}
                {govReportData.products.some((p: any) => Object.keys(p.licenseWiseSales).length > 0) && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-sm mb-3">License-wise Sales Breakdown</h4>
                    {govReportData.products.map((product: any, pIndex: number) => (
                      Object.keys(product.licenseWiseSales).length > 0 && (
                        <div key={pIndex} className="mb-4 bg-gray-50 rounded-lg p-3">
                          <p className="text-xs font-semibold mb-2">
                            Product: {product.productName}
                          </p>
                          <table className="w-full text-xs">
                            <thead className="bg-white">
                              <tr>
                                <th className="border p-2 text-left">License No</th>
                                <th className="border p-2 text-left">Buyer Name</th>
                                <th className="border p-2">Buyer Type</th>
                                <th className="border p-2 text-right">Quantity Sold</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(product.licenseWiseSales).map(([licNo, data]: [string, any]) => (
                                <tr key={licNo}>
                                  <td className="border p-2 font-mono">{licNo}</td>
                                  <td className="border p-2">{data.buyerName}</td>
                                  <td className="border p-2 text-center">{data.buyerType}</td>
                                  <td className="border p-2 text-right font-semibold">{data.quantity}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    ))}
                  </div>
                )}

                {/* Declaration */}
                <div className="border-t pt-4 mt-8 text-xs">
                  <p className="mb-4">
                    <b>Declaration:</b> I hereby declare that the above particulars are true to the best of my knowledge 
                    and belief and that no narcotic drugs or psychotropic substances have been received or issued other 
                    than those mentioned above during the period covered by this return.
                  </p>
                  <div className="grid grid-cols-2 gap-8 mt-8">
                    <div>
                      <p>Place: _______________</p>
                      <p className="mt-2">Date: _______________</p>
                    </div>
                    <div className="text-right">
                      <p>Signature of Authorized Person</p>
                      <p className="mt-8">_________________________</p>
                      <p className="text-[10px] text-gray-500 mt-1">(Name, Designation & Seal)</p>
                    </div>
                  </div>
                  <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="text-[10px] text-yellow-700">
                      <b>Submission Instructions:</b> This return must be submitted to the State Drug Controller / 
                      Narcotics Commissioner within 15 days of the end of the {govReportType} period. 
                      Retain a copy for your records for a minimum of 2 years.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border p-12 text-center text-gray-400">
                <div className="text-4xl mb-3">🏛️</div>
                <p className="text-sm">Select report type and date range, then click "Generate Report"</p>
                <p className="text-xs mt-1">This report must be submitted quarterly/monthly to government authorities</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============ ALL MODALS ============ */}

      {/* Mark NDPS Modal */}
      <Dialog open={showMarkModal} onOpenChange={setShowMarkModal}>
        <DialogContent className="bg-white max-w-lg p-0 gap-0">
          <DialogHeader className="bg-red-600 text-white px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Mark Product as NDPS</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-700">
                <b>⚠️ Important:</b> Products marked as NDPS will require additional documentation for sales and strict record-keeping as per NDPS Act, 1985.
              </p>
            </div>

            <div className="relative">
              <label className="text-[10px] text-gray-500 uppercase font-semibold">Select Product *</label>
              <Input
                ref={productSearchRef}
                placeholder="Search product by name..."
                value={productSearch}
                onChange={e => {
                  setProductSearch(e.target.value);
                  setShowProductSearch(true);
                  setMarkForm({...markForm, productId: ''});
                }}
                onFocus={() => productSearch && setShowProductSearch(true)}
                className="h-9 text-sm"
              />
              {showProductSearch && allProducts.length > 0 && (
                <div className="absolute z-50 w-full bg-white border shadow-lg mt-1 rounded max-h-48 overflow-y-auto">
                  {allProducts.map(p => (
                    <div
                      key={p.id}
                      className="px-3 py-2 hover:bg-red-50 cursor-pointer text-xs border-b"
                      onClick={() => handleSelectProduct(p)}
                    >
                      <div className="font-medium">{p.name}</div>
                      <div className="text-[10px] text-gray-500">{p.manufacturer?.name}</div>
                    </div>
                  ))}
                </div>
              )}
              {markForm.productId && (
                <p className="text-xs text-green-600 mt-1">✓ Product selected</p>
              )}
            </div>
            
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-semibold">Schedule Type *</label>
              <select
                value={markForm.scheduleType}
                onChange={e => setMarkForm({...markForm, scheduleType: e.target.value})}
                className="w-full h-9 text-sm border rounded px-2"
              >
                <option value="H">Schedule H (Prescription Drug)</option>
                <option value="H1">Schedule H1 (Restricted Prescription)</option>
                <option value="X">Schedule X (Narcotic/Psychotropic)</option>
              </select>
            </div>
            
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-semibold">Max Quantity Per Sale (Optional)</label>
              <Input
                type="number"
                value={markForm.maxQtyPerSale}
                onChange={e => setMarkForm({...markForm, maxQtyPerSale: e.target.value})}
                placeholder="Leave blank for unlimited"
                className="h-9 text-sm"
              />
            </div>
            
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
              <input
                type="checkbox"
                checked={markForm.requiresRx}
                onChange={e => setMarkForm({...markForm, requiresRx: e.target.checked})}
                className="w-4 h-4"
              />
              <label className="text-sm">Requires Prescription</label>
            </div>

            <div className="flex gap-2 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowMarkModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button size="sm" onClick={handleMarkNDPS} className="flex-1 bg-red-600 hover:bg-red-700">
                Mark as NDPS
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* License Modal */}
      <Dialog open={showLicenseModal} onOpenChange={setShowLicenseModal}>
        <DialogContent className="bg-white max-w-2xl p-0 gap-0">
          <DialogHeader className="bg-red-600 text-white px-4 py-3">
            <DialogTitle className="text-sm font-semibold">
              {editingLicense ? 'Edit Buyer License' : 'Add New Buyer License'}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-semibold">Buyer Name *</label>
                <Input 
                  value={licenseForm.buyerName} 
                  onChange={e => setLicenseForm({...licenseForm, buyerName: e.target.value})} 
                  className="h-8 text-xs"
                />
              </div>
              
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-semibold">Buyer Type *</label>
                <select
                  value={licenseForm.buyerType}
                  onChange={e => setLicenseForm({...licenseForm, buyerType: e.target.value})}
                  className="w-full h-8 text-xs border rounded px-2"
                >
                  <option value="WHOLESALER">Wholesaler</option>
                  <option value="RETAILER">Retailer</option>
                  <option value="HOSPITAL">Hospital</option>
                  <option value="CLINIC">Clinic</option>
                  <option value="MANUFACTURER">Manufacturer</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-semibold">License Number *</label>
                <Input 
                  value={licenseForm.licenseNo} 
                  onChange={e => setLicenseForm({...licenseForm, licenseNo: e.target.value.toUpperCase()})} 
                  className="h-8 text-xs font-mono"
                />
              </div>
              
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-semibold">Issued By</label>
                <Input 
                  value={licenseForm.issuedBy} 
                  onChange={e => setLicenseForm({...licenseForm, issuedBy: e.target.value})} 
                  placeholder="Drug Controller"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-semibold">Valid From *</label>
                <Input 
                  type="date" 
                  value={licenseForm.validFrom} 
                  onChange={e => setLicenseForm({...licenseForm, validFrom: e.target.value})} 
                  className="h-8 text-xs"
                />
              </div>
              
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-semibold">Valid To *</label>
                <Input 
                  type="date" 
                  value={licenseForm.validTo} 
                  onChange={e => setLicenseForm({...licenseForm, validTo: e.target.value})} 
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-semibold">Mobile</label>
                <Input 
                  value={licenseForm.mobile} 
                  onChange={e => setLicenseForm({...licenseForm, mobile: e.target.value})} 
                  maxLength={10}
                  className="h-8 text-xs"
                />
              </div>
              
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-semibold">Address</label>
                <Input 
                  value={licenseForm.address} 
                  onChange={e => setLicenseForm({...licenseForm, address: e.target.value})} 
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowLicenseModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveLicense} className="flex-1 bg-red-600 hover:bg-red-700">
                Save License
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Modal - FIXED HTML STRUCTURE */}
      <Dialog open={showTransactionModal} onOpenChange={setShowTransactionModal}>
        <DialogContent className="bg-white max-w-4xl p-0 gap-0 max-h-[90vh] overflow-hidden">
          <DialogHeader className="bg-red-600 text-white px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Record NDPS Transaction (Manual Entry)</DialogTitle>
          </DialogHeader>
          <div className="p-4 overflow-y-auto space-y-3" style={{ maxHeight: 'calc(90vh - 60px)' }}>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-700">
                <b>Note:</b> NDPS transactions are automatically recorded from sales. Use this only for manual adjustments or receipts.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-semibold">Transaction Type *</label>
                <select
                  value={transactionForm.transactionType}
                  onChange={e => setTransactionForm({...transactionForm, transactionType: e.target.value})}
                  className="w-full h-8 text-xs border rounded px-2"
                >
                  <option value="SALE">Sale/Issue</option>
                  <option value="RECEIPT">Receipt/Purchase</option>
                </select>
              </div>
              
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-semibold">NDPS Product *</label>
                <select
                  value={transactionForm.ndpsProductId}
                  onChange={e => setTransactionForm({...transactionForm, ndpsProductId: e.target.value})}
                  className="w-full h-8 text-xs border rounded px-2"
                >
                  <option value="">-- Select Product --</option>
                  {ndpsProducts.map(np => (
                    <option key={np.id} value={np.id}>
                      {np.product?.name || 'Unknown Product'}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-semibold">Quantity *</label>
                <Input 
                  type="number" 
                  value={transactionForm.quantity} 
                  onChange={e => setTransactionForm({...transactionForm, quantity: e.target.value})} 
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-semibold">Batch No</label>
                <Input 
                  value={transactionForm.batchNo} 
                  onChange={e => setTransactionForm({...transactionForm, batchNo: e.target.value.toUpperCase()})} 
                  className="h-8 text-xs"
                />
              </div>
              
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-semibold">Expiry Date</label>
                <Input 
                  type="date" 
                  value={transactionForm.expiryDate} 
                  onChange={e => setTransactionForm({...transactionForm, expiryDate: e.target.value})} 
                  className="h-8 text-xs"
                />
              </div>
              
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-semibold">Buyer License (for sales)</label>
                <select
                  value={transactionForm.ndpsLicenseId}
                  onChange={e => setTransactionForm({...transactionForm, ndpsLicenseId: e.target.value})}
                  className="w-full h-8 text-xs border rounded px-2"
                >
                  <option value="">-- Optional --</option>
                  {licenses.map(lic => (
                    <option key={lic.id} value={lic.id}>
                      {lic.licenseNo} - {lic.buyerName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Patient & Prescription Details Section - FIXED STRUCTURE */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
              <p className="text-xs text-blue-700 font-semibold">
                📋 Patient & Prescription Details (Required for individual patients)
              </p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Prescription No</label>
                  <Input 
                    value={transactionForm.prescriptionNo} 
                    onChange={e => setTransactionForm({...transactionForm, prescriptionNo: e.target.value})} 
                    className="h-8 text-xs"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Prescription Date</label>
                  <Input
                    type="date"
                    value={transactionForm.prescriptionDate}
                    onChange={e => setTransactionForm({...transactionForm, prescriptionDate: e.target.value})}
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Doctor Name</label>
                  <Input 
                    value={transactionForm.doctorName} 
                    onChange={e => setTransactionForm({...transactionForm, doctorName: e.target.value})} 
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Doctor Registration No</label>
                  <Input
                    value={transactionForm.doctorRegistrationNo}
                    onChange={e => setTransactionForm({...transactionForm, doctorRegistrationNo: e.target.value})}
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Patient Name</label>
                  <Input 
                    value={transactionForm.patientName} 
                    onChange={e => setTransactionForm({...transactionForm, patientName: e.target.value})} 
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Patient Aadhaar</label>
                  <Input
                    value={transactionForm.patientAadhaar}
                    onChange={e => setTransactionForm({...transactionForm, patientAadhaar: e.target.value})}
                    maxLength={12}
                    className="h-8 text-xs font-mono"
                    placeholder="12-digit Aadhaar"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Patient Age</label>
                  <Input
                    type="number"
                    value={transactionForm.patientAge}
                    onChange={e => setTransactionForm({...transactionForm, patientAge: e.target.value})}
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Patient Gender</label>
                  <select
                    value={transactionForm.patientGender}
                    onChange={e => setTransactionForm({...transactionForm, patientGender: e.target.value})}
                    className="w-full h-8 text-xs border rounded px-2"
                  >
                    <option value="">-- Select --</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Patient Mobile</label>
                  <Input
                    value={transactionForm.patientMobile}
                    onChange={e => setTransactionForm({...transactionForm, patientMobile: e.target.value})}
                    maxLength={10}
                    className="h-8 text-xs"
                    placeholder="10-digit mobile"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Patient Address</label>
                  <Input
                    value={transactionForm.patientAddress}
                    onChange={e => setTransactionForm({...transactionForm, patientAddress: e.target.value})}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Supplier Details Section */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-semibold">Supplier Name (for receipts)</label>
                <Input 
                  value={transactionForm.supplierName} 
                  onChange={e => setTransactionForm({...transactionForm, supplierName: e.target.value})} 
                  className="h-8 text-xs"
                />
              </div>
              
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-semibold">Supplier License</label>
                <Input 
                  value={transactionForm.supplierLicense} 
                  onChange={e => setTransactionForm({...transactionForm, supplierLicense: e.target.value})} 
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-500 uppercase font-semibold">Remarks</label>
              <Input 
                value={transactionForm.remarks} 
                onChange={e => setTransactionForm({...transactionForm, remarks: e.target.value})} 
                className="h-8 text-xs"
              />
            </div>

            <div className="flex gap-2 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowTransactionModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateTransaction} className="flex-1 bg-red-600 hover:bg-red-700">
                Record Transaction
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
