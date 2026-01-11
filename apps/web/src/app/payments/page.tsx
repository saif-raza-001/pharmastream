"use client";

import { useState, useEffect } from 'react';
import { accountsAPI, paymentsAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from "sonner";

type PaymentTab = 'RECEIPT' | 'PAYMENT';

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<PaymentTab>('RECEIPT');
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [account, setAccount] = useState<any>(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountResults, setAccountResults] = useState<any[]>([]);
  const [showAccountSearch, setShowAccountSearch] = useState(false);
  
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('CASH');
  const [referenceNo, setReferenceNo] = useState('');
  const [narration, setNarration] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchRecent();
  }, []);

  useEffect(() => {
    if (accountSearch.length > 1) {
      const type = activeTab === 'RECEIPT' ? 'CUSTOMER' : 'SUPPLIER';
      accountsAPI.getAll(type, accountSearch).then(res => setAccountResults(res.data)).catch(() => setAccountResults([]));
    } else {
      setAccountResults([]);
    }
  }, [accountSearch, activeTab]);

  const fetchRecent = async () => {
    try {
      setLoading(true);
      const res = await paymentsAPI.getRecent();
      setRecent(res.data || []);
    } catch (err) {
      console.error('Failed to fetch recent payments');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = (acc: any) => {
    setAccount(acc);
    setAccountSearch('');
    setAccountResults([]);
    setShowAccountSearch(false);
  };

  const resetForm = () => {
    setAccount(null);
    setAccountSearch('');
    setAmount('');
    setMode('CASH');
    setReferenceNo('');
    setNarration('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const handleSave = async () => {
    if (!account) {
      toast.error('Select account');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error('Enter valid amount');
      return;
    }

    setIsSaving(true);
    try {
      const data = {
        accountId: account.id,
        amount: Number(amount),
        mode,
        referenceNo,
        narration,
        date
      };

      if (activeTab === 'RECEIPT') {
        await paymentsAPI.createReceipt(data);
        toast.success(`Receipt of ₹${amount} saved!`);
      } else {
        await paymentsAPI.createPayment(data);
        toast.success(`Payment of ₹${amount} saved!`);
      }

      resetForm();
      fetchRecent();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const accountType = activeTab === 'RECEIPT' ? 'Customer' : 'Supplier';
  
  // Filter recent by type
  const filteredRecent = recent.filter(entry => 
    activeTab === 'RECEIPT' ? entry.entryType === 'RECEIPT' : entry.entryType === 'PAYMENT'
  );

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-11 bg-teal-700 flex items-center justify-between px-4 shrink-0">
        <h1 className="text-white font-semibold text-sm">Payment Entry</h1>
        <Button 
          size="sm" 
          className="h-7 text-xs bg-white text-teal-700 hover:bg-teal-50"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : `Save ${activeTab === 'RECEIPT' ? 'Receipt' : 'Payment'}`}
        </Button>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b px-4 shrink-0">
        <div className="flex gap-0">
          {(['RECEIPT', 'PAYMENT'] as PaymentTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); resetForm(); }}
              className={`px-6 py-2.5 text-xs font-medium border-b-2 transition ${
                activeTab === tab 
                  ? 'border-teal-600 text-teal-700' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'RECEIPT' ? '💰 Receipt (From Customer)' : '💸 Payment (To Supplier)'}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 p-6 overflow-auto bg-gray-100">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Form Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              {activeTab === 'RECEIPT' ? '💰 New Receipt' : '💸 New Payment'}
            </h2>
            
            <div className="grid grid-cols-2 gap-6">
              
              {/* Account Search */}
              <div className="col-span-2 relative">
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  {accountType} *
                </label>
                <Input 
                  placeholder={`Search ${accountType.toLowerCase()}...`}
                  value={account ? account.name : accountSearch}
                  onChange={(e) => { 
                    if (account) setAccount(null);
                    setAccountSearch(e.target.value); 
                    setShowAccountSearch(true); 
                  }}
                  onFocus={() => setShowAccountSearch(true)}
                  className="h-10"
                />
                {showAccountSearch && accountResults.length > 0 && (
                  <div className="absolute z-50 w-full bg-white border border-gray-200 shadow-lg max-h-60 overflow-y-auto rounded-md mt-1">
                    {accountResults.map((acc) => (
                      <div 
                        key={acc.id} 
                        className="px-4 py-3 hover:bg-teal-50 cursor-pointer border-b"
                        onClick={() => handleSelectAccount(acc)}
                      >
                        <div className="font-medium text-sm">{acc.name}</div>
                        <div className="text-xs text-gray-500 flex justify-between">
                          <span>{acc.city || '-'} • {acc.mobile || '-'}</span>
                          <span className={Number(acc.currentBalance) > 0 ? 'text-orange-600 font-semibold' : 'text-green-600'}>
                            {activeTab === 'RECEIPT' ? 'Due' : 'Payable'}: ₹{Number(acc.currentBalance || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Account Balance Display */}
              {account && (
                <div className={`col-span-2 p-3 rounded-lg text-center ${
                  Number(account.currentBalance) > 0 ? 'bg-orange-50' : 'bg-green-50'
                }`}>
                  <span className="text-sm text-gray-600">
                    {activeTab === 'RECEIPT' ? 'Outstanding Due' : 'Payable Balance'}:
                  </span>
                  <span className={`ml-2 text-lg font-bold ${
                    Number(account.currentBalance) > 0 ? 'text-orange-700' : 'text-green-700'
                  }`}>
                    ₹{Number(account.currentBalance || 0).toLocaleString()}
                  </span>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Amount *</label>
                <Input 
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="h-12 text-xl font-bold text-teal-700 text-center"
                />
              </div>

              {/* Mode */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Mode</label>
                <select 
                  value={mode}
                  onChange={e => setMode(e.target.value)}
                  className="w-full h-12 border rounded px-3 text-sm"
                >
                  <option value="CASH">💵 Cash</option>
                  <option value="UPI">📱 UPI</option>
                  <option value="BANK">🏦 Bank Transfer</option>
                  <option value="CHEQUE">📄 Cheque</option>
                </select>
              </div>

              {/* Reference No */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Reference No</label>
                <Input 
                  placeholder="Cheque No / Txn ID"
                  value={referenceNo}
                  onChange={e => setReferenceNo(e.target.value)}
                  className="h-10"
                />
              </div>

              {/* Date */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Date</label>
                <Input 
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="h-10"
                />
              </div>

              {/* Narration */}
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Narration</label>
                <Input 
                  placeholder="Payment details / notes..."
                  value={narration}
                  onChange={e => setNarration(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end mt-6 pt-4 border-t">
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                className="bg-teal-600 hover:bg-teal-700 px-8"
              >
                {isSaving ? 'Saving...' : `Save ${activeTab === 'RECEIPT' ? 'Receipt' : 'Payment'}`}
              </Button>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Recent {activeTab === 'RECEIPT' ? 'Receipts' : 'Payments'}
            </h3>
            
            {loading ? (
              <div className="text-center py-8 text-gray-400">Loading...</div>
            ) : filteredRecent.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No {activeTab === 'RECEIPT' ? 'receipts' : 'payments'} yet
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-2 px-3 text-left font-semibold">Date</th>
                    <th className="py-2 px-3 text-left font-semibold">Party</th>
                    <th className="py-2 px-3 text-left font-semibold">Narration</th>
                    <th className="py-2 px-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecent.map((entry) => (
                    <tr key={entry.id} className="border-t hover:bg-gray-50">
                      <td className="py-2 px-3">
                        {new Date(entry.entryDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-2 px-3 font-medium">{entry.account?.name || '-'}</td>
                      <td className="py-2 px-3 text-gray-600">{entry.narration || '-'}</td>
                      <td className="py-2 px-3 text-right font-bold text-teal-700">
                        ₹{Number(entry.entryType === 'RECEIPT' ? entry.creditAmount : entry.debitAmount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
