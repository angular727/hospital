import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { API, errorMessage } from '../../core/api';
import { LoadingService } from '../../core/loading.service';
import { Doctor, ReceptionDesk } from '../../core/models';

/** The reception desks of the hospital. A desk checks patients in only for its own doctors. */
@Component({
  selector: 'app-reception-desks',
  imports: [FormsModule],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
      <h3 class="mb-0">Reception desks</h3>
      <button class="btn btn-primary" (click)="openForm()"><i class="bi bi-plus-lg me-1"></i>Add desk</button>
    </div>
    <p class="text-muted small">
      A hospital can have more than one reception (for example OPD reception or a children's wing), and each desk can serve more than one doctor.
      Put a receptionist on a desk from "Users". They then see and check in only that desk's doctors. A desk with no doctors serves everyone.
    </p>

    @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }

    <div class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table table-hover mb-0 align-middle">
          <thead class="table-light"><tr><th>Desk</th><th>Doctors</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
          <tbody>
            @for (d of desks(); track d._id) {
              <tr>
                <td class="fw-semibold">{{ d.name }}</td>
                <td>{{ d.doctorIds.length ? doctorNames(d) : 'All doctors' }}</td>
                <td><span class="badge" [class.text-bg-success]="d.isActive" [class.text-bg-secondary]="!d.isActive">{{ d.isActive ? 'Active' : 'Not active' }}</span></td>
                <td class="text-end text-nowrap">
                  <button class="btn btn-sm btn-outline-secondary me-1" (click)="openForm(d)">Edit</button>
                  <button class="btn btn-sm btn-outline-danger" (click)="remove(d)"><i class="bi bi-trash"></i> Delete</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="text-center text-muted py-4">
                @if (loading.busy()) { <span class="spinner-border spinner-border-sm me-2"></span>Loading desks… } @else { No desks yet. Without desks every receptionist serves every doctor. }
              </td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (showForm()) {
      <div class="modal d-block modal-backdrop-custom" tabindex="-1">
        <div class="modal-dialog">
          <form class="modal-content" (ngSubmit)="save()">
            <div class="modal-header">
              <h5 class="modal-title">{{ editingId ? 'Edit desk' : 'Add desk' }}</h5>
              <button type="button" class="btn-close" (click)="showForm.set(false)"></button>
            </div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <label class="form-label">Desk name *</label>
              <input class="form-control mb-3" name="name" [(ngModel)]="name" placeholder="e.g. OPD reception" required autocomplete="off" />
              <label class="form-label">Doctors of this desk</label>
              <div class="border rounded p-2" style="max-height: 240px; overflow: auto">
                @for (d of doctors(); track d._id) {
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" [id]="'dd-' + d._id" [checked]="selected().has(d._id)" (change)="toggle(d._id)" />
                    <label class="form-check-label" [for]="'dd-' + d._id">{{ d.name }} <span class="text-muted small">{{ d.specialization }}</span></label>
                  </div>
                } @empty { <div class="text-muted small">No doctors yet. Mark a user as a doctor in "Users".</div> }
              </div>
              <div class="form-text">Leave all unticked to let this desk serve every doctor.</div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" (click)="showForm.set(false)">Cancel</button>
              <button class="btn btn-primary" [disabled]="saving()">Save</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class ReceptionDesksComponent implements OnInit {
  private http = inject(HttpClient);
  loading = inject(LoadingService);

  desks = signal<ReceptionDesk[]>([]);
  doctors = signal<Doctor[]>([]);
  error = signal('');
  showForm = signal(false);
  formError = signal('');
  saving = signal(false);
  editingId = '';
  name = '';
  selected = signal(new Set<string>());

  ngOnInit() {
    this.load();
    this.http.get<Doctor[]>(`${API}/users/doctors`).subscribe((d) => this.doctors.set(d));
  }

  load() {
    this.http.get<ReceptionDesk[]>(`${API}/reception-desks`).subscribe({
      next: (d) => {
        this.desks.set(d);
        this.error.set('');
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  doctorNames = (d: ReceptionDesk) => d.doctorIds.map((x) => x.name).join(', ');

  openForm(d?: ReceptionDesk) {
    this.formError.set('');
    this.editingId = d?._id ?? '';
    this.name = d?.name ?? '';
    this.selected.set(new Set(d?.doctorIds.map((x) => x._id) ?? []));
    this.showForm.set(true);
  }

  toggle(id: string) {
    const s = new Set(this.selected());
    if (!s.delete(id)) s.add(id);
    this.selected.set(s);
  }

  save() {
    if (!this.name.trim()) {
      this.formError.set('Enter the desk name');
      return;
    }
    this.saving.set(true);
    const body = { name: this.name, doctorIds: [...this.selected()] };
    const req = this.editingId
      ? this.http.put<ReceptionDesk>(`${API}/reception-desks/${this.editingId}`, body)
      : this.http.post<ReceptionDesk>(`${API}/reception-desks`, body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.formError.set(errorMessage(e));
      },
    });
  }

  remove(d: ReceptionDesk) {
    if (!confirm(`Delete the desk "${d.name}"? Its staff will be able to serve every doctor again.`)) return;
    this.http.delete(`${API}/reception-desks/${d._id}`).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }
}
