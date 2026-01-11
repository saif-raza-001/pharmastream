import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// Sales Report
export const getSalesReport = async (req: Request, res: Response) => {
  try {
    const { from, to, customerId } = req.query;
    
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) {
      const toDate = new Date(to as string);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }
    
    const where: any = {};
    if (from || to) where.invoiceDate = dateFilter;
    if (customerId) where.customerId = customerId as string;
    
    // Get invoices with items
    const invoices = await prisma.salesInvoice.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, city: true } },
        items: {
          include: {
            product: { select: { name: true } },
            batch: { select: { batchNo: true } }
          }
        }
      },
      orderBy: { invoiceDate: 'desc' }
    });
    
    // Calculate summary
    const summary = {
      totalInvoices: invoices.length,
      grossAmount: invoices.reduce((sum, inv) => sum + Number(inv.grossAmount), 0),
      totalDiscount: invoices.reduce((sum, inv) => sum + Number(inv.totalDiscount), 0),
      taxableAmount: invoices.reduce((sum, inv) => sum + Number(inv.taxableAmount), 0),
      cgstAmount: invoices.reduce((sum, inv) => sum + Number(inv.cgstAmount), 0),
      sgstAmount: invoices.reduce((sum, inv) => sum + Number(inv.sgstAmount), 0),
      grandTotal: invoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0),
      paidAmount: invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0),
      dueAmount: invoices.reduce((sum, inv) => sum + Number(inv.dueAmount), 0),
      cashSales: invoices.filter(inv => inv.invoiceType === 'CASH').length,
      creditSales: invoices.filter(inv => inv.invoiceType === 'CREDIT').length
    };
    
    // Product-wise summary
    const productSales: { [key: string]: { name: string; qty: number; amount: number } } = {};
    invoices.forEach(inv => {
      inv.items.forEach(item => {
        const key = item.productId;
        if (!productSales[key]) {
          productSales[key] = { name: item.product.name, qty: 0, amount: 0 };
        }
        productSales[key].qty += item.quantity;
        productSales[key].amount += Number(item.totalAmount);
      });
    });
    
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 20);
    
    res.json({ invoices, summary, topProducts });
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ error: 'Failed to generate sales report' });
  }
};

// Purchase Report
export const getPurchaseReport = async (req: Request, res: Response) => {
  try {
    const { from, to, supplierId } = req.query;
    
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) {
      const toDate = new Date(to as string);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }
    
    const where: any = {};
    if (from || to) where.purchaseDate = dateFilter;
    if (supplierId) where.supplierId = supplierId as string;
    
    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, city: true } },
        items: {
          include: {
            product: { select: { name: true } },
            batch: { select: { batchNo: true } }
          }
        }
      },
      orderBy: { purchaseDate: 'desc' }
    });
    
    const summary = {
      totalPurchases: purchases.length,
      grossAmount: purchases.reduce((sum, p) => sum + Number(p.grossAmount), 0),
      totalDiscount: purchases.reduce((sum, p) => sum + Number(p.totalDiscount), 0),
      taxableAmount: purchases.reduce((sum, p) => sum + Number(p.taxableAmount), 0),
      cgstAmount: purchases.reduce((sum, p) => sum + Number(p.cgstAmount), 0),
      sgstAmount: purchases.reduce((sum, p) => sum + Number(p.sgstAmount), 0),
      grandTotal: purchases.reduce((sum, p) => sum + Number(p.grandTotal), 0)
    };
    
    // Supplier-wise summary
    const supplierPurchases: { [key: string]: { name: string; count: number; amount: number } } = {};
    purchases.forEach(p => {
      const key = p.supplierId;
      if (!supplierPurchases[key]) {
        supplierPurchases[key] = { name: p.supplier.name, count: 0, amount: 0 };
      }
      supplierPurchases[key].count++;
      supplierPurchases[key].amount += Number(p.grandTotal);
    });
    
    const topSuppliers = Object.values(supplierPurchases)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
    
    res.json({ purchases, summary, topSuppliers });
  } catch (error) {
    console.error('Purchase report error:', error);
    res.status(500).json({ error: 'Failed to generate purchase report' });
  }
};

// Stock Report
export const getStockReport = async (req: Request, res: Response) => {
  try {
    const { filter } = req.query; // 'all', 'low', 'expiring', 'out'
    
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        manufacturer: { select: { name: true, shortName: true } },
        category: { select: { name: true } },
        batches: {
          where: { isActive: true },
          orderBy: { expiryDate: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    const today = new Date();
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysLater = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    
    let stockItems = products.map(product => {
      const totalStock = product.batches.reduce((sum, b) => sum + b.currentStock, 0);
      const stockValue = product.batches.reduce((sum, b) => sum + (b.currentStock * Number(b.purchaseRate)), 0);
      const mrpValue = product.batches.reduce((sum, b) => sum + (b.currentStock * Number(b.mrp)), 0);
      
      // Find earliest expiry batch with stock
      const batchesWithStock = product.batches.filter(b => b.currentStock > 0);
      const earliestExpiry = batchesWithStock.length > 0 
        ? batchesWithStock.reduce((earliest, b) => 
            new Date(b.expiryDate) < new Date(earliest.expiryDate) ? b : earliest
          )
        : null;
      
      const isLowStock = product.minStockAlert ? totalStock <= product.minStockAlert : totalStock < 50;
      const isOutOfStock = totalStock === 0;
      const isExpiringSoon = earliestExpiry && new Date(earliestExpiry.expiryDate) <= thirtyDaysLater;
      const isExpiring60 = earliestExpiry && new Date(earliestExpiry.expiryDate) <= sixtyDaysLater;
      const isExpired = earliestExpiry && new Date(earliestExpiry.expiryDate) < today;
      
      return {
        id: product.id,
        name: product.name,
        manufacturer: product.manufacturer?.shortName || product.manufacturer?.name || '-',
        category: product.category?.name || '-',
        rackLocation: product.rackLocation || '-',
        totalStock,
        stockValue: Math.round(stockValue * 100) / 100,
        mrpValue: Math.round(mrpValue * 100) / 100,
        minStockAlert: product.minStockAlert || 50,
        batchCount: batchesWithStock.length,
        earliestExpiry: earliestExpiry?.expiryDate || null,
        isLowStock,
        isOutOfStock,
        isExpiringSoon,
        isExpiring60,
        isExpired,
        batches: product.batches.map(b => ({
          id: b.id,
          batchNo: b.batchNo,
          expiryDate: b.expiryDate,
          currentStock: b.currentStock,
          mrp: Number(b.mrp),
          saleRate: Number(b.saleRate),
          purchaseRate: Number(b.purchaseRate)
        }))
      };
    });
    
    // Apply filter
    if (filter === 'low') {
      stockItems = stockItems.filter(item => item.isLowStock && !item.isOutOfStock);
    } else if (filter === 'out') {
      stockItems = stockItems.filter(item => item.isOutOfStock);
    } else if (filter === 'expiring') {
      stockItems = stockItems.filter(item => item.isExpiringSoon && !item.isExpired);
    } else if (filter === 'expired') {
      stockItems = stockItems.filter(item => item.isExpired);
    }
    
    // Summary
    const summary = {
      totalProducts: products.length,
      totalStock: stockItems.reduce((sum, item) => sum + item.totalStock, 0),
      totalStockValue: stockItems.reduce((sum, item) => sum + item.stockValue, 0),
      totalMRPValue: stockItems.reduce((sum, item) => sum + item.mrpValue, 0),
      lowStockCount: products.filter(p => {
        const stock = p.batches.reduce((sum, b) => sum + b.currentStock, 0);
        return stock > 0 && stock <= (p.minStockAlert || 50);
      }).length,
      outOfStockCount: products.filter(p => 
        p.batches.reduce((sum, b) => sum + b.currentStock, 0) === 0
      ).length,
      expiringSoonCount: stockItems.filter(item => item.isExpiringSoon && !item.isExpired).length,
      expiredCount: stockItems.filter(item => item.isExpired).length
    };
    
    res.json({ items: stockItems, summary });
  } catch (error) {
    console.error('Stock report error:', error);
    res.status(500).json({ error: 'Failed to generate stock report' });
  }
};

// GST Report (for filing)
export const getGSTReport = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({ error: 'Date range required' });
    }
    
    const fromDate = new Date(from as string);
    const toDate = new Date(to as string);
    toDate.setHours(23, 59, 59, 999);
    
    // Sales (Output GST)
    const sales = await prisma.salesInvoice.findMany({
      where: {
        invoiceDate: { gte: fromDate, lte: toDate }
      },
      include: {
        customer: { select: { name: true, gstin: true } }
      },
      orderBy: { invoiceDate: 'asc' }
    });
    
    // Purchases (Input GST)
    const purchases = await prisma.purchase.findMany({
      where: {
        purchaseDate: { gte: fromDate, lte: toDate }
      },
      include: {
        supplier: { select: { name: true, gstin: true } }
      },
      orderBy: { purchaseDate: 'asc' }
    });
    
    // Calculate GST summaries
    const outputGST = {
      taxableAmount: sales.reduce((sum, s) => sum + Number(s.taxableAmount), 0),
      cgst: sales.reduce((sum, s) => sum + Number(s.cgstAmount), 0),
      sgst: sales.reduce((sum, s) => sum + Number(s.sgstAmount), 0),
      igst: sales.reduce((sum, s) => sum + Number(s.igstAmount), 0),
      total: 0
    };
    outputGST.total = outputGST.cgst + outputGST.sgst + outputGST.igst;
    
    const inputGST = {
      taxableAmount: purchases.reduce((sum, p) => sum + Number(p.taxableAmount), 0),
      cgst: purchases.reduce((sum, p) => sum + Number(p.cgstAmount), 0),
      sgst: purchases.reduce((sum, p) => sum + Number(p.sgstAmount), 0),
      igst: purchases.reduce((sum, p) => sum + Number(p.igstAmount), 0),
      total: 0
    };
    inputGST.total = inputGST.cgst + inputGST.sgst + inputGST.igst;
    
    const netGST = {
      cgst: outputGST.cgst - inputGST.cgst,
      sgst: outputGST.sgst - inputGST.sgst,
      igst: outputGST.igst - inputGST.igst,
      total: outputGST.total - inputGST.total
    };
    
    // Rate-wise breakdown (5%, 12%, 18%, 28%)
    // This would require items, simplified for now
    
    res.json({
      period: { from: fromDate, to: toDate },
      sales: sales.map(s => ({
        date: s.invoiceDate,
        invoiceNo: s.invoiceNo,
        customer: s.customer.name,
        gstin: s.customer.gstin || '-',
        taxable: Number(s.taxableAmount),
        cgst: Number(s.cgstAmount),
        sgst: Number(s.sgstAmount),
        total: Number(s.grandTotal)
      })),
      purchases: purchases.map(p => ({
        date: p.purchaseDate,
        billNo: p.billNo,
        supplier: p.supplier.name,
        gstin: p.supplier.gstin || '-',
        taxable: Number(p.taxableAmount),
        cgst: Number(p.cgstAmount),
        sgst: Number(p.sgstAmount),
        total: Number(p.grandTotal)
      })),
      outputGST,
      inputGST,
      netGST
    });
  } catch (error) {
    console.error('GST report error:', error);
    res.status(500).json({ error: 'Failed to generate GST report' });
  }
};

// Dashboard Summary
export const getDashboardSummary = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
    
    // Today's sales
    const todaySales = await prisma.salesInvoice.aggregate({
      where: { invoiceDate: { gte: today, lt: tomorrow } },
      _sum: { grandTotal: true },
      _count: true
    });
    
    // This month sales
    const monthSales = await prisma.salesInvoice.aggregate({
      where: { invoiceDate: { gte: thisMonthStart } },
      _sum: { grandTotal: true },
      _count: true
    });
    
    // Last month sales (for comparison)
    const lastMonthSales = await prisma.salesInvoice.aggregate({
      where: { invoiceDate: { gte: lastMonthStart, lte: lastMonthEnd } },
      _sum: { grandTotal: true }
    });
    
    // Today's purchases
    const todayPurchases = await prisma.purchase.aggregate({
      where: { purchaseDate: { gte: today, lt: tomorrow } },
      _sum: { grandTotal: true },
      _count: true
    });
    
    // Outstanding amounts
    const customerDues = await prisma.account.aggregate({
      where: { accountType: 'CUSTOMER', currentBalance: { gt: 0 } },
      _sum: { currentBalance: true },
      _count: true
    });
    
    const supplierDues = await prisma.account.aggregate({
      where: { accountType: 'SUPPLIER', currentBalance: { gt: 0 } },
      _sum: { currentBalance: true },
      _count: true
    });
    
    // Low stock & expiring alerts
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const expiringBatches = await prisma.productBatch.count({
      where: {
        isActive: true,
        currentStock: { gt: 0 },
        expiryDate: { lte: thirtyDaysLater, gt: today }
      }
    });
    
    const expiredBatches = await prisma.productBatch.count({
      where: {
        isActive: true,
        currentStock: { gt: 0 },
        expiryDate: { lt: today }
      }
    });
    
    // Recent invoices
    const recentInvoices = await prisma.salesInvoice.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true } } }
    });
    
    res.json({
      today: {
        sales: Number(todaySales._sum.grandTotal) || 0,
        salesCount: todaySales._count,
        purchases: Number(todayPurchases._sum.grandTotal) || 0,
        purchasesCount: todayPurchases._count
      },
      thisMonth: {
        sales: Number(monthSales._sum.grandTotal) || 0,
        salesCount: monthSales._count
      },
      lastMonth: {
        sales: Number(lastMonthSales._sum.grandTotal) || 0
      },
      outstanding: {
        customerDues: Number(customerDues._sum.currentBalance) || 0,
        customerCount: customerDues._count,
        supplierDues: Number(supplierDues._sum.currentBalance) || 0,
        supplierCount: supplierDues._count
      },
      alerts: {
        expiringSoon: expiringBatches,
        expired: expiredBatches
      },
      recentInvoices: recentInvoices.map(inv => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        customer: inv.customer.name,
        amount: Number(inv.grandTotal),
        date: inv.invoiceDate
      }))
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
};
