/* =========================================================
   Telemedicina TFG - MySQL 8.x
   Charset: utf8mb4
   Engine : InnoDB
   ========================================================= */

DROP DATABASE IF EXISTS telemedicina_tfg;
CREATE DATABASE telemedicina_tfg
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE telemedicina_tfg;

SET sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
SET time_zone = '+00:00';

/* -------------------------
   1) Usuarios y roles
   ------------------------- */

CREATE TABLE users (
  id BIGINT NOT NULL AUTO_INCREMENT,
  dni VARCHAR(20) NOT NULL,
  email VARCHAR(255) NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_dni (dni)
) ENGINE=InnoDB;

CREATE TABLE roles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL, -- PACIENTE | DOCTOR | ADMIN
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB;

CREATE TABLE user_roles (
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_user_roles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_roles_role
    FOREIGN KEY (role_id) REFERENCES roles(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

/* -------------------------
   2) Perfiles: paciente / doctor
   ------------------------- */

CREATE TABLE patient_profiles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  birth_date DATE NULL,
  sex VARCHAR(20) NULL,
  notes TEXT NULL,
  chronic_flags JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_patient_user (user_id),
  CONSTRAINT fk_patient_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

/* ---- Categorías y especialidades (doctor) ---- */

CREATE TABLE professional_categories (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL, -- Médico, Enfermería, Psicología...
  description VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_professional_categories_name (name)
) ENGINE=InnoDB;

CREATE TABLE specialties (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL, -- Cardiología, Medicina de familia...
  category_id BIGINT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_specialties_name (name),
  KEY idx_specialties_category (category_id),
  CONSTRAINT fk_specialties_category
    FOREIGN KEY (category_id) REFERENCES professional_categories(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE professional_profiles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  category_id BIGINT NOT NULL,
  license_number VARCHAR(100) NOT NULL,
  workplace VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_professional_user (user_id),
  UNIQUE KEY uq_professional_license (license_number),
  KEY idx_professional_category (category_id),
  CONSTRAINT fk_professional_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_professional_category
    FOREIGN KEY (category_id) REFERENCES professional_categories(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE professional_specialties (
  professional_id BIGINT NOT NULL,
  specialty_id BIGINT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (professional_id, specialty_id),
  KEY idx_prof_spec_specialty (specialty_id),
  CONSTRAINT fk_prof_spec_prof
    FOREIGN KEY (professional_id) REFERENCES professional_profiles(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_prof_spec_spec
    FOREIGN KEY (specialty_id) REFERENCES specialties(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

/* -------------------------
   3) Consentimiento y auditoría
   ------------------------- */

CREATE TABLE consent_grants (
  id BIGINT NOT NULL AUTO_INCREMENT,
  patient_id BIGINT NOT NULL,
  professional_id BIGINT NOT NULL,
  scope JSON NOT NULL, -- ej: {"documents":true,"habits":false,"reports":true}
  expires_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_consent_patient (patient_id),
  KEY idx_consent_professional (professional_id),
  KEY idx_consent_expires (expires_at),
  CONSTRAINT fk_consent_patient
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_consent_professional
    FOREIGN KEY (professional_id) REFERENCES professional_profiles(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE access_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT NOT NULL,
  patient_id BIGINT NOT NULL,
  action VARCHAR(50) NOT NULL,     -- VIEW_DOC, VIEW_PROFILE...
  resource VARCHAR(255) NULL,      -- id o ruta del recurso
  ip VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_access_actor (actor_user_id),
  KEY idx_access_patient (patient_id),
  KEY idx_access_created (created_at),
  CONSTRAINT fk_access_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_access_patient
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

/* -------------------------
   4) Documentos + IA
   ------------------------- */

CREATE TABLE document_types (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL, -- receta, analítica, informe...
  PRIMARY KEY (id),
  UNIQUE KEY uq_document_types_name (name)
) ENGINE=InnoDB;

CREATE TABLE medical_documents (
  id BIGINT NOT NULL AUTO_INCREMENT,
  patient_id BIGINT NOT NULL,
  type_id BIGINT NOT NULL,
  file_url TEXT NOT NULL,
  file_hash CHAR(64) NULL,
  uploaded_by_user_id BIGINT NOT NULL,
  doc_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_docs_patient (patient_id),
  KEY idx_docs_type (type_id),
  KEY idx_docs_doc_date (doc_date),
  CONSTRAINT fk_docs_patient
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_docs_type
    FOREIGN KEY (type_id) REFERENCES document_types(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_docs_uploader
    FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE document_ai_results (
  id BIGINT NOT NULL AUTO_INCREMENT,
  document_id BIGINT NOT NULL,
  model_version VARCHAR(50) NOT NULL,
  classification VARCHAR(100) NOT NULL,
  entities JSON NULL,
  summary TEXT NULL,
  confidence DECIMAL(5,4) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ai_doc (document_id),
  KEY idx_ai_created (created_at),
  CONSTRAINT fk_ai_document
    FOREIGN KEY (document_id) REFERENCES medical_documents(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

/* -------------------------
   5) Hábitos / síntomas
   ------------------------- */

-- habit_logs removed from this location - see updated version below

/* -------------------------
   6) Teleconsulta (chat + video)
   ------------------------- */

CREATE TABLE consultations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  patient_id BIGINT NOT NULL,
  professional_id BIGINT NOT NULL,
  purpose VARCHAR(255) NOT NULL,
  started_at DATETIME NULL,
  ended_at DATETIME NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled', -- scheduled|active|closed|cancelled
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_consult_patient (patient_id),
  KEY idx_consult_professional (professional_id),
  KEY idx_consult_started (started_at),
  CONSTRAINT fk_consult_patient
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_consult_professional
    FOREIGN KEY (professional_id) REFERENCES professional_profiles(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE messages (
  id BIGINT NOT NULL AUTO_INCREMENT,
  consultation_id BIGINT NOT NULL,
  sender_user_id BIGINT NOT NULL,
  content TEXT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'text', -- text|file|system
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_msg_consult (consultation_id),
  KEY idx_msg_sender (sender_user_id),
  KEY idx_msg_created (created_at),
  CONSTRAINT fk_msg_consultation
    FOREIGN KEY (consultation_id) REFERENCES consultations(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_msg_sender
    FOREIGN KEY (sender_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE message_attachments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  message_id BIGINT NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NULL,
  size BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_attach_message (message_id),
  CONSTRAINT fk_attach_message
    FOREIGN KEY (message_id) REFERENCES messages(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE video_sessions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  consultation_id BIGINT NOT NULL,
  provider VARCHAR(50) NOT NULL,
  room_id VARCHAR(255) NOT NULL,
  join_url TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_video_consult (consultation_id),
  CONSTRAINT fk_video_consult
    FOREIGN KEY (consultation_id) REFERENCES consultations(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

/* -------------------------
   7) Reportes PDF + firma
   ------------------------- */

CREATE TABLE signatures (
  id BIGINT NOT NULL AUTO_INCREMENT,
  professional_id BIGINT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_signature_prof (professional_id),
  CONSTRAINT fk_signature_prof
    FOREIGN KEY (professional_id) REFERENCES professional_profiles(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE medical_reports (
  id BIGINT NOT NULL AUTO_INCREMENT,
  consultation_id BIGINT NULL,
  patient_id BIGINT NOT NULL,
  professional_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  body LONGTEXT NOT NULL, -- html/markdown
  pdf_url TEXT NULL,
  signature_id BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_report_consult (consultation_id),
  KEY idx_report_patient (patient_id),
  KEY idx_report_prof (professional_id),
  CONSTRAINT fk_report_consult
    FOREIGN KEY (consultation_id) REFERENCES consultations(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_report_patient
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_report_prof
    FOREIGN KEY (professional_id) REFERENCES professional_profiles(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_report_signature
    FOREIGN KEY (signature_id) REFERENCES signatures(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

/* -------------------------
   8) Riesgo temprano + recomendaciones
   ------------------------- */

CREATE TABLE risk_assessments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  patient_id BIGINT NOT NULL,
  score DECIMAL(6,2) NOT NULL,
  level VARCHAR(20) NOT NULL, -- bajo|medio|alto
  rationale JSON NULL,
  model_version VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_risk_patient (patient_id),
  KEY idx_risk_created (created_at),
  CONSTRAINT fk_risk_patient
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE recommendations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  risk_assessment_id BIGINT NOT NULL,
  category VARCHAR(100) NOT NULL,
  text TEXT NOT NULL,
  source_name VARCHAR(200) NULL,
  source_url TEXT NULL,
  source_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rec_risk (risk_assessment_id),
  CONSTRAINT fk_rec_risk
    FOREIGN KEY (risk_assessment_id) REFERENCES risk_assessments(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

/* -------------------------
   9) Medicación + recordatorios + notificaciones
   ------------------------- */

CREATE TABLE medication_plans (
  id BIGINT NOT NULL AUTO_INCREMENT,
  patient_id BIGINT NOT NULL,
  created_from_document_id BIGINT NULL,
  name VARCHAR(255) NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_plan_patient (patient_id),
  CONSTRAINT fk_plan_patient
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_plan_doc
    FOREIGN KEY (created_from_document_id) REFERENCES medical_documents(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE medication_items (
  id BIGINT NOT NULL AUTO_INCREMENT,
  plan_id BIGINT NOT NULL,
  drug_name VARCHAR(255) NOT NULL,
  dose VARCHAR(100) NOT NULL,
  frequency VARCHAR(100) NOT NULL,
  instructions VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_item_plan (plan_id),
  CONSTRAINT fk_item_plan
    FOREIGN KEY (plan_id) REFERENCES medication_plans(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE medication_reminders (
  id BIGINT NOT NULL AUTO_INCREMENT,
  item_id BIGINT NOT NULL,
  scheduled_at DATETIME NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'in_app', -- in_app|email|push
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|sent|failed|cancelled
  sent_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rem_item (item_id),
  KEY idx_rem_sched (scheduled_at),
  CONSTRAINT fk_rem_item
    FOREIGN KEY (item_id) REFERENCES medication_items(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE medication_alarms (
  id BIGINT NOT NULL AUTO_INCREMENT,
  patient_id BIGINT NOT NULL,
  medication_name VARCHAR(255) NOT NULL,
  dose VARCHAR(100) NOT NULL,
  frequency VARCHAR(50) NOT NULL DEFAULT 'daily',
  time TIME NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_alarm_patient (patient_id),
  CONSTRAINT fk_alarm_patient
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE appointments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  patient_id BIGINT NOT NULL,
  doctor_id BIGINT NULL,
  title VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  time TIME NULL,
  place VARCHAR(255) NULL,
  notes TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appt_patient (patient_id),
  KEY idx_appt_date (date),
  CONSTRAINT fk_appt_patient
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE habit_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  patient_id BIGINT NOT NULL,
  habit_type VARCHAR(50) NOT NULL, -- SLEEP|EXERCISE|NUTRITION|STRESS
  value DECIMAL(10, 2) NOT NULL,
  notes TEXT NULL,
  logged_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_habit_patient (patient_id),
  KEY idx_habit_date (logged_date),
  KEY idx_habit_type (habit_type),
  CONSTRAINT fk_habit_patient
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- reminder|system|risk|chat|...
  read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_user (user_id),
  KEY idx_notif_read (read_at),
  CONSTRAINT fk_notif_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;
