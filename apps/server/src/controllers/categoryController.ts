import { Request, Response } from 'express';
import prisma from '../utils/prisma';

const getParam = (value: string | string[] | undefined): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] || '';
  return '';
};

export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
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
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const category = await prisma.category.create({
      data: { name, description }
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category' });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const { name, description } = req.body;
    const category = await prisma.category.update({
      where: { id },
      data: { name, description }
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    
    // Check for ACTIVE products - block deletion
    const activeProductsCount = await prisma.product.count({ 
      where: { 
        categoryId: id,
        isActive: true
      } 
    });
    
    if (activeProductsCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete. ${activeProductsCount} active products linked. Deactivate them first.` 
      });
    }
    
    // Get all inactive products for this category
    const inactiveProducts = await prisma.product.findMany({
      where: { categoryId: id, isActive: false },
      select: { id: true }
    });
    
    if (inactiveProducts.length > 0) {
      // Check if any have sales/purchase history
      for (const product of inactiveProducts) {
        const usedInInvoice = await prisma.invoiceItem.findFirst({
          where: { productId: product.id }
        });
        
        const usedInPurchase = await prisma.purchaseItem.findFirst({
          where: { productId: product.id }
        });
        
        if (usedInInvoice || usedInPurchase) {
          return res.status(400).json({
            error: `Cannot delete. Some products have sales/purchase history. This category is archived.`
          });
        }
      }
      
      // Safe to delete - remove category reference from inactive products
      await prisma.product.updateMany({
        where: { categoryId: id, isActive: false },
        data: { categoryId: null }
      });
    }
    
    // Now delete the category
    await prisma.category.delete({ where: { id } });
    res.json({ message: 'Category deleted successfully' });
    
  } catch (error: any) {
    console.error('Delete category error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to delete category' 
    });
  }
};
