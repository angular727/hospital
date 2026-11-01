import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { copyToClipboard } from '../../core/util';
import { PasswordInputComponent } from '../../shared/password-input.component';
import { API, errorMessage } from '../../core/api';
import { Hospital, ModuleDef } from '../../core/models';
import { LoadingService } from '../../core/loading.service';

@Component({
  selector: 'app-hospitals',
  imports: [PasswordInputComponent, FormsModule, DatePipe],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3 class="mb-0">Hospitals</h3>
      <button class="btn btn-primary" (click)="openCreate()"><i class="bi bi-plus-lg me-1"></i>New hospital</button>
    </div>

    @if (error()) {
      <div class="alert alert-danger py-2">{{ error() }}</div>
    }
    @if (notice()) {
      <div class="alert alert-success py-2">{{ notice() }}</div>
    }

    <div class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-light">
            <tr>
              <th>Name</th>
              <th>Hospital code</th>
              <th>Admin username</th>
              <th>Admin password</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Optional modules</th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (c of hospitals(); track c._id) {
              <tr>
                <td class="fw-semibold">{{ c.name }}</td>
                <td><code>{{ c.code }}</code></td>
                <td><code>{{ c.adminUsername || '—' }}</code></td>
                <td class="text-nowrap">
                  @if (shown()[c._id]; as pw) {
                    <code style="cursor:pointer" title="Click to copy" (click)="copyText(pw, c._id)">{{ pw }}</code>
                    @if (copiedKey() === c._id) { <span class="text-success small ms-1"><i class="bi bi-check2"></i> Copied</span> }
                    <button class="btn btn-sm btn-link p-0 ms-1" title="Copy" (click)="copyText(pw, c._id)"><i class="bi" [class.bi-clipboard]="copiedKey() !== c._id" [class.bi-clipboard-check]="copiedKey() === c._id"></i></button>
                    <button class="btn btn-sm btn-link p-0 ms-1" title="Hide" (click)="hide(c)"><i class="bi bi-eye-slash"></i></button>
                  } @else if (c.hasStoredPassword) {
                    <span class="text-muted">••••••••</span>
                    <button class="btn btn-sm btn-outline-secondary py-0 ms-1" (click)="reveal(c)">Show</button>
                  } @else {
                    <span class="text-muted small" title="Use Reset admin password to set a password you can view here">—</span>
                  }
                </td>
                <td>
                  <span class="badge" [class.bg-success]="c.status === 'active'" [class.bg-danger]="c.status === 'suspended'">{{ c.status }}</span>
                </td>
                <td>{{ c.expiresAt ? (c.expiresAt | date: 'mediumDate') : '—' }}</td>
                <td>{{ c.enabledModules.length ? c.enabledModules.join(', ') : '—' }}</td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-secondary me-1" (click)="openModules(c)">Modules</button>
                  @if (c.adminUsername) {
                    <button class="btn btn-sm btn-outline-secondary me-1" (click)="openReset(c)">Reset admin password</button>
                  } @else {
                    <button class="btn btn-sm btn-primary me-1" (click)="openAdmin(c)"><i class="bi bi-person-plus"></i> Create admin</button>
                  }
                  <button class="btn btn-sm me-1" [class.btn-outline-warning]="c.status === 'active'" [class.btn-outline-success]="c.status === 'suspended'" (click)="toggleStatus(c)">
                    {{ c.status === 'active' ? 'Suspend' : 'Activate' }}
                  </button>
                  <button class="btn btn-sm btn-outline-danger" (click)="openDelete(c)"><i class="bi bi-trash"></i> Delete</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="text-center text-muted py-4">@if (loading.busy()) { <span class="spinner-border spinner-border-sm me-2"></span>Loading hospitals… } @else { No hospitals yet }</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create hospital -->
    @if (mode() === 'create') {
      <div class="modal d-block modal-backdrop-custom" tabindex="-1">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
          <form class="modal-content" (ngSubmit)="create()">
            <div class="modal-header"><h5 class="modal-title">New hospital</h5><button type="button" class="btn-close" (click)="close()"></button></div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Hospital name *</label><input class="form-control" name="name" [(ngModel)]="form.name" required /></div>
                <div class="col-md-6"><label class="form-label">Login code * <small class="text-muted">(lowercase, used at login)</small></label><input class="form-control" name="code" [(ngModel)]="form.code" required /></div>
                <div class="col-md-6"><label class="form-label">Phone</label><input class="form-control" name="phone" [(ngModel)]="form.phone" /></div>
                <div class="col-md-6"><label class="form-label">Subscription expires</label><input type="date" class="form-control" name="expiresAt" [(ngModel)]="form.expiresAt" /></div>
                <div class="col-12"><label class="form-label">Address</label><input class="form-control" name="address" [(ngModel)]="form.address" /></div>
                <div class="col-12"><hr class="my-1" /><div class="fw-semibold">Hospital admin</div></div>
                <div class="col-md-4"><label class="form-label">Name *</label><input class="form-control" name="an" [(ngModel)]="form.adminName" required /></div>
                <div class="col-md-4"><label class="form-label">Username *</label><input class="form-control" name="au" [(ngModel)]="form.adminUsername" required autocomplete="off" /></div>
                <div class="col-md-4"><label class="form-label">Password * <small class="text-muted">(min 8)</small></label><app-password-input name="ap" [(ngModel)]="form.adminPassword" required autocomplete="new-password" /></div>
                @if (optionalModules().length) {
                  <div class="col-12"><hr class="my-1" /><div class="fw-semibold mb-1">Optional modules</div>
                    @for (m of optionalModules(); track m.key) {
                      <div class="form-check form-check-inline">
                        <input class="form-check-input" type="checkbox" [id]="'c-' + m.key" [checked]="form.modules.includes(m.key)" (change)="toggle(form.modules, m.key)" />
                        <label class="form-check-label" [for]="'c-' + m.key">{{ m.name }}</label>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-light" (click)="close()">Cancel</button><button class="btn btn-primary" [disabled]="saving()">Create hospital</button></div>
          </form>
        </div>
      </div>
    }

    <!-- Modules -->
    @if (mode() === 'modules' && selected(); as c) {
      <div class="modal d-block modal-backdrop-custom" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">Modules — {{ c.name }}</h5><button type="button" class="btn-close" (click)="close()"></button></div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <p class="text-muted small">Core modules (patients, appointments, OPD, prescriptions, billing, reports, users) are always on. Turning a module off hides it; its data is kept.</p>
              @for (m of optionalModules(); track m.key) {
                <div class="form-check form-switch mb-2">
                  <input class="form-check-input" type="checkbox" [id]="'m-' + m.key" [checked]="modulesDraft.includes(m.key)" (change)="toggle(modulesDraft, m.key)" />
                  <label class="form-check-label" [for]="'m-' + m.key">{{ m.name }}</label>
                </div>
              } @empty {
                <div class="text-muted">No optional modules exist yet. They will appear here as they are built.</div>
              }
            </div>
            <div class="modal-footer"><button class="btn btn-light" (click)="close()">Close</button>
              @if (optionalModules().length) { <button class="btn btn-primary" [disabled]="saving()" (click)="saveModules()">Save</button> }
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Login details (password is only known right after create/reset) -->
    @if (credentials(); as cr) {
      <div class="modal d-block modal-backdrop-custom" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">Login details — {{ cr.hospitalName }}</h5><button type="button" class="btn-close" (click)="credentials.set(null)"></button></div>
            <div class="modal-body">
              <div class="alert alert-warning py-2 small">The password is shown only now. It is stored encrypted and cannot be viewed later. Copy it and give it to the hospital admin.</div>
              <table class="table table-sm mb-0">
                <tr><th>Hospital code</th><td><code>{{ cr.code }}</code></td></tr>
                <tr><th>Username</th><td><code>{{ cr.username }}</code></td></tr>
                <tr><th>Password</th><td><code>{{ cr.password }}</code></td></tr>
              </table>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" (click)="copyCredentials(cr)">{{ copied() ? 'Copied!' : 'Copy' }}</button>
              <button class="btn btn-primary" (click)="credentials.set(null)">Done</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Create the hospital's admin login -->
    @if (mode() === 'admin' && selected(); as c) {
      <div class="modal d-block modal-backdrop-custom" tabindex="-1">
        <div class="modal-dialog">
          <form class="modal-content" (ngSubmit)="createAdmin()">
            <div class="modal-header"><h5 class="modal-title">Create admin — {{ c.name }}</h5><button type="button" class="btn-close" (click)="close()"></button></div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <div class="mb-3"><label class="form-label">Name *</label><input class="form-control" name="an" [(ngModel)]="adminForm.name" required /></div>
              <div class="mb-3"><label class="form-label">Username *</label><input class="form-control" name="au" [(ngModel)]="adminForm.username" required autocomplete="off" /></div>
              <div class="mb-1"><label class="form-label">Password * <small class="text-muted">(min 8)</small></label><app-password-input name="ap" [(ngModel)]="adminForm.password" required autocomplete="new-password" /></div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-light" (click)="close()">Cancel</button><button class="btn btn-primary" [disabled]="saving()">Create admin</button></div>
          </form>
        </div>
      </div>
    }

    <!-- Delete a hospital and all its data -->
    @if (mode() === 'delete' && selected(); as c) {
      <div class="modal d-block modal-backdrop-custom" tabindex="-1">
        <div class="modal-dialog">
          <form class="modal-content" (ngSubmit)="confirmDelete()">
            <div class="modal-header"><h5 class="modal-title text-danger">Delete hospital — {{ c.name }}</h5><button type="button" class="btn-close" (click)="close()"></button></div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <div class="alert alert-danger py-2 small">This permanently deletes the hospital with <strong>all</strong> its patients, visits, prescriptions, bills and logins. It cannot be undone.</div>
              <label class="form-label">Type the hospital code <code>{{ c.code }}</code> to confirm</label>
              <input class="form-control" name="dc" [(ngModel)]="deleteCode" autocomplete="off" />
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-light" (click)="close()">Cancel</button><button class="btn btn-danger" [disabled]="saving() || deleteCode.trim().toLowerCase() !== c.code">Delete hospital</button></div>
          </form>
        </div>
      </div>
    }

    <!-- Reset admin password -->
    @if (mode() === 'reset' && selected(); as c) {
      <div class="modal d-block modal-backdrop-custom" tabindex="-1">
        <div class="modal-dialog">
          <form class="modal-content" (ngSubmit)="resetPassword()">
            <div class="modal-header"><h5 class="modal-title">Reset admin password — {{ c.name }}</h5><button type="button" class="btn-close" (click)="close()"></button></div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <label class="form-label">New password <small class="text-muted">(min 8)</small></label>
              <app-password-input name="np" [(ngModel)]="newPassword" required autocomplete="new-password" />
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-light" (click)="close()">Cancel</button><button class="btn btn-primary" [disabled]="saving()">Reset</button></div>
          </form>
        </div>
      </div>
    }
  `,
})
export class HospitalsComponent implements OnInit {
  private http = inject(HttpClient);
  loading = inject(LoadingService);

  hospitals = signal<Hospital[]>([]);
  optionalModules = signal<ModuleDef[]>([]);
  mode = signal<'' | 'create' | 'modules' | 'reset' | 'admin' | 'delete'>('');
  adminForm = { name: '', username: '', password: '' };
  deleteCode = '';
  selected = signal<Hospital | null>(null);
  error = signal('');
  notice = signal('');
  formError = signal('');
  saving = signal(false);
  credentials = signal<{ hospitalName: string; code: string; username: string; password: string } | null>(null);
  copied = signal(false);
  /** Admin passwords that are currently revealed, by hospital id. */
  shown = signal<Record<string, string>>({});

  form = this.emptyForm();
  modulesDraft: string[] = [];
  newPassword = '';

  ngOnInit() {
    this.load();
    this.http.get<ModuleDef[]>(`${API}/auth/modules`).subscribe((m) => this.optionalModules.set(m.filter((x) => !x.core)));
  }

  private emptyForm() {
    return { name: '', code: '', phone: '', address: '', expiresAt: '', adminName: '', adminUsername: '', adminPassword: '', modules: [] as string[] };
  }

  load() {
    this.http.get<Hospital[]>(`${API}/hospitals`).subscribe({
      next: (c) => this.hospitals.set(c),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  toggle(list: string[], key: string) {
    const i = list.indexOf(key);
    i >= 0 ? list.splice(i, 1) : list.push(key);
  }

  openCreate() {
    this.form = this.emptyForm();
    this.formError.set('');
    this.mode.set('create');
  }

  openModules(c: Hospital) {
    this.selected.set(c);
    this.modulesDraft = [...c.enabledModules];
    this.formError.set('');
    this.mode.set('modules');
  }

  openAdmin(c: Hospital) {
    this.selected.set(c);
    this.adminForm = { name: '', username: '', password: '' };
    this.formError.set('');
    this.mode.set('admin');
  }

  createAdmin() {
    const c = this.selected();
    const f = this.adminForm;
    if (!c) return;
    if (!f.name || !f.username || !f.password) {
      this.formError.set('Please fill all fields');
      return;
    }
    this.saving.set(true);
    this.http.post(`${API}/hospitals/${c._id}/admin`, f).subscribe({
      next: () => {
        this.done('Admin created');
        this.showCredentials({ hospitalName: c.name, code: c.code, username: f.username.toLowerCase().trim(), password: f.password });
      },
      error: (e) => this.fail(e),
    });
  }

  openDelete(c: Hospital) {
    this.selected.set(c);
    this.deleteCode = '';
    this.formError.set('');
    this.mode.set('delete');
  }

  confirmDelete() {
    const c = this.selected();
    if (!c) return;
    this.saving.set(true);
    this.http.delete(`${API}/hospitals/${c._id}`, { body: { confirmCode: this.deleteCode } }).subscribe({
      next: () => this.done('Hospital deleted'),
      error: (e) => this.fail(e),
    });
  }

  openReset(c: Hospital) {
    this.selected.set(c);
    this.newPassword = '';
    this.formError.set('');
    this.mode.set('reset');
  }

  close() {
    this.mode.set('');
    this.selected.set(null);
  }

  private done(message: string) {
    this.saving.set(false);
    this.close();
    this.notice.set(message);
    this.error.set('');
    this.load();
    setTimeout(() => this.notice.set(''), 4000);
  }

  private fail(e: unknown) {
    this.saving.set(false);
    this.formError.set(errorMessage(e));
  }

  create() {
    const f = this.form;
    this.formError.set('');
    if (!f.name || !f.code || !f.adminName || !f.adminUsername || !f.adminPassword) {
      this.formError.set('Please fill all required fields');
      return;
    }
    this.saving.set(true);
    this.http
      .post(`${API}/hospitals`, {
        name: f.name,
        code: f.code,
        phone: f.phone,
        address: f.address,
        expiresAt: f.expiresAt || undefined,
        enabledModules: f.modules,
        admin: { name: f.adminName, username: f.adminUsername, password: f.adminPassword },
      })
      .subscribe({
        next: () => {
          const shown = { hospitalName: f.name, code: f.code.toLowerCase().trim(), username: f.adminUsername.toLowerCase().trim(), password: f.adminPassword };
          this.done('Hospital created');
          this.showCredentials(shown);
        },
        error: (e) => this.fail(e),
      });
  }

  private showCredentials(c: { hospitalName: string; code: string; username: string; password: string }) {
    this.copied.set(false);
    this.credentials.set(c);
  }

  reveal(c: Hospital) {
    this.http.get<{ password: string }>(`${API}/hospitals/${c._id}/admin-password`).subscribe({
      next: (r) => this.shown.update((s) => ({ ...s, [c._id]: r.password })),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  hide(c: Hospital) {
    this.shown.update((s) => {
      const n = { ...s };
      delete n[c._id];
      return n;
    });
  }

  copiedKey = signal('');

  /** Copies the password; shows a "Copied" mark next to it for a moment. */
  copyText(text: string, key: string) {
    copyToClipboard(text).then((ok) => {
      if (!ok) return this.error.set('Could not copy. Select the password and press Ctrl+C.');
      this.copiedKey.set(key);
      setTimeout(() => this.copiedKey.set(''), 1800);
    });
  }

  copyCredentials(c: { code: string; username: string; password: string }) {
    const text = `Hospital code: ${c.code}\nUsername: ${c.username}\nPassword: ${c.password}`;
    copyToClipboard(text).then((ok) => this.copied.set(ok));
  }

  saveModules() {
    const c = this.selected();
    if (!c) return;
    this.saving.set(true);
    this.http.put(`${API}/hospitals/${c._id}/modules`, { enabledModules: this.modulesDraft }).subscribe({
      next: () => this.done('Modules updated'),
      error: (e) => this.fail(e),
    });
  }

  resetPassword() {
    const c = this.selected();
    if (!c) return;
    this.saving.set(true);
    const password = this.newPassword;
    this.http.post(`${API}/hospitals/${c._id}/reset-admin-password`, { password }).subscribe({
      next: () => {
        this.done('Admin password reset');
        this.showCredentials({ hospitalName: c.name, code: c.code, username: c.adminUsername || '', password });
      },
      error: (e) => this.fail(e),
    });
  }

  toggleStatus(c: Hospital) {
    const status = c.status === 'active' ? 'suspended' : 'active';
    this.http.put(`${API}/hospitals/${c._id}/status`, { status }).subscribe({
      next: () => this.done(`Hospital ${status === 'active' ? 'activated' : 'suspended'}`),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }
}
