"use client";

import { useState, useEffect, useRef } from 'react';
import { accountsAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type AccountType = 'CUSTOMER' | 'SUPPLIER';

interface Account {
  id: string;
  accountType: AccountType;
  name: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  dlNumber?: string;
  creditLimit: number;
  creditDays: number;
  openingBalance: number;
  currentBalance: number;
}

export default function AccountsPage() {
  const [activeTab, setActiveTab] = useState<AccountType>('CUSTOMER');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ totalCount: 0, totalOutstanding: 0, withDueCount: 0 });
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  
  // Ledger state
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerFromDate, setLedgerFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3); // Last 3 months default
    return d.toISOString().split('T')[0];
  });
  const [ledgerToDate, setLedgerToDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const printRef = useRef<HTMLDivElement>(null);
  
  // Form state
  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    mobile: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    dlNumber: '',
    creditLimit: 0,
    creditDays: 0,
    openingBalance: 0
  });

  useEffect(() => {
    fetchAccounts();
    fetchStats();
  }, [activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAccounts();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await accountsAPI.getAll(activeTab, search || undefined);
      setAccounts(res.data);
    } catch (err) {
      toast.error('Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await accountsAPI.getStats(activeTab);
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats');
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      contactPerson: '',
      mobile: '',
      email: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      gstin: '',
      dlNumber: '',
      creditLimit: 0,
      creditDays: 0,
      openingBalance: 0
    });
    setSelectedAccount(null);
    setEditMode(false);
  };

  const handleAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (account: Account) => {
    setSelectedAccount(account);
    setForm({
      name: account.name,
      contactPerson: account.contactPerson || '',
      mobile: account.mobile || '',
      email: account.email || '',
      address: account.address || '',
      city: account.city || '',
      state: account.state || '',
      pincode: account.pincode || '',
      gstin: account.gstin || '',
      dlNumber: account.dlNumber || '',
      creditLimit: Number(account.creditLimit) || 0,
      creditDays: Number(account.creditDays) || 0,
      openingBalance: Number(account.openingBalance) || 0
    });
    setEditMode(true);
    setShowModal(true);
  };

  const handleViewLedger = async (account: Account) => {
    setSelectedAccount(account);
    setShowLedgerModal(true);
    fetchLedger(account.id);
  };

  const fetchLedger = async (accountId: string) => {
    setLoadingLedger(true);
    try {
      const res = await accountsAPI.getLedger(accountId, ledgerFromDate, ledgerToDate);
      setLedgerData(res.data);
    } catch (err) {
      toast.error('Failed to fetch ledger');
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleLedgerFilter = () => {
    if (selectedAccount) {
      fetchLedger(selectedAccount.id);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      if (editMode && selectedAccount) {
        await accountsAPI.update(selectedAccount.id, form);
        toast.success('Account updated');
      } else {
        await accountsAPI.create({
          ...form,
          accountType: activeTab
        });
        toast.success('Account created');
      }
      setShowModal(false);
      resetForm();
      fetchAccounts();
      fetchStats();
    } catch (err) {
      toast.error('Failed to save account');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this account?')) return;
    
    try {
      await accountsAPI.delete(id);
      toast.success('Account deactivated');
      fetchAccounts();
      fetchStats();
    } catch (err) {
      toast.error('Failed to delete account');
    }
  };

  const handlePrintStatement = () => {
    if (!printRef.current) return;
    
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Account Statement - ${selectedAccount?.name}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 6px 8px; }
          th { background: #f0f0f0; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .debit { color: #dc3545; }
          .credit { color: #28a745; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${printRef.current.innerHTML}
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const tabLabel = activeTab === 'CUSTOMER' ? 'Customer' : 'Supplier';

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-IN');

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-11 bg-indigo-700 flex items-center justify-between px-4 shrink-0">
        <h1 className="text-white font-semibold text-sm">👥 Accounts Management</h1>
        <Button 
          size="sm" 
          className="h-7 text-xs bg-white text-indigo-700 hover:bg-indigo-50"
          onClick={handleAdd}
        >
          + Add {tabLabel}
        </Button>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b px-4 shrink-0">
        <div className="flex gap-0">
          {(['CUSTOMER', 'SUPPLIER'] as AccountType[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSearch(''); }}
              className={`px-6 py-2.5 text-xs font-medium border-b-2 transition ${
                activeTab === tab 
                  ? 'border-indigo-600 text-indigo-700' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'CUSTOMER' ? '👥 Customers' : '🏭 Suppliers'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-gray-50 px-4 py-3 border-b flex gap-6 shrink-0">
        <div className="bg-white px-4 py-2 rounded border">
          <div className="text-[10px] text-gray-500 uppercase">Total {tabLabel}s</div>
          <div className="text-lg font-bold text-gray-800">{stats.totalCount}</div>
        </div>
        <div className="bg-white px-4 py-2 rounded border">
          <div className="text-[10px] text-gray-500 uppercase">Total Outstanding</div>
          <div className="text-lg font-bold text-orange-600">₹{Number(stats.totalOutstanding || 0).toLocaleString()}</div>
        </div>
        <div className="bg-white px-4 py-2 rounded border">
          <div className="text-[10px] text-gray-500 uppercase">With Due</div>
          <div className="text-lg font-bold text-red-600">{stats.withDueCount}</div>
        </div>
        <div className="flex-1 flex justify-end">
          <Input 
            placeholder={`🔍 Search ${tabLabel.toLowerCase()}s...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 text-xs max-w-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="border-b">
              <th className="w-10 py-2 px-3 text-left font-semibold text-gray-600">#</th>
              <th className="py-2 px-3 text-left font-semibold text-gray-600">Name</th>
              <th className="py-2 px-3 text-left font-semibold text-gray-600">Contact</th>
              <th className="py-2 px-3 text-left font-semibold text-gray-600">City</th>
              <th className="py-2 px-3 text-left font-semibold text-gray-600">GSTIN</th>
              <th className="py-2 px-3 text-right font-semibold text-gray-600">Credit Limit</th>
              <th className="py-2 px-3 text-right font-semibold text-gray-600">Outstanding</th>
              <th className="w-28 py-2 px-3 text-center font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-gray-400">Loading...</td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-gray-400">
                  <div className="text-3xl mb-2">{activeTab === 'CUSTOMER' ? '👥' : '🏭'}</div>
                  <p>No {tabLabel.toLowerCase()}s found</p>
                  <Button size="sm" className="mt-2" onClick={handleAdd}>Add {tabLabel}</Button>
                </td>
              </tr>
            ) : (
              accounts.map((acc, i) => (
                <tr key={acc.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                  <td className="py-2 px-3">
                    <div className="font-medium text-gray-800">{acc.name}</div>
                    {acc.contactPerson && (
                      <div className="text-[10px] text-gray-500">{acc.contactPerson}</div>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {acc.mobile && <div className="text-gray-700">{acc.mobile}</div>}
                    {acc.email && <div className="text-[10px] text-gray-500">{acc.email}</div>}
                  </td>
                  <td className="py-2 px-3 text-gray-600">{acc.city || '-'}</td>
                  <td className="py-2 px-3 text-gray-600 font-mono text-[10px]">{acc.gstin || '-'}</td>
                  <td className="py-2 px-3 text-right text-gray-700">
                    ₹{Number(acc.creditLimit || 0).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className={`font-semibold ${Number(acc.currentBalance) > 0 ? 'text-orange-600' : Number(acc.currentBalance) < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                      {Number(acc.currentBalance) < 0 ? '-' : ''}₹{Math.abs(Number(acc.currentBalance || 0)).toLocaleString()}
                    </span>
                    {Number(acc.currentBalance) < 0 && (
                      <div className="text-[10px] text-green-600">Advance</div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button 
                      onClick={() => handleViewLedger(acc)} 
                      className="text-blue-600 hover:text-blue-800 mx-1"
                      title="View Ledger"
                    >
                      📒
                    </button>
                    <button 
                      onClick={() => handleEdit(acc)} 
                      className="text-gray-600 hover:text-gray-800 mx-1"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => handleDelete(acc.id)} 
                      className="text-red-400 hover:text-red-600 mx-1"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-white max-w-2xl p-0 gap-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="bg-indigo-600 text-white px-4 py-3 sticky top-0">
            <DialogTitle className="text-sm font-semibold">
              {editMode ? `Edit ${tabLabel}` : `Add New ${tabLabel}`}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            {/* Basic Info */}
            <div className="border-b pb-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Basic Information</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase">Name *</label>
                  <Input 
                    value={form.name} 
                    onChange={e => setForm({...form, name: e.target.value})} 
                    className="h-8 text-xs"
                    placeholder={`${tabLabel} Name / Shop Name`}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase">Contact Person</label>
                  <Input 
                    value={form.contactPerson} 
                    onChange={e => setForm({...form, contactPerson: e.target.value})} 
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase">Mobile</label>
                  <Input 
                    value={form.mobile} 
                    onChange={e => setForm({...form, mobile: e.target.value})} 
                    className="h-8 text-xs"
                    maxLength={10}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase">Email</label>
                  <Input 
                    value={form.email} 
                    onChange={e => setForm({...form, email: e.target.value})} 
                    className="h-8 text-xs"
                    type="email"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="border-b pb-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Address</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase">Address</label>
                  <Input 
                    value={form.address} 
                    onChange={e => setForm({...form, address: e.target.value})} 
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase">City</label>
                  <Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase">State</label>
                  <Input value={form.state} onChange={e => setForm({...form, state: e.target.value})} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase">Pincode</label>
                  <Input value={form.pincode} onChange={e => setForm({...form, pincode: e.target.value})} className="h-8 text-xs" maxLength={6} />
                </div>
              </div>
            </div>

            {/* Tax & License */}
            <div className="border-b pb-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Tax & License</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase">GSTIN</label>
                  <Input 
                    value={form.gstin} 
                    onChange={e => setForm({...form, gstin: e.target.value.toUpperCase()})} 
                    className="h-8 text-xs font-mono"
                    maxLength={15}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase">Drug License No.</label>
                  <Input value={form.dlNumber} onChange={e => setForm({...form, dlNumber: e.target.value})} className="h-8 text-xs" />
                </div>
              </div>
            </div>

            {/* Credit Settings */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Credit Settings</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase">Credit Limit (₹)</label>
                  <Input 
                    type="number"
                    value={form.creditLimit || ''} 
                    onChange={e => setForm({...form, creditLimit: Number(e.target.value)})} 
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase">Credit Days</label>
                  <Input 
                    type="number"
                    value={form.creditDays || ''} 
                    onChange={e => setForm({...form, creditDays: Number(e.target.value)})} 
                    className="h-8 text-xs"
                  />
                </div>
                {!editMode && (
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase">Opening Balance (₹)</label>
                    <Input 
                      type="number"
                      value={form.openingBalance || ''} 
                      onChange={e => setForm({...form, openingBalance: Number(e.target.value)})} 
                      className="h-8 text-xs"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => { setShowModal(false); resetForm(); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
                {editMode ? 'Update' : 'Save'} {tabLabel}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Professional Ledger Modal */}
      <Dialog open={showLedgerModal} onOpenChange={setShowLedgerModal}>
        <DialogContent className="bg-white max-w-5xl p-0 gap-0 max-h-[95vh] overflow-hidden">
          <DialogHeader className="bg-indigo-600 text-white px-4 py-3 sticky top-0 z-10 flex flex-row items-center justify-between">
            <DialogTitle className="text-sm font-semibold">
              📒 Account Ledger: {selectedAccount?.name}
            </DialogTitle>
            <Button 
              size="sm" 
              className="h-7 bg-white text-indigo-700 hover:bg-indigo-50 text-xs"
              onClick={handlePrintStatement}
            >
              🖨️ Print Statement
            </Button>
          </DialogHeader>
          
          {selectedAccount && (
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 60px)' }}>
              {/* Account Summary */}
              <div className="grid grid-cols-5 gap-4 mb-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-[10px] text-gray-500 uppercase">Account Type</div>
                  <div className="font-semibold">{selectedAccount.accountType}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-[10px] text-gray-500 uppercase">Mobile</div>
                  <div className="font-semibold">{selectedAccount.mobile || '-'}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-[10px] text-gray-500 uppercase">City</div>
                  <div className="font-semibold">{selectedAccount.city || '-'}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-[10px] text-gray-500 uppercase">Credit Limit</div>
                  <div className="font-semibold">₹{Number(selectedAccount.creditLimit || 0).toLocaleString()}</div>
                </div>
                <div className={`p-3 rounded-lg ${Number(selectedAccount.currentBalance) > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                  <div className="text-[10px] text-gray-500 uppercase">Current Balance</div>
                  <div className={`font-bold text-lg ${Number(selectedAccount.currentBalance) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {Number(selectedAccount.currentBalance) > 0 ? 'Due: ' : 'Advance: '}
                    ₹{Math.abs(Number(selectedAccount.currentBalance || 0)).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase">From Date</label>
                  <Input 
                    type="date" 
                    value={ledgerFromDate}
                    onChange={e => setLedgerFromDate(e.target.value)}
                    className="h-8 text-xs w-36"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase">To Date</label>
                  <Input 
                    type="date" 
                    value={ledgerToDate}
                    onChange={e => setLedgerToDate(e.target.value)}
                    className="h-8 text-xs w-36"
                  />
                </div>
                <div className="flex items-end">
                  <Button size="sm" onClick={handleLedgerFilter} className="h-8 bg-indigo-600">
                    Apply Filter
                  </Button>
                </div>
                <div className="flex-1 text-right text-xs text-gray-500">
                  Showing: {ledgerFromDate} to {ledgerToDate}
                </div>
              </div>

              {/* Ledger Table */}
              {loadingLedger ? (
                <div className="text-center py-10 text-gray-400">Loading ledger...</div>
              ) : !ledgerData ? (
                <div className="text-center py-10 text-gray-400">No data</div>
              ) : (
                <div ref={printRef}>
                  {/* Print Header (hidden on screen, visible on print) */}
                  <div className="hidden print:block text-center mb-4">
                    <h2 className="text-lg font-bold">ACCOUNT STATEMENT</h2>
                    <p className="text-sm">{ledgerData.account?.name}</p>
                    <p className="text-xs text-gray-500">
                      Period: {formatDate(ledgerFromDate)} to {formatDate(ledgerToDate)}
                    </p>
                  </div>

                  {/* Opening Balance */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 flex justify-between items-center">
                    <span className="font-semibold text-blue-700">Opening Balance</span>
                    <span className={`font-bold text-lg ${ledgerData.openingBalance >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {ledgerData.openingBalance >= 0 ? 'Dr' : 'Cr'} ₹{Math.abs(ledgerData.openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Transactions Table */}
                  <div className="border rounded-lg overflow-hidden mb-3">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="py-2 px-3 text-left font-semibold border-b">Date</th>
                          <th className="py-2 px-3 text-left font-semibold border-b">Voucher</th>
                          <th className="py-2 px-3 text-left font-semibold border-b">Particulars</th>
                          <th className="py-2 px-3 text-right font-semibold border-b text-red-600">Debit (Dr)</th>
                          <th className="py-2 px-3 text-right font-semibold border-b text-green-600">Credit (Cr)</th>
                          <th className="py-2 px-3 text-right font-semibold border-b">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerData.entries?.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-gray-400">
                              No transactions in this period
                            </td>
                          </tr>
                        ) : (
                          ledgerData.entries?.map((entry: any, i: number) => (
                            <tr key={i} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-3">{formatDate(entry.date)}</td>
                              <td className="py-2 px-3">
                                <span className="font-mono text-[10px] bg-gray-100 px-1 rounded">{entry.voucherType}</span>
                                {entry.voucherRef && (
                                  <span className="ml-1 text-indigo-600 font-semibold">{entry.voucherRef}</span>
                                )}
                              </td>
                              <td className="py-2 px-3">{entry.narration}</td>
                              <td className="py-2 px-3 text-right text-red-600 font-semibold">
                                {entry.debit > 0 ? `₹${entry.debit.toFixed(2)}` : '-'}
                              </td>
                              <td className="py-2 px-3 text-right text-green-600 font-semibold">
                                {entry.credit > 0 ? `₹${entry.credit.toFixed(2)}` : '-'}
                              </td>
                              <td className="py-2 px-3 text-right font-semibold">
                                <span className={entry.balance >= 0 ? 'text-orange-600' : 'text-green-600'}>
                                  {entry.balance >= 0 ? 'Dr' : 'Cr'} ₹{Math.abs(entry.balance).toFixed(2)}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="bg-gray-100 font-semibold">
                        <tr>
                          <td colSpan={3} className="py-2 px-3 text-right">Total:</td>
                          <td className="py-2 px-3 text-right text-red-600">₹{ledgerData.totals?.debit?.toFixed(2) || '0.00'}</td>
                          <td className="py-2 px-3 text-right text-green-600">₹{ledgerData.totals?.credit?.toFixed(2) || '0.00'}</td>
                          <td className="py-2 px-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Closing Balance */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex justify-between items-center">
                    <span className="font-semibold text-indigo-700">Closing Balance</span>
                    <span className={`font-bold text-xl ${ledgerData.closingBalance >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {ledgerData.closingBalance >= 0 ? 'Dr' : 'Cr'} ₹{Math.abs(ledgerData.closingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Balance Explanation */}
                  <div className="mt-3 text-xs text-gray-500 text-center">
                    {ledgerData.closingBalance > 0 && (
                      <span className="text-orange-600">⚠️ Amount receivable from {selectedAccount.accountType === 'CUSTOMER' ? 'customer' : 'supplier'}</span>
                    )}
                    {ledgerData.closingBalance < 0 && (
                      <span className="text-green-600">✓ Advance balance available</span>
                    )}
                    {ledgerData.closingBalance === 0 && (
                      <span className="text-gray-600">✓ Account is settled</span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-4 pt-3 border-t">
                <Button variant="outline" size="sm" onClick={() => setShowLedgerModal(false)}>
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
