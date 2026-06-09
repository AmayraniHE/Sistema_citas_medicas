// Rutas para la gestion de citas medicas.
// Incluye logica de disponibilidad y prevencion de conflictos de horario.
const express             = require('express');
const db                  = require('../config/database');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const router              = express.Router();

// GET /api/citas/disponibilidad?doctor_id=X&fecha=YYYY-MM-DD
// Devuelve los bloques horarios del doctor en esa fecha que aun no estan reservados
router.get('/disponibilidad', verificarToken, async (req, res) => {
  const { doctor_id, fecha } = req.query;

  if (!doctor_id || !fecha) {
    return res.status(400).json({ error: 'doctor_id y fecha son requeridos' });
  }

  // Valida formato de fecha
  const fechaObj = new Date(fecha + 'T00:00:00');
  if (isNaN(fechaObj.getTime())) {
    return res.status(400).json({ error: 'Formato de fecha invalido. Use YYYY-MM-DD' });
  }

  // No permite reservas en fechas pasadas
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  if (fechaObj < hoy) {
    return res.status(400).json({ error: 'No se pueden consultar fechas pasadas' });
  }

  const diaSemana = fechaObj.getDay(); // 0=domingo ... 6=sabado

  try {
    // Obtiene todos los horarios del doctor para ese dia de la semana
    // y excluye los que ya tienen una cita activa (no cancelada) en la fecha dada
    const [slots] = await db.query(
      `SELECT h.id, h.hora_inicio, h.hora_fin,
              CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END AS ocupado
       FROM horarios h
       LEFT JOIN citas c
         ON c.horario_id = h.id
        AND c.doctor_id  = h.doctor_id
        AND c.fecha       = ?
        AND c.estado NOT IN ('cancelada')
       WHERE h.doctor_id  = ?
         AND h.dia_semana = ?
         AND h.activo     = 1
       ORDER BY h.hora_inicio`,
      [fecha, doctor_id, diaSemana]
    );

    res.json({ fecha, doctor_id: parseInt(doctor_id), slots });
  } catch (err) {
    console.error('Error en disponibilidad:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/citas/doctores - lista de doctores activos para el selector del calendario
router.get('/doctores', verificarToken, async (req, res) => {
  try {
    const [doctores] = await db.query(
      `SELECT d.id, d.nombre, d.apellido, e.nombre AS especialidad
       FROM doctores d
       JOIN especialidades e ON e.id = d.especialidad_id
       WHERE d.activo = 1
       ORDER BY e.nombre, d.apellido`
    );
    res.json(doctores);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/citas/mis-citas - historial de citas del usuario autenticado
router.get('/mis-citas', verificarToken, async (req, res) => {
  try {
    const [citas] = await db.query(
      `SELECT c.id, c.fecha, c.estado, c.motivo, c.fecha_creacion,
              h.hora_inicio, h.hora_fin,
              d.nombre AS doctor_nombre, d.apellido AS doctor_apellido,
              e.nombre AS especialidad
       FROM citas c
       JOIN horarios     h ON h.id = c.horario_id
       JOIN doctores     d ON d.id = c.doctor_id
       JOIN especialidades e ON e.id = d.especialidad_id
       WHERE c.usuario_id = ?
       ORDER BY c.fecha DESC, h.hora_inicio DESC`,
      [req.user.id]
    );
    res.json(citas);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/citas - crea una nueva cita
// El UNIQUE KEY en la tabla impide doble reservacion; se captura el error 1062 de MySQL
router.post('/', verificarToken, async (req, res) => {
  const { doctor_id, horario_id, fecha, motivo } = req.body;

  if (!doctor_id || !horario_id || !fecha) {
    return res.status(400).json({ error: 'doctor_id, horario_id y fecha son requeridos' });
  }

  const fechaObj = new Date(fecha + 'T00:00:00');
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  if (fechaObj < hoy) {
    return res.status(400).json({ error: 'No se pueden agendar citas en fechas pasadas' });
  }

  const diaSemana = fechaObj.getDay();

  try {
    // Verifica que el horario pertenece al doctor y corresponde al dia de la semana
    const [horario] = await db.query(
      `SELECT id FROM horarios
       WHERE id = ? AND doctor_id = ? AND dia_semana = ? AND activo = 1`,
      [horario_id, doctor_id, diaSemana]
    );

    if (horario.length === 0) {
      return res.status(400).json({ error: 'El horario no es valido para ese doctor y fecha' });
    }

    // Verifica que el usuario no tenga ya una cita activa ese mismo dia
    const [citaExistente] = await db.query(
      `SELECT id FROM citas
       WHERE usuario_id = ? AND fecha = ? AND estado NOT IN ('cancelada')`,
      [req.user.id, fecha]
    );

    if (citaExistente.length > 0) {
      return res.status(409).json({ error: 'Ya tienes una cita activa para esa fecha' });
    }

    const [result] = await db.query(
      `INSERT INTO citas (usuario_id, doctor_id, horario_id, fecha, motivo, estado)
       VALUES (?, ?, ?, ?, ?, 'pendiente')`,
      [req.user.id, doctor_id, horario_id, fecha, motivo || null]
    );

    // Registro en historial de auditoria
    await db.query(
      `INSERT INTO historial_citas (cita_id, estado_nuevo, modificado_por, observacion)
       VALUES (?, 'pendiente', ?, 'Cita creada por paciente')`,
      [result.insertId, req.user.id]
    );

    // Simulacion de envio de confirmacion (en produccion se conectaria un servicio de email)
    console.log(`[CONFIRMACION] Cita #${result.insertId} creada para ${req.user.email} - Fecha: ${fecha}`);

    res.status(201).json({
      mensaje: 'Cita agendada exitosamente. Recibirás una confirmacion pronto.',
      cita_id: result.insertId
    });
  } catch (err) {
    // Error 1062 = duplicado; significa que el slot fue tomado en otra transaccion concurrente
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ese horario ya fue reservado. Por favor elige otro.' });
    }
    console.error('Error al crear cita:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/citas/:id/cancelar - el paciente cancela su propia cita
router.patch('/:id/cancelar', verificarToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [citas] = await db.query(
      `SELECT id, estado, usuario_id, fecha FROM citas WHERE id = ?`, [id]
    );

    if (citas.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    const cita = citas[0];

    // Solo el dueno de la cita o un admin puede cancelarla
    if (cita.usuario_id !== req.user.id && req.user.rol_id !== 1) {
      return res.status(403).json({ error: 'No tienes permiso para cancelar esta cita' });
    }

    if (['cancelada', 'completada'].includes(cita.estado)) {
      return res.status(400).json({ error: `La cita ya esta en estado: ${cita.estado}` });
    }

    const estadoAnterior = cita.estado;

    await db.query(`UPDATE citas SET estado = 'cancelada' WHERE id = ?`, [id]);

    await db.query(
      `INSERT INTO historial_citas (cita_id, estado_anterior, estado_nuevo, modificado_por, observacion)
       VALUES (?, ?, 'cancelada', ?, 'Cancelada por usuario')`,
      [id, estadoAnterior, req.user.id]
    );

    console.log(`[CANCELACION] Cita #${id} cancelada por usuario ${req.user.id}`);

    res.json({ mensaje: 'Cita cancelada exitosamente' });
  } catch (err) {
    console.error('Error al cancelar:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/citas/:id/reprogramar - cambia la fecha y horario de una cita existente
router.patch('/:id/reprogramar', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { nueva_fecha, nuevo_horario_id } = req.body;

  if (!nueva_fecha || !nuevo_horario_id) {
    return res.status(400).json({ error: 'nueva_fecha y nuevo_horario_id son requeridos' });
  }

  const fechaObj = new Date(nueva_fecha + 'T00:00:00');
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  if (fechaObj < hoy) {
    return res.status(400).json({ error: 'No se puede reprogramar a una fecha pasada' });
  }

  try {
    const [citas] = await db.query(
      `SELECT id, estado, usuario_id, doctor_id FROM citas WHERE id = ?`, [id]
    );

    if (citas.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    const cita = citas[0];

    if (cita.usuario_id !== req.user.id && req.user.rol_id !== 1) {
      return res.status(403).json({ error: 'No tienes permiso para reprogramar esta cita' });
    }

    if (['cancelada', 'completada'].includes(cita.estado)) {
      return res.status(400).json({ error: 'No se puede reprogramar una cita cancelada o completada' });
    }

    const diaSemana = fechaObj.getDay();

    // Verifica que el nuevo horario sea valido para ese doctor y dia
    const [horario] = await db.query(
      `SELECT id FROM horarios
       WHERE id = ? AND doctor_id = ? AND dia_semana = ? AND activo = 1`,
      [nuevo_horario_id, cita.doctor_id, diaSemana]
    );

    if (horario.length === 0) {
      return res.status(400).json({ error: 'El nuevo horario no es valido para ese doctor y fecha' });
    }

    const estadoAnterior = cita.estado;

    await db.query(
      `UPDATE citas SET horario_id = ?, fecha = ?, estado = 'reprogramada' WHERE id = ?`,
      [nuevo_horario_id, nueva_fecha, id]
    );

    await db.query(
      `INSERT INTO historial_citas (cita_id, estado_anterior, estado_nuevo, modificado_por, observacion)
       VALUES (?, ?, 'reprogramada', ?, 'Reprogramada por usuario')`,
      [id, estadoAnterior, req.user.id]
    );

    console.log(`[REPROGRAMACION] Cita #${id} reprogramada al ${nueva_fecha}`);

    res.json({ mensaje: 'Cita reprogramada exitosamente' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ese nuevo horario ya esta ocupado' });
    }
    console.error('Error al reprogramar:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== RUTAS DE ADMINISTRADOR =====

// GET /api/citas/admin/todas - lista todas las citas (solo admin)
router.get('/admin/todas', verificarToken, soloAdmin, async (req, res) => {
  const { fecha, estado, doctor_id } = req.query;
  let sql = `
    SELECT c.id, DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha, c.estado, c.motivo, c.fecha_creacion,
           h.hora_inicio, h.hora_fin,
           u.nombre AS paciente_nombre, u.apellido AS paciente_apellido, u.email AS paciente_email,
           d.nombre AS doctor_nombre, d.apellido AS doctor_apellido,
           e.nombre AS especialidad
    FROM citas c
    JOIN horarios     h ON h.id = c.horario_id
    JOIN doctores     d ON d.id = c.doctor_id
    JOIN especialidades e ON e.id = d.especialidad_id
    JOIN usuarios     u ON u.id = c.usuario_id
    WHERE 1=1`;

  const params = [];

  if (fecha)     { sql += ' AND c.fecha = ?';     params.push(fecha); }
  if (estado)    { sql += ' AND c.estado = ?';    params.push(estado); }
  if (doctor_id) { sql += ' AND c.doctor_id = ?'; params.push(doctor_id); }

  sql += ' ORDER BY c.fecha DESC, h.hora_inicio DESC';

  try {
    const [citas] = await db.query(sql, params);
    res.json(citas);
  } catch (err) {
    console.error('Error al obtener citas admin:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/citas/admin/agenda?fecha=YYYY-MM-DD - agenda diaria del admin
router.get('/admin/agenda', verificarToken, soloAdmin, async (req, res) => {
  const { fecha } = req.query;

  if (!fecha) {
    return res.status(400).json({ error: 'fecha es requerida' });
  }

  try {
    const [citas] = await db.query(
      `SELECT c.id, DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha, c.estado, c.motivo,
              h.hora_inicio, h.hora_fin,
              u.nombre AS paciente_nombre, u.apellido AS paciente_apellido,
              u.email AS paciente_email, u.telefono,
              d.nombre AS doctor_nombre, d.apellido AS doctor_apellido,
              e.nombre AS especialidad
       FROM citas c
       JOIN horarios h ON h.id = c.horario_id
       JOIN doctores d ON d.id = c.doctor_id
       JOIN especialidades e ON e.id = d.especialidad_id
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.fecha = ?
       ORDER BY h.hora_inicio ASC`,
      [fecha]
    );
    res.json(citas);
  } catch (err) {
    console.error('Error al obtener agenda admin:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/citas/admin/resumen-mes?anio=YYYY&mes=MM - conteo por dia
router.get('/admin/resumen-mes', verificarToken, soloAdmin, async (req, res) => {
  const { anio, mes } = req.query;

  if (!anio || !mes) {
    return res.status(400).json({ error: 'anio y mes son requeridos' });
  }

  try {
    const [filas] = await db.query(
      `SELECT DAY(fecha) AS dia, COUNT(*) AS total
       FROM citas
       WHERE YEAR(fecha) = ? AND MONTH(fecha) = ?
       GROUP BY DAY(fecha)`,
      [anio, mes]
    );

    const resumen = {};
    filas.forEach(f => {
      resumen[f.dia] = f.total;
    });
    res.json(resumen);
  } catch (err) {
    console.error('Error al obtener resumen mensual:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/citas/admin/especialidades - catalogo para el modal de medicos
router.get('/admin/especialidades', verificarToken, soloAdmin, async (req, res) => {
  try {
    const [especialidades] = await db.query(
      `SELECT id, nombre
       FROM especialidades
       ORDER BY nombre`
    );
    res.json(especialidades);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/citas/admin/doctores - crea un medico
router.post('/admin/doctores', verificarToken, soloAdmin, async (req, res) => {
  const { nombre, apellido, cedula, especialidad_id } = req.body;

  if (!nombre || !apellido || !cedula || !especialidad_id) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO doctores (nombre, apellido, cedula, especialidad_id)
       VALUES (?, ?, ?, ?)`,
      [nombre, apellido, cedula, especialidad_id]
    );

    res.status(201).json({ mensaje: 'Medico creado correctamente', doctor_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'La cedula profesional ya esta registrada' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/citas/admin/doctores/:id - actualiza datos del medico
router.patch('/admin/doctores/:id', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, cedula, especialidad_id } = req.body;

  if (!nombre || !apellido || !cedula || !especialidad_id) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    const [result] = await db.query(
      `UPDATE doctores
       SET nombre = ?, apellido = ?, cedula = ?, especialidad_id = ?
       WHERE id = ?`,
      [nombre, apellido, cedula, especialidad_id, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Medico no encontrado' });
    }

    res.json({ mensaje: 'Medico actualizado correctamente' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'La cedula profesional ya esta registrada' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/citas/admin/doctores/:id/estado - activa o desactiva un medico
router.patch('/admin/doctores/:id/estado', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;

  if (typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'activo debe ser true o false' });
  }

  try {
    const [result] = await db.query(
      `UPDATE doctores SET activo = ? WHERE id = ?`,
      [activo ? 1 : 0, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Medico no encontrado' });
    }

    res.json({ mensaje: 'Estado del medico actualizado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/citas/admin/doctores/:id/horarios - horarios de un medico
router.get('/admin/doctores/:id/horarios', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [horarios] = await db.query(
      `SELECT id, doctor_id, dia_semana, hora_inicio, hora_fin, activo
       FROM horarios
       WHERE doctor_id = ?
       ORDER BY dia_semana, hora_inicio`,
      [id]
    );
    res.json(horarios);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/citas/admin/doctores/:id/horarios - agrega un horario a un medico
router.post('/admin/doctores/:id/horarios', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { dia_semana, hora_inicio, hora_fin } = req.body;

  if (dia_semana === undefined || !hora_inicio || !hora_fin) {
    return res.status(400).json({ error: 'Dia, hora de inicio y hora de fin son requeridos' });
  }

  const dia = Number(dia_semana);
  if (!Number.isInteger(dia) || dia < 0 || dia > 6) {
    return res.status(400).json({ error: 'El dia debe estar entre 0 y 6' });
  }

  if (hora_inicio >= hora_fin) {
    return res.status(400).json({ error: 'La hora de inicio debe ser menor que la hora de fin' });
  }

  try {
    const [doctor] = await db.query('SELECT id FROM doctores WHERE id = ?', [id]);
    if (doctor.length === 0) {
      return res.status(404).json({ error: 'Medico no encontrado' });
    }

    const [result] = await db.query(
      `INSERT INTO horarios (doctor_id, dia_semana, hora_inicio, hora_fin, activo)
       VALUES (?, ?, ?, ?, 1)`,
      [id, dia, hora_inicio, hora_fin]
    );

    res.status(201).json({ mensaje: 'Horario agregado correctamente', horario_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ese medico ya tiene un horario que inicia a esa hora ese dia' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/citas/admin/horarios/:id/estado - activa o desactiva un horario
router.patch('/admin/horarios/:id/estado', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;

  if (typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'activo debe ser true o false' });
  }

  try {
    const [result] = await db.query(
      `UPDATE horarios SET activo = ? WHERE id = ?`,
      [activo ? 1 : 0, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Horario no encontrado' });
    }

    res.json({ mensaje: 'Horario actualizado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/citas/admin/:id/estado - el admin cambia el estado de cualquier cita
router.patch('/admin/:id/estado', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { estado, notas } = req.body;

  const estadosValidos = ['pendiente', 'confirmada', 'cancelada', 'completada'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado no valido' });
  }

  try {
    const [citas] = await db.query(`SELECT id, estado FROM citas WHERE id = ?`, [id]);
    if (citas.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    const estadoAnterior = citas[0].estado;

    await db.query(
      `UPDATE citas SET estado = ?, notas_admin = ? WHERE id = ?`,
      [estado, notas || null, id]
    );

    await db.query(
      `INSERT INTO historial_citas (cita_id, estado_anterior, estado_nuevo, modificado_por, observacion)
       VALUES (?, ?, ?, ?, 'Actualizado por administrador')`,
      [id, estadoAnterior, estado, req.user.id]
    );

    res.json({ mensaje: 'Estado actualizado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/citas/admin/doctores - lista y gestion de doctores (solo admin)
router.get('/admin/doctores', verificarToken, soloAdmin, async (req, res) => {
  try {
    const [doctores] = await db.query(
      `SELECT d.id, d.nombre, d.apellido, d.cedula, d.activo,
              d.especialidad_id, e.nombre AS especialidad,
              COUNT(h.id) AS total_horarios
       FROM doctores d
       JOIN especialidades e ON e.id = d.especialidad_id
       LEFT JOIN horarios h ON h.doctor_id = d.id AND h.activo = 1
       GROUP BY d.id, d.nombre, d.apellido, d.cedula, d.activo, d.especialidad_id, e.nombre
       ORDER BY d.apellido`
    );
    res.json(doctores);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
