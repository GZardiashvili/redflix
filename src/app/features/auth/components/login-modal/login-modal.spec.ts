import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../../../core/services/auth.service';
import { LoginModal } from './login-modal';

describe('LoginModal layering', () => {
  let fixture: ComponentFixture<LoginModal>;

  const overlay = () =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.modal__overlay');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginModal],
      providers: [{ provide: AuthService, useValue: { login: () => Promise.resolve() } }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginModal);
    fixture.detectChanges();
  });

  // The shell mounts this dialog before the booking dialog, so on a shared
  // stacking layer the booking overlay would paint over it. A session that
  // expires mid-booking has to be recovered before the booking can continue,
  // so the login takes the layer above every other dialog.
  it('opens above every other dialog', () => {
    expect(overlay()?.classList).toContain('modal__overlay--top');
  });
});
