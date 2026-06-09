// Modulo del panel de administracion.
// Gestiona citas, calendario mensual, agenda del dia y CRUD de medicos.

const Admin = (() => {
  const DIAS_SEMANA = ['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'];

  function normalizarFecha(fecha) {
    if (!fecha) return '';
    return String(fecha).slice(0, 10);
  }

  function formatearFecha(fecha) {
    const [anio, mes, dia] = normalizarFecha(fecha).split('-');
    if (!anio || !mes || !dia) return fecha || '';
    return `${dia}/${mes}/${anio}`;
  }


  // SECCION: TODAS LAS CITAS

  async function cargarTodasCitas() {
    const contenedor = document.getElementById('tabla-citas-admin');
    contenedor.innerHTML = '<div class="cargando">Cargando citas...</div>';

    const fecha  = document.getElementById('filtro-fecha').value;
    const estado = document.getElementById('filtro-estado').value;

    let params = [];
    if (fecha)  params.push('fecha='  + fecha);
    if (estado) params.push('estado=' + estado);
    const qs = params.length ? '?' + params.join('&') : '';

    try {
      const citas = await API.getTodasCitas(qs);

      if (citas.length === 0) {
        contenedor.innerHTML = '<div class="cargando">No se encontraron citas con esos filtros</div>';
        return;
      }

      const tabla = document.createElement('table');
      tabla.className = 'tabla-admin';
      tabla.innerHTML = `
        <thead>
          <tr>
            <th>#</th>
            <th>Fecha</th>
            <th>Horario</th>
            <th>Paciente</th>
            <th>Médico</th>
            <th>Especialidad</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="tbody-citas"></tbody>`;

      const tbody = tabla.querySelector('#tbody-citas');

      citas.forEach(c => {
        const tr           = document.createElement('tr');

        tr.innerHTML = `
          <td>${c.id}</td>
          <td>${formatearFecha(c.fecha)}</td>
          <td>${c.hora_inicio.slice(0,5)} - ${c.hora_fin.slice(0,5)}</td>
          <td>
            <div>${c.paciente_nombre} ${c.paciente_apellido}</div>
            <div style="font-size:0.75rem;color:var(--texto-suave)">${c.paciente_email}</div>
          </td>
          <td>Dr. ${c.doctor_nombre} ${c.doctor_apellido}</td>
          <td>${c.especialidad}</td>
          <td><span class="estado-badge estado-${c.estado}">${c.estado}</span></td>
          <td>
            <button class="btn-accion editar" data-id="${c.id}" data-estado="${c.estado}">
              Actualizar
            </button>
          </td>`;

        tr.querySelector('.btn-accion.editar').addEventListener('click', (e) => {
          abrirModalEstado(e.target.dataset.id, e.target.dataset.estado);
        });

        tbody.appendChild(tr);
      });

      contenedor.innerHTML = '';
      contenedor.appendChild(tabla);
    } catch (e) {
      contenedor.innerHTML = `<div class="cargando" style="color:var(--rosa-fuerte)">Error: ${e.message}</div>`;
    }
  }


  // SECCION: CALENDARIO MENSUAL ADMIN

  let calAdminAnio  = new Date().getFullYear();
  let calAdminMes   = new Date().getMonth();
  let resumenMes    = {};

  const MESES = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];

  // Pide al backend el conteo de citas por dia del mes y luego renderiza
  async function cargarCalendarioAdmin() {
    try {
      resumenMes = await API.getResumenMes(calAdminAnio, calAdminMes + 1);
    } catch (e) {
      resumenMes = {};
    }
    renderizarCalendarioAdmin();
  }

  // Dibuja la grilla mensual con badges de conteo en los dias que tienen citas
  function renderizarCalendarioAdmin() {
    const grid   = document.getElementById('admin-cal-grid');
    const titulo = document.getElementById('admin-cal-titulo');
    if (!grid) return;

    titulo.textContent = `${MESES[calAdminMes]} ${calAdminAnio}`;
    grid.innerHTML = '';

    const hoy        = new Date(); hoy.setHours(0,0,0,0);
    const primerDia  = new Date(calAdminAnio, calAdminMes, 1).getDay();
    const diasEnMes  = new Date(calAdminAnio, calAdminMes + 1, 0).getDate();
    const diasMesAnt = new Date(calAdminAnio, calAdminMes, 0).getDate();

    // Dias del mes anterior (relleno)
    for (let i = primerDia - 1; i >= 0; i--) {
      const el = document.createElement('div');
      el.className = 'cal-dia otro-mes inactivo';
      el.textContent = diasMesAnt - i;
      grid.appendChild(el);
    }

    // Dias del mes actual
    for (let d = 1; d <= diasEnMes; d++) {
      const fecha = new Date(calAdminAnio, calAdminMes, d);
      const el    = document.createElement('div');
      const clases = ['cal-dia'];

      if (fecha.getTime() === hoy.getTime()) clases.push('hoy');

      el.className   = clases.join(' ');
      el.textContent = d;

      // Si hay citas ese dia muestra un badge con el conteo
      if (resumenMes[d]) {
        const badge = document.createElement('span');
        badge.className   = 'cal-dia-badge';
        badge.textContent = resumenMes[d];
        el.appendChild(badge);
      }

      // Al hacer clic en un dia carga el detalle de citas de ese dia
      el.addEventListener('click', () => {
        const fechaStr = `${calAdminAnio}-${String(calAdminMes + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        mostrarDetalleDia(fechaStr, d);
      });

      grid.appendChild(el);
    }

    // Relleno del final
    const totalCeldas = grid.children.length;
    const restantes   = totalCeldas % 7 === 0 ? 0 : 7 - (totalCeldas % 7);
    for (let i = 1; i <= restantes; i++) {
      const el = document.createElement('div');
      el.className = 'cal-dia otro-mes inactivo';
      el.textContent = i;
      grid.appendChild(el);
    }
  }

  // Carga las citas de un dia especifico y las muestra bajo el calendario
  async function mostrarDetalleDia(fecha, dia) {
    const detalle = document.getElementById('admin-cal-detalle');
    const titulo  = document.getElementById('admin-cal-detalle-titulo');
    const lista   = document.getElementById('admin-cal-detalle-lista');

    titulo.textContent = `Citas del ${dia} de ${MESES[calAdminMes]} de ${calAdminAnio}`;
    lista.innerHTML    = '<div class="cargando">Cargando...</div>';
    detalle.classList.remove('oculto');

    try {
      const citas = await API.getAgenda(fecha);

      if (citas.length === 0) {
        lista.innerHTML = '<p class="slots-placeholder">No hay citas para este dia</p>';
        return;
      }

      lista.innerHTML = '';
      citas.forEach(c => {
        const div = document.createElement('div');
        div.style.cssText = 'margin-bottom:10px;padding:12px 16px;background:var(--beige-claro);border-radius:10px;border-left:4px solid var(--lila-fuerte)';
        div.innerHTML = `
          <div style="font-weight:500;color:var(--texto-oscuro)">${c.hora_inicio.slice(0,5)} - ${c.paciente_nombre} ${c.paciente_apellido}</div>
          <div style="font-size:0.82rem;color:var(--texto-suave)">Dr. ${c.doctor_nombre} ${c.doctor_apellido} | ${c.especialidad} | <span class="estado-badge estado-${c.estado}">${c.estado}</span></div>`;
        lista.appendChild(div);
      });
    } catch (e) {
      lista.innerHTML = `<p style="color:var(--rosa-fuerte)">${e.message}</p>`;
    }
  }


  // SECCION: AGENDA DEL DIA

  async function cargarAgendaDia() {
    const fecha      = document.getElementById('agenda-fecha').value;
    const contenedor = document.getElementById('agenda-contenedor');

    if (!fecha) {
      contenedor.innerHTML = '<p class="slots-placeholder">Selecciona una fecha para ver la agenda del dia</p>';
      return;
    }

    contenedor.innerHTML = '<div class="cargando">Cargando agenda...</div>';

    try {
      const citas = await API.getAgenda(fecha);

      if (citas.length === 0) {
        contenedor.innerHTML = '<div class="agenda-vacio"><p>No hay citas programadas para este dia</p></div>';
        return;
      }

      contenedor.innerHTML = '';

      citas.forEach(c => {
        const bloque = document.createElement('div');
        bloque.className = 'agenda-bloque';

        bloque.innerHTML = `
          <div class="agenda-hora">${c.hora_inicio.slice(0,5)}</div>
          <div class="agenda-cita-card">
            <div class="agenda-cita-paciente">${c.paciente_nombre} ${c.paciente_apellido}</div>
            <div class="agenda-cita-info">
              <span>Dr. ${c.doctor_nombre} ${c.doctor_apellido}</span>
              <span>${c.especialidad}</span>
              <span>${c.hora_inicio.slice(0,5)} - ${c.hora_fin.slice(0,5)}</span>
              ${c.telefono ? `<span>${c.telefono}</span>` : ''}
              <span class="estado-badge estado-${c.estado}">${c.estado}</span>
            </div>
            ${c.motivo ? `<div style="margin-top:8px;font-size:0.82rem;color:var(--texto-medio);font-style:italic">Motivo: ${c.motivo}</div>` : ''}
          </div>`;

        contenedor.appendChild(bloque);
      });
    } catch (e) {
      contenedor.innerHTML = `<div class="cargando" style="color:var(--rosa-fuerte)">Error: ${e.message}</div>`;
    }
  }

  // SECCION: GESTION DE MEDICOS (CRUD)

  async function cargarDoctoresAdmin() {
    const contenedor = document.getElementById('tabla-doctores-admin');
    contenedor.innerHTML = '<div class="cargando">Cargando médicos...</div>';

    try {
      const doctores = await API.getDoctoresAdmin();

      const tabla = document.createElement('table');
      tabla.className = 'tabla-admin';
      tabla.innerHTML = `
        <thead>
          <tr>
            <th>#</th>
            <th>Nombre</th>
            <th>Cedula</th>
            <th>Especialidad</th>
            <th>Horarios activos</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody></tbody>`;

      const tbody = tabla.querySelector('tbody');

      doctores.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${d.id}</td>
          <td>Dr. ${d.nombre} ${d.apellido}</td>
          <td>${d.cedula}</td>
          <td>${d.especialidad}</td>
          <td>${d.total_horarios}</td>
          <td>
            <span class="${d.activo ? 'doctor-activo-si' : 'doctor-activo-no'}">
              ${d.activo ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn-accion editar" data-id="${d.id}">Editar</button>
            <button class="btn-accion" data-id="${d.id}" data-horarios="true">Horarios</button>
            <button class="btn-accion ${d.activo ? 'cancelar' : 'confirmar'}" data-id="${d.id}" data-activo="${d.activo}">
              ${d.activo ? 'Desactivar' : 'Activar'}
            </button>
          </td>`;

        // Boton editar abre modal con datos del doctor
        tr.querySelector('.btn-accion.editar').addEventListener('click', () => {
          abrirModalDoctor(d);
        });

        tr.querySelector('[data-horarios="true"]').addEventListener('click', () => {
          abrirModalHorarios(d);
        });

        // Boton activar/desactivar cambia el estado del doctor
        tr.querySelector(`.btn-accion.${d.activo ? 'cancelar' : 'confirmar'}`).addEventListener('click', async () => {
          const accion = d.activo ? 'desactivar' : 'activar';
          if (!confirm(`Confirmas ${accion} al Dr. ${d.nombre} ${d.apellido}?`)) return;
          try {
            await API.cambiarEstadoDoctor(d.id, !d.activo);
            await cargarDoctoresAdmin();
          } catch (e) {
            alert('Error: ' + e.message);
          }
        });

        tbody.appendChild(tr);
      });

      contenedor.innerHTML = '';
      contenedor.appendChild(tabla);
    } catch (e) {
      contenedor.innerHTML = `<div class="cargando" style="color:var(--rosa-fuerte)">Error: ${e.message}</div>`;
    }
  }

  // Carga especialidades en el select del modal de doctor
  async function cargarEspecialidadesModal() {
    const select = document.getElementById('md-especialidad');
    try {
      const especialidades = await API.getEspecialidades();
      select.innerHTML = '<option value="">Selecciona...</option>';
      especialidades.forEach(e => {
        const op = document.createElement('option');
        op.value       = e.id;
        op.textContent = e.nombre;
        select.appendChild(op);
      });
    } catch (e) {
      select.innerHTML = '<option value="">Error al cargar</option>';
    }
  }

  // Abre el modal de doctor en modo agregar o editar
  function abrirModalDoctor(doctor = null) {
    const titulo = document.getElementById('modal-doctor-titulo');
    const errEl  = document.getElementById('modal-doctor-error');

    errEl.classList.add('oculto');

    if (doctor) {
      titulo.textContent = 'Editar médico';
      document.getElementById('modal-doctor-id').value   = doctor.id;
      document.getElementById('md-nombre').value         = doctor.nombre;
      document.getElementById('md-apellido').value       = doctor.apellido;
      document.getElementById('md-cedula').value         = doctor.cedula;
      // Espera a que se carguen las especialidades para seleccionar la correcta
      cargarEspecialidadesModal().then(() => {
        document.getElementById('md-especialidad').value = doctor.especialidad_id;
      });
    } else {
      titulo.textContent = 'Agregar médico';
      document.getElementById('modal-doctor-id').value   = '';
      document.getElementById('md-nombre').value         = '';
      document.getElementById('md-apellido').value       = '';
      document.getElementById('md-cedula').value         = '';
      cargarEspecialidadesModal();
    }

    document.getElementById('modal-doctor').classList.remove('oculto');
  }

  async function abrirModalHorarios(doctor) {
    const modal = document.getElementById('modal-horarios');
    const titulo = document.getElementById('modal-horarios-titulo');
    const lista = document.getElementById('modal-horarios-lista');
    const errEl = document.getElementById('modal-horarios-error');

    titulo.textContent = `Horarios de Dr. ${doctor.nombre} ${doctor.apellido}`;
    document.getElementById('modal-horarios-doctor-id').value = doctor.id;
    errEl.classList.add('oculto');
    lista.innerHTML = '<div class="cargando">Cargando horarios...</div>';
    modal.classList.remove('oculto');
    await cargarHorariosDoctor(doctor.id);
  }

  async function cargarHorariosDoctor(doctorId) {
    const lista = document.getElementById('modal-horarios-lista');
    try {
      const horarios = await API.getHorariosDoctor(doctorId);

      if (horarios.length === 0) {
        lista.innerHTML = '<p class="slots-placeholder">Este médico no tiene horarios registrados</p>';
        return;
      }

      lista.innerHTML = '';
      horarios.forEach(h => {
        const fila = document.createElement('div');
        fila.className = 'horario-admin-item';
        fila.innerHTML = `
          <div>
            <div class="horario-admin-dia">${DIAS_SEMANA[h.dia_semana]}</div>
            <div class="horario-admin-hora">${h.hora_inicio.slice(0,5)} - ${h.hora_fin.slice(0,5)}</div>
          </div>
          <label class="switch-horario">
            <input type="checkbox" ${h.activo ? 'checked' : ''}>
            <span>${h.activo ? 'Activo' : 'Inactivo'}</span>
          </label>`;

        const checkbox = fila.querySelector('input');
        const estado = fila.querySelector('.switch-horario span');
        checkbox.addEventListener('change', async () => {
          checkbox.disabled = true;
          try {
            await API.cambiarEstadoHorario(h.id, checkbox.checked);
            estado.textContent = checkbox.checked ? 'Activo' : 'Inactivo';
            await cargarDoctoresAdmin();
          } catch (e) {
            checkbox.checked = !checkbox.checked;
            alert('Error: ' + e.message);
          } finally {
            checkbox.disabled = false;
          }
        });

        lista.appendChild(fila);
      });
    } catch (e) {
      lista.innerHTML = `<div class="cargando" style="color:var(--rosa-fuerte)">Error: ${e.message}</div>`;
    }
  }

  async function agregarHorarioModal() {
    const doctorId = document.getElementById('modal-horarios-doctor-id').value;
    const dia = document.getElementById('mh-dia').value;
    const inicio = document.getElementById('mh-inicio').value;
    const fin = document.getElementById('mh-fin').value;
    const errEl = document.getElementById('modal-horarios-error');
    const btn = document.getElementById('modal-horarios-agregar');

    errEl.classList.add('oculto');

    if (!doctorId || !inicio || !fin) {
      errEl.textContent = 'Selecciona dia, hora de inicio y hora de fin';
      errEl.classList.remove('oculto');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Agregando...';

    try {
      await API.agregarHorarioDoctor(doctorId, {
        dia_semana: dia,
        hora_inicio: inicio,
        hora_fin: fin
      });
      document.getElementById('mh-inicio').value = '';
      document.getElementById('mh-fin').value = '';
      await cargarHorariosDoctor(doctorId);
      await cargarDoctoresAdmin();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('oculto');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Agregar horario';
    }
  }

  function cerrarModalHorarios() {
    document.getElementById('modal-horarios').classList.add('oculto');
  }

  function cerrarModalDoctor() {
    document.getElementById('modal-doctor').classList.add('oculto');
  }

  // Guarda un doctor nuevo o actualiza uno existente segun si hay id en el hidden input
  async function guardarDoctor() {
    const id           = document.getElementById('modal-doctor-id').value;
    const nombre       = document.getElementById('md-nombre').value.trim();
    const apellido     = document.getElementById('md-apellido').value.trim();
    const cedula       = document.getElementById('md-cedula').value.trim();
    const especialidad = document.getElementById('md-especialidad').value;
    const errEl        = document.getElementById('modal-doctor-error');
    const btn          = document.getElementById('modal-doctor-guardar');

    errEl.classList.add('oculto');

    if (!nombre || !apellido || !cedula || !especialidad) {
      errEl.textContent = 'Todos los campos son obligatorios';
      errEl.classList.remove('oculto');
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Guardando...';

    try {
      if (id) {
        await API.editarDoctor(id, { nombre, apellido, cedula, especialidad_id: especialidad });
      } else {
        await API.agregarDoctor({ nombre, apellido, cedula, especialidad_id: especialidad });
      }
      cerrarModalDoctor();
      await cargarDoctoresAdmin();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('oculto');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Guardar';
    }
  }


  // MODAL DE ESTADO DE CITA

  function abrirModalEstado(citaId, estadoActual) {
    document.getElementById('modal-cita-id').value      = citaId;
    document.getElementById('modal-nuevo-estado').value = estadoActual;
    document.getElementById('modal-notas').value        = '';
    document.getElementById('modal-estado').classList.remove('oculto');
  }

  function cerrarModalEstado() {
    document.getElementById('modal-estado').classList.add('oculto');
  }

  async function guardarEstadoModal() {
    const citaId = document.getElementById('modal-cita-id').value;
    const estado = document.getElementById('modal-nuevo-estado').value;
    const notas  = document.getElementById('modal-notas').value.trim();
    const btn    = document.getElementById('modal-guardar');

    btn.disabled    = true;
    btn.textContent = 'Guardando...';

    try {
      await API.actualizarEstado(citaId, { estado, notas: notas || undefined });
      cerrarModalEstado();
      await cargarTodasCitas();
    } catch (e) {
      alert('Error al actualizar: ' + e.message);
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Guardar';
    }
  }

  // NAVEGACION ENTRE SECCIONES ADMIN

  function inicializarNav() {
    document.querySelectorAll('[data-seccion-admin]').forEach(btn => {
      btn.addEventListener('click', () => {
        const objetivo = btn.dataset.seccionAdmin;

        document.querySelectorAll('[data-seccion-admin]').forEach(b => b.classList.remove('activo'));
        btn.classList.add('activo');

        document.querySelectorAll('#pantalla-admin .seccion').forEach(s => {
          s.classList.remove('activa');
          s.classList.add('oculto');
        });

        const seccion = document.getElementById('seccion-' + objetivo);
        if (seccion) {
          seccion.classList.remove('oculto');
          seccion.classList.add('activa');
        }

        if (objetivo === 'todas-citas')      cargarTodasCitas();
        if (objetivo === 'calendario-admin') cargarCalendarioAdmin();
        if (objetivo === 'agenda-admin')     cargarAgendaDia();
        if (objetivo === 'doctores-admin')   cargarDoctoresAdmin();
      });
    });
  }

  // ============================================================
  // INICIALIZACION GENERAL DEL MODULO ADMIN
  // ============================================================

  function inicializar() {
    inicializarNav();

    // Citas
    document.getElementById('btn-filtrar').addEventListener('click', cargarTodasCitas);

    // Modal estado de cita
    document.getElementById('modal-cancelar').addEventListener('click', cerrarModalEstado);
    document.getElementById('modal-guardar').addEventListener('click', guardarEstadoModal);
    document.getElementById('modal-estado').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) cerrarModalEstado();
    });

    // Navegacion del calendario admin
    document.getElementById('admin-cal-prev').addEventListener('click', () => {
      calAdminMes--;
      if (calAdminMes < 0) { calAdminMes = 11; calAdminAnio--; }
      cargarCalendarioAdmin();
    });
    document.getElementById('admin-cal-next').addEventListener('click', () => {
      calAdminMes++;
      if (calAdminMes > 11) { calAdminMes = 0; calAdminAnio++; }
      cargarCalendarioAdmin();
    });

    // Agenda del dia
    document.getElementById('btn-cargar-agenda').addEventListener('click', cargarAgendaDia);
    // Precarga con la fecha de hoy
    const hoy = new Date();
    const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
    document.getElementById('agenda-fecha').value = hoyStr;

    // Modal de doctor
    document.getElementById('btn-nuevo-doctor').addEventListener('click', () => abrirModalDoctor());
    document.getElementById('modal-doctor-cancelar').addEventListener('click', cerrarModalDoctor);
    document.getElementById('modal-doctor-guardar').addEventListener('click', guardarDoctor);
    document.getElementById('modal-doctor').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) cerrarModalDoctor();
    });

    // Modal de horarios
    document.getElementById('modal-horarios-agregar').addEventListener('click', agregarHorarioModal);
    document.getElementById('modal-horarios-cerrar').addEventListener('click', cerrarModalHorarios);
    document.getElementById('modal-horarios').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) cerrarModalHorarios();
    });

    // Carga inicial
    cargarTodasCitas();
  }

  return { inicializar };
})();
