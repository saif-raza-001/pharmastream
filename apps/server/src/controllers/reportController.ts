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

    const products = await prisma.product.findMany({
      where: { isActive: true },
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
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);

    let filteredProducts = products.map(p => ({
      ...p,
      totalStock: p.batches.reduce((sum, b) => sum + b.currentStock, 0),
      stockValue: p.batches.reduce((sum, b) => sum + (b.currentStock * Number(b.purchaseRate)), 0),
      nearestExpiry: p.batches.length > 0 ? p.batches[0].expiryDate : null
    }));

    if (filter === 'low') {
      filteredProducts = filteredProducts.filter(p => 
        p.totalStock > 0 && p.totalStock < (p.minStockAlert || 50)
      );
    } else if (filter === 'out') {
      filteredProducts = filteredProducts.filter(p => p.totalStock === 0);
    } else if (filter === 'expiring') {
      filteredProducts = filteredProducts.filter(p => 
        p.batches.some(b => 
          new Date(b.expiryDate) <= thirtyDaysLater && 
          new Date(b.expiryDate) > today &&
          b.currentStock > 0
        )
      );
    } else if (filter === 'expired') {
      filteredProducts = filteredProducts.filter(p => 
        p.batches.some(b => 
          new Date(b.expiryDate) < today && b.currentStock > 0
        )
      );
    }

    const summary = {
      totalProducts: filteredProducts.length,
      totalStock: filteredProducts.reduce((sum, p) => sum + p.totalStock, 0),
      totalValue: filteredProducts.reduce((sum, p) => sum + p.stockValue, 0)
    };

    res.json({ products: filteredProducts, summary });
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

    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);

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

    const expiringSoon = await prisma.productBatch.count({
      where: {
        isActive: true,
        currentStock: { gt: 0 },
        expiryDate: { gte: today, lte: thirtyDaysLater }
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
