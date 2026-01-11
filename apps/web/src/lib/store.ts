import { create } from 'zustand';

interface BatchInfo {
  id: string;
  batchNo: string;
  expiryDate: string;
  mrp: number;
  saleRate: number;
  currentStock: number;
}

interface BillingItem {
  id: string;
  productId: string;
  productName: string;
  batchId: string;
  batchNo: string;
  expiry: string;
  quantity: number;
  freeQuantity: number;
  unitRate: number;
  discountPct: number;
  gstPct: number;
  amount: number;
  mrp: number;
}

interface Customer {
  id: string;
  name: string;
  currentBalance: number;
}

interface BillingStore {
  customer: Customer | null;
  items: BillingItem[];
  invoiceType: 'CASH' | 'CREDIT';
  
  setCustomer: (customer: Customer | null) => void;
  setInvoiceType: (type: 'CASH' | 'CREDIT') => void;
  addItem: (item: BillingItem) => void;
  updateItem: (index: number, item: Partial<BillingItem>) => void;
  removeItem: (index: number) => void;
  clearBill: () => void;
  
  getTotals: () => {
    grossAmount: number;
    totalDiscount: number;
    taxableAmount: number;
    gstAmount: number;
    grandTotal: number;
  };
}

export const useBillingStore = create<BillingStore>((set, get) => ({
  customer: null,
  items: [],
  invoiceType: 'CASH',
  
  setCustomer: (customer) => set({ customer }),
  setInvoiceType: (type) => set({ invoiceType: type }),
  
  addItem: (item) => set((state) => ({ 
    items: [...state.items, item] 
  })),
  
  updateItem: (index, updates) => set((state) => ({
    items: state.items.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    )
  })),
  
  removeItem: (index) => set((state) => ({
    items: state.items.filter((_, i) => i !== index)
  })),
  
  clearBill: () => set({ customer: null, items: [], invoiceType: 'CASH' }),
  
  getTotals: () => {
    const items = get().items;
    const grossAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitRate), 0);
    const totalDiscount = items.reduce((sum, item) => sum + (item.quantity * item.unitRate * item.discountPct / 100), 0);
    const taxableAmount = grossAmount - totalDiscount;
    const gstAmount = items.reduce((sum, item) => {
      const itemTaxable = (item.quantity * item.unitRate) * (1 - item.discountPct / 100);
      return sum + (itemTaxable * item.gstPct / 100);
    }, 0);
    const grandTotal = taxableAmount + gstAmount;
    
    return { grossAmount, totalDiscount, taxableAmount, gstAmount, grandTotal };
  }
}));
