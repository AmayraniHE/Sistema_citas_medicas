// Rutas de autenticacion: registro e inicio de sesion.
// Devuelve un JWT firmado que el cliente guarda y envía en cada peticion protegida.
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../config/database');
const router   = express.Router();

// POST /api/auth/registro - crea un nuevo usuario con rol paciente
router.post('/registro', async (req, res) => {
  const { nombre, apellido, email, password, telefono } = req.body;

  if (!nombre || !apellido || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos obligatorios son requeridos' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    // Verifica que el correo no este registrado
    const [existing] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'El correo ya esta registrado' });
    }

    // Genera hash de la contraseña con salt de costo 10
    const hash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO usuarios (nombre, apellido, email, password_hash, telefono, rol_id)
       VALUES (?, ?, ?, ?, ?, 2)`,
      [nombre.trim(), apellido.trim(), email.toLowerCase().trim(), hash, telefono || null]
    );

    res.status(201).json({ mensaje: 'Usuario registrado exitosamente', id: result.insertId });
  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/auth/login - autentica credenciales y devuelve JWT
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    const [rows] = await db.query(
      `SELECT u.id, u.nombre, u.apellido, u.email, u.password_hash, u.activo, u.rol_id, r.nombre as rol
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.email = ?`,
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const usuario = rows[0];

    if (!usuario.activo) {
      return res.status(403).json({ error: 'Cuenta desactivada. Contacte al administrador' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Genera token con datos basicos del usuario
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol_id: usuario.rol_id, nombre: usuario.nombre },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      usuario: {
        id:       usuario.id,
        nombre:   usuario.nombre,
        apellido: usuario.apellido,
        email:    usuario.email,
        rol:      usuario.rol,
        rol_id:   usuario.rol_id
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;