import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user';
import { AppHeader } from './app-header';

describe('AppHeader', () => {
  const user = signal<User | null>(null);
  const logout = vi.fn();

  beforeEach(async () => {
    user.set(null);
    logout.mockReset();

    await TestBed.configureTestingModule({
      imports: [AppHeader],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: user.asReadonly(),
            isAuthenticated: () => user() !== null,
            logout,
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the guest navigation with the auth triggers', () => {
    const fixture = TestBed.createComponent(AppHeader);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-header__identity')).toBeNull();
    expect(compiled.textContent).toContain('Log in');
    expect(compiled.textContent).toContain('Sign up');
  });

  it('emits loginRequested when the guest presses Log in', async () => {
    const fixture = TestBed.createComponent(AppHeader);
    vi.spyOn(fixture.componentInstance.loginRequested, 'emit');
    fixture.detectChanges();

    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '.app-header__auth',
      ),
    );
    buttons.find((button) => button.textContent?.trim() === 'Log in')?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.loginRequested.emit).toHaveBeenCalledOnce();
  });

  it('shows the identity dropdown for an authenticated user and logs out', async () => {
    user.set({
      id: 1,
      username: 'jane',
      email: 'jane@kinoxii.test',
      avatar: null,
      fullName: null,
      mobileNumber: null,
      dateOfBirth: null,
      age: null,
      preferredVenue: null,
      profileComplete: false,
    });

    const fixture = TestBed.createComponent(AppHeader);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const identity = compiled.querySelector<HTMLButtonElement>('.app-header__identity');

    expect(identity).not.toBeNull();
    expect(identity?.textContent).toContain('jane');
    expect(identity?.getAttribute('aria-expanded')).toBe('false');
    expect(compiled.querySelector('.app-header__menu')).toBeNull();

    identity?.click();
    fixture.detectChanges();

    expect(identity?.getAttribute('aria-expanded')).toBe('true');
    expect(compiled.querySelector('.app-header__menu')).not.toBeNull();
    expect(compiled.textContent).toContain('My Profile');

    Array.from(compiled.querySelectorAll<HTMLButtonElement>('.app-header__menu-item'))
      .find((item) => item.textContent?.trim() === 'Logout')
      ?.click();
    await fixture.whenStable();

    expect(logout).toHaveBeenCalledOnce();
    expect(compiled.querySelector('.app-header__menu')).toBeNull();
  });
});
