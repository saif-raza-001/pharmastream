import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// Helper to safely get string from query param
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

export const getProducts = async (req: Request, res: Response) => {
  try {
    const search = getString(req.query.search);
    const barcode = getString(req.query.barcode);
    const manufacturerId = getString(req.query.manufacturerId);
    const categoryId = getString(req.query.categoryId);
    const stockStatus = getString(req.query.stockStatus);
    const page = getNumber(req.query.page, 1);
    const limit = getNumber(req.query.limit, 50);
    
    const where: any = { isActive: true };
    
    if (barcode) {
      where.barcode = barcode;
    } else if (search) {
      const searchTerm = search.toLowerCase();
      where.OR = [
        { name: { contains: searchTerm } },
        { saltComposition: { contains: searchTerm } },
        { barcode: { contains: searchTerm } },
        { rackLocation: { contains: searchTerm } }
      ];
    }
    
    if (manufacturerId) where.manufacturerId = manufacturerId;
    if (categoryId) where.categoryId = categoryId;

    const products = await prisma.product.findMany({
      where,
      include: {
        manufacturer: true,
        category: true,
        batches: {
          where: { isActive: true },
          orderBy: { expiryDate: 'asc' }
        }
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit
    });

    const total = await prisma.product.count({ where });

    const productsWithStock = products.map(p => ({
      ...p,
      totalStock: p.batches.reduce((sum, b) => sum + b.currentStock, 0),
      avgRate: p.batches.length > 0 
        ? p.batches.reduce((sum, b) => sum + Number(b.saleRate), 0) / p.batches.length 
        : 0
    }));

    let filtered = productsWithStock;
    if (stockStatus === 'low') {
      filtered = productsWithStock.filter(p => p.totalStock > 0 && p.totalStock < (p.minStockAlert || 50));
    } else if (stockStatus === 'out') {
      filtered = productsWithStock.filter(p => p.totalStock === 0);
    } else if (stockStatus === 'expiring') {
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      filtered = productsWithStock.filter(p => 
        p.batches.some(b => new Date(b.expiryDate) <= thirtyDays && b.currentStock > 0)
      );
    }

    res.json({ products: filtered, total, page, limit });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

export const getProductByBarcode = async (req: Request, res: Response) => {
  try {
    const barcode = getParam(req.params.barcode);
    
    const product = await prisma.product.findFirst({
      where: { barcode: barcode, isActive: true },
      include: {
        manufacturer: true,
        category: true,
        batches: {
          where: { isActive: true, currentStock: { gt: 0 } },
          orderBy: { expiryDate: 'asc' }
        }
      }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        manufacturer: true,
        category: true,
        batches: {
          where: { isActive: true },
          orderBy: { expiryDate: 'asc' }
        }
      }
    });
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const { name, barcode, saltComposition, hsnCode, manufacturerId, categoryId, packingInfo, conversionFactor, rackLocation, gstRate, minStockAlert } = req.body;
    
    if (barcode) {
      const existing = await prisma.product.findFirst({ where: { barcode } });
      if (existing) {
        return res.status(400).json({ error: 'Barcode already exists' });
      }
    }
    
    const product = await prisma.product.create({
      data: {
        name,
        barcode: barcode || null,
        saltComposition,
        hsnCode,
        manufacturerId,
        categoryId: categoryId || null,
        packingInfo,
        conversionFactor: conversionFactor || 1,
        rackLocation,
        gstRate: gstRate || 12,
        minStockAlert
      },
      include: { manufacturer: true, category: true }
    });
    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const { name, barcode, saltComposition, hsnCode, manufacturerId, categoryId, packingInfo, conversionFactor, rackLocation, gstRate, minStockAlert, isActive } = req.body;
    
    if (barcode) {
      const existing = await prisma.product.findFirst({ 
        where: { barcode, NOT: { id } } 
      });
      if (existing) {
        return res.status(400).json({ error: 'Barcode already exists' });
      }
    }
    
    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        barcode: barcode || null,
        saltComposition,
        hsnCode,
        manufacturerId,
        categoryId: categoryId || null,
        packingInfo,
        conversionFactor,
        rackLocation,
        gstRate,
        minStockAlert,
        isActive
      },
      include: { manufacturer: true, category: true }
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    await prisma.product.update({
      where: { id },
      data: { isActive: false }
    });
    res.json({ message: 'Product deactivated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

export const addBatch = async (req: Request, res: Response) => {
  try {
    const { productId, batchNo, expiryDate, mrp, saleRate, purchaseRate, currentStock } = req.body;
    
    const existing = await prisma.productBatch.findFirst({
      where: { productId, batchNo }
    });
    
    if (existing) {
      const batch = await prisma.productBatch.update({
        where: { id: existing.id },
        data: {
          currentStock: { increment: currentStock || 0 },
          mrp,
          saleRate,
          purchaseRate
        }
      });
      return res.json(batch);
    }
    
    const batch = await prisma.productBatch.create({
      data: {
        productId,
        batchNo,
        expiryDate: new Date(expiryDate),
        mrp,
        saleRate,
        purchaseRate,
        currentStock: currentStock || 0
      }
    });
    res.status(201).json(batch);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add batch' });
  }
};

// ============ FIXED IMPORT WITH CATEGORY CREATION ============
export const importProducts = async (req: Request, res: Response) => {
  try {
    const { products } = req.body;
    
    let created = 0;
    let updated = 0;
    let errors: string[] = [];

    // Cache for manufacturers and categories to avoid repeated DB calls
    let manufacturerCache: any[] = await prisma.manufacturer.findMany();
    let categoryCache: any[] = await prisma.category.findMany();

    for (const p of products) {
      try {
        // Skip if no name or manufacturer
        if (!p.name || !p.manufacturer) {
          errors.push(`Skipped row: Missing name or manufacturer`);
          continue;
        }

        // ============ MANUFACTURER: Find or Create ============
        let manufacturer = manufacturerCache.find(
          m => m.name.toLowerCase() === p.manufacturer.toLowerCase().trim()
        );
        
        if (!manufacturer) {
          manufacturer = await prisma.manufacturer.create({
            data: { 
              name: p.manufacturer.trim(), 
              shortName: p.manufacturer.trim().substring(0, 10) 
            }
          });
          manufacturerCache.push(manufacturer);
          console.log(`Created manufacturer: ${manufacturer.name}`);
        }

        // ============ CATEGORY: Find or Create ============
        let categoryId = null;
        const categoryName = p.category?.trim();
        
        if (categoryName) {
          let category = categoryCache.find(
            c => c.name.toLowerCase() === categoryName.toLowerCase()
          );
          
          if (!category) {
            category = await prisma.category.create({
              data: { name: categoryName }
            });
            categoryCache.push(category);
            console.log(`Created category: ${category.name}`);
          }
          categoryId = category.id;
        }

        // ============ PRODUCT: Find or Create ============
        let existing = null;
        let wasInactive = false;
        
        // Try to find ACTIVE product by barcode first
        if (p.barcode) {
          existing = await prisma.product.findFirst({
            where: { barcode: p.barcode, isActive: true }
          });
        }
        
        // If not found by barcode, try by name + manufacturer (ACTIVE only)
        if (!existing) {
          const allProducts = await prisma.product.findMany({
            where: { manufacturerId: manufacturer.id, isActive: true }
          });
          existing = allProducts.find(
            prod => prod.name.toLowerCase() === p.name.toLowerCase().trim()
          );
        }

        // If still not found, check if there's an INACTIVE product we can reactivate
        if (!existing) {
          let inactiveProduct = null;
          
          if (p.barcode) {
            inactiveProduct = await prisma.product.findFirst({
              where: { barcode: p.barcode, isActive: false }
            });
          }
          
          if (!inactiveProduct) {
            const inactiveProducts = await prisma.product.findMany({
              where: { manufacturerId: manufacturer.id, isActive: false }
            });
            inactiveProduct = inactiveProducts.find(
              prod => prod.name.toLowerCase() === p.name.toLowerCase().trim()
            );
          }
          
          if (inactiveProduct) {
            // Reactivate the product
            existing = inactiveProduct;
            wasInactive = true;
          }
        }

        if (existing) {
          // Update existing product (or reactivate if was inactive)
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              isActive: true,  // Reactivate if was deleted
              barcode: p.barcode || existing.barcode,
              saltComposition: p.salt || p.saltComposition || existing.saltComposition,
              packingInfo: p.packing || p.packingInfo || existing.packingInfo,
              hsnCode: p.hsn || p.hsnCode || existing.hsnCode,
              rackLocation: p.rack || p.rackLocation || existing.rackLocation,
              gstRate: p.gst || p.gstRate || existing.gstRate,
              categoryId: categoryId || existing.categoryId
            }
          });
          
          if (wasInactive) {
            created++;  // Count as created since it was reactivated
            console.log(`Reactivated product: ${existing.name}`);
          } else {
            updated++;
          }
          
          // Add batch if stock info provided
          if ((p.quantity || p.qty) && p.batchNo) {
            const batchQty = Number(p.quantity) || Number(p.qty) || 0;
            if (batchQty > 0) {
              // Check if batch exists
              const existingBatch = await prisma.productBatch.findFirst({
                where: { productId: existing.id, batchNo: p.batchNo }
              });
              
              if (existingBatch) {
                await prisma.productBatch.update({
                  where: { id: existingBatch.id },
                  data: { currentStock: { increment: batchQty } }
                });
              } else {
                await prisma.productBatch.create({
                  data: {
                    productId: existing.id,
                    batchNo: p.batchNo || 'OPENING',
                    expiryDate: parseExpiryDate(p.expiry),
                    mrp: Number(p.mrp) || 0,
                    saleRate: Number(p.saleRate) || Number(p.sRate) || 0,
                    purchaseRate: Number(p.purchaseRate) || Number(p.pRate) || 0,
                    currentStock: batchQty
                  }
                });
              }
            }
          }
        } else {
          // Create new product
          const newProduct = await prisma.product.create({
            data: {
              name: p.name.trim(),
              barcode: p.barcode || null,
              saltComposition: p.salt || p.saltComposition || null,
              hsnCode: p.hsn || p.hsnCode || '3004',
              manufacturerId: manufacturer.id,
              categoryId: categoryId,
              packingInfo: p.packing || p.packingInfo || null,
              rackLocation: p.rack || p.rackLocation || null,
              gstRate: Number(p.gst) || Number(p.gstRate) || 12,
              minStockAlert: Number(p.minStock) || 50
            }
          });
          created++;
          
          // Add batch if stock info provided
          const batchQty = Number(p.quantity) || Number(p.qty) || 0;
          if (batchQty > 0 || p.batchNo) {
            await prisma.productBatch.create({
              data: {
                productId: newProduct.id,
                batchNo: p.batchNo || 'OPENING',
                expiryDate: parseExpiryDate(p.expiry),
                mrp: Number(p.mrp) || 0,
                saleRate: Number(p.saleRate) || Number(p.sRate) || 0,
                purchaseRate: Number(p.purchaseRate) || Number(p.pRate) || 0,
                currentStock: batchQty
              }
            });
          }
        }
      } catch (err: any) {
        errors.push(`Error with "${p.name}": ${err.message}`);
        console.error(`Import error for ${p.name}:`, err);
      }
    }

    res.json({ 
      created, 
      updated, 
      errors: errors.slice(0, 10), // Return first 10 errors only
      total: products.length,
      success: true
    });
  } catch (error) {
    console.error('Import failed:', error);
    res.status(500).json({ error: 'Import failed' });
  }
};

// Helper to parse various expiry date formats
function parseExpiryDate(expiry: string | number): Date {
  // Default: 2 years from now
  const getDefault = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    return d;
  };

  if (!expiry && expiry !== 0) return getDefault();
  
  // Convert to string and clean
  let cleaned = String(expiry).trim();
  
  // Remove any quotes
  cleaned = cleaned.replace(/['"]/g, '');
  
  if (!cleaned) return getDefault();

  // Excel serial date number (e.g., 45678)
  if (/^\d{5}$/.test(cleaned)) {
    const excelDate = parseInt(cleaned);
    // Excel dates start from 1900-01-01
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) return date;
  }

  // Format: MMYY (4 digits without separator) e.g., 1227 = Dec 2027
  if (/^\d{4}$/.test(cleaned)) {
    const month = parseInt(cleaned.substring(0, 2));
    const year = parseInt(cleaned.substring(2, 4));
    if (month >= 1 && month <= 12) {
      const fullYear = 2000 + year;
      return new Date(fullYear, month, 0); // Last day of month
    }
  }

  // Format: MYY (3 digits) e.g., 625 = Jun 2025
  if (/^\d{3}$/.test(cleaned)) {
    const month = parseInt(cleaned.substring(0, 1));
    const year = parseInt(cleaned.substring(1, 3));
    if (month >= 1 && month <= 9) {
      const fullYear = 2000 + year;
      return new Date(fullYear, month, 0);
    }
  }

  // Format: MMYYYY (6 digits) e.g., 122027 = Dec 2027
  if (/^\d{6}$/.test(cleaned)) {
    const month = parseInt(cleaned.substring(0, 2));
    const year = parseInt(cleaned.substring(2, 6));
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return new Date(year, month, 0);
    }
  }

  // Format: MM/YY or MM-YY or MM.YY
  if (/^\d{1,2}[\/\-\.]\d{2}$/.test(cleaned)) {
    const [month, year] = cleaned.split(/[\/\-\.]/);
    const fullYear = 2000 + parseInt(year);
    return new Date(fullYear, parseInt(month), 0);
  }
  
  // Format: MM/YYYY or MM-YYYY or MM.YYYY
  if (/^\d{1,2}[\/\-\.]\d{4}$/.test(cleaned)) {
    const [month, year] = cleaned.split(/[\/\-\.]/);
    return new Date(parseInt(year), parseInt(month), 0);
  }

  // Format: YYYY-MM-DD (ISO format)
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // Format: DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(cleaned)) {
    const parts = cleaned.split(/[\/\-]/);
    const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    if (!isNaN(date.getTime())) return date;
  }

  // Month names: Dec-27, Dec 27, December 2027
  const monthNames: { [key: string]: number } = {
    'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
    'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6,
    'jul': 7, 'july': 7, 'aug': 8, 'august': 8, 'sep': 9, 'sept': 9, 'september': 9,
    'oct': 10, 'october': 10, 'nov': 11, 'november': 11, 'dec': 12, 'december': 12
  };
  
  const monthMatch = cleaned.toLowerCase().match(/^([a-z]+)[\/\-\s]*(\d{2,4})$/);
  if (monthMatch) {
    const monthNum = monthNames[monthMatch[1]];
    let year = parseInt(monthMatch[2]);
    if (monthNum && year) {
      if (year < 100) year = 2000 + year;
      return new Date(year, monthNum, 0);
    }
  }

  // Try native Date parsing as last resort
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) return parsed;
  
  // Default fallback
  return getDefault();
}

// Update existing batch
export const updateBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { batchNo, expiryDate, mrp, saleRate, purchaseRate, currentStock } = req.body;
    
    const batch = await prisma.productBatch.update({
      where: { id },
      data: {
        batchNo,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        mrp,
        saleRate,
        purchaseRate,
        currentStock
      }
    });
    
    res.json(batch);
  } catch (error) {
    console.error('Update batch error:', error);
    res.status(500).json({ error: 'Failed to update batch' });
  }
};

// Delete batch
export const deleteBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if batch has been used in invoices
    const usedInInvoice = await prisma.invoiceItem.findFirst({
      where: { batchId: id }
    });
    
    if (usedInInvoice) {
      // Soft delete - just deactivate
      await prisma.productBatch.update({
        where: { id },
        data: { isActive: false }
      });
      return res.json({ message: 'Batch deactivated (has sales history)' });
    }
    
    // Hard delete if never used
    await prisma.productBatch.delete({
      where: { id }
    });
    
    res.json({ message: 'Batch deleted' });
  } catch (error) {
    console.error('Delete batch error:', error);
    res.status(500).json({ error: 'Failed to delete batch' });
  }
};
