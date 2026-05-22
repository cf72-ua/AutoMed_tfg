jest.mock('../dist/db/connection', () => ({
  getDatabase: jest.fn(),
}));

const { getDatabase } = require('../dist/db/connection');
const { AppointmentsService } = require('../dist/services/appointments.service');

describe('AppointmentsService', () => {
  let db;

  beforeEach(() => {
    db = {
      query: jest.fn(),
    };
    getDatabase.mockReturnValue(db);
  });

  test('crea una cita conservando la fecha seleccionada como YYYY-MM-DD', async () => {
    const createdAppointment = {
      id: 7,
      patientId: 2,
      doctorId: 4,
      title: 'Cita médica',
      date: '2026-05-22',
      time: '10:30',
      place: 'Consulta 1',
      notes: 'Primera visita',
    };

    db.query
      .mockResolvedValueOnce([{ insertId: 7 }])
      .mockResolvedValueOnce([[createdAppointment]]);

    const result = await new AppointmentsService().createAppointment({
      patientId: 2,
      doctorId: 4,
      title: 'Cita médica',
      date: '2026-05-22',
      time: '10:30',
      place: 'Consulta 1',
      notes: 'Primera visita',
    });

    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO appointments'),
      [2, 4, 'Cita médica', '2026-05-22', '10:30', 'Consulta 1', 'Primera visita', 'scheduled'],
    );
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("DATE_FORMAT(date, '%Y-%m-%d') as date"),
      [7],
    );
    expect(result).toEqual(createdAppointment);
  });
});
