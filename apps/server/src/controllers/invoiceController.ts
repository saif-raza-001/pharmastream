import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { getNextNumber } from '../utils/counter';

// Helper functions
const getString = (value: any): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
};

const getParam = (value: string | string[] | undefined): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] || '';
  return '';
};

const getNumber = (value: any, defaultVal: number): number => {
  const str = getString(value);
  if (!str) return defaultVal;
  const num = parseInt(str, 10);
  return isNaN(num) ? defaultVal : num;
};

export const createInvoice = async (req: Request, res: Response) => {
  try {
    const { customerId, invoiceType, items, totals, payment } = req.body;
    
    const grandTotal = Number(totals.grandTotal);
    const previousDue = Number(payment?.previousDue || 0);
    const advanceUsed = Number(payment?.advanceUsed || 0);
    const cashReceived = Number(payment?.amount || 0);
    const paymentMode = payment?.mode || 'CASH';
    const paymentRef = payment?.reference || null;
    
    const netPayable = grandTotal + previousDue - advanceUsed;
    const totalPaid = cashReceived;
    const finalDue = netPayable - totalPaid;

    for (const item of items) {
      const batch = await prisma.productBatch.findUnique({
        where: { id: item.batchId }
      });
      
      if (!batch || batch.currentStock < (item.quantity + (item.freeQuantity || 0))) {
        return res.status(400).json({ 
          error: `Insufficient stock for batch ${item.batchNo}. Available: ${batch?.currentStock || 0}` 
        });
      }
    }

    const invoiceNo = await getNextNumber('invoice');

    const invoice = await prisma.$transaction(async (tx) => {
      const newInvoice = await tx.salesInvoice.create({
        data: {
          invoiceNo,
          customerId,
          invoiceType,
          grossAmount: totals.grossAmount,
          totalDiscount: totals.totalDiscount,
          taxableAmount: totals.taxableAmount,
          cgstAmount: totals.gstAmount / 2,
          sgstAmount: totals.gstAmount / 2,
          igstAmount: 0,
          roundOff: 0,
          grandTotal: grandTotal,
          previousDue: previousDue,
          advanceUsed: advanceUsed,
          netPayable: netPayable,
          paidAmount: cashReceived,
          dueAmount: Math.max(0, finalDue),
          paymentMode: paymentMode,
          paymentRef: paymentRef
        }
      });

      for (const item of items) {
        await tx.invoiceItem.create({
          data: {
            invoiceId: newInvoice.id,
            productId: item.productId,
            batchId: item.batchId,
            quantity: item.quantity,
            freeQuantity: item.freeQuantity || 0,
            unitRate: item.unitRate,
            discountPct: item.discountPct,
            discountAmount: (item.quantity * item.unitRate * item.discountPct) / 100,
            taxableAmount: item.quantity * item.unitRate * (1 - item.discountPct / 100),
            gstPct: item.gstPct,
            gstAmount: item.quantity * item.unitRate * (1 - item.discountPct / 100) * item.gstPct / 100,
            totalAmount: item.amount
          }
        });

        await tx.productBatch.update({
          where: { id: item.batchId },
          data: {
            currentStock: {
              decrement: item.quantity + (item.freeQuantity || 0)
            }
          }
        });
      }

      await tx.ledgerEntry.create({
        data: {
          accountId: customerId,
          invoiceId: newInvoice.id,
          entryType: 'SALES',
          debitAmount: grandTotal,
          creditAmount: 0,
          narration: `Sales Invoice #${newInvoice.invoiceNo}`
        }
      });

      if (advanceUsed > 0) {
        await tx.ledgerEntry.create({
          data: {
            accountId: customerId,
            invoiceId: newInvoice.id,
            entryType: 'ADJUSTMENT',
            debitAmount: 0,
            creditAmount: advanceUsed,
            narration: `Advance adjusted for Invoice #${newInvoice.invoiceNo}`
          }
        });
      }

      if (cashReceived > 0) {
        await tx.ledgerEntry.create({
          data: {
            accountId: customerId,
            invoiceId: newInvoice.id,
            entryType: 'RECEIPT',
            debitAmount: 0,
            creditAmount: cashReceived,
            narration: `Payment (${paymentMode}) for Invoice #${newInvoice.invoiceNo}${paymentRef ? ` Ref: ${paymentRef}` : ''}`
          }
        });
      }

      const balanceChange = grandTotal - advanceUsed - cashReceived;
      
      await tx.account.update({
        where: { id: customerId },
        data: {
          currentBalance: {
            increment: balanceChange
          }
        }
      });

      return newInvoice;
    });

    const completeInvoice = await prisma.salesInvoice.findUnique({
      where: { id: invoice.id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            batch: true
          }
        }
      }
    });

    res.status(201).json(completeInvoice);
  } catch (error) {
    console.error('Invoice creation error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const from = getString(req.query.from);
    const to = getString(req.query.to);
    const customerId = getString(req.query.customerId);
    const status = getString(req.query.status);
    const search = getString(req.query.search);
    const currentPage = getNumber(req.query.page, 1);
    const size = getNumber(req.query.pageSize, 50) || getNumber(req.query.limit, 50);
    
    const where: any = {};
    
    if (from || to) {
      where.invoiceDate = {};
      if (from) {
        where.invoiceDate.gte = new Date(from);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.invoiceDate.lte = toDate;
      }
    }
    
    if (customerId) {
      where.customerId = customerId;
    }
    
    if (status === 'PAID') {
      where.dueAmount = { equals: 0 };
    } else if (status === 'PENDING') {
      where.dueAmount = { gt: 0 };
    }
    
    if (search) {
      const searchNum = parseInt(search, 10);
      if (!isNaN(searchNum)) {
        where.invoiceNo = searchNum;
      }
    }
    
    const totalCount = await prisma.salesInvoice.count({ where });
    
    const invoices = await prisma.salesInvoice.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, mobile: true, city: true }
        },
        items: {
          select: { id: true, quantity: true, totalAmount: true }
        }
      },
      orderBy: { invoiceDate: 'desc' },
      skip: (currentPage - 1) * size,
      take: size
    });
    
    const stats = await prisma.salesInvoice.aggregate({
      where,
      _sum: { grandTotal: true, paidAmount: true, dueAmount: true },
      _count: true
    });

    res.json({
      invoices,
      pagination: {
        page: currentPage,
        pageSize: size,
        totalCount,
        totalPages: Math.ceil(totalCount / size)
      },
      stats: {
        totalInvoices: stats._count,
        totalAmount: stats._sum.grandTotal || 0,
        totalPaid: stats._sum.paidAmount || 0,
        totalDue: stats._sum.dueAmount || 0
      }
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

export const getInvoiceById = async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);

    const invoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            batch: true
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
};

export const getRecentInvoices = async (req: Request, res: Response) => {
  try {
    const invoices = await prisma.salesInvoice.findMany({
      include: {
        customer: { select: { id: true, name: true } }
      },
      orderBy: { invoiceDate: 'desc' },
      take: 15
    });

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recent invoices' });
  }
};

export const receivePayment = async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const { amount, mode, reference } = req.body;
    
    const paymentAmount = Number(amount);
    
    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }
    
    const invoice = await prisma.salesInvoice.findUnique({
      where: { id }
    });
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const currentDue = Number(invoice.dueAmount);
    
    if (currentDue <= 0) {
      return res.status(400).json({ error: 'Invoice already paid' });
    }
    
    const newPaid = Number(invoice.paidAmount) + paymentAmount;
    const newDue = Math.max(0, currentDue - paymentAmount);
    
    await prisma.$transaction(async (tx) => {
      await tx.salesInvoice.update({
        where: { id },
        data: {
          paidAmount: newPaid,
          dueAmount: newDue
        }
      });
      
      await tx.ledgerEntry.create({
        data: {
          accountId: invoice.customerId,
          invoiceId: id,
          entryType: 'RECEIPT',
          debitAmount: 0,
          creditAmount: paymentAmount,
          narration: `Payment (${mode || 'CASH'}) for Invoice #${invoice.invoiceNo}${reference ? ` Ref: ${reference}` : ''}`
        }
      });
      
      await tx.account.update({
        where: { id: invoice.customerId },
        data: {
          currentBalance: { decrement: paymentAmount }
        }
      });
    });
    
    res.json({ 
      success: true, 
      message: `Payment of ₹${paymentAmount} received`,
      newDue
    });
  } catch (error) {
    console.error('Receive payment error:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
};
