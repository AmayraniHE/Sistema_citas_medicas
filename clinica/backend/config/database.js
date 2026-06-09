// Modulo de conexion a MySQL usando mysql2 con pool de conexiones.
// El pool reutiliza conexiones abiertas en lugar de abrir una nueva por cada consulta.
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  port:               process.env.DB_PORT,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           'local'
});

// Verifica al arrancar que la base de datos es alcanzable
pool.getConnection()
  .then(conn => {
    console.log('Conexion a MySQL establecida correctamente');
    conn.release();
  })
  .catch(err => {
    console.error('Error al conectar con MySQL:', err.message);
    process.exit(1);
  });

module.exports = pool;
