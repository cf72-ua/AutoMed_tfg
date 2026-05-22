jest.mock('../dist/db/connection', () => ({
  getDatabase: jest.fn(),
}));

const { getDatabase } = require('../dist/db/connection');
const { AIRecommendationsService } = require('../dist/services/ai-recommendations.service');

describe('AIRecommendationsService', () => {
  let db;

  beforeEach(() => {
    db = {
      query: jest.fn(),
    };
    getDatabase.mockReturnValue(db);
  });

  test('genera una respuesta válida de recomendaciones desde hábitos del paciente', async () => {
    db.query.mockResolvedValueOnce([
      [
        { habitType: 'SLEEP', value: 7, loggedDate: '2026-05-20' },
        { habitType: 'EXERCISE', value: 20, loggedDate: '2026-05-20' },
        { habitType: 'STRESS', value: 2, loggedDate: '2026-05-21' },
      ],
    ]);

    const result = await AIRecommendationsService.generateFromPatientHabits(9);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM habit_logs'), [9]);
    expect(['BAJO', 'MEDIO', 'ALTO']).toContain(result.riskLevel);
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations.every((item) => typeof item === 'string')).toBe(true);
    expect(typeof result.summary).toBe('string');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});
