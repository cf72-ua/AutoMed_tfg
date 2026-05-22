const mockReportAuditService = {
  logAction: jest.fn(),
};
const mockPdfGenerationService = {
  generateReportPDF: jest.fn(),
};

jest.mock('../dist/db/connection', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../dist/services/report-audit.service', () => ({
  ReportAuditService: jest.fn(() => mockReportAuditService),
}));

jest.mock('../dist/services/pdf-generation.service', () => ({
  PDFGenerationService: jest.fn(() => mockPdfGenerationService),
}));

const { getDatabase } = require('../dist/db/connection');
const { ReportService } = require('../dist/services/report.service');

function report(overrides = {}) {
  return {
    id: 42,
    reportTypeId: 1,
    reportTypeName: 'Informe',
    patientId: 3,
    professionalId: 7,
    consultationId: null,
    title: 'Informe de prueba',
    body: 'Contenido',
    metadata: null,
    status: 'draft',
    signatureId: null,
    signedAt: null,
    pdfUrl: null,
    pdfHash: null,
    pdfGeneratedAt: null,
    createdAt: new Date('2026-05-20T10:00:00Z'),
    updatedAt: new Date('2026-05-20T10:00:00Z'),
    ...overrides,
  };
}

describe('ReportService', () => {
  let connection;

  beforeEach(() => {
    connection = {
      query: jest.fn(),
      release: jest.fn(),
    };
    getDatabase.mockReturnValue({
      getConnection: jest.fn().mockResolvedValue(connection),
    });
    mockReportAuditService.logAction.mockResolvedValue(undefined);
    mockPdfGenerationService.generateReportPDF.mockResolvedValue({
      pdfPath: '/reports/report-42.pdf',
      fileName: 'report-42.pdf',
    });
  });

  test('crea un borrador y audita la generación', async () => {
    connection.query.mockResolvedValueOnce([{ insertId: 42 }]);
    const service = new ReportService();
    jest.spyOn(service, 'getUserProfessionalId').mockResolvedValue(7);
    jest.spyOn(service, 'getReportById').mockResolvedValue(report());

    const result = await service.createReport(
      3,
      11,
      {
        reportTypeId: 1,
        title: 'Informe de prueba',
        body: 'Contenido',
      },
      '127.0.0.1',
      'jest',
    );

    expect(connection.query).toHaveBeenCalledWith(
      expect.stringContaining("VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')"),
      [1, 3, 7, null, 'Informe de prueba', 'Contenido', null],
    );
    expect(mockReportAuditService.logAction).toHaveBeenCalledWith(
      42,
      11,
      'GENERATED',
      '127.0.0.1',
      'jest',
      'Reporte creado en estado borrador',
    );
    expect(result.status).toBe('draft');
  });

  test('firma un informe, genera PDF y audita la firma', async () => {
    const service = new ReportService();
    jest.spyOn(service, 'getUserProfessionalId').mockResolvedValue(7);
    jest
      .spyOn(service, 'getReportById')
      .mockResolvedValueOnce(report())
      .mockResolvedValueOnce(
        report({
          status: 'signed',
          signatureId: 99,
          pdfUrl: '/reports/report-42.pdf',
        }),
      );
    jest.spyOn(service, 'getProfessionalSignature').mockResolvedValue({
      id: 99,
      professional_id: 7,
    });

    const result = await service.signReport(
      42,
      11,
      { signatureId: 99 },
      '127.0.0.1',
      'jest',
    );

    expect(mockPdfGenerationService.generateReportPDF).toHaveBeenCalledWith(42);
    expect(connection.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'signed'"),
      ['/reports/report-42.pdf', expect.any(String), 42],
    );
    expect(mockReportAuditService.logAction).toHaveBeenCalledWith(
      42,
      11,
      'SIGNED',
      '127.0.0.1',
      'jest',
      'Reporte firmado y PDF generado',
    );
    expect(result).toMatchObject({
      status: 'signed',
      pdfUrl: '/reports/report-42.pdf',
    });
  });

  test('descarga un PDF y audita el acceso', async () => {
    const service = new ReportService();
    jest.spyOn(service, 'getReportById').mockResolvedValue(
      report({
        status: 'signed',
        pdfUrl: '/reports/report-42.pdf',
      }),
    );
    jest.spyOn(service, 'verifyAccessPermission').mockResolvedValue(undefined);

    const pdfUrl = await service.downloadReport(
      42,
      11,
      '127.0.0.1',
      'jest',
    );

    expect(pdfUrl).toBe('/reports/report-42.pdf');
    expect(mockReportAuditService.logAction).toHaveBeenCalledWith(
      42,
      11,
      'DOWNLOADED',
      '127.0.0.1',
      'jest',
      'PDF descargado',
    );
  });
});
