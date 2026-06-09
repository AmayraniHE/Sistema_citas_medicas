// Punto de entrada del servidor Express.
// Configura middlewares globales, monta las rutas y arranca el servidor.
const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app = express();

// Permite peticiones desde el frontend
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parsea el cuerpo de las peticiones como JSON
app.use(express.json());

// Sirve los archivos estaticos del frontend desde la carpeta ../frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Rutas de la API
app.use('/api/auth',  require('./routes/auth'));
app.use('/api/citas', require('./routes/citas'));

// Ruta de estado del servidor (health check)
app.get('/api/health', (req, res) => {
  res.json({ estado: 'ok', servidor: 'Clinica Los Reyes API', version: '1.0.0' });
});

// Para cualquier ruta no conocida de la API devuelve 404
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Todas las demas rutas sirven el index del frontend (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Clinica Los Reyes escuchando en puerto ${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
});