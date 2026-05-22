import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ReportListItem, ReportsService } from '../../core/services/reports.service';
import { ReportsListComponent } from './reports-list.component';

function makeReport(id: number, overrides: Partial<ReportListItem> = {}): ReportListItem {
  return {
    id,
    reportTypeId: id % 2 === 0 ? 2 : 1,
    title: `Informe ${id}`,
    reportTypeName: id % 2 === 0 ? 'Analítica' : 'Alta',
    status: id % 3 === 0 ? 'signed' : 'draft',
    patientName: id % 2 === 0 ? 'Paciente B' : 'Paciente A',
    professionalName: id % 2 === 0 ? 'Dra. Beta' : 'Dr. Alfa',
    createdAt: new Date('2026-05-20T10:00:00'),
    signedAt: null,
    pdfUrl: null,
    ...overrides,
  };
}

describe('ReportsListComponent', () => {
  let fixture: ComponentFixture<ReportsListComponent>;
  let component: ReportsListComponent;
  let reportsService: jasmine.SpyObj<ReportsService>;

  beforeEach(async () => {
    reportsService = jasmine.createSpyObj<ReportsService>('ReportsService', [
      'getReportTypes',
      'listReports',
      'listPatientReports',
      'downloadReportPDF',
    ]);

    reportsService.getReportTypes.and.returnValue(of([]));
    reportsService.listReports.and.returnValue(of(Array.from({ length: 12 }, (_, i) => makeReport(i + 1))));
    reportsService.listPatientReports.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [ReportsListComponent],
      providers: [
        { provide: ReportsService, useValue: reportsService },
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate']) },
        { provide: ActivatedRoute, useValue: {} },
        { provide: AuthService, useValue: { getRole: () => signal('PACIENTE') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('envía filtros de estado, tipo y fechas al servicio', () => {
    reportsService.listReports.calls.reset();
    component.selectedStatus = 'signed';
    component.selectedReportTypeId = '2';
    component.fromDate = '2026-05-01';
    component.toDate = '2026-05-22';

    component.onServerFilterChange();

    expect(component.currentPage).toBe(1);
    expect(reportsService.listReports).toHaveBeenCalledWith(
      jasmine.objectContaining({
        status: 'signed',
        reportTypeId: 2,
      }),
    );
    const filters = reportsService.listReports.calls.mostRecent().args[0]!;
    expect(filters.fromDate?.getFullYear()).toBe(2026);
    expect(filters.fromDate?.getMonth()).toBe(4);
    expect(filters.fromDate?.getDate()).toBe(1);
    expect(filters.toDate?.getFullYear()).toBe(2026);
    expect(filters.toDate?.getMonth()).toBe(4);
    expect(filters.toDate?.getDate()).toBe(22);
  });

  it('filtra en cliente por texto y profesional', () => {
    component.reports = [
      makeReport(1, { title: 'Informe cardiología', professionalName: 'Dra. Uno' }),
      makeReport(2, { title: 'Analítica anual', professionalName: 'Dr. Dos' }),
    ];
    component.searchText = 'cardio';
    component.selectedPerson = 'Dra. Uno';

    expect(component.filteredReports.map((report) => report.id)).toEqual([1]);
  });

  it('pagina resultados y permite navegar entre páginas', () => {
    component.reports = Array.from({ length: 12 }, (_, i) => makeReport(i + 1));
    component.pageSize = 5;

    expect(component.totalPages).toBe(3);
    expect(component.paginatedReports.map((report) => report.id)).toEqual([1, 2, 3, 4, 5]);

    component.nextPage();

    expect(component.currentPage).toBe(2);
    expect(component.paginatedReports.map((report) => report.id)).toEqual([6, 7, 8, 9, 10]);

    component.goToPage(99);

    expect(component.currentPage).toBe(3);
    expect(component.paginatedReports.map((report) => report.id)).toEqual([11, 12]);
  });

  it('resetea la página al limpiar filtros', () => {
    component.currentPage = 3;
    component.selectedStatus = 'draft';
    component.searchText = 'alta';

    component.clearFilters();

    expect(component.currentPage).toBe(1);
    expect(component.selectedStatus).toBe('');
    expect(component.searchText).toBe('');
  });
});
