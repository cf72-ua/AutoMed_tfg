jest.mock('../dist/db/connection', () => ({
  getDatabase: jest.fn(),
}));

const { getDatabase } = require('../dist/db/connection');
const { MedicationsService } = require('../dist/services/medications.service');

describe('MedicationsService', () => {
  let db;

  beforeEach(() => {
    db = {
      query: jest.fn(),
    };
    getDatabase.mockReturnValue(db);
  });

  test('crea una alarma de medicación con fecha final', async () => {
    const createdAlarm = {
      id: 9,
      patientId: 2,
      medicationName: 'Ibuprofeno',
      dose: '200 mg',
      frequency: 'daily',
      time: '09:00',
      endDate: '2026-05-30',
    };

    db.query
      .mockResolvedValueOnce([{ insertId: 9 }])
      .mockResolvedValueOnce([[createdAlarm]]);

    const result = await new MedicationsService().createMedicationAlarm({
      patientId: 2,
      medicationName: 'Ibuprofeno',
      dose: '200 mg',
      frequency: 'daily',
      time: '09:00',
      endDate: '2026-05-30',
    });

    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO medication_alarms'),
      [2, 'Ibuprofeno', '200 mg', 'daily', '09:00', '2026-05-30', null],
    );
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("DATE_FORMAT(end_date, '%Y-%m-%d') as endDate"),
      [9],
    );
    expect(result).toEqual(createdAlarm);
  });
});
