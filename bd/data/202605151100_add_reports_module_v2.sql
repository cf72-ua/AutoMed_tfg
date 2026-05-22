/* =========================================================
   Migración: Módulo de Reportes/Informes Médicos (REVISADA)
   Fecha: 15-05-2026
   Descripción: Agrega tablas para gestión de informes médicos
   con firma obligatoria, PDF generado y auditoría de accesos
   ========================================================= */

USE telemedicina_tfg;

/* -------------------------
   1) Tipos de Informes (Catálogo)
   ------------------------- */

CREATE TABLE IF NOT EXISTS report_types (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL, -- "Informe de Consulta", "Receta/Plan de Medicación", etc.
  slug VARCHAR(100) NOT NULL, -- "consultation-report", "medication-plan"
  description TEXT NULL,
  template_name VARCHAR(100) NOT NULL, -- nombre del template Handlebars
  required_fields JSON NULL, -- lista de campos obligatorios
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_report_types_slug (slug),
  UNIQUE KEY uq_report_types_name (name)
) ENGINE=InnoDB;

/* -------------------------
   2) Firmas Digitales de Profesionales
   ------------------------- */

CREATE TABLE IF NOT EXISTS professional_signatures (
  id BIGINT NOT NULL AUTO_INCREMENT,
  professional_id BIGINT NOT NULL,
  image_url TEXT NOT NULL, -- Path PNG de la firma
  image_hash CHAR(64) NULL, -- SHA256 para validar integridad
  name_printed VARCHAR(255) NOT NULL, -- Nombre a imprimir en la firma
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_prof_sig_prof (professional_id),
  KEY idx_prof_sig_active (is_active),
  CONSTRAINT fk_prof_sig_prof
    FOREIGN KEY (professional_id) REFERENCES professional_profiles(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

/* -------------------------
   3) ACTUALIZACIÓN: Ampliar tabla medical_reports con nuevas columnas
   ------------------------- */

-- Primero, eliminar las foreign keys existentes para poder modificar
ALTER TABLE medical_reports 
  DROP FOREIGN KEY fk_report_signature;

ALTER TABLE medical_reports
  DROP FOREIGN KEY fk_report_consult;

-- Agregar nuevas columnas
ALTER TABLE medical_reports 
  ADD COLUMN report_type_id BIGINT NOT NULL DEFAULT 1 AFTER consultation_id,
  ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'draft' AFTER body,
  ADD COLUMN signed_at DATETIME NULL AFTER signature_id,
  ADD COLUMN pdf_hash CHAR(64) NULL AFTER pdf_url,
  ADD COLUMN pdf_generated_at DATETIME NULL AFTER pdf_hash,
  ADD COLUMN metadata JSON NULL AFTER title;

-- Permitir informes no asociados a una consulta concreta
ALTER TABLE medical_reports
  MODIFY COLUMN consultation_id BIGINT NULL;

-- Crear índices para las nuevas columnas
ALTER TABLE medical_reports 
  ADD KEY idx_report_type (report_type_id),
  ADD KEY idx_report_status (status),
  ADD KEY idx_report_signed (signed_at);

-- Recrear la foreign key para signature_id
ALTER TABLE medical_reports 
  ADD CONSTRAINT fk_report_signature
    FOREIGN KEY (signature_id) REFERENCES professional_signatures(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Agregar nueva foreign key para report_type
ALTER TABLE medical_reports 
  ADD CONSTRAINT fk_report_type
    FOREIGN KEY (report_type_id) REFERENCES report_types(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Recrear la foreign key opcional para consultation_id
ALTER TABLE medical_reports
  ADD CONSTRAINT fk_report_consult
    FOREIGN KEY (consultation_id) REFERENCES consultations(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

/* -------------------------
   4) Historial de Cambios de Reportes (para auditoría)
   ------------------------- */

CREATE TABLE IF NOT EXISTS report_revisions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  report_id BIGINT NOT NULL,
  revision_number INT NOT NULL,
  body_snapshot LONGTEXT NOT NULL, -- Copia del contenido en esa versión
  metadata_snapshot JSON NULL,
  status_at_revision VARCHAR(30) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_report_revision (report_id, revision_number),
  KEY idx_revision_report (report_id),
  CONSTRAINT fk_revision_report
    FOREIGN KEY (report_id) REFERENCES medical_reports(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

/* -------------------------
   5) Auditoría de Accesos y Descargas (requerimiento crítico)
   ------------------------- */

CREATE TABLE IF NOT EXISTS report_access_audit (
  id BIGINT NOT NULL AUTO_INCREMENT,
  report_id BIGINT NOT NULL,
  actor_user_id BIGINT NOT NULL, -- Quién realizó la acción
  action VARCHAR(50) NOT NULL, -- VIEWED, DOWNLOADED, GENERATED, SIGNED, ARCHIVED
  ip_address VARCHAR(64) NULL,
  user_agent TEXT NULL,
  reason_notes TEXT NULL, -- Notas opcionales
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_report (report_id),
  KEY idx_audit_actor (actor_user_id),
  KEY idx_audit_action (action),
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_report
    FOREIGN KEY (report_id) REFERENCES medical_reports(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_audit_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

/* -------------------------
   6) Permisos de Acceso a Reportes
   (control granular de quién puede ver qué reporte)
   ------------------------- */

CREATE TABLE IF NOT EXISTS report_access_permissions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  report_id BIGINT NOT NULL,
  granted_to_user_id BIGINT NOT NULL,
  permission_type VARCHAR(50) NOT NULL, -- VIEW, DOWNLOAD, SIGN (si es firmante)
  expires_at DATETIME NULL,
  granted_by_user_id BIGINT NOT NULL, -- Quién otorgó el permiso
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_report_access (report_id, granted_to_user_id, permission_type),
  KEY idx_access_report (report_id),
  KEY idx_access_user (granted_to_user_id),
  KEY idx_access_expires (expires_at),
  CONSTRAINT fk_access_report
    FOREIGN KEY (report_id) REFERENCES medical_reports(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_access_user
    FOREIGN KEY (granted_to_user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_access_granted_by
    FOREIGN KEY (granted_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

/* =========================================================
   INSERCIÓN DE DATOS INICIALES (tipos de reportes)
   ========================================================= */

INSERT IGNORE INTO report_types (name, slug, description, template_name, required_fields) VALUES
  ('Informe de Consulta', 'consultation-report', 
   'Informe estándar generado después de una consulta médica', 
   'consultation-report.hbs',
   JSON_ARRAY('title', 'diagnosis', 'treatment_plan')),
   
  ('Receta/Plan de Medicación', 'medication-plan', 
   'Plan de medicación prescrito por el profesional', 
   'medication-plan.hbs',
   JSON_ARRAY('title', 'medications', 'duration')),
   
  ('Informe de Análisis', 'analysis-report', 
   'Informe de análisis de laboratorio o pruebas complementarias', 
   'analysis-report.hbs',
   JSON_ARRAY('title', 'analysis_type', 'results')),
   
  ('Parte de Baja Médica', 'medical-leave', 
   'Certificado de incapacidad temporal', 
   'medical-leave.hbs',
   JSON_ARRAY('title', 'start_date', 'end_date', 'reason'));
