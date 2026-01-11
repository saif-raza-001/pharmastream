import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { getNextNumber } from '../utils/counter';

// Create Sales Invoice (with stock deduction + payment tracking + advance/due handling)
export const createInvoice = async (req: Request, res: Response) => {
  try {
    const { customerId, invoiceType, items, totals, payment } = req.body;
    
    const grandTotal = Number(totals.grandTotal);
    const previousDue = Number(payment?.previousDue || 0);
    const advanceUsed = Number(payment?.advanceUsed || 0);
    const cashReceived = Number(payment?.amount || 0);
    const paymentMode = payment?.mode || 'CASH';
    const paymentRef = payment?.reference || null;
    
    // Net payable = Bill Amount + Previous Due - Advance Used
    const netPayable = grandTotal + previousDue - advanceUsed;
    const totalPaid = cashReceived;
    const finalDue = netPayable - totalPaid;

    // Validate stock availability first
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

    // Get next invoice number
    const invoiceNo = await getNextNumber('invoice');

    // Create invoice with transaction (atomic operation)
    const invoice = await prisma.$transaction(async (tx) => {
      // 1. Create invoice header with all payment breakdown fields
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

      // 2. Create invoice items & deduct stock
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

        // Deduct stock from batch
        await tx.productBatch.update({
          where: { id: item.batchId },
          data: {
            currentStock: {
              decrement: item.quantity + (item.freeQuantity || 0)
            }
          }
        });
      }

      // 3. Create SALES ledger entry (bill amount only)
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

      // 4. If advance was used, create adjustment entry
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

      // 5. If cash payment received, create RECEIPT ledger entry
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

      // 6. Update customer balance
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

    // Fetch complete invoice with items
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

// Get all invoices with enhanced filters and pagination
export const getInvoices = async (req: Request, res: Response) => {
  try {
    const { from, to, customerId, status, search, page, pageSize, limit } = req.query;
    
    // Build where clause
    const where: any = {};
    
    // Date filter
    if (from || to) {
      where.invoiceDate = {};
      if (from) {
        where.invoiceDate.gte = new Date(String(from));
      }
      if (to) {
        const toDate = new Date(String(to));
        toDate.setHours(23, 59, 59, 999);
        where.invoiceDate.lte = toDate;
      }
    }
    
    // Customer filter
    if (customerId) {
      where.customerId = String(customerId);
    }
    
    // Status filter
    if (status === 'PAID') {
      where.dueAmount = { equals: 0 };
    } else if (status === 'PENDING') {
      where.dueAmount = { gt: 0 };
    }
    
    // Search by invoice number
    if (search) {
      const searchNum = parseInt(String(search));
      if (!isNaN(searchNum)) {
        where.invoiceNo = searchNum;
      }
    }
    
    // Pagination
    const currentPage = Number(page) || 1;
    const size = Number(pageSize) || Number(limit) || 50;
    
    // Get total count
    const totalCount = await prisma.salesInvoice.count({ where });
    
    // Get invoices
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
    
    // Get stats
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

// Get single invoice by ID
export const getInvoiceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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

// Get recent invoices for billing page sidebar (15 limit)
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

// Receive payment for pending invoice
export const receivePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, mode, reference } = req.body;
    
    const paymentAmount = Number(amount);
    
    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }
    
    // Get current invoice
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
    
    // Calculate new amounts
    const newPaid = Number(invoice.paidAmount) + paymentAmount;
    const newDue = Math.max(0, currentDue - paymentAmount);
    
    // Update in transaction
    await prisma.$transaction(async (tx) => {
      // Update invoice
      await tx.salesInvoice.update({
        where: { id },
        data: {
          paidAmount: newPaid,
          dueAmount: newDue
        }
      });
      
      // Create ledger entry for receipt
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
      
      // Update customer balance
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
