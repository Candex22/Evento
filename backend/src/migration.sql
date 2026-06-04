-- Migración: tabla usuario para PostgreSQL
-- Equivalente al esquema MySQL del proyecto PHP

CREATE TABLE IF NOT EXISTS usuario (
  id_user     SERIAL PRIMARY KEY,
  name_user   VARCHAR(50)  NOT NULL UNIQUE,
  nombre      VARCHAR(100) NOT NULL,
  apellido    VARCHAR(100) NOT NULL,
  correo_electronico VARCHAR(150) NOT NULL UNIQUE,
  contrasena  VARCHAR(255) NOT NULL,
  rol VARCHAR(20) NOT NULL DEFAULT 'mozo'
        CHECK (rol IN ('administrador', 'mozo', 'cajero', 'buffet'))
  estado      VARCHAR(20)  NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente', 'activo', 'inactivo')),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_usuario_correo  ON usuario (correo_electronico);
CREATE INDEX IF NOT EXISTS idx_usuario_estado  ON usuario (estado);
CREATE INDEX IF NOT EXISTS idx_usuario_rol     ON usuario (rol);

-- Usuario administrador de prueba
-- Contraseña: Admin1234  (bcrypt hash generado con saltRounds=10)
INSERT INTO usuario (name_user, nombre, apellido, correo_electronico, contrasena, rol, estado)
VALUES (
  'admin',
  'admin',
  'Sistema',
  'admin@evento.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: "password" (cambiar en producción)
  'administrador',
  'activo'
)
ON CONFLICT (name_user) DO NOTHING;