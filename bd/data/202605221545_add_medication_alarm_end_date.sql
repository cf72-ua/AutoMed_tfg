ALTER TABLE medication_alarms
  ADD COLUMN end_date DATE NULL AFTER time;

UPDATE medication_alarms
SET end_date = DATE(created_at)
WHERE end_date IS NULL;

ALTER TABLE medication_alarms
  MODIFY COLUMN end_date DATE NOT NULL;
