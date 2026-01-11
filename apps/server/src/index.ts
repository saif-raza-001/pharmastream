import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import productRoutes from './routes/productRoutes';
import manufacturerRoutes from './routes/manufacturerRoutes';
import accountRoutes from './routes/accountRoutes';
import invoiceRoutes from './routes/invoiceRoutes';
import purchaseRoutes from './routes/purchaseRoutes';
import categoryRoutes from './routes/categoryRoutes';
import settingsRoutes from './routes/settingsRoutes';
import paymentRoutes from './routes/paymentRoutes';
import reportRoutes from './routes/reportRoutes';

dotenv.config();

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/manufacturers', manufacturerRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);

// Serve static web files in production (for Electron)
const webPath = process.env.WEB_PATH;
if (webPath) {
  console.log('Serving static files from:', webPath);
  app.use(express.static(webPath));
  
  // Handle client-side routing - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(webPath, 'index.html'));
    }
  });
}

// Export for Electron integration
export function startServer(port: number = 3001): Promise<void> {
  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
      resolve();
    });
  });
}

// Run directly if not imported (standalone mode)
const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
