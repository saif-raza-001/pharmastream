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
  amount: number; // Now includes GST (Net Amount)
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
    subtotal: number;      // Sum of (qty × rate) before discount
    totalDiscount: number; // Total discount amount
    grandTotal: number;    // Final amount (all net amounts with GST)
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
    
    // Subtotal = sum of (qty × rate) - before any discount or GST
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitRate), 0);
    
    // Total discount amount
    const totalDiscount = items.reduce((sum, item) => {
      return sum + (item.quantity * item.unitRate * item.discountPct / 100);
    }, 0);
    
    // Grand Total = sum of all item amounts (which now include GST)
    const grandTotal = items.reduce((sum, item) => sum + item.amount, 0);
    
    return { subtotal, totalDiscount, grandTotal };
  }
}));
