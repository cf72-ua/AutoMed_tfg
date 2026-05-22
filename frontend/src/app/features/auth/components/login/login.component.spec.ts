import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['login', 'getRole']);
    authService.getRole.and.returnValue(signal('PACIENTE'));
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('valida el formulario como inválido si faltan campos', () => {
    component.dni = '12345678A';
    component.password = '';

    expect(component.isFormValid).toBeFalse();

    component.password = 'secret';

    expect(component.isFormValid).toBeTrue();
  });

  it('bloquea el botón hasta completar DNI y contraseña', async () => {
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(button.disabled).toBeTrue();

    component.dni = '12345678A';
    component.password = 'secret';
    fixture.detectChanges();
    await fixture.whenStable();

    expect(button.disabled).toBeFalse();
  });

  it('no llama al servicio si el formulario está incompleto', () => {
    component.dni = '12345678A';
    component.password = '';

    component.onSubmit();

    expect(authService.login).not.toHaveBeenCalled();
  });

  it('navega al calendario en login correcto', () => {
    authService.login.and.returnValue(of({ token: 'token' }));
    component.dni = '12345678A';
    component.password = 'secret';

    component.onSubmit();

    expect(authService.login).toHaveBeenCalledWith('12345678A', 'secret');
    expect(router.navigate).toHaveBeenCalledWith(['/calendar']);
    expect(component.isSubmitting).toBeFalse();
  });

  it('navega a pacientes admin si el usuario es administrador', () => {
    authService.getRole.and.returnValue(signal('ADMIN'));
    authService.login.and.returnValue(of({ token: 'token' }));
    component.dni = '12345678A';
    component.password = 'secret';

    component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/admin/patients']);
    expect(component.isSubmitting).toBeFalse();
  });

  it('muestra error y desbloquea el formulario si falla el login', () => {
    spyOn(console, 'error');
    authService.login.and.returnValue(
      throwError(() => ({ error: { error: 'Credenciales incorrectas' } })),
    );
    component.dni = '12345678A';
    component.password = 'bad-secret';

    component.onSubmit();
    fixture.detectChanges();

    expect(component.errorMessage).toBe('Credenciales incorrectas');
    expect(component.isSubmitting).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Credenciales incorrectas',
    );
  });
});
