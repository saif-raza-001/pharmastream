import { Router } from 'express';
import { createReceipt, createPayment, getRecent } from '../controllers/paymentController';

const router = Router();

router.get('/', getRecent);
router.post('/receipt', createReceipt);
router.post('/payment', createPayment);

export default router;
