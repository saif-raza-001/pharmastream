import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// Create Receipt (Money received FROM Customer)
export const createReceipt = async (req: Request, res: Response) => {
  try {
    const { accountId, amount, mode, referenceNo, narration, date } = req.body;
    const amt = Number(amount);

    if (!accountId) return res.status(400).json({ error: 'Account required' });
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    if (account.accountType !== 'CUSTOMER') {
      return res.status(400).json({ error: 'Receipt only for Customers' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Reduce customer outstanding balance
      await tx.account.update({
        where: { id: accountId },
        data: { currentBalance: { decrement: amt } }
      });

      // Create ledger entry
      const entry = await tx.ledgerEntry.create({
        data: {
          accountId,
          entryType: 'RECEIPT',
          debitAmount: 0,
          creditAmount: amt,
          narration: narration || `Receipt (${mode || 'CASH'}) ${referenceNo ? `Ref: ${referenceNo}` : ''}`.trim(),
          ...(date && { entryDate: new Date(date) })
        }
      });

      return entry;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Receipt error:', error);
    res.status(500).json({ error: 'Failed to create receipt' });
  }
};

// Create Payment (Money paid TO Supplier)
export const createPayment = async (req: Request, res: Response) => {
  try {
    const { accountId, amount, mode, referenceNo, narration, date } = req.body;
    const amt = Number(amount);

    if (!accountId) return res.status(400).json({ error: 'Account required' });
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    if (account.accountType !== 'SUPPLIER') {
      return res.status(400).json({ error: 'Payment only for Suppliers' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Reduce supplier payable balance
      await tx.account.update({
        where: { id: accountId },
        data: { currentBalance: { decrement: amt } }
      });

      // Create ledger entry
      const entry = await tx.ledgerEntry.create({
        data: {
          accountId,
          entryType: 'PAYMENT',
          debitAmount: amt,
          creditAmount: 0,
          narration: narration || `Payment (${mode || 'CASH'}) ${referenceNo ? `Ref: ${referenceNo}` : ''}`.trim(),
          ...(date && { entryDate: new Date(date) })
        }
      });

      return entry;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
};

// Get Recent Receipts & Payments
export const getRecent = async (req: Request, res: Response) => {
  try {
    const entries = await prisma.ledgerEntry.findMany({
      where: { 
        entryType: { in: ['RECEIPT', 'PAYMENT'] } 
      },
      orderBy: { entryDate: 'desc' },
      take: 100,
      include: { account: true }
    });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch' });
  }
};
