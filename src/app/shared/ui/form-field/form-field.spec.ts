import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormField } from './form-field';

@Component({
  imports: [FormField],
  template: `
    <app-form-field
      [label]="label()"
      controlId="email"
      [error]="error()"
      [hint]="hint()"
      [required]="required()"
    >
      <input id="email" type="email" />
    </app-form-field>
  `,
})
class FormFieldHost {
  readonly label = signal('Email');
  readonly error = signal<string | null>(null);
  readonly hint = signal<string | null>(null);
  readonly required = signal(false);
}

describe('FormField', () => {
  let fixture: ComponentFixture<FormFieldHost>;

  const root = () => fixture.nativeElement as HTMLElement;
  const field = () => root().querySelector<HTMLElement>('app-form-field');
  const error = () => field()?.querySelector('.form-field__error');
  const hint = () => field()?.querySelector('.form-field__hint');

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [FormFieldHost] });
    fixture = TestBed.createComponent(FormFieldHost);
    await render();
  });

  it('associates the label with the projected control', () => {
    const label = field()?.querySelector<HTMLLabelElement>('label');

    expect(label?.textContent).toContain('Email');
    expect(label?.getAttribute('for')).toBe('email');
    expect(field()?.querySelector('#email')).not.toBeNull();
  });

  it('hides the required marker by default and shows it when required', async () => {
    expect(field()?.querySelector('.form-field__required')).toBeNull();

    fixture.componentInstance.required.set(true);
    await render();

    const marker = field()?.querySelector('.form-field__required');
    expect(marker?.textContent).toContain('*');
    expect(marker?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders the hint only when there is no error', async () => {
    expect(hint()).toBeNull();

    fixture.componentInstance.hint.set('We never share your email.');
    await render();

    expect(hint()?.textContent).toContain('We never share your email.');
    expect(hint()?.getAttribute('id')).toBe('email-hint');
  });

  it('renders the validation error verbatim and announces it', async () => {
    fixture.componentInstance.hint.set('We never share your email.');
    fixture.componentInstance.error.set('Email is required.');
    await render();

    expect(hint()).toBeNull();
    expect(error()?.textContent?.trim()).toBe('Email is required.');
    expect(error()?.getAttribute('id')).toBe('email-error');
    expect(error()?.getAttribute('role')).toBe('alert');
  });
});
