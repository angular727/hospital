import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { API, errorMessage } from '../../core/api';
import { LoadingService } from '../../core/loading.service';
import { Lab } from '../../core/models';

/** The labs of the hospital. Every lab has its own test list and its own staff (set in Users). */
@Component({
  selector: 'app-labs',
  imports: [FormsModule],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
      <h3 class="mb-0">Labs</h3>
      <button class="btn btn-primary" (click)="openForm()"><i class="bi bi-plus-lg me-1"></i>Add lab</button>
    </div>
    <p class="text-muted small">
      Add each laboratory once (for example Main Lab, Radiology, or an outside lab). Add its tests in "Lab tests", and put its staff in a lab from "Users".
      When a doctor picks tests, each test goes to its own lab automatically.
    </p>

    @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }

    <div class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table table-hover mb-0 align-middle">
          <thead class="table-light"><tr><th>Lab</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
          <tbody>
            @for (l of labs(); track l._id) {
              <tr>
                <td class="fw-semibold">{{ l.name }}</td>
                <td><span class="badge" [class.text-bg-success]="l.isActive" [class.text-bg-secondary]="!l.isActive">{{ l.isActive ? 'Active' : 'Not active' }}</span></td>
                <td class="text-end text-nowrap">
                  <button class="btn btn-sm btn-outline-secondary me-1" (click)="openForm(l)">Rename</button>
                  <button class="btn btn-sm btn-outline-warning me-1" (click)="toggle(l)">{{ l.isActive ? 'Deactivate' : 'Activate' }}</button>
                  <button class="btn btn-sm btn-outline-danger" (click)="remove(l)"><i class="bi bi-trash"></i> Delete</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="3" class="text-center text-muted py-4">
                @if (loading.busy()) { <span class="spinner-border spinner-border-sm me-2"></span>Loading labs… } @else { No labs yet. }
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
              <h5 class="modal-title">{{ editingId ? 'Rename lab' : 'Add lab' }}</h5>
              <button type="button" class="btn-close" (click)="showForm.set(false)"></button>
            </div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <label class="form-label">Lab name *</label>
              <input class="form-control" name="name" [(ngModel)]="name" placeholder="e.g. Radiology" required autocomplete="off" />
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
export class LabsComponent implements OnInit {
  private http = inject(HttpClient);
  loading = inject(LoadingService);

  labs = signal<Lab[]>([]);
  error = signal('');
  showForm = signal(false);
  formError = signal('');
  saving = signal(false);
  editingId = '';
  name = '';

  ngOnInit() {
    this.load();
  }

  load() {
    this.http.get<Lab[]>(`${API}/lab/labs`).subscribe({
      next: (l) => {
        this.labs.set(l);
        this.error.set('');
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  openForm(l?: Lab) {
    this.formError.set('');
    this.editingId = l?._id ?? '';
    this.name = l?.name ?? '';
    this.showForm.set(true);
  }

  save() {
    if (!this.name.trim()) {
      this.formError.set('Enter the lab name');
      return;
    }
    this.saving.set(true);
    const req = this.editingId
      ? this.http.put<Lab>(`${API}/lab/labs/${this.editingId}`, { name: this.name })
      : this.http.post<Lab>(`${API}/lab/labs`, { name: this.name });
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

  toggle(l: Lab) {
    this.http.put(`${API}/lab/labs/${l._id}`, { isActive: !l.isActive }).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  remove(l: Lab) {
    if (!confirm(`Delete "${l.name}"? A lab that already has tests or orders cannot be deleted; deactivate it instead.`)) return;
    this.http.delete(`${API}/lab/labs/${l._id}`).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }
}
