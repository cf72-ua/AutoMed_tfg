/* =========================================================
   Migración: Limpiar URLs de ubicaciones
   Fecha: 22-05-2026
   Descripción: Elimina enlaces de Meet/videochat que se hubieran
   importado accidentalmente como ubicaciones administrables.
   ========================================================= */

USE telemedicina_tfg;

DELETE FROM appointment_locations
WHERE TRIM(name) LIKE 'http://%'
   OR TRIM(name) LIKE 'https://%';
