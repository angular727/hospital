import { Component, inject, isDevMode, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PasswordInputComponent } from '../../shared/password-input.component';
import { Router } from '@angular/router';
import { errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [PasswordInputComponent, FormsModule],
  template: `
    <div class="login-wrap d-flex align-items-center justify-content-center">
      <form class="card shadow border-0 p-4" (ngSubmit)="submit()">
        <div class="text-center mb-3">
          <i class="bi bi-heart-pulse-fill logo"></i>
          <h4 class="mt-2 mb-0">Welcome back</h4>
          <div class="text-muted small">Sign in to your account</div>
        </div>

        @if (error()) {
          <div class="alert alert-danger py-2">{{ error() }}</div>
        }

        <div class="mb-3">
          <label class="form-label">Hospital code</label>
          <input class="form-control" name="hospitalCode" [(ngModel)]="hospitalCode" [disabled]="superAdmin" placeholder="e.g. alshifa" autocomplete="organization" />
        </div>
        <div class="mb-3">
          <label class="form-label">Username</label>
          <input class="form-control" name="username" [(ngModel)]="username" required autocomplete="username" />
        </div>
        <div class="mb-3">
          <label class="form-label">Password</label>
          <app-password-input name="password" [(ngModel)]="password" required autocomplete="current-password" />
        </div>
        <div class="form-check mb-3">
          <input class="form-check-input" type="checkbox" id="sa" name="sa" [(ngModel)]="superAdmin" />
          <label class="form-check-label small" for="sa">Super Admin login</label>
        </div>
        <button class="btn btn-primary w-100" [disabled]="loading()">
          {{ loading() ? 'Signing in…' : 'Sign in' }}
        </button>

        @if (dev) {
          <div class="alert alert-warning small mt-3 mb-0 py-2">
            <div class="fw-semibold">Dev hint (hidden in production)</div>
            Super Admin: tick the box, username <code>demo</code>, password <code>demo</code>
            <button type="button" class="btn btn-sm btn-outline-secondary d-block mt-2" (click)="fillSuperAdmin()">Fill Super Admin</button>
          </div>
        }
      </form>
    </div>
  `,
  styles: `
    .login-wrap { min-height: 100vh; background: linear-gradient(135deg, #0f4c4c, #14b8a6); }
    .card { width: 680px; max-width: 92vw; border-radius: 1rem; }
    .logo { font-size: 2.5rem; color: #14b8a6; }
    .btn-primary { background: #0f4c4c; border-color: #0f4c4c; }
    .btn-primary:hover { background: #14b8a6; border-color: #14b8a6; }
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  hospitalCode = '';
  username = '';
  password = '';
  superAdmin = false;
  loading = signal(false);
  error = signal('');
  dev = isDevMode();

  fillSuperAdmin() {
    this.superAdmin = true;
    this.hospitalCode = '';
    this.username = 'demo';
    this.password = 'demo';
  }

  submit() {
    this.error.set('');
    if (!this.username || !this.password || (!this.superAdmin && !this.hospitalCode)) {
      this.error.set('Please fill in all fields');
      return;
    }
    this.loading.set(true);
    this.auth
      .login({ hospitalCode: this.superAdmin ? undefined : this.hospitalCode.trim(), username: this.username.trim(), password: this.password.trim() })
      .subscribe({
        next: () => this.router.navigate(['/dashboard']),
        error: (e) => {
          this.error.set(errorMessage(e));
          this.loading.set(false);
        },
      });
  }
}
