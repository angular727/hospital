import { Component, booleanAttribute, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * A password box with an eye button to show or hide what is typed.
 * Works with ngModel exactly like a normal input:
 *   <app-password-input name="password" [(ngModel)]="password" autocomplete="current-password" required />
 */
@Component({
  selector: 'app-password-input',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PasswordInputComponent), multi: true }],
  template: `
    <div class="input-group">
      <input
        class="form-control"
        [type]="visible() ? 'text' : 'password'"
        [value]="value"
        [disabled]="disabled"
        [required]="required()"
        [attr.autocomplete]="autocomplete()"
        [attr.placeholder]="placeholder() || null"
        (input)="onInput($event)"
        (blur)="onBlur()"
      />
      <button
        type="button"
        class="btn btn-outline-secondary"
        tabindex="-1"
        [attr.aria-label]="visible() ? 'Hide password' : 'Show password'"
        [title]="visible() ? 'Hide password' : 'Show password'"
        (click)="visible.set(!visible())"
      >
        <i class="bi" [class.bi-eye]="!visible()" [class.bi-eye-slash]="visible()"></i>
      </button>
    </div>
  `,
})
export class PasswordInputComponent implements ControlValueAccessor {
  autocomplete = input('off');
  placeholder = input('');
  required = input(false, { transform: booleanAttribute });

  visible = signal(false);
  value = '';
  disabled = false;

  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(v: string | null): void {
    this.value = v ?? '';
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  /** A copied password often carries a stray space or line break at the end: remove it when leaving the box. */
  onBlur() {
    const trimmed = this.value.trim();
    if (trimmed !== this.value) {
      this.value = trimmed;
      this.onChange(trimmed);
    }
    this.onTouched();
  }

  onInput(e: Event) {
    this.value = (e.target as HTMLInputElement).value;
    this.onChange(this.value);
  }
}
