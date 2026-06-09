// Modulo principal de la aplicacion.
// Maneja la sesion del usuario, decide que pantalla mostrar
// y coordina la navegacion entre secciones del paciente.

(function () {
  // Datos del usuario autenticado guardados en sessionStorage
  let sesion = null;

  // Muestra una sola pantalla y oculta las demas
  function mostrarPantalla(id) {
    document.querySelectorAll('.pantalla').forEach(p => {
      p.classList.remove('activa');
      p.classList.add('oculto');
    });
    const pantalla = document.getElementById(id);
    if (pantalla) {
      pantalla.classList.remove('oculto');
      pantalla.classList.add('activa');
    }
  }

  // Lee la sesion guardada y redirige a la pantalla correcta
  function iniciarSesionGuardada() {
    const tokenGuardado   = sessionStorage.getItem('clr_token');
    const usuarioGuardado = sessionStorage.getItem('clr_usuario');

    if (tokenGuardado && usuarioGuardado) {
      try {
        sesion = JSON.parse(usuarioGuardado);
        abrirApp();
      } catch {
        cerrarSesion();
      }
    } else {
      // Sin sesion activa muestra la landing page
      mostrarPantalla('pantalla-landing');
    }
  }

  // Decide la pantalla segun el rol y carga los datos iniciales
  function abrirApp() {
    if (sesion.rol_id === 1) {
      // Panel administrador
      document.getElementById('nombre-admin-nav').textContent = sesion.nombre;
      mostrarPantalla('pantalla-admin');
      Admin.inicializar();
    } else {
      // Panel paciente
      document.getElementById('nombre-usuario-nav').textContent = sesion.nombre;
      mostrarPantalla('pantalla-principal');
      Citas.inicializar();
    }
  }

  function cerrarSesion() {
    sessionStorage.removeItem('clr_token');
    sessionStorage.removeItem('clr_usuario');
    sesion = null;
    mostrarPantalla('pantalla-landing');
    document.getElementById('login-email').value    = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').classList.add('oculto');
  }

  // ========== LANDING PAGE ==========

  // Los tres botones de la landing redirigen a la pantalla de auth
  // btn-landing-entrar y btn-landing-agendar abren directamente el login
  // btn-landing-cta abre directamente el registro
  // btn-landing-saber hace scroll suave a la seccion "como funciona"

  document.getElementById('btn-landing-entrar').addEventListener('click', () => {
    cambiarALogin();
    mostrarPantalla('pantalla-auth');
  });

  document.getElementById('btn-landing-agendar').addEventListener('click', () => {
    cambiarALogin();
    mostrarPantalla('pantalla-auth');
  });

  document.getElementById('btn-landing-cta').addEventListener('click', () => {
    cambiarARegistro();
    mostrarPantalla('pantalla-auth');
  });

  document.getElementById('btn-landing-saber').addEventListener('click', () => {
    document.getElementById('como-funciona').scrollIntoView({ behavior: 'smooth' });
  });

  // ========== AUTENTICACION ==========

  document.getElementById('btn-login').addEventListener('click', async () => {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    const btn      = document.getElementById('btn-login');

    errEl.classList.add('oculto');

    if (!email || !password) {
      errEl.textContent = 'Completa todos los campos';
      errEl.classList.remove('oculto');
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Ingresando...';

    try {
      const resp = await API.login(email, password);
      sessionStorage.setItem('clr_token',  resp.token);
      sessionStorage.setItem('clr_usuario', JSON.stringify(resp.usuario));
      sesion = resp.usuario;
      abrirApp();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('oculto');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Entrar';
    }
  });

  // Permite enviar el login con Enter
  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-login').click();
  });

  document.getElementById('btn-registro').addEventListener('click', async () => {
    const nombre   = document.getElementById('reg-nombre').value.trim();
    const apellido = document.getElementById('reg-apellido').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const tel      = document.getElementById('reg-telefono').value.trim();
    const password = document.getElementById('reg-password').value;
    const errEl    = document.getElementById('reg-error');
    const okEl     = document.getElementById('reg-exito');
    const btn      = document.getElementById('btn-registro');

    errEl.classList.add('oculto');
    okEl.classList.add('oculto');

    if (!nombre || !apellido || !email || !password) {
      errEl.textContent = 'Nombre, apellido, correo y contrasena son obligatorios';
      errEl.classList.remove('oculto');
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Registrando...';

    try {
      await API.registro({ nombre, apellido, email, password, telefono: tel || undefined });
      okEl.textContent = 'Cuenta creada. Ahora puedes iniciar sesion.';
      okEl.classList.remove('oculto');

      // Limpia el formulario y muestra login tras 2 segundos
      setTimeout(() => {
        document.getElementById('reg-nombre').value    = '';
        document.getElementById('reg-apellido').value  = '';
        document.getElementById('reg-email').value     = '';
        document.getElementById('reg-telefono').value  = '';
        document.getElementById('reg-password').value  = '';
        okEl.classList.add('oculto');
        cambiarALogin();
      }, 2000);
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('oculto');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Crear cuenta';
    }
  });

  // ========== ALTERNANCIA LOGIN / REGISTRO ==========

  function cambiarALogin() {
    document.getElementById('form-login').classList.remove('oculto');
    document.getElementById('form-registro').classList.add('oculto');
  }

  function cambiarARegistro() {
    document.getElementById('form-login').classList.add('oculto');
    document.getElementById('form-registro').classList.remove('oculto');
  }

  document.getElementById('btn-ir-registro').addEventListener('click', cambiarARegistro);
  document.getElementById('btn-ir-login').addEventListener('click', cambiarALogin);

  // ========== NAVEGACION PACIENTE ==========

  document.querySelectorAll('[data-seccion]').forEach(btn => {
    btn.addEventListener('click', () => {
      const objetivo = btn.dataset.seccion;

      document.querySelectorAll('[data-seccion]').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');

      document.querySelectorAll('#pantalla-principal .seccion').forEach(s => {
        s.classList.remove('activa');
        s.classList.add('oculto');
      });

      const seccion = document.getElementById('seccion-' + objetivo);
      if (seccion) {
        seccion.classList.remove('oculto');
        seccion.classList.add('activa');
      }

      // Recarga citas al navegar a esa seccion
      if (objetivo === 'mis-citas') {
        Citas.cargarMisCitas();
      }
    });
  });

  // ========== CERRAR SESION ==========

  document.getElementById('btn-logout').addEventListener('click', cerrarSesion);
  document.getElementById('btn-logout-admin').addEventListener('click', cerrarSesion);

  // ========== ARRANQUE ==========

  iniciarSesionGuardada();

})();