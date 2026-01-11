import { Router } from 'express';
import { createInvoice, getInvoices, getInvoiceById, getRecentInvoices } from '../controllers/invoiceController';

const router = Router();

router.post('/', createInvoice);
router.get('/', getInvoices);
router.get('/recent', getRecentInvoices);
router.get('/:id', getInvoiceById);

export default router;
