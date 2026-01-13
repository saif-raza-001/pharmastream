import { Request, Response } from 'express';
import prisma from '../utils/prisma';

const getParam = (value: string | string[] | undefined): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] || '';
  return '';
};

export const getManufacturers = async (req: Request, res: Response) => {
  try {
    const manufacturers = await prisma.manufacturer.findMany({
      include: {
        _count: { 
          select: { 
            products: {
              where: { isActive: true }
            } 
          } 
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(manufacturers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch manufacturers' });
  }
};

export const createManufacturer = async (req: Request, res: Response) => {
  try {
    const { name, shortName, address, gstin } = req.body;
    const manufacturer = await prisma.manufacturer.create({
      data: { name, shortName, address, gstin }
    });
    res.status(201).json(manufacturer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create manufacturer' });
  }
};

export const updateManufacturer = async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const { name, shortName, address, gstin } = req.body;
    const manufacturer = await prisma.manufacturer.update({
      where: { id },
      data: { name, shortName, address, gstin }
    });
    res.json(manufacturer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update manufacturer' });
  }
};

export const deleteManufacturer = async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    
    // Check for ACTIVE products - block deletion
    const activeProductsCount = await prisma.product.count({ 
      where: { 
        manufacturerId: id,
        isActive: true
      } 
    });
    
    if (activeProductsCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete. ${activeProductsCount} active products linked. Deactivate them first.` 
      });
    }
    
    // Get all inactive products for this manufacturer
    const inactiveProducts = await prisma.product.findMany({
      where: { manufacturerId: id, isActive: false },
      select: { id: true }
    });
    
    if (inactiveProducts.length > 0) {
      // Check if any of these products have been used in invoices or purchases
      for (const product of inactiveProducts) {
        const usedInInvoice = await prisma.invoiceItem.findFirst({
          where: { productId: product.id }
        });
        
        const usedInPurchase = await prisma.purchaseItem.findFirst({
          where: { productId: product.id }
        });
        
        if (usedInInvoice || usedInPurchase) {
          return res.status(400).json({
            error: `Cannot delete. Some products have sales/purchase history. This manufacturer is archived.`
          });
        }
      }
      
      // Safe to delete - no sales/purchase history
      // Delete batches first
      for (const product of inactiveProducts) {
        await prisma.productBatch.deleteMany({
          where: { productId: product.id }
        });
      }
      
      // Delete inactive products
      await prisma.product.deleteMany({
        where: { manufacturerId: id, isActive: false }
      });
    }
    
    // Now delete the manufacturer
    await prisma.manufacturer.delete({ where: { id } });
    res.json({ message: 'Manufacturer deleted successfully' });
    
  } catch (error: any) {
    console.error('Delete manufacturer error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to delete manufacturer' 
    });
  }
};
