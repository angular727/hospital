import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { API, errorMessage } from '../../core/api';
import { LoadingService } from '../../core/loading.service';
import { BedRow, WardRow } from '../../core/models';

/** Wards and their beds, with the charge per day and who is in each bed right now. */
@Component({
  selector: 'app-wards',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
      <h3 class="mb-0">Wards and beds</h3>
      <button class="btn btn-primary" (click)="openWard()"><i class="bi bi-plus-lg me-1"></i>Add ward</button>
    </div>
    <p class="text-muted small">Make each ward once, then add its beds with the charge per day. The doctor picks a free bed when admitting a patient, and the bed charge goes on the bill at discharge.</p>
    @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }

    @for (w of wards(); track w._id) {
      <div class="card border-0 shadow-sm mb-3">
        <div class="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <span class="fw-semibold fs-5">{{ w.name }}</span>
            <span class="badge ms-2" [class.text-bg-success]="w.isActive" [class.text-bg-secondary]="!w.isActive">{{ w.isActive ? 'Active' : 'Not active' }}</span>
            <span class="text-muted small ms-2">{{ w.occupiedBeds }} of {{ w.totalBeds }} beds in use</span>
          </div>
          <div class="d-flex gap-1 flex-wrap">
            <button class="btn btn-sm btn-primary" (click)="openBeds(w)"><i class="bi bi-plus-lg me-1"></i>Add beds</button>
            <button class="btn btn-sm btn-outline-secondary" (click)="openWard(w)">Rename</button>
            <button class="btn btn-sm btn-outline-warning" (click)="toggleWard(w)">{{ w.isActive ? 'Deactivate' : 'Activate' }}</button>
            <button class="btn btn-sm btn-outline-danger" (click)="removeWard(w)"><i class="bi bi-trash"></i></button>
          </div>
        </div>
        <div class="table-responsive">
          <table class="table table-sm align-middle mb-0">
            <thead class="table-light"><tr><th>Bed</th><th class="text-end">Per day</th><th>Now</th><th class="text-end">Actions</th></tr></thead>
            <tbody>
              @for (b of w.beds; track b._id) {
                <tr [class.text-muted]="!b.isActive">
                  <td class="fw-semibold">{{ b.name }}</td>
                  <td class="text-end">{{ b.dailyCharge | number: '1.0-0' }}</td>
                  <td>
                    @if (!b.isActive) { <span class="badge text-bg-secondary">Not active</span> }
                    @else if (b.occupied) { <span class="badge text-bg-danger">In use</span> <span class="small">{{ b.occupied.patient }}</span> }
                    @else { <span class="badge text-bg-success">Free</span> }
                  </td>
                  <td class="text-end text-nowrap">
                    <button class="btn btn-sm btn-outline-secondary me-1" (click)="openBed(b)">Edit</button>
                    <button class="btn btn-sm btn-outline-warning me-1" [disabled]="!!b.occupied" (click)="toggleBed(b)">{{ b.isActive ? 'Deactivate' : 'Activate' }}</button>
                    <button class="btn btn-sm btn-outline-danger" [disabled]="!!b.occupied" (click)="removeBed(b)"><i class="bi bi-trash"></i></button>
                  </td>
                </tr>
              } @empty { <tr><td colspan="4" class="text-center text-muted py-3">No beds yet. Click "Add beds".</td></tr> }
            </tbody>
          </table>
        </div>
      </div>
    } @empty {
      <div class="text-center text-muted py-5">
        @if (loading.busy()) { <span class="spinner-border spinner-border-sm me-2"></span>Loading wards… } @else { No wards yet. Click "Add ward" to make the first one. }
      </div>
    }

    @if (mode() === 'ward') {
      <div class="modal d-block modal-backdrop-custom" tabindex="-1">
        <div class="modal-dialog">
          <form class="modal-content" (ngSubmit)="saveWard()">
            <div class="modal-header"><h5 class="modal-title">{{ editingId ? 'Rename ward' : 'Add ward' }}</h5><button type="button" class="btn-close" (click)="close()"></button></div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <label class="form-label">Ward name *</label>
              <input class="form-control" name="wname" [(ngModel)]="wardName" placeholder="e.g. General ward, ICU, Private rooms" autocomplete="off" />
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-light" (click)="close()">Cancel</button><button class="btn btn-primary" [disabled]="saving()">Save</button></div>
          </form>
        </div>
      </div>
    }

    @if (mode() === 'beds' && target(); as w) {
      <div class="modal d-block modal-backdrop-custom" tabindex="-1">
        <div class="modal-dialog">
          <form class="modal-content" (ngSubmit)="saveBeds()">
            <div class="modal-header"><h5 class="modal-title">Add beds to {{ w.name }}</h5><button type="button" class="btn-close" (click)="close()"></button></div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <div class="row g-3">
                <div class="col-6"><label class="form-label">How many beds</label><input type="number" min="1" max="100" class="form-control" name="count" [(ngModel)]="bedCount" /></div>
                <div class="col-6"><label class="form-label">Charge per day *</label><input type="number" min="0" class="form-control" name="rate" [(ngModel)]="bedRate" /></div>
                @if (bedCount > 1) {
                  <div class="col-12"><label class="form-label">Name starts with</label><input class="form-control" name="prefix" [(ngModel)]="bedPrefix" placeholder="Bed " /><div class="form-text">Beds are named {{ bedPrefix }}1, {{ bedPrefix }}2 and so on. Numbers already in use are skipped.</div></div>
                } @else {
                  <div class="col-12"><label class="form-label">Bed name *</label><input class="form-control" name="bname" [(ngModel)]="bedName" placeholder="e.g. Bed 1, Room 3" autocomplete="off" /></div>
                }
              </div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-light" (click)="close()">Cancel</button><button class="btn btn-primary" [disabled]="saving()">Add</button></div>
          </form>
        </div>
      </div>
    }

    @if (mode() === 'bed' && bed(); as b) {
      <div class="modal d-block modal-backdrop-custom" tabindex="-1">
        <div class="modal-dialog">
          <form class="modal-content" (ngSubmit)="saveBed()">
            <div class="modal-header"><h5 class="modal-title">Edit {{ b.name }}</h5><button type="button" class="btn-close" (click)="close()"></button></div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <div class="row g-3">
                <div class="col-6"><label class="form-label">Bed name *</label><input class="form-control" name="ename" [(ngModel)]="bedName" /></div>
                <div class="col-6"><label class="form-label">Charge per day</label><input type="number" min="0" class="form-control" name="erate" [(ngModel)]="bedRate" /></div>
              </div>
              <div class="form-text mt-2">A new charge applies to new admissions only. Patients already in this bed keep the charge they were admitted with.</div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-light" (click)="close()">Cancel</button><button class="btn btn-primary" [disabled]="saving()">Save</button></div>
          </form>
        </div>
      </div>
    }
  `,
})
export class WardsComponent implements OnInit {
  private http = inject(HttpClient);
  loading = inject(LoadingService);

  wards = signal<WardRow[]>([]);
  error = signal('');
  mode = signal<'' | 'ward' | 'beds' | 'bed'>('');
  formError = signal('');
  saving = signal(false);
  editingId = '';
  target = signal<WardRow | null>(null);
  bed = signal<BedRow | null>(null);
  wardName = '';
  bedName = '';
  bedPrefix = 'Bed ';
  bedCount = 5;
  bedRate = 1000;

  ngOnInit() {
    this.load();
  }

  load() {
    this.http.get<WardRow[]>(`${API}/ipd/wards`).subscribe({
      next: (w) => {
        this.wards.set(w);
        this.error.set('');
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  close() {
    this.mode.set('');
    this.formError.set('');
  }

  private run(req: ReturnType<HttpClient['get']>) {
    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.close();
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.formError.set(errorMessage(e));
      },
    });
  }

  openWard(w?: WardRow) {
    this.editingId = w?._id ?? '';
    this.wardName = w?.name ?? '';
    this.formError.set('');
    this.mode.set('ward');
  }

  saveWard() {
    if (!this.wardName.trim()) return this.formError.set('Enter the ward name');
    this.run(this.editingId ? this.http.put(`${API}/ipd/wards/${this.editingId}`, { name: this.wardName }) : this.http.post(`${API}/ipd/wards`, { name: this.wardName }));
  }

  toggleWard(w: WardRow) {
    this.http.put(`${API}/ipd/wards/${w._id}`, { isActive: !w.isActive }).subscribe({ next: () => this.load(), error: (e) => this.error.set(errorMessage(e)) });
  }

  removeWard(w: WardRow) {
    if (!confirm(`Delete the ward "${w.name}" and its beds? A ward that was already used cannot be deleted; deactivate it instead.`)) return;
    this.http.delete(`${API}/ipd/wards/${w._id}`).subscribe({ next: () => this.load(), error: (e) => this.error.set(errorMessage(e)) });
  }

  openBeds(w: WardRow) {
    this.target.set(w);
    this.bedName = '';
    this.formError.set('');
    this.mode.set('beds');
  }

  saveBeds() {
    const w = this.target();
    if (!w) return;
    if (this.bedCount <= 1 && !this.bedName.trim()) return this.formError.set('Enter the bed name');
    this.run(this.http.post(`${API}/ipd/wards/${w._id}/beds`, { count: this.bedCount, prefix: this.bedPrefix, name: this.bedName, dailyCharge: Number(this.bedRate) || 0 }));
  }

  openBed(b: BedRow) {
    this.bed.set(b);
    this.bedName = b.name;
    this.bedRate = b.dailyCharge;
    this.formError.set('');
    this.mode.set('bed');
  }

  saveBed() {
    const b = this.bed();
    if (!b) return;
    if (!this.bedName.trim()) return this.formError.set('Enter the bed name');
    this.run(this.http.put(`${API}/ipd/beds/${b._id}`, { name: this.bedName, dailyCharge: Number(this.bedRate) || 0 }));
  }

  toggleBed(b: BedRow) {
    this.http.put(`${API}/ipd/beds/${b._id}`, { isActive: !b.isActive }).subscribe({ next: () => this.load(), error: (e) => this.error.set(errorMessage(e)) });
  }

  removeBed(b: BedRow) {
    if (!confirm(`Delete ${b.name}? A bed that was already used cannot be deleted; deactivate it instead.`)) return;
    this.http.delete(`${API}/ipd/beds/${b._id}`).subscribe({ next: () => this.load(), error: (e) => this.error.set(errorMessage(e)) });
  }
}
