import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const getProducts = async (req: Request, res: Response) => {
  try {
    const { search, barcode, manufacturerId, categoryId, stockStatus, page = 1, limit = 50 } = req.query;
    
    const where: any = { isActive: true };
    
    // Barcode exact search (for scanner)
    if (barcode) {
      where.barcode = String(barcode);
    } else if (search) {
      // SQLite: use LIKE for case-insensitive search (SQLite LIKE is case-insensitive by default for ASCII)
      const searchTerm = String(search).toLowerCase();
      where.OR = [
        { name: { contains: searchTerm } },
        { saltComposition: { contains: searchTerm } },
        { barcode: { contains: searchTerm } },
        { rackLocation: { contains: searchTerm } }
      ];
    }
    
    if (manufacturerId) where.manufacturerId = String(manufacturerId);
    if (categoryId) where.categoryId = String(categoryId);

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
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
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

    res.json({ products: filtered, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

// Search by barcode (exact match for scanner)
export const getProductByBarcode = async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params;
    
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
    const { id } = req.params;
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
    
    // Check barcode uniqueness
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
    const { id } = req.params;
    const { name, barcode, saltComposition, hsnCode, manufacturerId, categoryId, packingInfo, conversionFactor, rackLocation, gstRate, minStockAlert, isActive } = req.body;
    
    // Check barcode uniqueness (exclude current product)
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
    const { id } = req.params;
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
    
    // Check if batch already exists
    const existing = await prisma.productBatch.findFirst({
      where: { productId, batchNo }
    });
    
    if (existing) {
      // Update existing batch stock
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

export const importProducts = async (req: Request, res: Response) => {
  try {
    const { products } = req.body;
    
    let created = 0;
    let updated = 0;
    let errors: string[] = [];

    for (const p of products) {
      try {
        // Find manufacturer (case-insensitive using lowercase comparison)
        const allManufacturers = await prisma.manufacturer.findMany();
        let manufacturer = allManufacturers.find(
          m => m.name.toLowerCase() === p.manufacturer.toLowerCase()
        );
        
        if (!manufacturer) {
          manufacturer = await prisma.manufacturer.create({
            data: { name: p.manufacturer, shortName: p.manufacturer.substring(0, 10) }
          });
        }

        // Check by barcode first, then by name
        let existing = null;
        if (p.barcode) {
          existing = await prisma.product.findFirst({
            where: { barcode: p.barcode }
          });
        }
        if (!existing) {
          // Find by name (case-insensitive)
          const allProducts = await prisma.product.findMany({
            where: { manufacturerId: manufacturer.id }
          });
          existing = allProducts.find(
            prod => prod.name.toLowerCase() === p.name.toLowerCase()
          );
        }

        if (existing) {
          // Update existing product
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              barcode: p.barcode || existing.barcode,
              saltComposition: p.salt || p.saltComposition || existing.saltComposition,
              packingInfo: p.packing || p.packingInfo || existing.packingInfo,
              hsnCode: p.hsn || p.hsnCode || existing.hsnCode,
              rackLocation: p.rack || p.rackLocation || existing.rackLocation,
              gstRate: p.gst || p.gstRate || existing.gstRate
            }
          });
          updated++;
          
          // Add stock if provided
          if (p.quantity && p.batchNo) {
            await prisma.productBatch.create({
              data: {
                productId: existing.id,
                batchNo: p.batchNo || 'OPENING',
                expiryDate: p.expiry ? new Date(p.expiry) : new Date('2025-12-31'),
                mrp: Number(p.mrp) || 0,
                saleRate: Number(p.saleRate) || Number(p.rate) || 0,
                purchaseRate: Number(p.purchaseRate) || Number(p.pRate) || 0,
                currentStock: Number(p.quantity) || Number(p.qty) || 0
              }
            });
          }
        } else {
          // Create new product
          const newProduct = await prisma.product.create({
            data: {
              name: p.name,
              barcode: p.barcode || null,
              saltComposition: p.salt || p.saltComposition,
              hsnCode: p.hsn || p.hsnCode || '3004',
              manufacturerId: manufacturer.id,
              packingInfo: p.packing || p.packingInfo,
              rackLocation: p.rack || p.rackLocation,
              gstRate: p.gst || p.gstRate || 12,
              minStockAlert: p.minStock || 50
            }
          });
          created++;
          
          // Add opening stock if provided
          if (p.quantity || p.qty) {
            await prisma.productBatch.create({
              data: {
                productId: newProduct.id,
                batchNo: p.batchNo || 'OPENING',
                expiryDate: p.expiry ? new Date(p.expiry) : new Date('2025-12-31'),
                mrp: Number(p.mrp) || 0,
                saleRate: Number(p.saleRate) || Number(p.rate) || 0,
                purchaseRate: Number(p.purchaseRate) || Number(p.pRate) || 0,
                currentStock: Number(p.quantity) || Number(p.qty) || 0
              }
            });
          }
        }
      } catch (err) {
        errors.push(`Error with ${p.name}: ${err}`);
      }
    }

    res.json({ created, updated, errors, total: products.length });
  } catch (error) {
    res.status(500).json({ error: 'Import failed' });
  }
};
