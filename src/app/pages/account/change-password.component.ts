import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PasswordInputComponent } from '../../shared/password-input.component';
import { API, errorMessage } from '../../core/api';

/** Every signed-in user (including the Super Admin) can change their own password here. */
@Component({
  selector: 'app-change-password',
  imports: [PasswordInputComponent, FormsModule],
  template: `
    <h3 class="mb-3">Change password</h3>
    <div class="row">
      <div class="col-lg-5">
        <form class="card border-0 shadow-sm" (ngSubmit)="submit()">
          <div class="card-body">
            @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }
            @if (notice()) { <div class="alert alert-success py-2">{{ notice() }}</div> }
            <div class="mb-3">
              <label class="form-label">Current password</label>
              <app-password-input name="current" [(ngModel)]="current" autocomplete="current-password" required />
            </div>
            <div class="mb-3">
              <label class="form-label">New password <small class="text-muted">(at least 8 characters)</small></label>
              <app-password-input name="next" [(ngModel)]="next" autocomplete="new-password" required />
            </div>
            <div class="mb-1">
              <label class="form-label">Confirm new password</label>
              <app-password-input name="confirm" [(ngModel)]="confirm" autocomplete="new-password" required />
            </div>
            <div class="form-text">After you change it yourself, only you know it: the hospital admin can no longer view it.</div>
          </div>
          <div class="card-footer bg-white">
            <button class="btn btn-primary" [disabled]="saving()">
              @if (saving()) { <span class="spinner-border spinner-border-sm me-2"></span>Saving… } @else { Change password }
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class ChangePasswordComponent {
  private http = inject(HttpClient);

  current = '';
  next = '';
  confirm = '';
  error = signal('');
  notice = signal('');
  saving = signal(false);

  submit() {
    this.error.set('');
    this.notice.set('');
    if (!this.current || !this.next) return this.error.set('Fill in all the fields');
    if (this.next.length < 8) return this.error.set('The new password must be at least 8 characters');
    if (this.next !== this.confirm) return this.error.set('The new password and its confirmation do not match');
    if (this.next === this.current) return this.error.set('The new password must be different from the current one');

    this.saving.set(true);
    this.http.post(`${API}/auth/change-password`, { currentPassword: this.current, newPassword: this.next }).subscribe({
      next: () => {
        this.saving.set(false);
        this.notice.set('Password changed. Use the new password next time you sign in.');
        this.current = this.next = this.confirm = '';
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }
}
