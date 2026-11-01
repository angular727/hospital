import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { API, errorMessage } from '../../core/api';
import { LoadingService } from '../../core/loading.service';
import { Medicine } from '../../core/models';
import { DURATIONS, FREQUENCIES } from '../../core/util';

/** The hospital's own medicine list. Picking a medicine in a prescription fills in the details saved here. */
@Component({
  selector: 'app-medicines',
  imports: [FormsModule],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
      <h3 class="mb-0">Medicines</h3>
      <button class="btn btn-primary" (click)="openForm()"><i class="bi bi-plus-lg me-1"></i>Add medicine</button>
    </div>
    <p class="text-muted small">
      Write a medicine once with its usual dose, frequency and duration. When a doctor picks it in a prescription, everything is filled in.
      Medicines you prescribe are also added here automatically the first time.
    </p>

    @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }

    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body py-2 d-flex align-items-center gap-3">
        <div class="input-group" style="max-width: 360px">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input class="form-control" placeholder="Search medicines" [ngModel]="q()" (ngModelChange)="q.set($event)" />
        </div>
        <div class="ms-auto text-muted small">{{ filtered().length }} medicine(s)</div>
      </div>
    </div>

    <div class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-light"><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Instructions</th><th class="text-end">Actions</th></tr></thead>
          <tbody>
            @for (m of filtered(); track m._id) {
              <tr>
                <td class="fw-semibold">{{ m.name }}</td>
                <td>{{ m.dose || '—' }}</td>
                <td>{{ m.frequency || '—' }}</td>
                <td>{{ m.duration || '—' }}</td>
                <td>{{ m.instructions || '—' }}</td>
                <td class="text-end text-nowrap">
                  <button class="btn btn-sm btn-outline-secondary me-1" (click)="openForm(m)">Edit</button>
                  <button class="btn btn-sm btn-outline-danger" (click)="remove(m)"><i class="bi bi-trash"></i> Delete</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="text-center text-muted py-4">
                @if (loading.busy()) { <span class="spinner-border spinner-border-sm me-2"></span>Loading medicines… }
                @else { {{ q() ? 'No medicine matches your search' : 'No medicines yet. Add one, or write a prescription and it will appear here.' }} }
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
              <h5 class="modal-title">{{ editingId ? 'Edit medicine' : 'Add medicine' }}</h5>
              <button type="button" class="btn-close" (click)="showForm.set(false)"></button>
            </div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <div class="mb-3"><label class="form-label">Medicine name *</label><input class="form-control" name="name" [(ngModel)]="form.name" placeholder="e.g. Tab Paracetamol 500mg" required autocomplete="off" /></div>
              <div class="row g-3">
                <div class="col-6"><label class="form-label">Dose</label><input class="form-control" name="dose" [(ngModel)]="form.dose" placeholder="1 tab" /></div>
                <div class="col-6"><label class="form-label">Frequency</label><input class="form-control" list="mfreq" name="frequency" [(ngModel)]="form.frequency" placeholder="1+0+1" /></div>
                <div class="col-6"><label class="form-label">Duration</label><input class="form-control" list="mdur" name="duration" [(ngModel)]="form.duration" placeholder="5 days" /></div>
                <div class="col-6"><label class="form-label">Instructions</label><input class="form-control" name="instructions" [(ngModel)]="form.instructions" placeholder="after meals" /></div>
              </div>
              <datalist id="mfreq">@for (x of frequencies; track x) { <option [value]="x"></option> }</datalist>
              <datalist id="mdur">@for (x of durations; track x) { <option [value]="x"></option> }</datalist>
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
export class MedicinesComponent implements OnInit {
  private http = inject(HttpClient);
  loading = inject(LoadingService);

  items = signal<Medicine[]>([]);
  q = signal('');
  filtered = computed(() => {
    const q = this.q().trim().toLowerCase();
    return q ? this.items().filter((m) => m.name.toLowerCase().includes(q)) : this.items();
  });
  showForm = signal(false);
  error = signal('');
  formError = signal('');
  saving = signal(false);

  frequencies = FREQUENCIES;
  durations = DURATIONS;
  editingId = '';
  form = this.emptyForm();

  ngOnInit() {
    this.load();
  }

  private emptyForm() {
    return { name: '', dose: '', frequency: '', duration: '', instructions: '' };
  }

  load() {
    this.http.get<Medicine[]>(`${API}/medicines`).subscribe({
      next: (m) => {
        this.items.set(m);
        this.error.set('');
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  openForm(m?: Medicine) {
    this.formError.set('');
    this.editingId = m?._id ?? '';
    this.form = m
      ? { name: m.name, dose: m.dose ?? '', frequency: m.frequency ?? '', duration: m.duration ?? '', instructions: m.instructions ?? '' }
      : this.emptyForm();
    this.showForm.set(true);
  }

  save() {
    if (!this.form.name.trim()) {
      this.formError.set('Enter the medicine name');
      return;
    }
    this.saving.set(true);
    const req = this.editingId
      ? this.http.put<Medicine>(`${API}/medicines/${this.editingId}`, this.form)
      : this.http.post<Medicine>(`${API}/medicines`, this.form);
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

  remove(m: Medicine) {
    if (!confirm(`Delete "${m.name}" from the medicine list? Old prescriptions are not affected.`)) return;
    this.http.delete(`${API}/medicines/${m._id}`).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }
}
