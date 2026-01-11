import { Router } from 'express';
import { 
  createInvoice, 
  getInvoices, 
  getInvoiceById, 
  getRecentInvoices,
  receivePayment,
  deleteInvoice
} from '../controllers/invoiceController';

const router = Router();

router.post('/', createInvoice);
router.get('/', getInvoices);
router.get('/recent', getRecentInvoices);
router.get('/:id', getInvoiceById);
router.post('/:id/payment', receivePayment);
router.delete('/:id', deleteInvoice);

export default router;
