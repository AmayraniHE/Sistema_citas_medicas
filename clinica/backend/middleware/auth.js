// Middleware que valida el token JWT enviado en el encabezado Authorization.
// Si el token es valido, adjunta los datos del usuario a req.user y continua.
// Si no, devuelve 401 o 403 segun el caso.
const jwt = require('jsonwebtoken');
 
function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // formato: "Bearer <token>"
 
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }
 
  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalido o expirado' });
    }
    req.user = payload; // { id, email, rol_id, nombre }
    next();
  });
}
 
// Middleware adicional que restringe rutas solo al rol admin (rol_id = 1)
function soloAdmin(req, res, next) {
  if (!req.user || req.user.rol_id !== 1) {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}
 
module.exports = { verificarToken, soloAdmin };
 