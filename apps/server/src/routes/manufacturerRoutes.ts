import { Router } from 'express';
import { getManufacturers, createManufacturer } from '../controllers/manufacturerController';

const router = Router();

router.get('/', getManufacturers);
router.post('/', createManufacturer);

export default router;
