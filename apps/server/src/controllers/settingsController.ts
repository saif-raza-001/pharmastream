import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const getSettings = async (req: Request, res: Response) => {
  try {
    let settings = await prisma.systemSettings.findFirst();
    
    if (!settings) {
      // Create default settings if not exists
      settings = await prisma.systemSettings.create({
        data: {
          companyName: 'Your Pharmacy Name',
          address: '',
          city: '',
          state: '',
          pincode: '',
          phone: '',
          email: '',
          gstin: '',
          dlNumber20b: '',
          dlNumber21b: '',
          invoicePrefix: 'INV',
          thermalPrintWidth: 80
        }
      });
    }
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const settings = await prisma.systemSettings.findFirst();
    
    if (settings) {
      const updated = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: req.body
      });
      res.json(updated);
    } else {
      const created = await prisma.systemSettings.create({
        data: req.body
      });
      res.json(created);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
};
