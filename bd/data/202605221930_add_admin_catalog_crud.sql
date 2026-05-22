/* =========================================================
   Migración: Catálogos administrables
   Fecha: 22-05-2026
   Descripción: Agrega catálogos de medicamentos y ubicaciones
   para que el administrador pueda gestionarlos desde la app.
   ========================================================= */

USE telemedicina_tfg;

CREATE TABLE IF NOT EXISTS medication_catalog (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_medication_catalog_slug (slug),
  UNIQUE KEY uq_medication_catalog_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS appointment_locations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_appointment_locations_slug (slug),
  UNIQUE KEY uq_appointment_locations_name (name)
) ENGINE=InnoDB;

INSERT IGNORE INTO medication_catalog (name, slug, description)
SELECT DISTINCT
  medication_name,
  LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(medication_name), ' ', '-'), 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o')),
  'Importado desde alarmas de medicación existentes'
FROM medication_alarms
WHERE medication_name IS NOT NULL AND TRIM(medication_name) <> '';

INSERT IGNORE INTO appointment_locations (name, slug, description)
SELECT DISTINCT
  place,
  LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(place), ' ', '-'), 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o')),
  'Importado desde citas existentes'
FROM appointments
WHERE place IS NOT NULL
  AND TRIM(place) <> ''
  AND TRIM(place) NOT LIKE 'http://%'
  AND TRIM(place) NOT LIKE 'https://%';
