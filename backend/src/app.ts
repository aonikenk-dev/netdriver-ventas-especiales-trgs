import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import excelRouter from './routes/excel.js';
import tramitesRouter from './routes/tramites.js';
import documentosRouter from './routes/documentos.js';
import remitosRouter from './routes/remitos.js';
import configuracionRouter from './routes/configuracion.js';
import uploadRouter from './routes/upload.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.use('/files', express.static(path.resolve(process.cwd(), 'generated')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', mock: true, service: 'netdriver-ve-trgs-backend' });
});

app.use('/api/excel', excelRouter);
app.use('/api/tramites', tramitesRouter);
app.use('/api/documentos', documentosRouter);
app.use('/api/remitos', remitosRouter);
app.use('/api/configuracion', configuracionRouter);
app.use('/api/upload', uploadRouter);

app.listen(PORT, () => {
  console.log(`Backend (mock) escuchando en http://localhost:${PORT}`);
});
