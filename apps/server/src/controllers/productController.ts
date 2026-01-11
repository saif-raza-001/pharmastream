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

export const importProducts = async (req: Request, res: Response) => {
  try {
    const { products } = req.body;
    
    let created = 0;
    let updated = 0;
    let errors: string[] = [];

    for (const p of products) {
      try {
        const allManufacturers = await prisma.manufacturer.findMany();
        let manufacturer = allManufacturers.find(
          m => m.name.toLowerCase() === p.manufacturer.toLowerCase()
        );
        
        if (!manufacturer) {
          manufacturer = await prisma.manufacturer.create({
            data: { name: p.manufacturer, shortName: p.manufacturer.substring(0, 10) }
          });
        }

        let existing = null;
        if (p.barcode) {
          existing = await prisma.product.findFirst({
            where: { barcode: p.barcode }
          });
        }
        if (!existing) {
          const allProducts = await prisma.product.findMany({
            where: { manufacturerId: manufacturer.id }
          });
          existing = allProducts.find(
            prod => prod.name.toLowerCase() === p.name.toLowerCase()
          );
        }

        if (existing) {
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
