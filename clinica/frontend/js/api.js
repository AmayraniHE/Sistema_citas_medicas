// Modulo de comunicacion con la API REST del backend.
// Centraliza todas las llamadas fetch y maneja el token JWT automaticamente.

const API = (() => {
  const BASE = '/api';

  // Obtiene el token almacenado en sessionStorage
  function getToken() {
    return sessionStorage.getItem('clr_token');
  }

  // Construye los encabezados comunes para las peticiones autenticadas
  function headers(conAuth = true) {
    const h = { 'Content-Type': 'application/json' };
    if (conAuth) {
      const t = getToken();
      if (t) h['Authorization'] = 'Bearer ' + t;
    }
    return h;
  }

  // Funcion interna que ejecuta fetch y lanza error si el servidor responde con error
  async function request(metodo, ruta, cuerpo = null, auth = true) {
    const opciones = {
      method:  metodo,
      headers: headers(auth)
    };
    if (cuerpo) opciones.body = JSON.stringify(cuerpo);

    const resp = await fetch(BASE + ruta, opciones);
    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || 'Error en la solicitud');
    }
    return data;
  }

  return {
    // -- Autenticacion --
    login:    (email, password) => request('POST', '/auth/login',    { email, password }, false),
    registro: (datos)           => request('POST', '/auth/registro', datos, false),

    // -- Citas paciente --
    getDoctores:      ()      => request('GET',  '/citas/doctores'),
    getDisponibilidad:(doc, f) => request('GET',  `/citas/disponibilidad?doctor_id=${doc}&fecha=${f}`),
    getMisCitas:      ()      => request('GET',  '/citas/mis-citas'),
    crearCita:        (datos) => request('POST', '/citas', datos),
    cancelarCita:     (id)    => request('PATCH', `/citas/${id}/cancelar`),
    reprogramarCita:  (id, d) => request('PATCH', `/citas/${id}/reprogramar`, d),

    // -- Admin --
    getTodasCitas:        (params)     => request('GET',  '/citas/admin/todas' + (params || '')),
    actualizarEstado:     (id, datos)  => request('PATCH', `/citas/admin/${id}/estado`, datos),
    getDoctoresAdmin:     ()           => request('GET',  '/citas/admin/doctores'),
    getEspecialidades:    ()           => request('GET',  '/citas/admin/especialidades'),
    agregarDoctor:        (datos)      => request('POST', '/citas/admin/doctores', datos),
    editarDoctor:         (id, datos)  => request('PATCH', `/citas/admin/doctores/${id}`, datos),
    cambiarEstadoDoctor:  (id, activo) => request('PATCH', `/citas/admin/doctores/${id}/estado`, { activo }),
    getHorariosDoctor:    (id)         => request('GET',  `/citas/admin/doctores/${id}/horarios`),
    agregarHorarioDoctor: (id, datos)  => request('POST', `/citas/admin/doctores/${id}/horarios`, datos),
    cambiarEstadoHorario: (id, activo) => request('PATCH', `/citas/admin/horarios/${id}/estado`, { activo }),
    getAgenda:            (fecha)      => request('GET',  `/citas/admin/agenda?fecha=${fecha}`),
    getResumenMes:        (anio, mes)  => request('GET',  `/citas/admin/resumen-mes?anio=${anio}&mes=${mes}`)
  };
})();
