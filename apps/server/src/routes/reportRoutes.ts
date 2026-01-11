import { Router } from 'express';
import {
  getSalesReport,
  getPurchaseReport,
  getStockReport,
  getGSTReport,
  getDashboardSummary
} from '../controllers/reportController';

const router = Router();

// Dashboard
router.get('/dashboard', getDashboardSummary);

// Reports
router.get('/sales', getSalesReport);
router.get('/purchases', getPurchaseReport);
router.get('/stock', getStockReport);
router.get('/gst', getGSTReport);

export default router;
