import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const getAccounts = async (req: Request, res: Response) => {
  try {
    const { type, search } = req.query;
    
    const where: any = { isActive: true };
    
    if (type) {
      where.accountType = type as string;
    }
    
    if (search) {
      // SQLite: use contains without mode (case-sensitive, but works)
      const searchTerm = String(search);
      where.OR = [
        { name: { contains: searchTerm } },
        { mobile: { contains: searchTerm } },
        { city: { contains: searchTerm } }
      ];
    }
    
    const accounts = await prisma.account.findMany({
      where,
      orderBy: { name: 'asc' }
    });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};

export const getAccountById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        ledgerEntries: {
          orderBy: { entryDate: 'desc' },
          take: 50
        }
      }
    });
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch account' });
  }
};

export const createAccount = async (req: Request, res: Response) => {
  try {
    const { accountType, name, contactPerson, mobile, email, address, city, state, pincode, gstin, dlNumber, creditLimit, creditDays, openingBalance } = req.body;
    
    const account = await prisma.account.create({
      data: {
        accountType,
        name,
        contactPerson,
        mobile,
        email,
        address,
        city,
        state,
        pincode,
        gstin,
        dlNumber,
        creditLimit: creditLimit || 0,
        creditDays: creditDays || 0,
        openingBalance: openingBalance || 0,
        currentBalance: openingBalance || 0
      }
    });
    res.status(201).json(account);
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
};

export const updateAccount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, contactPerson, mobile, email, address, city, state, pincode, gstin, dlNumber, creditLimit, creditDays } = req.body;
    
    const account = await prisma.account.update({
      where: { id },
      data: {
        name,
        contactPerson,
        mobile,
        email,
        address,
        city,
        state,
        pincode,
        gstin,
        dlNumber,
        creditLimit,
        creditDays
      }
    });
    res.json(account);
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
};

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await prisma.account.update({
      where: { id },
      data: { isActive: false }
    });
    
    res.json({ message: 'Account deactivated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
};

export const getAccountLedger = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    
    const account = await prisma.account.findUnique({
      where: { id }
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const allEntries = await prisma.ledgerEntry.findMany({
      where: { accountId: id },
      orderBy: { entryDate: 'asc' },
      include: {
        salesInvoice: { select: { invoiceNo: true, invoiceType: true } },
        purchase: { select: { purchaseNo: true, billNo: true } }
      }
    });
    
    let openingBalance = Number(account.openingBalance) || 0;
    let filteredEntries: any[] = [];
    
    if (from) {
      const fromDate = new Date(from as string);
      
      for (const entry of allEntries) {
        if (new Date(entry.entryDate) < fromDate) {
          openingBalance += Number(entry.debitAmount) - Number(entry.creditAmount);
        }
      }
      
      filteredEntries = allEntries.filter(entry => {
        const entryDate = new Date(entry.entryDate);
        const inRange = entryDate >= fromDate;
        if (to) {
          const toDate = new Date(to as string);
          toDate.setHours(23, 59, 59, 999);
          return inRange && entryDate <= toDate;
        }
        return inRange;
      });
    } else {
      filteredEntries = allEntries;
    }
    
    let runningBalance = openingBalance;
    const entriesWithBalance = filteredEntries.map(entry => {
      const debit = Number(entry.debitAmount) || 0;
      const credit = Number(entry.creditAmount) || 0;
      runningBalance += debit - credit;
      
      let voucherType = entry.entryType;
      let voucherRef = '';
      
      if (entry.salesInvoice) {
        voucherType = 'SALES';
        voucherRef = `INV-${entry.salesInvoice.invoiceNo}`;
      } else if (entry.purchase) {
        voucherType = 'PURCHASE';
        voucherRef = entry.purchase.billNo || `PUR-${entry.purchase.purchaseNo}`;
      } else if (entry.entryType === 'RECEIPT') {
        voucherType = 'RECEIPT';
        voucherRef = entry.narration?.match(/RCP-\d+/)?.[0] || '';
      } else if (entry.entryType === 'PAYMENT') {
        voucherType = 'PAYMENT';
        voucherRef = entry.narration?.match(/PAY-\d+/)?.[0] || '';
      }
      
      return {
        id: entry.id,
        date: entry.entryDate,
        voucherType,
        voucherRef,
        narration: entry.narration || getDefaultNarration(entry),
        debit,
        credit,
        balance: runningBalance
      };
    });
    
    const totalDebit = entriesWithBalance.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entriesWithBalance.reduce((sum, e) => sum + e.credit, 0);
    const closingBalance = openingBalance + totalDebit - totalCredit;
    
    res.json({
      account: {
        id: account.id,
        name: account.name,
        type: account.accountType,
        mobile: account.mobile,
        city: account.city,
        gstin: account.gstin
      },
      period: {
        from: from || 'Beginning',
        to: to || 'Today'
      },
      openingBalance,
      entries: entriesWithBalance,
      totals: {
        debit: totalDebit,
        credit: totalCredit
      },
      closingBalance
    });
  } catch (error) {
    console.error('Ledger error:', error);
    res.status(500).json({ error: 'Failed to fetch ledger' });
  }
};

function getDefaultNarration(entry: any): string {
  switch (entry.entryType) {
    case 'SALES': return 'Sales Invoice';
    case 'PURCHASE': return 'Purchase Entry';
    case 'RECEIPT': return 'Payment Received';
    case 'PAYMENT': return 'Payment Made';
    case 'ADJUSTMENT': return 'Balance Adjustment';
    default: return entry.entryType;
  }
}

export const getAccountStats = async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    
    const where: any = { isActive: true };
    if (type) where.accountType = type as string;
    
    const stats = await prisma.account.aggregate({
      where,
      _count: { id: true },
      _sum: { currentBalance: true }
    });
    
    const withDue = await prisma.account.count({
      where: {
        ...where,
        currentBalance: { gt: 0 }
      }
    });
    
    res.json({
      totalCount: stats._count.id,
      totalOutstanding: stats._sum.currentBalance || 0,
      withDueCount: withDue
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

export const getAccountStatement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    
    const ledgerResponse = await getAccountLedgerData(id, from as string, to as string);
    
    if (!ledgerResponse) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json(ledgerResponse);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate statement' });
  }
};

async function getAccountLedgerData(accountId: string, from?: string, to?: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId }
  });
  
  if (!account) return null;
  
  const allEntries = await prisma.ledgerEntry.findMany({
    where: { accountId },
    orderBy: { entryDate: 'asc' },
    include: {
      salesInvoice: { select: { invoiceNo: true } },
      purchase: { select: { purchaseNo: true, billNo: true } }
    }
  });
  
  let openingBalance = Number(account.openingBalance) || 0;
  let filteredEntries: any[] = [];
  
  if (from) {
    const fromDate = new Date(from);
    for (const entry of allEntries) {
      if (new Date(entry.entryDate) < fromDate) {
        openingBalance += Number(entry.debitAmount) - Number(entry.creditAmount);
      }
    }
    filteredEntries = allEntries.filter(entry => {
      const entryDate = new Date(entry.entryDate);
      const inRange = entryDate >= fromDate;
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        return inRange && entryDate <= toDate;
      }
      return inRange;
    });
  } else {
    filteredEntries = allEntries;
  }
  
  let runningBalance = openingBalance;
  const entriesWithBalance = filteredEntries.map(entry => {
    const debit = Number(entry.debitAmount) || 0;
    const credit = Number(entry.creditAmount) || 0;
    runningBalance += debit - credit;
    
    return {
      date: entry.entryDate,
      narration: entry.narration || entry.entryType,
      voucherRef: entry.salesInvoice ? `INV-${entry.salesInvoice.invoiceNo}` : 
                  entry.purchase ? (entry.purchase.billNo || `PUR-${entry.purchase.purchaseNo}`) : '',
      debit,
      credit,
      balance: runningBalance
    };
  });
  
  const totalDebit = entriesWithBalance.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = entriesWithBalance.reduce((sum, e) => sum + e.credit, 0);
  
  return {
    account,
    openingBalance,
    entries: entriesWithBalance,
    totals: { debit: totalDebit, credit: totalCredit },
    closingBalance: openingBalance + totalDebit - totalCredit
  };
}
