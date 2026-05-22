const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

jest.mock('../dist/db/connection', () => ({
  getDatabase: jest.fn(),
}));

const { getDatabase } = require('../dist/db/connection');
const { AuthService } = require('../dist/services/auth.service');

describe('AuthService', () => {
  const originalSecret = process.env.JWT_SECRET;
  let db;

  beforeEach(() => {
    process.env.JWT_SECRET = 'unit-test-secret';
    db = {
      query: jest.fn(),
    };
    getDatabase.mockReturnValue(db);
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  test('login correcto emite un JWT con datos del usuario y paciente', async () => {
    const passwordHash = bcrypt.hashSync('correct-password', 10);
    db.query
      .mockResolvedValueOnce([
        [
          {
            id: 12,
            dni: '12345678A',
            password_hash: passwordHash,
            full_name: 'Ana Paciente',
            email: 'ana@example.test',
            phone: '600000000',
            status: 'active',
            role: 'PACIENTE',
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            id: 12,
            dni: '12345678A',
            email: 'ana@example.test',
            full_name: 'Ana Paciente',
            phone: '600000000',
            status: 'active',
          },
        ],
      ])
      .mockResolvedValueOnce([[{ id: 33 }]]);

    const result = await new AuthService().login({
      dni: '12345678A',
      password: 'correct-password',
    });

    expect(result.user).toMatchObject({ id: 12, dni: '12345678A' });
    expect(typeof result.token).toBe('string');

    const payload = jwt.verify(result.token, 'unit-test-secret');
    expect(payload).toMatchObject({
      userId: 12,
      patientId: 33,
      dni: '12345678A',
      role: 'PACIENTE',
    });
  });

  test('login incorrecto rechaza credenciales sin emitir token', async () => {
    const passwordHash = bcrypt.hashSync('correct-password', 10);
    db.query.mockResolvedValueOnce([
      [
        {
          id: 12,
          dni: '12345678A',
          password_hash: passwordHash,
          role: 'PACIENTE',
        },
      ],
    ]);

    await expect(
      new AuthService().login({
        dni: '12345678A',
        password: 'wrong-password',
      }),
    ).rejects.toThrow('DNI o contraseña incorrectos');

    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
