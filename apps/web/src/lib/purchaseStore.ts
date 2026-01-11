import { create } from 'zustand';

interface PurchaseItem {
  id: string;
  productId: string;
  productName: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  freeQuantity: number;
  purchaseRate: number;
  mrp: number;
  saleRate: number;
  discountPct: number;
  gstPct: number;
  amount: number;
  isExistingBatch?: boolean;
  previousStock?: number;
}

interface Supplier {
  id: string;
  name: string;
}

interface PurchaseStore {
  supplier: Supplier | null;
  billNo: string;
  billDate: string;
  items: PurchaseItem[];
  
  setSupplier: (supplier: Supplier | null) => void;
  setBillInfo: (no: string, date: string) => void;
  addItem: (item: PurchaseItem) => void;
  removeItem: (index: number) => void;
  clearPurchase: () => void;
  
  getTotals: () => {
    grossAmount: number;
    totalDiscount: number;
    taxableAmount: number;
    gstAmount: number;
    grandTotal: number;
  };
}

export const usePurchaseStore = create<PurchaseStore>((set, get) => ({
  supplier: null,
  billNo: '',
  billDate: new Date().toISOString().split('T')[0],
  items: [],
  
  setSupplier: (supplier) => set({ supplier }),
  setBillInfo: (billNo, billDate) => set({ billNo, billDate }),
  
  addItem: (item) => set((state) => ({ 
    items: [...state.items, item] 
  })),
  
  removeItem: (index) => set((state) => ({
    items: state.items.filter((_, i) => i !== index)
  })),
  
  clearPurchase: () => set({ 
    supplier: null, 
    billNo: '', 
    billDate: new Date().toISOString().split('T')[0], 
    items: [] 
  }),
  
  getTotals: () => {
    const items = get().items;
    const grossAmount = items.reduce((sum, item) => sum + (item.quantity * item.purchaseRate), 0);
    const totalDiscount = items.reduce((sum, item) => sum + (item.quantity * item.purchaseRate * item.discountPct / 100), 0);
    const taxableAmount = grossAmount - totalDiscount;
    const gstAmount = items.reduce((sum, item) => {
      const itemTaxable = (item.quantity * item.purchaseRate) * (1 - item.discountPct / 100);
      return sum + (itemTaxable * item.gstPct / 100);
    }, 0);
    const grandTotal = taxableAmount + gstAmount;
    
    return { grossAmount, totalDiscount, taxableAmount, gstAmount, grandTotal };
  }
}));
