"use client";

import { useState, useEffect } from 'react';
import { settingsAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'company' | 'print' | 'billing'>('company');
  
  const [settings, setSettings] = useState({
    companyName: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    gstin: '',
    dlNumber20b: '',
    dlNumber21b: '',
    invoicePrefix: 'INV',
    thermalPrintWidth: 80
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await settingsAPI.get();
      setSettings({
        companyName: res.data.companyName || '',
        address: res.data.address || '',
        city: res.data.city || '',
        state: res.data.state || '',
        pincode: res.data.pincode || '',
        phone: res.data.phone || '',
        email: res.data.email || '',
        gstin: res.data.gstin || '',
        dlNumber20b: res.data.dlNumber20b || '',
        dlNumber21b: res.data.dlNumber21b || '',
        invoicePrefix: res.data.invoicePrefix || 'INV',
        thermalPrintWidth: res.data.thermalPrintWidth || 80
      });
    } catch (err) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.companyName) {
      toast.error('Company name is required');
      return;
    }
    
    setSaving(true);
    try {
      await settingsAPI.update(settings);
      toast.success('Settings saved successfully!');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-11 bg-gray-700 flex items-center justify-between px-4 shrink-0">
        <h1 className="text-white font-semibold text-sm">⚙️ System Settings</h1>
        <Button 
          size="sm" 
          onClick={handleSave}
          disabled={saving}
          className="h-7 bg-emerald-600 hover:bg-emerald-700 text-xs"
        >
          {saving ? 'Saving...' : '💾 Save Settings'}
        </Button>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b px-4 shrink-0">
        <div className="flex gap-0">
          {[
            { id: 'company', label: '🏢 Company Info', icon: '🏢' },
            { id: 'print', label: '🖨️ Print Settings', icon: '🖨️' },
            { id: 'billing', label: '🧾 Billing Settings', icon: '🧾' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 text-xs font-semibold border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-gray-700 text-gray-800 bg-gray-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
          
          {/* Company Info Tab */}
          {activeTab === 'company' && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b">
                  🏢 Business Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase font-medium">Company / Pharmacy Name *</label>
                    <Input 
                      value={settings.companyName}
                      onChange={e => updateField('companyName', e.target.value)}
                      placeholder="Enter your pharmacy name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase font-medium">Address</label>
                    <Input 
                      value={settings.address}
                      onChange={e => updateField('address', e.target.value)}
                      placeholder="Shop No, Building, Street"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase font-medium">City</label>
                      <Input 
                        value={settings.city}
                        onChange={e => updateField('city', e.target.value)}
                        placeholder="City"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase font-medium">State</label>
                      <Input 
                        value={settings.state}
                        onChange={e => updateField('state', e.target.value)}
                        placeholder="State"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase font-medium">Pincode</label>
                      <Input 
                        value={settings.pincode}
                        onChange={e => updateField('pincode', e.target.value)}
                        placeholder="Pincode"
                        className="mt-1"
                        maxLength={6}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase font-medium">Phone</label>
                      <Input 
                        value={settings.phone}
                        onChange={e => updateField('phone', e.target.value)}
                        placeholder="Contact Number"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase font-medium">Email</label>
                      <Input 
                        value={settings.email}
                        onChange={e => updateField('email', e.target.value)}
                        placeholder="email@example.com"
                        className="mt-1"
                        type="email"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tax & License */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b">
                  📋 Tax & License Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase font-medium">GSTIN</label>
                    <Input 
                      value={settings.gstin}
                      onChange={e => updateField('gstin', e.target.value.toUpperCase())}
                      placeholder="22AAAAA0000A1Z5"
                      className="mt-1 font-mono"
                      maxLength={15}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">15-digit GST Identification Number</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase font-medium">Drug License No. (20B)</label>
                      <Input 
                        value={settings.dlNumber20b}
                        onChange={e => updateField('dlNumber20b', e.target.value.toUpperCase())}
                        placeholder="DL-20B-XXXXX"
                        className="mt-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase font-medium">Drug License No. (21B)</label>
                      <Input 
                        value={settings.dlNumber21b}
                        onChange={e => updateField('dlNumber21b', e.target.value.toUpperCase())}
                        placeholder="DL-21B-XXXXX"
                        className="mt-1 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Print Settings Tab */}
          {activeTab === 'print' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b">
                  🖨️ Print Configuration
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase font-medium">Print Paper Width</label>
                    <div className="mt-2 grid grid-cols-3 gap-3">
                      {[
                        { value: 58, label: '58mm', desc: 'Small Thermal' },
                        { value: 80, label: '80mm', desc: 'Standard Thermal' },
                        { value: 210, label: 'A4', desc: 'Full Page' }
                      ].map(option => (
                        <div
                          key={option.value}
                          onClick={() => updateField('thermalPrintWidth', option.value)}
                          className={`p-4 border-2 rounded-lg cursor-pointer text-center transition ${
                            settings.thermalPrintWidth === option.value
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="text-2xl mb-1">
                            {option.value === 58 && '📃'}
                            {option.value === 80 && '🧾'}
                            {option.value === 210 && '📄'}
                          </div>
                          <div className="text-sm font-semibold">{option.label}</div>
                          <div className="text-xs text-gray-500">{option.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                    <h4 className="text-xs font-semibold text-blue-700 mb-2">💡 Print Tips</h4>
                    <ul className="text-xs text-blue-600 space-y-1">
                      <li>• <b>58mm</b>: Best for small receipts, limited product info</li>
                      <li>• <b>80mm</b>: Recommended for pharmacy bills with full details</li>
                      <li>• <b>A4</b>: For formal tax invoices with GST summary</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Print Preview */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b">
                  👁️ Header Preview
                </h3>
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center"
                  style={{ 
                    maxWidth: settings.thermalPrintWidth === 58 ? '200px' : 
                              settings.thermalPrintWidth === 80 ? '280px' : '100%',
                    margin: '0 auto'
                  }}
                >
                  <h4 className="font-bold text-sm uppercase">{settings.companyName || 'Your Pharmacy Name'}</h4>
                  <p className="text-[10px] text-gray-600">{settings.address || 'Address Line'}</p>
                  <p className="text-[10px] text-gray-600">
                    {settings.city || 'City'}, {settings.state || 'State'} - {settings.pincode || '000000'}
                  </p>
                  <p className="text-[10px] text-gray-600">Ph: {settings.phone || '0000000000'}</p>
                  {settings.gstin && <p className="text-[10px] font-semibold">GSTIN: {settings.gstin}</p>}
                  <p className="text-[10px] text-gray-500 mt-1">
                    DL: {settings.dlNumber20b || 'XX-XXX'} | {settings.dlNumber21b || 'XX-XXX'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Billing Settings Tab */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b">
                  🧾 Invoice Settings
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase font-medium">Invoice Number Prefix</label>
                    <Input 
                      value={settings.invoicePrefix}
                      onChange={e => updateField('invoicePrefix', e.target.value.toUpperCase())}
                      placeholder="INV"
                      className="mt-1 w-32 font-mono"
                      maxLength={5}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      Example: {settings.invoicePrefix || 'INV'}-0001, {settings.invoicePrefix || 'INV'}-0002
                    </p>
                  </div>
                </div>
              </div>

              {/* GST Rates Reference */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b">
                  📊 GST Rates Reference
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { rate: '5%', items: 'Essential medicines, bulk drugs' },
                    { rate: '12%', items: 'Most medicines, medical devices' },
                    { rate: '18%', items: 'Cosmetics, premium products' },
                    { rate: '28%', items: 'Luxury items' }
                  ].map(gst => (
                    <div key={gst.rate} className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-lg font-bold text-indigo-600">{gst.rate}</div>
                      <div className="text-[10px] text-gray-500 mt-1">{gst.items}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Info */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-yellow-700 mb-2">⚠️ Important Notes</h4>
                <ul className="text-xs text-yellow-600 space-y-1">
                  <li>• Invoice numbers are auto-generated and sequential</li>
                  <li>• GST is calculated automatically based on product rates</li>
                  <li>• CGST and SGST are split equally for intra-state sales</li>
                </ul>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t px-6 py-3 shrink-0">
        <div className="flex justify-between items-center max-w-3xl mx-auto">
          <p className="text-xs text-gray-400">
            Settings are saved to database and apply to all invoices
          </p>
          <Button 
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? 'Saving...' : '💾 Save All Settings'}
          </Button>
        </div>
      </footer>
    </div>
  );
}
