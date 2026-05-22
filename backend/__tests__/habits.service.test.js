jest.mock('../dist/db/connection', () => ({
  getDatabase: jest.fn(),
}));

const { getDatabase } = require('../dist/db/connection');
const { HabitsService } = require('../dist/services/habits.service');

describe('HabitsService', () => {
  let db;

  beforeEach(() => {
    db = {
      query: jest.fn(),
    };
    getDatabase.mockReturnValue(db);
  });

  test('crea un registro de hábito', async () => {
    const createdHabit = {
      id: 5,
      patientId: 2,
      habitType: 'SLEEP',
      value: 7.5,
      notes: 'Dormí bien',
      loggedDate: '2026-05-20',
    };
    db.query
      .mockResolvedValueOnce([{ insertId: 5 }])
      .mockResolvedValueOnce([[createdHabit]]);

    const result = await new HabitsService().createHabitLog({
      patientId: 2,
      habitType: 'SLEEP',
      value: 7.5,
      notes: 'Dormí bien',
      loggedDate: '2026-05-20',
    });

    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO habit_logs'),
      [2, 'SLEEP', 7.5, 'Dormí bien', '2026-05-20'],
    );
    expect(result).toEqual(createdHabit);
  });

  test('recupera hábitos por tipo dentro de un rango de fechas', async () => {
    const rows = [
      { id: 1, patientId: 2, habitType: 'EXERCISE', value: 30, loggedDate: '2026-05-18' },
      { id: 2, patientId: 2, habitType: 'EXERCISE', value: 45, loggedDate: '2026-05-19' },
    ];
    db.query.mockResolvedValueOnce([rows]);

    const result = await new HabitsService().getHabitsByType(
      2,
      'EXERCISE',
      '2026-05-18',
      '2026-05-21',
    );

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('logged_date >= ? AND logged_date <= ?'),
      [2, 'EXERCISE', '2026-05-18', '2026-05-21'],
    );
    expect(result).toEqual(rows);
  });
});
