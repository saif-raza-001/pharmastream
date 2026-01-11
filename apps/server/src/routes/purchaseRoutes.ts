import { Router } from 'express';
import { createPurchase, getPurchases, getPurchaseById } from '../controllers/purchaseController';

const router = Router();

router.post('/', createPurchase);
router.get('/', getPurchases);
router.get('/:id', getPurchaseById);

export default router;
