USE telemedicina_tfg;

CREATE TABLE IF NOT EXISTS consultations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  patient_id BIGINT NOT NULL,
  professional_id BIGINT NOT NULL,
  purpose VARCHAR(255) NOT NULL,
  started_at DATETIME NULL,
  ended_at DATETIME NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
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

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT NOT NULL AUTO_INCREMENT,
  consultation_id BIGINT NOT NULL,
  sender_user_id BIGINT NOT NULL,
  content TEXT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'text',
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
