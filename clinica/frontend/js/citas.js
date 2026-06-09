// Modulo frontend de citas del paciente.
// Carga doctores, disponibilidad, agenda citas y muestra el historial.

const Citas = (() => {
  let doctores = [];
  let doctorSeleccionado = null;
  let fechaSeleccionada = null;
  let slotSeleccionado = null;

  function normalizarFecha(fecha) {
    if (!fecha) return '';
    return String(fecha).slice(0, 10);
  }

  function formatearFecha(fecha) {
    const [anio, mes, dia] = normalizarFecha(fecha).split('-');
    if (!anio || !mes || !dia) return fecha || '';
    return `${dia}/${mes}/${anio}`;
  }

  function mostrarMensaje(id, texto) {
    const el = document.getElementById(id);
    el.textContent = texto;
    el.classList.remove('oculto');
  }

  function ocultarMensajes() {
    document.getElementById('agendar-error').classList.add('oculto');
    document.getElementById('agendar-exito').classList.add('oculto');
  }

  function limpiarSeleccionHorario() {
    slotSeleccionado = null;
    document.getElementById('btn-agendar').disabled = true;
    document.getElementById('resumen-cita').classList.add('oculto');
    document.getElementById('resumen-contenido').innerHTML = '';
  }

  async function cargarDoctores() {
    const select = document.getElementById('select-doctor');
    select.innerHTML = '<option value="">Cargando médicos...</option>';

    try {
      doctores = await API.getDoctores();
      select.innerHTML = '<option value="">Selecciona un médico</option>';

      if (doctores.length === 0) {
        select.innerHTML = '<option value="">No hay médicos disponibles</option>';
        return;
      }

      doctores.forEach(d => {
        const op = document.createElement('option');
        op.value = d.id;
        op.textContent = `Dr. ${d.nombre} ${d.apellido} - ${d.especialidad}`;
        select.appendChild(op);
      });
    } catch (e) {
      select.innerHTML = '<option value="">Error al cargar médicos</option>';
    }
  }

  async function cargarDisponibilidad() {
    const contenedor = document.getElementById('slots-contenedor');
    ocultarMensajes();
    limpiarSeleccionHorario();

    if (!doctorSeleccionado || !fechaSeleccionada) {
      contenedor.innerHTML = '<p class="slots-placeholder">Selecciona un médico y una fecha para ver disponibilidad</p>';
      return;
    }

    contenedor.innerHTML = '<div class="cargando">Cargando horarios...</div>';

    try {
      const resp = await API.getDisponibilidad(doctorSeleccionado.id, fechaSeleccionada);
      const slots = resp.slots || [];

      if (slots.length === 0) {
        contenedor.innerHTML = '<p class="slots-placeholder">No hay horarios disponibles para esta fecha</p>';
        return;
      }

      contenedor.innerHTML = '';
      slots.forEach(slot => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `slot ${slot.ocupado ? 'ocupado' : ''}`;
        btn.disabled = !!slot.ocupado;
        btn.textContent = `${slot.hora_inicio.slice(0,5)} - ${slot.hora_fin.slice(0,5)}`;

        if (!slot.ocupado) {
          btn.addEventListener('click', () => seleccionarSlot(slot, btn));
        }

        contenedor.appendChild(btn);
      });
    } catch (e) {
      contenedor.innerHTML = `<p class="slots-placeholder" style="color:var(--rosa-fuerte)">${e.message}</p>`;
    }
  }

  function seleccionarSlot(slot, boton) {
    slotSeleccionado = slot;
    document.querySelectorAll('.slot').forEach(b => b.classList.remove('seleccionado'));
    boton.classList.add('seleccionado');
    actualizarResumen();
    document.getElementById('btn-agendar').disabled = false;
  }

  function actualizarResumen() {
    const resumen = document.getElementById('resumen-cita');
    const contenido = document.getElementById('resumen-contenido');

    if (!doctorSeleccionado || !fechaSeleccionada || !slotSeleccionado) {
      resumen.classList.add('oculto');
      return;
    }

    contenido.innerHTML = `
      <div class="resumen-fila"><span>Médico:</span><span>Dr. ${doctorSeleccionado.nombre} ${doctorSeleccionado.apellido}</span></div>
      <div class="resumen-fila"><span>Especialidad:</span><span>${doctorSeleccionado.especialidad}</span></div>
      <div class="resumen-fila"><span>Fecha:</span><span>${formatearFecha(fechaSeleccionada)}</span></div>
      <div class="resumen-fila"><span>Horario:</span><span>${slotSeleccionado.hora_inicio.slice(0,5)} - ${slotSeleccionado.hora_fin.slice(0,5)}</span></div>`;
    resumen.classList.remove('oculto');
  }

  async function agendarCita() {
    ocultarMensajes();

    if (!doctorSeleccionado || !fechaSeleccionada || !slotSeleccionado) {
      mostrarMensaje('agendar-error', 'Selecciona médico, fecha y horario');
      return;
    }

    const btn = document.getElementById('btn-agendar');
    const motivo = document.getElementById('motivo-cita').value.trim();

    btn.disabled = true;
    btn.textContent = 'Confirmando...';

    try {
      await API.crearCita({
        doctor_id: doctorSeleccionado.id,
        horario_id: slotSeleccionado.id,
        fecha: fechaSeleccionada,
        motivo: motivo || undefined
      });

      mostrarMensaje('agendar-exito', 'Cita agendada exitosamente');
      document.getElementById('motivo-cita').value = '';
      Calendario.reiniciar();
      fechaSeleccionada = null;
      document.getElementById('slots-contenedor').innerHTML = '<p class="slots-placeholder">Selecciona un médico y una fecha para ver disponibilidad</p>';
      limpiarSeleccionHorario();
      await cargarMisCitas();
    } catch (e) {
      mostrarMensaje('agendar-error', e.message);
    } finally {
      btn.textContent = 'Confirmar cita';
      btn.disabled = !slotSeleccionado;
    }
  }

  async function cargarMisCitas() {
    const contenedor = document.getElementById('lista-mis-citas');
    contenedor.innerHTML = '<div class="cargando">Cargando tus citas...</div>';

    try {
      const citas = await API.getMisCitas();

      if (citas.length === 0) {
        contenedor.innerHTML = `
          <div class="sin-citas">
            <p>No tienes citas registradas</p>
            <p>Agenda una nueva cita desde el calendario.</p>
          </div>`;
        return;
      }

      contenedor.innerHTML = '';
      citas.forEach(c => {
        const card = document.createElement('div');
        card.className = 'cita-card';
        card.innerHTML = `
          <div class="cita-card-encabezado">
            <div>
              <div class="cita-fecha-hora">${formatearFecha(c.fecha)}</div>
              <div class="cita-hora-detalle">${c.hora_inicio.slice(0,5)} - ${c.hora_fin.slice(0,5)}</div>
            </div>
            <span class="estado-badge estado-${c.estado}">${c.estado}</span>
          </div>
          <div class="cita-doctor">Dr. <strong>${c.doctor_nombre} ${c.doctor_apellido}</strong></div>
          <div class="cita-especialidad">${c.especialidad}</div>
          ${c.motivo ? `<div style="margin-top:10px;font-size:0.85rem;color:var(--texto-medio)">Motivo: ${c.motivo}</div>` : ''}
          <div class="cita-acciones">
            <button class="btn-accion cancelar" data-id="${c.id}" ${['cancelada','completada'].includes(c.estado) ? 'disabled' : ''}>Cancelar</button>
          </div>`;

        const cancelar = card.querySelector('.btn-accion.cancelar');
        cancelar.addEventListener('click', () => cancelarCita(c.id));
        contenedor.appendChild(card);
      });
    } catch (e) {
      contenedor.innerHTML = `<div class="cargando" style="color:var(--rosa-fuerte)">Error: ${e.message}</div>`;
    }
  }

  async function cancelarCita(id) {
    if (!confirm('Confirmas cancelar esta cita?')) return;

    try {
      await API.cancelarCita(id);
      await cargarMisCitas();
      if (doctorSeleccionado && fechaSeleccionada) {
        await cargarDisponibilidad();
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  function inicializar() {
    cargarDoctores();
    cargarMisCitas();

    document.getElementById('select-doctor').addEventListener('change', (e) => {
      doctorSeleccionado = doctores.find(d => String(d.id) === e.target.value) || null;
      cargarDisponibilidad();
    });

    Calendario.inicializar((fecha) => {
      fechaSeleccionada = fecha;
      cargarDisponibilidad();
    });

    document.getElementById('btn-agendar').addEventListener('click', agendarCita);
  }

  return { inicializar, cargarMisCitas };
})();
