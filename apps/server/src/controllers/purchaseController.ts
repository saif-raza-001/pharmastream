import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { getNextNumber } from '../utils/counter';

const getParam = (value: string | string[] | undefined): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] || '';
  return '';
};

// Create Purchase Entry with Smart Batch Management
export const createPurchase = async (req: Request, res: Response) => {
  try {
    const { supplierId, billNo, billDate, items, totals } = req.body;

    // Get next purchase number
    const purchaseNo = await getNextNumber('purchase');

    const purchase = await prisma.$transaction(async (tx) => {
      // 1. Create purchase header
      const newPurchase = await tx.purchase.create({
        data: {
          purchaseNo,
          supplierId,
          billNo,
          billDate: billDate ? new Date(billDate) : new Date(),
          grossAmount: totals.grossAmount,
          totalDiscount: totals.totalDiscount || 0,
          taxableAmount: totals.taxableAmount,
          cgstAmount: totals.gstAmount / 2,
          sgstAmount: totals.gstAmount / 2,
          igstAmount: 0,
          grandTotal: totals.grandTotal
        }
      });

      // 2. Process items with smart batch management
      for (const item of items) {
        // Check if batch already exists
        let batch = await tx.productBatch.findFirst({
          where: {
            productId: item.productId,
            batchNo: item.batchNo
          }
        });

        if (batch) {
          // SMART UPDATE: Batch exists - update stock and weighted average rates
          const existingStock = batch.currentStock;
          const newStock = existingStock + item.quantity + (item.freeQuantity || 0);
          
          // Calculate weighted average purchase rate
          const weightedPurchaseRate = ((Number(batch.purchaseRate) * existingStock) + 
                                        (item.purchaseRate * item.quantity)) / 
                                        (existingStock + item.quantity);
          
          // Update existing batch
          batch = await tx.productBatch.update({
            where: { id: batch.id },
            data: {
              currentStock: newStock,
              purchaseRate: weightedPurchaseRate,
              // Update MRP and Sale Rate only if new ones are provided
              mrp: item.mrp || batch.mrp,
              saleRate: item.saleRate || batch.saleRate,
              // Update expiry only if new batch has later expiry
              expiryDate: new Date(item.expiryDate) > batch.expiryDate ? 
                          new Date(item.expiryDate) : batch.expiryDate
            }
          });
          
        } else {
          // Create new batch
          batch = await tx.productBatch.create({
            data: {
              productId: item.productId,
              batchNo: item.batchNo,
              expiryDate: new Date(item.expiryDate),
              mrp: item.mrp,
              saleRate: item.saleRate,
              purchaseRate: item.purchaseRate,
              currentStock: item.quantity + (item.freeQuantity || 0)
            }
          });
        }

        // Create purchase item record
        await tx.purchaseItem.create({
          data: {
            purchaseId: newPurchase.id,
            productId: item.productId,
            batchId: batch.id,
            quantity: item.quantity,
            freeQuantity: item.freeQuantity || 0,
            unitRate: item.purchaseRate,
            discountPct: item.discountPct || 0,
            gstPct: item.gstPct,
            totalAmount: item.amount
          }
        });
      }

      // 3. Create ledger entry for supplier
      await tx.ledgerEntry.create({
        data: {
          accountId: supplierId,
          purchaseId: newPurchase.id,
          entryType: 'PURCHASE',
          debitAmount: 0,
          creditAmount: totals.grandTotal,
          narration: `Purchase Bill #${billNo}`
        }
      });

      // 4. Update supplier balance
      await tx.account.update({
        where: { id: supplierId },
        data: {
          currentBalance: {
            increment: totals.grandTotal
          }
        }
      });

      return newPurchase;
    });

    res.status(201).json(purchase);
  } catch (error) {
    console.error('Purchase creation error:', error);
    res.status(500).json({ error: 'Failed to create purchase' });
  }
};

// Get all purchases
export const getPurchases = async (req: Request, res: Response) => {
  try {
    const purchases = await prisma.purchase.findMany({
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
            batch: true
          }
        }
      },
      orderBy: { purchaseDate: 'desc' },
      take: 100
    });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
};

// Get single purchase
export const getPurchaseById = async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
            batch: true
          }
        }
      }
    });
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    res.json(purchase);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purchase' });
  }
};

// Extract data from bill text/OCR
export const extractBillData = async (req: Request, res: Response) => {
  try {
    const { billText } = req.body;
    
    const lines = billText.split('\n').filter((line: string) => line.trim());
    const items = [];
    
    for (const line of lines) {
      const parts = line.split(',').map((p: string) => p.trim());
      if (parts.length >= 8) {
        const product = await prisma.product.findFirst({
          where: {
            name: {
              contains: parts[0],
            }
          }
        });
        
        if (product) {
          items.push({
            productId: product.id,
            productName: product.name,
            batchNo: parts[1] || 'BATCH001',
            expiryDate: parts[2] || '2025-12-31',
            quantity: parseInt(parts[3]) || 0,
            freeQuantity: parseInt(parts[4]) || 0,
            purchaseRate: parseFloat(parts[5]) || 0,
            mrp: parseFloat(parts[6]) || 0,
            saleRate: parseFloat(parts[7]) || 0,
            gstPct: parseFloat(parts[8]) || product.gstRate || 12
          });
        }
      }
    }
    
    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to extract data' });
  }
};
