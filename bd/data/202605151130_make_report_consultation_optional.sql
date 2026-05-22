/* -------------------------
   Permitir reportes sin consulta asociada
   ------------------------- */

ALTER TABLE medical_reports
  DROP FOREIGN KEY fk_report_consult;

ALTER TABLE medical_reports
  MODIFY COLUMN consultation_id BIGINT NULL;

ALTER TABLE medical_reports
  ADD CONSTRAINT fk_report_consult
    FOREIGN KEY (consultation_id) REFERENCES consultations(id)
    ON DELETE SET NULL ON UPDATE CASCADE;
