import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { API, errorMessage } from '../../core/api';
import { LoadingService } from '../../core/loading.service';
import { Lab, LabTest } from '../../core/models';

/** The hospital's lab test list: name, price and the normal range printed on the report. */
@Component({
  selector: 'app-lab-tests',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
      <h3 class="mb-0">Lab tests</h3>
      <button class="btn btn-primary" (click)="openForm()"><i class="bi bi-plus-lg me-1"></i>Add test</button>
    </div>
    <p class="text-muted small">Add each test once with its price and normal range. When a lab order is placed, the price goes on the bill and the range is printed on the report.</p>

    @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }

    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body py-2 d-flex align-items-center gap-3">
        <div class="input-group" style="max-width: 360px">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input class="form-control" placeholder="Search tests" [ngModel]="q()" (ngModelChange)="q.set($event)" />
        </div>
        @if (labs().length > 1) {
          <select class="form-select" style="max-width: 220px" [ngModel]="labFilter()" (ngModelChange)="labFilter.set($event)">
            <option value="">All labs</option>
            @for (l of labs(); track l._id) { <option [value]="l._id">{{ l.name }}</option> }
          </select>
        }
        <div class="ms-auto text-muted small">{{ filtered().length }} test(s)</div>
      </div>
    </div>

    <div class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-light"><tr><th>Test</th><th>Category</th><th>Lab</th><th class="text-end">Price</th><th>Unit</th><th>Normal range</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
          <tbody>
            @for (t of filtered(); track t._id) {
              <tr>
                <td class="fw-semibold">{{ t.name }}</td>
                <td>{{ t.category || '—' }}</td>
                <td>{{ t.labId?.name || '—' }}</td>
                <td class="text-end">{{ t.price | number: '1.0-2' }}</td>
                <td>{{ t.unit || '—' }}</td>
                <td>{{ t.normalRange || '—' }}</td>
                <td><span class="badge" [class.text-bg-success]="t.isActive" [class.text-bg-secondary]="!t.isActive">{{ t.isActive ? 'Active' : 'Hidden' }}</span></td>
                <td class="text-end text-nowrap">
                  <button class="btn btn-sm btn-outline-secondary me-1" (click)="openForm(t)">Edit</button>
                  <button class="btn btn-sm btn-outline-danger" (click)="remove(t)"><i class="bi bi-trash"></i> Delete</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="text-center text-muted py-4">
                @if (loading.busy()) { <span class="spinner-border spinner-border-sm me-2"></span>Loading tests… }
                @else { {{ q() ? 'No test matches your search' : 'No tests yet. Click "Add test" to create the first one.' }} }
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
              <h5 class="modal-title">{{ editingId ? 'Edit test' : 'Add test' }}</h5>
              <button type="button" class="btn-close" (click)="showForm.set(false)"></button>
            </div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <div class="mb-3"><label class="form-label">Test name *</label><input class="form-control" name="name" [(ngModel)]="form.name" placeholder="e.g. Blood sugar (fasting)" required autocomplete="off" /></div>
              <div class="row g-3">
                <div class="col-12">
                  <label class="form-label">Lab *</label>
                  <select class="form-select" name="labId" [(ngModel)]="form.labId" [disabled]="!!editingId || labs().length < 2">
                    @for (l of labs(); track l._id) { <option [value]="l._id">{{ l.name }}</option> }
                  </select>
                  @if (editingId) { <div class="form-text">The lab of a test cannot be changed. Delete the test and add it to the other lab.</div> }
                </div>
                <div class="col-6"><label class="form-label">Category</label><input class="form-control" list="lcat" name="category" [(ngModel)]="form.category" placeholder="Hematology" /></div>
                <div class="col-6"><label class="form-label">Price *</label><input type="number" min="0" class="form-control" name="price" [(ngModel)]="form.price" /></div>
                <div class="col-6"><label class="form-label">Unit</label><input class="form-control" name="unit" [(ngModel)]="form.unit" placeholder="mg/dL" /></div>
                <div class="col-6"><label class="form-label">Normal range</label><input class="form-control" name="normalRange" [(ngModel)]="form.normalRange" placeholder="70 - 110" /></div>
                <div class="col-12">
                  <div class="form-check"><input class="form-check-input" type="checkbox" id="lt-active" name="isActive" [(ngModel)]="form.isActive" /><label class="form-check-label" for="lt-active">Active (can be ordered)</label></div>
                </div>
              </div>
              <datalist id="lcat">@for (c of categories; track c) { <option [value]="c"></option> }</datalist>
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
export class LabTestsComponent implements OnInit {
  private http = inject(HttpClient);
  loading = inject(LoadingService);

  items = signal<LabTest[]>([]);
  labs = signal<Lab[]>([]);
  labFilter = signal('');
  q = signal('');
  filtered = computed(() => {
    const q = this.q().trim().toLowerCase();
    const lab = this.labFilter();
    return this.items().filter((t) => (!lab || t.labId?._id === lab) && (!q || t.name.toLowerCase().includes(q) || (t.category ?? '').toLowerCase().includes(q)));
  });
  showForm = signal(false);
  error = signal('');
  formError = signal('');
  saving = signal(false);

  categories = ['Hematology', 'Biochemistry', 'Urine', 'Serology', 'Microbiology', 'Hormones', 'Radiology'];
  editingId = '';
  form = this.emptyForm();

  ngOnInit() {
    this.load();
    this.http.get<Lab[]>(`${API}/lab/labs`).subscribe((l) => this.labs.set(l));
  }

  private emptyForm() {
    return { name: '', labId: this.labFilter() || this.labs()[0]?._id || '', category: '', price: 0, unit: '', normalRange: '', isActive: true };
  }

  load() {
    this.http.get<LabTest[]>(`${API}/lab/tests`).subscribe({
      next: (t) => {
        this.items.set(t);
        this.error.set('');
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  openForm(t?: LabTest) {
    this.formError.set('');
    this.editingId = t?._id ?? '';
    this.form = t
      ? { name: t.name, labId: t.labId?._id ?? '', category: t.category ?? '', price: t.price, unit: t.unit ?? '', normalRange: t.normalRange ?? '', isActive: t.isActive }
      : this.emptyForm();
    this.showForm.set(true);
  }

  save() {
    if (!this.form.name.trim()) {
      this.formError.set('Enter the test name');
      return;
    }
    if (!this.form.labId) {
      this.formError.set('Select the lab');
      return;
    }
    this.saving.set(true);
    const body = { ...this.form, price: Number(this.form.price) || 0 };
    const req = this.editingId
      ? this.http.put<LabTest>(`${API}/lab/tests/${this.editingId}`, body)
      : this.http.post<LabTest>(`${API}/lab/tests`, body);
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

  remove(t: LabTest) {
    if (!confirm(`Delete "${t.name}" from the test list? Old lab orders are not affected.`)) return;
    this.http.delete(`${API}/lab/tests/${t._id}`).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }
}
