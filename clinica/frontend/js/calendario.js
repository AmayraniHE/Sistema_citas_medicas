// Modulo del calendario interactivo.
// Renderiza una grilla mensual y permite seleccionar fechas a partir de hoy.

const Calendario = (() => {
  let anio    = new Date().getFullYear();
  let mes     = new Date().getMonth();  // 0-indexado
  let fechaSeleccionada = null;
  let callbackSeleccion = null;

  // Nombres de meses en español
  const MESES = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];

  // Dibuja la tabla de dias del mes actual en #cal-grid
  function renderizar() {
    const grid    = document.getElementById('cal-grid');
    const titulo  = document.getElementById('cal-titulo-mes');
    if (!grid || !titulo) return;

    titulo.textContent = `${MESES[mes]} ${anio}`;
    grid.innerHTML = '';

    const hoy         = new Date(); hoy.setHours(0,0,0,0);
    const primerDia   = new Date(anio, mes, 1).getDay();  // 0=dom
    const diasEnMes   = new Date(anio, mes + 1, 0).getDate();
    const diasMesAnt  = new Date(anio, mes, 0).getDate();

    // Dias del mes anterior para completar la primera semana
    for (let i = primerDia - 1; i >= 0; i--) {
      const el = document.createElement('div');
      el.className = 'cal-dia otro-mes inactivo';
      el.textContent = diasMesAnt - i;
      grid.appendChild(el);
    }

    // Dias del mes actual
    for (let d = 1; d <= diasEnMes; d++) {
      const fecha  = new Date(anio, mes, d);
      const el     = document.createElement('div');
      const clases = ['cal-dia'];

      if (fecha < hoy)  clases.push('pasado');
      if (fecha.getTime() === hoy.getTime()) clases.push('hoy');

      // Marca el dia seleccionado si coincide
      if (fechaSeleccionada) {
        const [sy, sm, sd] = fechaSeleccionada.split('-').map(Number);
        if (anio === sy && mes === sm - 1 && d === sd) {
          clases.push('seleccionado');
        }
      }

      el.className  = clases.join(' ');
      el.textContent = d;

      if (!clases.includes('pasado')) {
        el.addEventListener('click', () => seleccionarDia(d));
      }

      grid.appendChild(el);
    }

    // Dias del mes siguiente para completar la ultima fila
    const totalCeldas = grid.children.length;
    const restantes   = totalCeldas % 7 === 0 ? 0 : 7 - (totalCeldas % 7);
    for (let i = 1; i <= restantes; i++) {
      const el = document.createElement('div');
      el.className = 'cal-dia otro-mes inactivo';
      el.textContent = i;
      grid.appendChild(el);
    }
  }

  // Formatea un dia a YYYY-MM-DD con ceros a la izquierda
  function formatearFecha(y, m, d) {
    return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  function seleccionarDia(d) {
    fechaSeleccionada = formatearFecha(anio, mes, d);
    renderizar();
    if (typeof callbackSeleccion === 'function') {
      callbackSeleccion(fechaSeleccionada);
    }
  }

  function inicializar(onSeleccion) {
    callbackSeleccion = onSeleccion;

    document.getElementById('cal-prev').addEventListener('click', () => {
      mes--;
      if (mes < 0) { mes = 11; anio--; }
      renderizar();
    });

    document.getElementById('cal-next').addEventListener('click', () => {
      mes++;
      if (mes > 11) { mes = 0; anio++; }
      renderizar();
    });

    renderizar();
  }

  function reiniciar() {
    fechaSeleccionada = null;
    anio = new Date().getFullYear();
    mes  = new Date().getMonth();
    renderizar();
  }

  return { inicializar, reiniciar, getFecha: () => fechaSeleccionada };
})();