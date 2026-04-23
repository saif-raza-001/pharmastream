import { Router } from 'express';
import {
  getNDPSProducts,
  markProductAsNDPS,
  unmarkNDPS,
  getLicenses,
  createLicense,
  updateLicense,
  deleteLicense,
  getTransactions,
  createTransaction,
  getNDPSRegister,
  getStockSummary,
  generateGovernmentReport
} from '../controllers/ndpsController';

const router = Router();

// NDPS Products
router.get('/products', getNDPSProducts);
router.post('/products/mark', markProductAsNDPS);
router.delete('/products/:id', unmarkNDPS);

// Licenses
router.get('/licenses', getLicenses);
router.post('/licenses', createLicense);
router.put('/licenses/:id', updateLicense);
router.delete('/licenses/:id', deleteLicense);

// Transactions
router.get('/transactions', getTransactions);
router.post('/transactions', createTransaction);

// Reports
router.get('/register', getNDPSRegister);
router.get('/stock-summary', getStockSummary);
router.get('/government-report', generateGovernmentReport);

export default router;
