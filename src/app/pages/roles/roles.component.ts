import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { API, errorMessage } from '../../core/api';
import { HasPermissionDirective } from '../../core/has-permission.directive';
import { PermissionGroup, Role } from '../../core/models';

@Component({
  selector: 'app-roles',
  imports: [FormsModule, HasPermissionDirective],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3 class="mb-0">Roles</h3>
      <button *hasPermission="'users.create'" class="btn btn-primary" (click)="startNew()"><i class="bi bi-plus-lg me-1"></i>New role</button>
    </div>

    @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }
    @if (notice()) { <div class="alert alert-success py-2">{{ notice() }}</div> }

    <div class="row g-3">
      <div class="col-md-4">
        <div class="list-group shadow-sm">
          @for (r of roles(); track r._id) {
            <button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" [class.active]="editing()?._id === r._id" (click)="select(r)">
              {{ r.name }}
              @if (r.isAdmin) { <span class="badge bg-secondary">built-in</span> }
            </button>
          }
        </div>
      </div>

      <div class="col-md-8">
        @if (editing(); as r) {
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              @if (r.isAdmin) {
                <div class="alert alert-info py-2">The Admin role has every permission and cannot be edited or deleted.</div>
              }
              <label class="form-label">Role name</label>
              <input class="form-control mb-3" [(ngModel)]="name" [disabled]="r.isAdmin" placeholder="e.g. Receptionist" />

              <div class="table-responsive">
                <table class="table table-sm align-middle">
                  <thead class="table-light"><tr><th>Module</th><th>Permissions</th></tr></thead>
                  <tbody>
                    @for (g of groups(); track g.key) {
                      <tr>
                        <td class="fw-semibold">{{ g.name }}</td>
                        <td>
                          @for (a of g.actions; track a) {
                            <div class="form-check form-check-inline">
                              <input class="form-check-input" type="checkbox" [id]="g.key + a" [disabled]="r.isAdmin" [checked]="r.isAdmin || perms.has(g.key + '.' + a)" (change)="toggle(g.key + '.' + a)" />
                              <label class="form-check-label text-capitalize" [for]="g.key + a">{{ a }}</label>
                            </div>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              @if (!r.isAdmin) {
                <div class="d-flex gap-2">
                  <button *hasPermission="'users.edit'" class="btn btn-primary" [disabled]="saving()" (click)="save()">Save role</button>
                  @if (r._id) {
                    <button *hasPermission="'users.delete'" class="btn btn-outline-danger" (click)="remove()">Delete</button>
                  }
                </div>
              }
            </div>
          </div>
        } @else {
          <div class="text-muted">Select a role to see or edit its permissions.</div>
        }
      </div>
    </div>
  `,
})
export class RolesComponent implements OnInit {
  private http = inject(HttpClient);

  roles = signal<Role[]>([]);
  groups = signal<PermissionGroup[]>([]);
  editing = signal<Role | null>(null);
  error = signal('');
  notice = signal('');
  saving = signal(false);

  name = '';
  perms = new Set<string>();

  ngOnInit() {
    this.load();
    this.http.get<PermissionGroup[]>(`${API}/roles/available-permissions`).subscribe((g) => this.groups.set(g));
  }

  load() {
    this.http.get<Role[]>(`${API}/roles`).subscribe({
      next: (r) => this.roles.set(r),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  select(r: Role) {
    this.error.set('');
    this.editing.set(r);
    this.name = r.name;
    this.perms = new Set(r.permissions);
  }

  startNew() {
    this.select({ _id: '', name: '', permissions: [], isAdmin: false });
  }

  toggle(p: string) {
    this.perms.has(p) ? this.perms.delete(p) : this.perms.add(p);
  }

  save() {
    const r = this.editing();
    if (!r) return;
    if (!this.name.trim()) {
      this.error.set('Role name is required');
      return;
    }
    this.saving.set(true);
    const body = { name: this.name.trim(), permissions: [...this.perms] };
    const req = r._id ? this.http.put<Role>(`${API}/roles/${r._id}`, body) : this.http.post<Role>(`${API}/roles`, body);
    req.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.error.set('');
        this.notice.set('Role saved');
        setTimeout(() => this.notice.set(''), 3000);
        this.load();
        this.select(saved);
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }

  remove() {
    const r = this.editing();
    if (!r || !r._id || !confirm(`Delete role "${r.name}"?`)) return;
    this.http.delete(`${API}/roles/${r._id}`).subscribe({
      next: () => {
        this.editing.set(null);
        this.load();
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }
}
