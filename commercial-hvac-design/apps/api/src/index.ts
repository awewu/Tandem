import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { projectRoutes } from './routes/projects.js';
import { calculationRoutes } from './routes/calculations.js';
import { equipmentRoutes } from './routes/equipment.js';
import { quotationRoutes } from './routes/quotations.js';
import { drawingRoutes } from './routes/drawings.js';
import { registrationRoutes } from './routes/registrations.js';
import { orderRoutes } from './routes/orders.js';

const app = express();
const PORT = process.env.PORT || 3002;

// 中间件
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'hengre-hvac-api',
    version: '1.0.0-mvp',
    features: ['calculation', 'quotation', 'drawing', 'equipment', 'registration', 'order'],
  });
});

// API路由
app.use('/api/projects', projectRoutes);
app.use('/api/calculations', calculationRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/drawings', drawingRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/orders', orderRoutes);

// 404处理
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// 错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📝 API Docs:`);
  console.log(`   - POST /api/calculations/hot-water`);
  console.log(`   - GET  /api/equipment/heat-pumps`);
  console.log(`   - CRUD /api/projects`);
});
