import { Router } from 'express';
import {
  getSalesReport,
  getPurchaseReport,
  getStockReport,
  getGstReport,
  getDashboard
} from '../controllers/reportController';

const router = Router();

// Dashboard
router.get('/dashboard', getDashboard);

// Reports
router.get('/sales', getSalesReport);
router.get('/purchases', getPurchaseReport);
router.get('/stock', getStockReport);
router.get('/gst', getGstReport);

export default router;
