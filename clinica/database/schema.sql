-- Clinica Los Reyes - Esquema de base de datos
-- Contiene tablas para usuarios, doctores, horarios y citas

CREATE DATABASE IF NOT EXISTS clinica_los_reyes
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE clinica_los_reyes;

-- Tabla de roles del sistema (admin y paciente)
CREATE TABLE roles (
  id         INT          NOT NULL AUTO_INCREMENT,
  nombre     VARCHAR(50)  NOT NULL UNIQUE,
  PRIMARY KEY (id)
);

-- Tabla de usuarios registrados en el sistema
CREATE TABLE usuarios (
  id              INT           NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(100)  NOT NULL,
  apellido        VARCHAR(100)  NOT NULL,
  email           VARCHAR(150)  NOT NULL UNIQUE,
  password_hash   VARCHAR(255)  NOT NULL,
  telefono        VARCHAR(20)   NULL,
  fecha_registro  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activo          TINYINT(1)    NOT NULL DEFAULT 1,
  rol_id          INT           NOT NULL DEFAULT 2,
  PRIMARY KEY (id),
  FOREIGN KEY (rol_id) REFERENCES roles(id)
);

-- Tabla de especialidades medicas disponibles
CREATE TABLE especialidades (
  id      INT          NOT NULL AUTO_INCREMENT,
  nombre  VARCHAR(100) NOT NULL UNIQUE,
  PRIMARY KEY (id)
);

-- Tabla de doctores que trabajan en la clinica
CREATE TABLE doctores (
  id              INT           NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(100)  NOT NULL,
  apellido        VARCHAR(100)  NOT NULL,
  cedula          VARCHAR(50)   NOT NULL UNIQUE,
  especialidad_id INT           NOT NULL,
  activo          TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  FOREIGN KEY (especialidad_id) REFERENCES especialidades(id)
);

-- Tabla de bloques de horario disponibles por doctor
-- Cada fila representa un turno asignable (no solapado entre doctores)
CREATE TABLE horarios (
  id           INT          NOT NULL AUTO_INCREMENT,
  doctor_id    INT          NOT NULL,
  dia_semana   TINYINT      NOT NULL COMMENT '0=Domingo 1=Lunes ... 6=Sabado',
  hora_inicio  TIME         NOT NULL,
  hora_fin     TIME         NOT NULL,
  activo       TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  FOREIGN KEY (doctor_id) REFERENCES doctores(id),
  -- Evita que el mismo doctor tenga dos bloques solapados el mismo dia
  UNIQUE KEY uk_doctor_dia_inicio (doctor_id, dia_semana, hora_inicio)
);

-- Tabla principal de citas agendadas
CREATE TABLE citas (
  id            INT           NOT NULL AUTO_INCREMENT,
  usuario_id    INT           NOT NULL,
  doctor_id     INT           NOT NULL,
  horario_id    INT           NOT NULL,
  fecha         DATE          NOT NULL,
  motivo        TEXT          NULL,
  estado        ENUM('pendiente','confirmada','cancelada','reprogramada','completada')
                NOT NULL DEFAULT 'pendiente',
  fecha_creacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
  notas_admin   TEXT          NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id),
  FOREIGN KEY (doctor_id)   REFERENCES doctores(id),
  FOREIGN KEY (horario_id)  REFERENCES horarios(id),
  -- Restriccion critica: impide doble reservacion en el mismo slot
  UNIQUE KEY uk_doctor_fecha_horario (doctor_id, fecha, horario_id)
);

-- Tabla de log de cambios en citas (auditoria)
CREATE TABLE historial_citas (
  id             INT       NOT NULL AUTO_INCREMENT,
  cita_id        INT       NOT NULL,
  estado_anterior ENUM('pendiente','confirmada','cancelada','reprogramada','completada') NULL,
  estado_nuevo   ENUM('pendiente','confirmada','cancelada','reprogramada','completada') NOT NULL,
  modificado_por INT       NOT NULL,
  fecha          DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  observacion    TEXT      NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (cita_id)        REFERENCES citas(id),
  FOREIGN KEY (modificado_por) REFERENCES usuarios(id)
);

-- =============================================================
-- Datos iniciales
-- =============================================================

INSERT INTO roles (nombre) VALUES ('admin'), ('paciente');

INSERT INTO especialidades (nombre) VALUES
  ('Medicina General'),
  ('Pediatria'),
  ('Urgencias');

INSERT INTO doctores (nombre, apellido, cedula, especialidad_id) VALUES
  ('Carlos',   'Ramirez',  'MED-001', 1),
  ('Sofia',    'Mendoza',  'MED-002', 1),
  ('Andres',   'Torres',   'MED-003', 2),
  ('Daniela',  'Fuentes',  'MED-004', 3);

-- Doctor 1: turno matutino L-V
INSERT INTO horarios (doctor_id, dia_semana, hora_inicio, hora_fin) VALUES
  (1, 1, '08:00:00', '08:30:00'), (1, 1, '08:30:00', '09:00:00'),
  (1, 1, '09:00:00', '09:30:00'), (1, 1, '09:30:00', '10:00:00'),
  (1, 1, '10:00:00', '10:30:00'), (1, 1, '10:30:00', '11:00:00'),
  (1, 1, '11:00:00', '11:30:00'), (1, 1, '11:30:00', '12:00:00'),
  (1, 2, '08:00:00', '08:30:00'), (1, 2, '08:30:00', '09:00:00'),
  (1, 2, '09:00:00', '09:30:00'), (1, 2, '09:30:00', '10:00:00'),
  (1, 2, '10:00:00', '10:30:00'), (1, 2, '10:30:00', '11:00:00'),
  (1, 2, '11:00:00', '11:30:00'), (1, 2, '11:30:00', '12:00:00'),
  (1, 3, '08:00:00', '08:30:00'), (1, 3, '08:30:00', '09:00:00'),
  (1, 3, '09:00:00', '09:30:00'), (1, 3, '09:30:00', '10:00:00'),
  (1, 4, '08:00:00', '08:30:00'), (1, 4, '08:30:00', '09:00:00'),
  (1, 5, '08:00:00', '08:30:00'), (1, 5, '08:30:00', '09:00:00');

-- Doctor 2: turno vespertino L-V
INSERT INTO horarios (doctor_id, dia_semana, hora_inicio, hora_fin) VALUES
  (2, 1, '14:00:00', '14:30:00'), (2, 1, '14:30:00', '15:00:00'),
  (2, 1, '15:00:00', '15:30:00'), (2, 1, '15:30:00', '16:00:00'),
  (2, 1, '16:00:00', '16:30:00'), (2, 1, '16:30:00', '17:00:00'),
  (2, 2, '14:00:00', '14:30:00'), (2, 2, '14:30:00', '15:00:00'),
  (2, 2, '15:00:00', '15:30:00'), (2, 2, '15:30:00', '16:00:00'),
  (2, 3, '14:00:00', '14:30:00'), (2, 3, '14:30:00', '15:00:00'),
  (2, 4, '14:00:00', '14:30:00'), (2, 4, '14:30:00', '15:00:00'),
  (2, 5, '14:00:00', '14:30:00'), (2, 5, '14:30:00', '15:00:00');

-- Doctor 3: turno nocturno diario
INSERT INTO horarios (doctor_id, dia_semana, hora_inicio, hora_fin) VALUES
  (3, 0, '20:00:00', '20:30:00'), (3, 0, '20:30:00', '21:00:00'),
  (3, 0, '21:00:00', '21:30:00'), (3, 0, '21:30:00', '22:00:00'),
  (3, 1, '20:00:00', '20:30:00'), (3, 1, '20:30:00', '21:00:00'),
  (3, 1, '21:00:00', '21:30:00'), (3, 1, '21:30:00', '22:00:00'),
  (3, 2, '20:00:00', '20:30:00'), (3, 2, '20:30:00', '21:00:00'),
  (3, 3, '20:00:00', '20:30:00'), (3, 3, '20:30:00', '21:00:00'),
  (3, 4, '20:00:00', '20:30:00'), (3, 4, '20:30:00', '21:00:00'),
  (3, 5, '20:00:00', '20:30:00'), (3, 5, '20:30:00', '21:00:00'),
  (3, 6, '20:00:00', '20:30:00'), (3, 6, '20:30:00', '21:00:00');

-- Doctor 4: urgencias madrugada todos los dias
INSERT INTO horarios (doctor_id, dia_semana, hora_inicio, hora_fin) VALUES
  (4, 0, '22:00:00', '22:30:00'), (4, 0, '22:30:00', '23:00:00'),
  (4, 0, '23:00:00', '23:30:00'), (4, 0, '23:30:00', '00:00:00'),
  (4, 1, '00:00:00', '00:30:00'), (4, 1, '00:30:00', '01:00:00'),
  (4, 1, '01:00:00', '01:30:00'), (4, 1, '01:30:00', '02:00:00'),
  (4, 1, '22:00:00', '22:30:00'), (4, 1, '22:30:00', '23:00:00'),
  (4, 2, '00:00:00', '00:30:00'), (4, 2, '00:30:00', '01:00:00'),
  (4, 2, '22:00:00', '22:30:00'), (4, 2, '22:30:00', '23:00:00'),
  (4, 3, '00:00:00', '00:30:00'), (4, 3, '00:30:00', '01:00:00'),
  (4, 3, '22:00:00', '22:30:00'), (4, 3, '22:30:00', '23:00:00'),
  (4, 4, '00:00:00', '00:30:00'), (4, 4, '00:30:00', '01:00:00'),
  (4, 4, '22:00:00', '22:30:00'), (4, 4, '22:30:00', '23:00:00'),
  (4, 5, '00:00:00', '00:30:00'), (4, 5, '00:30:00', '01:00:00'),
  (4, 5, '22:00:00', '22:30:00'), (4, 5, '22:30:00', '23:00:00'),
  (4, 6, '00:00:00', '00:30:00'), (4, 6, '00:30:00', '01:00:00'),
  (4, 6, '22:00:00', '22:30:00'), (4, 6, '22:30:00', '23:00:00');

-- Usuario administrador por defecto (password: Admin123!)
INSERT INTO usuarios (nombre, apellido, email, password_hash, rol_id) VALUES
  ('Admin', 'Sistema', 'admin@clinicalosreyes.com',
   '$2b$10$placeholder_hash_replace_on_first_run', 1);
