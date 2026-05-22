const jwt = require('jsonwebtoken');

const { authenticateJWT, authorize } = require('../dist/middleware/auth.middleware');
const { requireRole } = require('../dist/middleware/role.middleware');

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('middlewares de autenticación y roles', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'unit-test-secret';
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  test('deniega acceso protegido si no hay token', () => {
    const req = { headers: {} };
    const res = mockResponse();
    const next = jest.fn();

    authenticateJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access token required' });
    expect(next).not.toHaveBeenCalled();
  });

  test('deniega acceso si el rol autenticado no está autorizado', () => {
    const token = jwt.sign(
      { userId: 15, dni: '12345678A', role: 'PACIENTE' },
      'unit-test-secret',
    );
    const req = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };
    const res = mockResponse();
    const next = jest.fn();

    authenticateJWT(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    requireRole(['DOCTOR'])(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Forbidden - Insufficient permissions',
      requiredRoles: ['DOCTOR'],
      userRoles: ['PACIENTE'],
    });
  });

  test('authorize permite un rol autorizado', () => {
    const req = {
      user: {
        id: 1,
        dni: '11111111A',
        fullName: 'Doctora Test',
        roles: ['DOCTOR'],
      },
    };
    const res = mockResponse();
    const next = jest.fn();

    authorize('DOCTOR')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
