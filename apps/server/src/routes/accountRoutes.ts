import { Router } from 'express';
import { 
  getAccounts, 
  getAccountById, 
  createAccount, 
  updateAccount,
  deleteAccount,
  getAccountLedger,
  getAccountStats,
  getAccountStatement
} from '../controllers/accountController';

const router = Router();

router.get('/', getAccounts);
router.get('/stats', getAccountStats);
router.get('/:id', getAccountById);
router.get('/:id/ledger', getAccountLedger);
router.get('/:id/statement', getAccountStatement);
router.post('/', createAccount);
router.put('/:id', updateAccount);
router.delete('/:id', deleteAccount);

export default router;
