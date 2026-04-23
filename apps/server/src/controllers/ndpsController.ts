import { Request, Response } from 'express';
import prisma from '../utils/prisma';

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

// ==================== NDPS PRODUCTS ====================

export const getNDPSProducts = async (req: Request, res: Response) => {
  try {
    const ndpsProducts = await prisma.nDPSProduct.findMany({
      where: { isActive: true },
      include: {
        transactions: {
          orderBy: { transactionDate: 'desc' },
          take: 10
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch product details for all productIds
    const productIds = ndpsProducts.map(np => np.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { manufacturer: true }
    });

    // Create a map for quick lookup
    const productMap = new Map(products.map(p => [p.id, p]));

    // Attach product details to each NDPS product
    const enrichedProducts = ndpsProducts.map(np => ({
      ...np,
      product: productMap.get(np.productId) || null
    }));

    res.json(enrichedProducts);
  } catch (error) {
    console.error('Get NDPS products error:', error);
    res.status(500).json({ error: 'Failed to fetch NDPS products' });
  }
};

export const markProductAsNDPS = async (req: Request, res: Response) => {
  try {
    const { productId, scheduleType, maxQtyPerSale, requiresRx } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const existing = await prisma.nDPSProduct.findUnique({
      where: { productId }
    });

    if (existing) {
      const updated = await prisma.nDPSProduct.update({
        where: { productId },
        data: {
          scheduleType: scheduleType || 'H1',
          maxQtyPerSale: maxQtyPerSale ? Number(maxQtyPerSale) : null,
          requiresRx: requiresRx !== undefined ? requiresRx : true,
          isActive: true
        }
      });
      return res.json(updated);
    }

    // NEW: Calculate current stock from batches and create initial transaction
    const batches = await prisma.productBatch.findMany({
      where: { 
        productId: productId,
        isActive: true
      }
    });

    const currentStock = batches.reduce((sum, batch) => sum + batch.currentStock, 0);

    // Create NDPS product
    const ndpsProduct = await prisma.nDPSProduct.create({
      data: {
        productId,
        scheduleType: scheduleType || 'H1',
        maxQtyPerSale: maxQtyPerSale ? Number(maxQtyPerSale) : null,
        requiresRx: requiresRx !== undefined ? requiresRx : true
      }
    });

    // Create initial stock transaction if there's existing stock
    if (currentStock > 0) {
      await prisma.nDPSTransaction.create({
        data: {
          transactionType: 'RECEIPT',
          ndpsProductId: ndpsProduct.id,
          quantity: currentStock,
          unit: 'units',
          openingBalance: 0,
          closingBalance: currentStock,
          remarks: 'Initial stock entry when marked as NDPS'
        }
      });
    }

    res.status(201).json(ndpsProduct);
  } catch (error) {
    console.error('Mark NDPS error:', error);
    res.status(500).json({ error: 'Failed to mark product as NDPS' });
  }
};

export const unmarkNDPS = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.nDPSProduct.update({
      where: { id },
      data: { isActive: false }
    });
    res.json({ message: 'Product unmarked from NDPS' });
  } catch (error) {
    console.error('Unmark NDPS error:', error);
    res.status(500).json({ error: 'Failed to unmark NDPS' });
  }
};

// ==================== NDPS LICENSES ====================

export const getLicenses = async (req: Request, res: Response) => {
  try {
    const search = getString(req.query.search);
    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { buyerName: { contains: search.toLowerCase() } },
        { licenseNo: { contains: search.toLowerCase() } }
      ];
    }

    const licenses = await prisma.nDPSLicense.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json(licenses);
  } catch (error) {
    console.error('Get licenses error:', error);
    res.status(500).json({ error: 'Failed to fetch licenses' });
  }
};

export const createLicense = async (req: Request, res: Response) => {
  try {
    const { buyerName, buyerType, licenseNo, issuedBy, validFrom, validTo, address, mobile } = req.body;

    const existing = await prisma.nDPSLicense.findUnique({
      where: { licenseNo }
    });

    if (existing) {
      return res.status(400).json({ error: 'License number already exists' });
    }

    const license = await prisma.nDPSLicense.create({
      data: {
        buyerName,
        buyerType,
        licenseNo,
        issuedBy: issuedBy || null,
        validFrom: new Date(validFrom),
        validTo: new Date(validTo),
        address: address || null,
        mobile: mobile || null
      }
    });

    res.status(201).json(license);
  } catch (error) {
    console.error('Create license error:', error);
    res.status(500).json({ error: 'Failed to create license' });
  }
};

export const updateLicense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { buyerName, buyerType, licenseNo, issuedBy, validFrom, validTo, address, mobile } = req.body;

    const license = await prisma.nDPSLicense.update({
      where: { id },
      data: {
        buyerName,
        buyerType,
        licenseNo,
        issuedBy: issuedBy || null,
        validFrom: new Date(validFrom),
        validTo: new Date(validTo),
        address: address || null,
        mobile: mobile || null
      }
    });

    res.json(license);
  } catch (error) {
    console.error('Update license error:', error);
    res.status(500).json({ error: 'Failed to update license' });
  }
};

export const deleteLicense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.nDPSLicense.update({
      where: { id },
      data: { isActive: false }
    });
    res.json({ message: 'License deleted' });
  } catch (error) {
    console.error('Delete license error:', error);
    res.status(500).json({ error: 'Failed to delete license' });
  }
};

// ==================== NDPS TRANSACTIONS ====================

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const from = getString(req.query.from);
    const to = getString(req.query.to);
    const productId = getString(req.query.productId);

    const where: any = {};

    if (from && to) {
      where.transactionDate = {
        gte: new Date(from),
        lte: new Date(to)
      };
    }

    if (productId) {
      where.ndpsProductId = productId;
    }

    const transactions = await prisma.nDPSTransaction.findMany({
      where,
      include: {
        ndpsProduct: true,
        ndpsLicense: true
      },
      orderBy: { transactionDate: 'desc' }
    });

    // Fetch product details
    const ndpsProductIds = [...new Set(transactions.map(t => t.ndpsProduct.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: ndpsProductIds } },
      include: { manufacturer: true }
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    // Enrich transactions with product details
    const enrichedTransactions = transactions.map(txn => ({
      ...txn,
      product: productMap.get(txn.ndpsProduct.productId) || null
    }));

    res.json(enrichedTransactions);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

export const createTransaction = async (req: Request, res: Response) => {
  try {
    const {
      transactionType,
      ndpsProductId,
      ndpsLicenseId,
      batchNo,
      expiryDate,
      quantity,
      unit,
      supplierName,
      supplierLicense,
      invoiceNo,
      prescriptionNo,
      prescriptionDate,
      doctorName,
      doctorRegistrationNo,
      patientName,
      patientAadhaar,
      patientAge,
      patientGender,
      patientMobile,
      patientAddress,
      purposeOfUse,
      remarks
    } = req.body;

    // Get last transaction for this product to calculate balance
    const lastTransaction = await prisma.nDPSTransaction.findFirst({
      where: { ndpsProductId },
      orderBy: { transactionDate: 'desc' }
    });

    const openingBalance = lastTransaction ? lastTransaction.closingBalance : 0;
    let closingBalance = openingBalance;

    if (transactionType === 'RECEIPT' || transactionType === 'PURCHASE') {
      closingBalance = openingBalance + Number(quantity);
    } else if (transactionType === 'ISSUE' || transactionType === 'SALE') {
      closingBalance = openingBalance - Number(quantity);
    }

    const transaction = await prisma.nDPSTransaction.create({
      data: {
        transactionType,
        ndpsProductId,
        ndpsLicenseId: ndpsLicenseId || null,
        batchNo: batchNo || null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        quantity: Number(quantity),
        unit: unit || 'units',
        supplierName: supplierName || null,
        supplierLicense: supplierLicense || null,
        invoiceNo: invoiceNo || null,
        prescriptionNo: prescriptionNo || null,
        prescriptionDate: prescriptionDate ? new Date(prescriptionDate) : null,
        doctorName: doctorName || null,
        doctorRegistrationNo: doctorRegistrationNo || null,
        patientName: patientName || null,
        patientAadhaar: patientAadhaar || null,
        patientAge: patientAge ? Number(patientAge) : null,
        patientGender: patientGender || null,
        patientMobile: patientMobile || null,
        patientAddress: patientAddress || null,
        purposeOfUse: purposeOfUse || null,
        openingBalance,
        closingBalance,
        remarks: remarks || null
      },
      include: {
        ndpsProduct: true,
        ndpsLicense: true
      }
    });

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
};

export const getNDPSRegister = async (req: Request, res: Response) => {
  try {
    const from = getString(req.query.from);
    const to = getString(req.query.to);

    const where: any = {};

    if (from && to) {
      where.transactionDate = {
        gte: new Date(from),
        lte: new Date(to)
      };
    }

    const transactions = await prisma.nDPSTransaction.findMany({
      where,
      include: {
        ndpsProduct: true,
        ndpsLicense: true
      },
      orderBy: { transactionDate: 'asc' }
    });

    // Fetch product details
    const ndpsProductIds = [...new Set(transactions.map(t => t.ndpsProduct.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: ndpsProductIds } },
      include: { manufacturer: true }
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    // Enrich with product details
    const enrichedTransactions = transactions.map(txn => ({
      ...txn,
      product: productMap.get(txn.ndpsProduct.productId) || null
    }));

    res.json(enrichedTransactions);
  } catch (error) {
    console.error('Get NDPS register error:', error);
    res.status(500).json({ error: 'Failed to fetch NDPS register' });
  }
};

export const getStockSummary = async (req: Request, res: Response) => {
  try {
    const ndpsProducts = await prisma.nDPSProduct.findMany({
      where: { isActive: true },
      include: {
        transactions: {
          orderBy: { transactionDate: 'desc' },
          take: 1
        }
      }
    });

    // Fetch product details
    const productIds = ndpsProducts.map(np => np.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { manufacturer: true }
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    const summary = ndpsProducts.map(np => ({
      id: np.id,
      productId: np.productId,
      product: productMap.get(np.productId) || null,
      scheduleType: np.scheduleType,
      currentStock: np.transactions[0]?.closingBalance || 0,
      lastUpdated: np.transactions[0]?.transactionDate || np.createdAt
    }));

    res.json(summary);
  } catch (error) {
    console.error('Get stock summary error:', error);
    res.status(500).json({ error: 'Failed to fetch stock summary' });
  }
};

// ==================== GOVERNMENT REPORTS ====================

export const generateGovernmentReport = async (req: Request, res: Response) => {
  try {
    const from = getString(req.query.from);
    const to = getString(req.query.to);
    const reportType = getString(req.query.type) || 'quarterly';

    if (!from || !to) {
      return res.status(400).json({ error: 'Date range required' });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const ndpsProducts = await prisma.nDPSProduct.findMany({
      where: { isActive: true },
      include: {
        transactions: {
          where: {
            transactionDate: {
              gte: fromDate,
              lte: toDate
            }
          },
          orderBy: { transactionDate: 'asc' }
        }
      }
    });

    // Fetch product details
    const productIds = ndpsProducts.map(np => np.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { manufacturer: true }
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    const reportData = [];

    for (const ndpsProduct of ndpsProducts) {
      const transactions = ndpsProduct.transactions;
      if (transactions.length === 0) continue;

      const product = productMap.get(ndpsProduct.productId);

      const openingTxn = await prisma.nDPSTransaction.findFirst({
        where: {
          ndpsProductId: ndpsProduct.id,
          transactionDate: { lt: fromDate }
        },
        orderBy: { transactionDate: 'desc' }
      });

      const openingBalance = openingTxn?.closingBalance || 0;

      let totalReceipts = 0;
      let totalIssues = 0;
      let patientWiseSales: any[] = [];

      for (const txn of transactions) {
        if (txn.transactionType === 'RECEIPT' || txn.transactionType === 'PURCHASE') {
          totalReceipts += Number(txn.quantity);
        } else if (txn.transactionType === 'SALE' || txn.transactionType === 'ISSUE') {
          totalIssues += Number(txn.quantity);

          // Track patient-wise sales for common men
          if (!txn.ndpsLicenseId && txn.patientName) {
            patientWiseSales.push({
              date: txn.transactionDate,
              patientName: txn.patientName,
              patientAadhaar: txn.patientAadhaar,
              patientAge: txn.patientAge,
              patientGender: txn.patientGender,
              doctorName: txn.doctorName,
              doctorRegNo: txn.doctorRegistrationNo,
              prescriptionNo: txn.prescriptionNo,
              prescriptionDate: txn.prescriptionDate,
              quantity: txn.quantity,
              invoiceNo: txn.invoiceNo
            });
          }
        }
      }

      const closingBalance = transactions.length > 0
        ? transactions[transactions.length - 1].closingBalance
        : openingBalance;

      // License-wise sales breakdown
      const licenseWiseSales: any = {};
      for (const txn of transactions) {
        if (txn.transactionType === 'SALE' && txn.ndpsLicenseId) {
          const license = await prisma.nDPSLicense.findUnique({
            where: { id: txn.ndpsLicenseId }
          });
          if (license) {
            if (!licenseWiseSales[license.licenseNo]) {
              licenseWiseSales[license.licenseNo] = {
                buyerName: license.buyerName,
                buyerType: license.buyerType,
                quantity: 0
              };
            }
            licenseWiseSales[license.licenseNo].quantity += Number(txn.quantity);
          }
        }
      }

      reportData.push({
        productId: ndpsProduct.productId,
        productName: product?.name || 'Unknown Product',
        manufacturer: product?.manufacturer?.name || 'Unknown',
        scheduleType: ndpsProduct.scheduleType,
        openingBalance,
        totalReceipts,
        totalIssues,
        closingBalance,
        transactions: transactions.length,
        licenseWiseSales,
        patientWiseSales
      });
    }

    const summary = {
      reportPeriod: {
        from: fromDate.toLocaleDateString('en-IN'),
        to: toDate.toLocaleDateString('en-IN')
      },
      reportType,
      totalProducts: reportData.length,
      totalReceipts: reportData.reduce((sum, p) => sum + p.totalReceipts, 0),
      totalIssues: reportData.reduce((sum, p) => sum + p.totalIssues, 0),
      scheduleWiseSummary: {
        H: reportData.filter(p => p.scheduleType === 'H').length,
        H1: reportData.filter(p => p.scheduleType === 'H1').length,
        X: reportData.filter(p => p.scheduleType === 'X').length
      },
      generatedAt: new Date().toISOString(),
      generatedBy: 'PharmaStream ERP'
    };

    res.json({
      summary,
      products: reportData,
      success: true
    });
  } catch (error) {
    console.error('Generate government report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};
