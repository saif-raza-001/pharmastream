import { Request, Response } from 'express';
import prisma from '../utils/prisma';

const getString = (value: any): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
};

export const getSalesReport = async (req: Request, res: Response) => {
  try {
    const from = getString(req.query.from);
    const to = getString(req.query.to);
    const customerId = getString(req.query.customerId);

    const where: any = {};
    
    if (from && to) {
      where.invoiceDate = {
        gte: new Date(from),
        lte: new Date(to)
      };
    }
    
    if (customerId) {
      where.customerId = customerId;
    }

    const invoices = await prisma.salesInvoice.findMany({
      where,
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            batch: true
          }
        }
      },
      orderBy: { invoiceDate: 'desc' }
    });

    const summary = await prisma.salesInvoice.aggregate({
      where,
      _sum: {
        grandTotal: true,
        paidAmount: true,
        dueAmount: true,
        cgstAmount: true,
        sgstAmount: true
      },
      _count: true
    });

    res.json({
      invoices,
      summary: {
        totalInvoices: summary._count,
        totalAmount: summary._sum.grandTotal || 0,
        totalPaid: summary._sum.paidAmount || 0,
        totalDue: summary._sum.dueAmount || 0,
        totalGst: (Number(summary._sum.cgstAmount) || 0) + (Number(summary._sum.sgstAmount) || 0)
      }
    });
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ error: 'Failed to generate sales report' });
  }
};

export const getPurchaseReport = async (req: Request, res: Response) => {
  try {
    const from = getString(req.query.from);
    const to = getString(req.query.to);
    const supplierId = getString(req.query.supplierId);

    const where: any = {};
    
    if (from && to) {
      where.purchaseDate = {
        gte: new Date(from),
        lte: new Date(to)
      };
    }
    
    if (supplierId) {
      where.supplierId = supplierId;
    }

    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
            batch: true
          }
        }
      },
      orderBy: { purchaseDate: 'desc' }
    });

    const summary = await prisma.purchase.aggregate({
      where,
      _sum: {
        grandTotal: true,
        cgstAmount: true,
        sgstAmount: true
      },
      _count: true
    });

    res.json({
      purchases,
      summary: {
        totalPurchases: summary._count,
        totalAmount: summary._sum.grandTotal || 0,
        totalGst: (Number(summary._sum.cgstAmount) || 0) + (Number(summary._sum.sgstAmount) || 0)
      }
    });
  } catch (error) {
    console.error('Purchase report error:', error);
    res.status(500).json({ error: 'Failed to generate purchase report' });
  }
};

export const getStockReport = async (req: Request, res: Response) => {
  try {
    const filter = getString(req.query.filter) || 'all';
    const categoryId = getString(req.query.categoryId);

    const productWhere: any = { isActive: true };
    if (categoryId) {
      productWhere.categoryId = categoryId;
    }

    const products = await prisma.product.findMany({
      where: productWhere,
      include: {
        manufacturer: true,
        category: true,
        batches: {
          where: { isActive: true },
          orderBy: { expiryDate: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 120 days for expiring filter
    const expiryThreshold = new Date();
    expiryThreshold.setDate(today.getDate() + 120);

    // Create batch-level data for detailed view
    let stockItems: any[] = [];

    for (const product of products) {
      for (const batch of product.batches) {
        if (batch.currentStock <= 0) continue;

        const expiryDate = new Date(batch.expiryDate);
        const daysToExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const isExpired = expiryDate < today;
        const isExpiringSoon = !isExpired && expiryDate <= expiryThreshold;

        stockItems.push({
          id: batch.id,
          productId: product.id,
          productName: product.name,
          saltComposition: product.saltComposition,
          manufacturer: product.manufacturer?.name || '-',
          manufacturerShort: product.manufacturer?.shortName || product.manufacturer?.name || '-',
          category: product.category?.name || '-',
          categoryId: product.categoryId,
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          daysToExpiry,
          isExpired,
          isExpiringSoon,
          currentStock: batch.currentStock,
          mrp: Number(batch.mrp),
          saleRate: Number(batch.saleRate),
          purchaseRate: Number(batch.purchaseRate),
          stockValue: batch.currentStock * Number(batch.purchaseRate),
          rackLocation: product.rackLocation || '-',
          gstRate: product.gstRate || 12,
          minStockAlert: product.minStockAlert || 50
        });
      }
    }

    // Apply filters
    if (filter === 'low') {
      // Group by product and check total stock
      const productStocks: { [key: string]: number } = {};
      stockItems.forEach(item => {
        productStocks[item.productId] = (productStocks[item.productId] || 0) + item.currentStock;
      });
      stockItems = stockItems.filter(item => {
        const totalStock = productStocks[item.productId];
        return totalStock > 0 && totalStock < item.minStockAlert;
      });
    } else if (filter === 'out') {
      // Products with zero total stock
      const productStocks: { [key: string]: number } = {};
      products.forEach(p => {
        productStocks[p.id] = p.batches.reduce((sum, b) => sum + b.currentStock, 0);
      });
      // Show products with 0 stock (no batch entries)
      const outOfStockProducts = products.filter(p => productStocks[p.id] === 0);
      stockItems = outOfStockProducts.map(p => ({
        id: p.id,
        productId: p.id,
        productName: p.name,
        saltComposition: p.saltComposition,
        manufacturer: p.manufacturer?.name || '-',
        manufacturerShort: p.manufacturer?.shortName || p.manufacturer?.name || '-',
        category: p.category?.name || '-',
        categoryId: p.categoryId,
        batchNo: '-',
        expiryDate: null,
        daysToExpiry: null,
        isExpired: false,
        isExpiringSoon: false,
        currentStock: 0,
        mrp: 0,
        saleRate: 0,
        purchaseRate: 0,
        stockValue: 0,
        rackLocation: p.rackLocation || '-',
        gstRate: p.gstRate || 12,
        minStockAlert: p.minStockAlert || 50
      }));
    } else if (filter === 'expiring') {
      stockItems = stockItems.filter(item => item.isExpiringSoon);
    } else if (filter === 'expired') {
      stockItems = stockItems.filter(item => item.isExpired);
    }

    // Sort by expiry date for expiring/expired filters
    if (filter === 'expiring' || filter === 'expired') {
      stockItems.sort((a, b) => {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      });
    }

    // Get all categories for filter dropdown
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' }
    });

    const summary = {
      totalProducts: new Set(stockItems.map(i => i.productId)).size,
      totalBatches: stockItems.length,
      totalStock: stockItems.reduce((sum, item) => sum + item.currentStock, 0),
      totalValue: stockItems.reduce((sum, item) => sum + item.stockValue, 0),
      expiringCount: stockItems.filter(i => i.isExpiringSoon).length,
      expiredCount: stockItems.filter(i => i.isExpired).length
    };

    res.json({ 
      products: stockItems, 
      summary,
      categories
    });
  } catch (error) {
    console.error('Stock report error:', error);
    res.status(500).json({ error: 'Failed to generate stock report' });
  }
};

export const getGstReport = async (req: Request, res: Response) => {
  try {
    const from = getString(req.query.from);
    const to = getString(req.query.to);

    if (!from || !to) {
      return res.status(400).json({ error: 'From and To dates are required' });
    }

    const salesWhere = {
      invoiceDate: {
        gte: new Date(from),
        lte: new Date(to)
      }
    };

    const purchaseWhere = {
      purchaseDate: {
        gte: new Date(from),
        lte: new Date(to)
      }
    };

    const salesSummary = await prisma.salesInvoice.aggregate({
      where: salesWhere,
      _sum: {
        taxableAmount: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
        grandTotal: true
      },
      _count: true
    });

    const purchaseSummary = await prisma.purchase.aggregate({
      where: purchaseWhere,
      _sum: {
        taxableAmount: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
        grandTotal: true
      },
      _count: true
    });

    const outputGst = (Number(salesSummary._sum.cgstAmount) || 0) + 
                      (Number(salesSummary._sum.sgstAmount) || 0) + 
                      (Number(salesSummary._sum.igstAmount) || 0);
                      
    const inputGst = (Number(purchaseSummary._sum.cgstAmount) || 0) + 
                     (Number(purchaseSummary._sum.sgstAmount) || 0) + 
                     (Number(purchaseSummary._sum.igstAmount) || 0);

    res.json({
      period: { from, to },
      sales: {
        count: salesSummary._count,
        taxableAmount: salesSummary._sum.taxableAmount || 0,
        cgst: salesSummary._sum.cgstAmount || 0,
        sgst: salesSummary._sum.sgstAmount || 0,
        igst: salesSummary._sum.igstAmount || 0,
        totalGst: outputGst,
        grandTotal: salesSummary._sum.grandTotal || 0
      },
      purchases: {
        count: purchaseSummary._count,
        taxableAmount: purchaseSummary._sum.taxableAmount || 0,
        cgst: purchaseSummary._sum.cgstAmount || 0,
        sgst: purchaseSummary._sum.sgstAmount || 0,
        igst: purchaseSummary._sum.igstAmount || 0,
        totalGst: inputGst,
        grandTotal: purchaseSummary._sum.grandTotal || 0
      },
      netGst: outputGst - inputGst,
      liability: Math.max(0, outputGst - inputGst),
      credit: Math.max(0, inputGst - outputGst)
    });
  } catch (error) {
    console.error('GST report error:', error);
    res.status(500).json({ error: 'Failed to generate GST report' });
  }
};

export const getDashboard = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    // 120 days for expiry alert
    const expiryThreshold = new Date();
    expiryThreshold.setDate(today.getDate() + 120);

    const todaySales = await prisma.salesInvoice.aggregate({
      where: { invoiceDate: { gte: today, lt: tomorrow } },
      _sum: { grandTotal: true },
      _count: true
    });

    const todayPurchases = await prisma.purchase.aggregate({
      where: { purchaseDate: { gte: today, lt: tomorrow } },
      _sum: { grandTotal: true },
      _count: true
    });

    const thisMonthSales = await prisma.salesInvoice.aggregate({
      where: { invoiceDate: { gte: thisMonthStart } },
      _sum: { grandTotal: true },
      _count: true
    });

    const lastMonthSales = await prisma.salesInvoice.aggregate({
      where: { invoiceDate: { gte: lastMonthStart, lte: lastMonthEnd } },
      _sum: { grandTotal: true },
      _count: true
    });

    const customerDues = await prisma.account.aggregate({
      where: { accountType: 'CUSTOMER', currentBalance: { gt: 0 }, isActive: true },
      _sum: { currentBalance: true },
      _count: true
    });

    const supplierDues = await prisma.account.aggregate({
      where: { accountType: 'SUPPLIER', currentBalance: { gt: 0 }, isActive: true },
      _sum: { currentBalance: true },
      _count: true
    });

    // Expiring in 120 days
    const expiringSoon = await prisma.productBatch.count({
      where: {
        isActive: true,
        currentStock: { gt: 0 },
        expiryDate: { gte: today, lte: expiryThreshold }
      }
    });

    const expired = await prisma.productBatch.count({
      where: {
        isActive: true,
        currentStock: { gt: 0 },
        expiryDate: { lt: today }
      }
    });

    const recentInvoices = await prisma.salesInvoice.findMany({
      where: { invoiceDate: { gte: today } },
      include: { customer: { select: { name: true } } },
      orderBy: { invoiceDate: 'desc' },
      take: 10
    });

    res.json({
      today: {
        sales: todaySales._sum.grandTotal || 0,
        salesCount: todaySales._count,
        purchases: todayPurchases._sum.grandTotal || 0,
        purchasesCount: todayPurchases._count
      },
      thisMonth: {
        sales: thisMonthSales._sum.grandTotal || 0,
        salesCount: thisMonthSales._count
      },
      lastMonth: {
        sales: lastMonthSales._sum.grandTotal || 0,
        salesCount: lastMonthSales._count
      },
      outstanding: {
        customerDues: customerDues._sum.currentBalance || 0,
        customerCount: customerDues._count,
        supplierDues: supplierDues._sum.currentBalance || 0,
        supplierCount: supplierDues._count
      },
      alerts: {
        expiringSoon,
        expired
      },
      recentInvoices: recentInvoices.map(inv => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        customer: inv.customer?.name || 'Walk-in',
        amount: inv.grandTotal,
        date: inv.invoiceDate
      }))
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
};
