import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../../../core/services/auth.service';
import { RegisterModal } from './register-modal';

describe('RegisterModal validation', () => {
  let fixture: ComponentFixture<RegisterModal>;

  const root = () => fixture.nativeElement as HTMLElement;
  const input = (id: string) => root().querySelector<HTMLInputElement>(`#${id}`);
  const submit = () => root().querySelector<HTMLButtonElement>('.register-modal__submit');

  /**
   * The message rendered in the `<app-form-field>` that wraps this control.
   *
   * Anchored on the input rather than the field's `controlId`: that is a signal
   * input, so it is a property of the element and never an attribute to match on.
   */
  const message = (id: string) =>
    input(id)
      ?.closest('app-form-field')
      ?.querySelector('.form-field__error')
      ?.textContent?.trim() ?? null;

  /** Types into a control the way a visitor does: value, then input event. */
  function type(controlId: string, id: string, value: string): void {
    const element = input(id);
    element!.value = value;
    element!.dispatchEvent(new Event('input'));
  }

  function blur(id: string): void {
    input(id)!.dispatchEvent(new Event('blur'));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterModal],
      providers: [{ provide: AuthService, useValue: { register: () => Promise.resolve() } }],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterModal);
    fixture.detectChanges();
  });

  it('shows nothing before the field has been engaged', () => {
    expect(message('register-username')).toBeNull();
    expect(submit()?.disabled).toBe(true);
  });

  it('reports the error after an invalid value is blurred', () => {
    type('register-username', 'register-username', 'a');
    blur('register-username');
    fixture.detectChanges();

    expect(message('register-username')).toBe('Username must be at least 3 characters.');
  });

  it('clears the error in real time once the value satisfies validation', () => {
    type('register-username', 'register-username', 'a');
    blur('register-username');
    fixture.detectChanges();

    expect(message('register-username')).not.toBeNull();

    // The 2nd character: still too short, so the message stays.
    type('register-username', 'register-username', 'ab');
    fixture.detectChanges();
    expect(message('register-username')).toBe('Username must be at least 3 characters.');

    // The 3rd character clears it with no further blur or click.
    type('register-username', 'register-username', 'abc');
    fixture.detectChanges();

    expect(message('register-username')).toBeNull();
  });

  it('drops the error when the value is cleared again', () => {
    type('register-username', 'register-username', 'abc');
    blur('register-username');
    fixture.detectChanges();

    expect(message('register-username')).toBeNull();

    type('register-username', 'register-username', '');
    fixture.detectChanges();

    expect(message('register-username')).toBe('Username is required.');
  });

  it('clears the email error as soon as the address becomes valid', () => {
    type('register-email', 'register-email', 'not-an-email');
    blur('register-email');
    fixture.detectChanges();

    expect(message('register-email')).toBe('Enter a valid email address.');

    type('register-email', 'register-email', 'jane@kinoxii.test');
    fixture.detectChanges();

    expect(message('register-email')).toBeNull();
  });

  it('clears the mismatch as soon as the confirmation matches', () => {
    type('register-password', 'register-password', 'secret1');
    type('register-password-confirmation', 'register-password-confirmation', 'other');
    blur('register-password-confirmation');
    fixture.detectChanges();

    expect(message('register-password-confirmation')).toBe('Passwords do not match.');

    type('register-password-confirmation', 'register-password-confirmation', 'secret1');
    fixture.detectChanges();

    expect(message('register-password-confirmation')).toBeNull();
  });

  it('activates the submit button once every required field is valid', () => {
    type('register-username', 'register-username', 'jane');
    type('register-email', 'register-email', 'jane@kinoxii.test');
    type('register-password', 'register-password', 'secret1');
    type('register-password-confirmation', 'register-password-confirmation', 'secret1');
    fixture.detectChanges();

    expect(submit()?.disabled).toBe(false);
  });

  it('keeps the submit button disabled while a field is invalid', () => {
    type('register-username', 'register-username', 'jane');
    type('register-email', 'register-email', 'jane@kinoxii.test');
    type('register-password', 'register-password', 'secret1');
    type('register-password-confirmation', 'register-password-confirmation', 'nope');
    fixture.detectChanges();

    expect(submit()?.disabled).toBe(true);
  });
});
