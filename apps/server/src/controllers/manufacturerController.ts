import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const getManufacturers = async (req: Request, res: Response) => {
  try {
    const manufacturers = await prisma.manufacturer.findMany({
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
