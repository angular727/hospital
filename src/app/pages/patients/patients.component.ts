import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { API, errorMessage } from '../../core/api';
import { HasPermissionDirective } from '../../core/has-permission.directive';
import { Patient } from '../../core/models';
import { LoadingService } from '../../core/loading.service';
import { ageText } from '../../core/util';

interface PatientForm {
  name: string; fatherName: string; gender: string; age: number | null; dob: string; bloodGroup: string;
  phone: string; cnic: string; city: string; address: string; allergies: string; chronicConditions: string;
  emergencyName: string; emergencyPhone: string; notes: string;
}

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

@Component({
  selector: 'app-patients',
  imports: [FormsModule, RouterLink, HasPermissionDirective],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <h3 class="mb-0">Patients</h3>
      <button *hasPermission="'patients.create'" class="btn btn-primary" (click)="openForm()"><i class="bi bi-person-plus me-1"></i>New patient</button>
    </div>

    @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }
    @if (notice()) { <div class="alert alert-success py-2">{{ notice() }}</div> }

    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body py-2 d-flex gap-3 align-items-center flex-wrap">
        <div class="input-group" style="max-width: 420px">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input class="form-control" placeholder="Search by name, phone, ID or CNIC" [ngModel]="q" (ngModelChange)="onSearch($event)" />
        </div>
        <div class="form-check mb-0">
          <input class="form-check-input" type="checkbox" id="arch" [ngModel]="archived" (ngModelChange)="archived = $event; page = 1; load()" />
          <label class="form-check-label small" for="arch">Show archived</label>
        </div>
        <div class="ms-auto text-muted small">{{ total() }} patient(s)</div>
      </div>
    </div>

    <div class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-light"><tr><th>ID</th><th>Name</th><th>Gender / Age</th><th>Phone</th><th>City</th><th>Registered</th><th class="text-end">Actions</th></tr></thead>
          <tbody>
            @for (p of items(); track p._id) {
              <tr>
                <td><code>{{ p.mrn }}</code></td>
                <td>
                  <a class="fw-semibold text-decoration-none" [routerLink]="['/patients', p._id]">{{ p.name }}</a>
                  @if (p.allergies) { <span class="badge bg-danger ms-1" title="Allergies: {{ p.allergies }}">allergy</span> }
                  @if (p.fatherName) { <div class="small text-muted">S/D/W of {{ p.fatherName }}</div> }
                </td>
                <td class="text-capitalize">{{ p.gender }}{{ age(p) ? ' · ' + age(p) : '' }}</td>
                <td>{{ p.phone || '—' }}</td>
                <td>{{ p.city || '—' }}</td>
                <td>{{ p.createdAt.slice(0, 10) }}</td>
                <td class="text-end text-nowrap">
                  <a class="btn btn-sm btn-outline-primary me-1" [routerLink]="['/patients', p._id]" title="See all visits, prescriptions and bills of this patient"><i class="bi bi-clock-history me-1"></i>Visit history</a>
                  @if (archived) {
                    <button *hasPermission="'patients.delete'" class="btn btn-sm btn-outline-success" (click)="restore(p)">Restore</button>
                  } @else {
                    <button *hasPermission="'patients.edit'" class="btn btn-sm btn-outline-secondary me-1" (click)="openForm(p)">Edit</button>
                    <button *hasPermission="'patients.delete'" class="btn btn-sm btn-outline-danger" (click)="archive(p)">Archive</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="text-center text-muted py-4">@if (loading.busy()) { <span class="spinner-border spinner-border-sm me-2"></span>Loading patients… } @else { {{ q ? 'No patients match your search' : 'No patients yet' }} }</td></tr>
            }
          </tbody>
        </table>
      </div>
      @if (total() > limit) {
        <div class="card-footer d-flex justify-content-between align-items-center bg-white">
          <button class="btn btn-sm btn-outline-secondary" [disabled]="page <= 1" (click)="go(page - 1)">Previous</button>
          <span class="small text-muted">Page {{ page }} of {{ pages() }}</span>
          <button class="btn btn-sm btn-outline-secondary" [disabled]="page >= pages()" (click)="go(page + 1)">Next</button>
        </div>
      }
    </div>

    @if (showForm()) {
      <div class="modal d-block modal-backdrop-custom" tabindex="-1">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
          <form class="modal-content" (ngSubmit)="save()">
            <div class="modal-header"><h5 class="modal-title">{{ editingId ? 'Edit patient' : 'New patient' }}</h5><button type="button" class="btn-close" (click)="showForm.set(false)"></button></div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Full name *</label><input class="form-control" name="name" [(ngModel)]="form.name" required /></div>
                <div class="col-md-6"><label class="form-label">Father / husband name</label><input class="form-control" name="fatherName" [(ngModel)]="form.fatherName" /></div>
                <div class="col-md-3">
                  <label class="form-label">Gender</label>
                  <select class="form-select" name="gender" [(ngModel)]="form.gender">
                    <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                  </select>
                </div>
                <div class="col-md-3"><label class="form-label">Age (years)</label><input type="number" min="0" max="130" class="form-control" name="age" [(ngModel)]="form.age" /></div>
                <div class="col-md-3"><label class="form-label">Date of birth</label><input type="date" class="form-control" name="dob" [(ngModel)]="form.dob" /></div>
                <div class="col-md-3">
                  <label class="form-label">Blood group</label>
                  <select class="form-select" name="bloodGroup" [(ngModel)]="form.bloodGroup">
                    <option value="">—</option>
                    @for (b of blood; track b) { <option [value]="b">{{ b }}</option> }
                  </select>
                </div>
                <div class="col-md-4"><label class="form-label">Phone</label><input class="form-control" name="phone" [(ngModel)]="form.phone" placeholder="03xx-xxxxxxx" /></div>
                <div class="col-md-4"><label class="form-label">CNIC</label><input class="form-control" name="cnic" [(ngModel)]="form.cnic" placeholder="xxxxx-xxxxxxx-x" /></div>
                <div class="col-md-4"><label class="form-label">City</label><input class="form-control" name="city" [(ngModel)]="form.city" /></div>
                <div class="col-12"><label class="form-label">Address</label><input class="form-control" name="address" [(ngModel)]="form.address" /></div>
                <div class="col-md-6"><label class="form-label text-danger">Allergies</label><input class="form-control" name="allergies" [(ngModel)]="form.allergies" placeholder="e.g. Penicillin" /></div>
                <div class="col-md-6"><label class="form-label">Chronic conditions</label><input class="form-control" name="chronic" [(ngModel)]="form.chronicConditions" placeholder="e.g. Diabetes, Hypertension" /></div>
                <div class="col-md-6"><label class="form-label">Emergency contact name</label><input class="form-control" name="en" [(ngModel)]="form.emergencyName" /></div>
                <div class="col-md-6"><label class="form-label">Emergency contact phone</label><input class="form-control" name="ep" [(ngModel)]="form.emergencyPhone" /></div>
                <div class="col-12"><label class="form-label">Notes</label><textarea class="form-control" rows="2" name="notes" [(ngModel)]="form.notes"></textarea></div>
              </div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-light" (click)="showForm.set(false)">Cancel</button><button class="btn btn-primary" [disabled]="saving()">{{ editingId ? 'Save changes' : 'Register patient' }}</button></div>
          </form>
        </div>
      </div>
    }
  `,
})
export class PatientsComponent implements OnInit {
  private http = inject(HttpClient);
  loading = inject(LoadingService);
  private router = inject(Router);

  items = signal<Patient[]>([]);
  total = signal(0);
  showForm = signal(false);
  error = signal('');
  notice = signal('');
  formError = signal('');
  saving = signal(false);

  blood = BLOOD;
  q = '';
  archived = false;
  page = 1;
  limit = 20;
  editingId = '';
  form: PatientForm = this.emptyForm();
  private timer: any;

  age = ageText;
  pages = () => Math.max(Math.ceil(this.total() / this.limit), 1);

  ngOnInit() {
    this.load();
  }

  private emptyForm(): PatientForm {
    return { name: '', fatherName: '', gender: 'male', age: null, dob: '', bloodGroup: '', phone: '', cnic: '', city: '', address: '', allergies: '', chronicConditions: '', emergencyName: '', emergencyPhone: '', notes: '' };
  }

  onSearch(v: string) {
    this.q = v;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.page = 1;
      this.load();
    }, 300);
  }

  go(p: number) {
    this.page = p;
    this.load();
  }

  load() {
    const params: Record<string, string | number> = { page: this.page, limit: this.limit };
    if (this.q.trim()) params['q'] = this.q.trim();
    if (this.archived) params['archived'] = 1;
    this.http.get<{ items: Patient[]; total: number }>(`${API}/patients`, { params }).subscribe({
      next: (r) => {
        this.items.set(r.items);
        this.total.set(r.total);
        this.error.set('');
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  openForm(p?: Patient) {
    this.formError.set('');
    this.editingId = p?._id ?? '';
    this.form = p ? this.fromPatient(p) : this.emptyForm();
    this.showForm.set(true);
  }

  private fromPatient(p: Patient): PatientForm {
    return {
      name: p.name, fatherName: p.fatherName ?? '', gender: p.gender ?? 'male', age: p.age ?? null,
      dob: p.dob ? p.dob.slice(0, 10) : '', bloodGroup: p.bloodGroup ?? '', phone: p.phone ?? '', cnic: p.cnic ?? '',
      city: p.city ?? '', address: p.address ?? '', allergies: p.allergies ?? '', chronicConditions: p.chronicConditions ?? '',
      emergencyName: p.emergencyName ?? '', emergencyPhone: p.emergencyPhone ?? '', notes: p.notes ?? '',
    };
  }

  save() {
    if (!this.form.name.trim()) {
      this.formError.set('Patient name is required');
      return;
    }
    const src = this.form as unknown as Record<string, unknown>;
    const body: Record<string, unknown> = {};
    for (const k of Object.keys(src)) body[k] = src[k] === '' ? (this.editingId ? '' : undefined) : src[k];
    this.saving.set(true);
    const req = this.editingId ? this.http.put<Patient>(`${API}/patients/${this.editingId}`, body) : this.http.post<Patient>(`${API}/patients`, body);
    req.subscribe({
      next: (p) => {
        this.saving.set(false);
        this.showForm.set(false);
        if (!this.editingId) {
          this.notice.set(`Registered ${p.name} (${p.mrn})`);
          setTimeout(() => this.notice.set(''), 4000);
        }
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.formError.set(errorMessage(e));
      },
    });
  }

  archive(p: Patient) {
    if (!confirm(`Archive ${p.name}? The record is kept and can be restored.`)) return;
    this.http.delete(`${API}/patients/${p._id}`).subscribe({ next: () => this.load(), error: (e) => this.error.set(errorMessage(e)) });
  }

  restore(p: Patient) {
    this.http.post(`${API}/patients/${p._id}/restore`, {}).subscribe({ next: () => this.load(), error: (e) => this.error.set(errorMessage(e)) });
  }
}
