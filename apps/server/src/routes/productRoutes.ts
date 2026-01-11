import { Router } from 'express';
import { getProducts, getProductById, getProductByBarcode, createProduct, updateProduct, deleteProduct, addBatch, importProducts } from '../controllers/productController';

const router = Router();

router.get('/', getProducts);
router.get('/barcode/:barcode', getProductByBarcode);
router.get('/:id', getProductById);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.post('/batch', addBatch);
router.post('/import', importProducts);

export default router;
