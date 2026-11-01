import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { HasPermissionDirective } from '../../core/has-permission.directive';
import { Doctor, PatientRef, Visit } from '../../core/models';
import { STATUS_CLASS, ageText, today } from '../../core/util';
import { PatientPickerComponent } from '../../shared/patient-picker.component';

@Component({
  selector: 'app-visits',
  imports: [FormsModule, RouterLink, HasPermissionDirective, PatientPickerComponent],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <h3 class="mb-0">Consultations (OPD)</h3>
      <button *hasPermission="'opd.create'" class="btn btn-primary" (click)="openForm()"><i class="bi bi-plus-lg me-1"></i>New visit (walk-in)</button>
    </div>

    @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }

    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body py-2 d-flex gap-3 align-items-end flex-wrap">
        <div>
          <label class="form-label small mb-0">Period</label>
          <div class="btn-group btn-group-sm d-flex">
            @for (p of presets; track p.key) {
              <button type="button" class="btn" [class.btn-primary]="preset === p.key" [class.btn-outline-primary]="preset !== p.key" (click)="setPreset(p.key)">{{ p.label }}</button>
            }
          </div>
        </div>
        <div><label class="form-label small mb-0">From</label><input type="date" class="form-control form-control-sm" [ngModel]="from" (ngModelChange)="from = $event; preset = ''; load()" /></div>
        <div><label class="form-label small mb-0">To</label><input type="date" class="form-control form-control-sm" [ngModel]="to" (ngModelChange)="to = $event; preset = ''; load()" /></div>
        <div>
          <label class="form-label small mb-0">Search</label>
          <input class="form-control form-control-sm" placeholder="Name, MRN or phone" [ngModel]="q" (ngModelChange)="q = $event; searchChanged()" />
        </div>
        <div>
          <label class="form-label small mb-0">Doctor</label>
          <select class="form-select form-select-sm" [ngModel]="doctorId" (ngModelChange)="doctorId = $event; load()">
            <option value="">All doctors</option>
            @for (d of doctors(); track d._id) { <option [value]="d._id">{{ d.name }}</option> }
          </select>
        </div>
        <div>
          <label class="form-label small mb-0">Status</label>
          <select class="form-select form-select-sm" [ngModel]="status" (ngModelChange)="status = $event; load()">
            <option value="">All</option><option value="open">Open</option><option value="completed">Completed</option>
          </select>
        </div>
      </div>
    </div>

    <div class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-light"><tr><th>Visit</th><th>Date</th><th>Patient</th><th>Doctor</th><th>Diagnosis</th><th>Status</th><th></th></tr></thead>
          <tbody>
            @for (v of items(); track v._id) {
              <tr>
                <td><code>{{ v.visitNo }}</code></td>
                <td>{{ v.date }}</td>
                <td><span class="fw-semibold">{{ v.patientId?.name }}</span><div class="small text-muted">{{ v.patientId?.mrn }} {{ age(v.patientId) ? '· ' + age(v.patientId) : '' }}</div></td>
                <td>{{ v.doctorId?.name }}</td>
                <td>{{ v.diagnosis || '—' }}</td>
                <td>
                  <span class="badge" [class]="badge(v.status)">{{ v.status }}</span>
                  @if (v.status === 'cancelled' && v.cancelReason) { <div class="small text-muted mt-1">{{ v.cancelReason }}</div> }
                </td>
                <td class="text-end text-nowrap">
                  @if (v.rxId && canPrint()) {
                    <a class="btn btn-sm btn-outline-dark me-1" [routerLink]="['/prescriptions', v.rxId, 'print']" [queryParams]="{ auto: 'print' }" title="Print prescription"><i class="bi bi-printer"></i></a>
                    <a class="btn btn-sm btn-outline-dark me-1" [routerLink]="['/prescriptions', v.rxId, 'print']" [queryParams]="{ auto: 'pdf' }" title="Download PDF"><i class="bi bi-file-earmark-pdf"></i> PDF</a>
                  }
                  @if (v.status === 'open') {
                    <a class="btn btn-sm btn-outline-primary" [routerLink]="['/opd', v._id]">Open</a>
                  } @else {
                    <a class="btn btn-sm btn-outline-primary" [routerLink]="['/visits', v._id]">View</a>
                  }
                </td>
              </tr>
            } @empty { <tr><td colspan="7" class="text-center text-muted py-4">No visits found</td></tr> }
          </tbody>
        </table>
      </div>
    </div>

    @if (showForm()) {
      <div class="modal d-block modal-backdrop-custom" tabindex="-1">
        <div class="modal-dialog">
          <form class="modal-content" (ngSubmit)="start()">
            <div class="modal-header"><h5 class="modal-title">New visit</h5><button type="button" class="btn-close" (click)="showForm.set(false)"></button></div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <div class="mb-3"><label class="form-label">Patient *</label><app-patient-picker [(patient)]="patient" /></div>
              <div class="mb-1">
                <label class="form-label">Doctor *</label>
                <select class="form-select" name="doctor" [(ngModel)]="formDoctor" required>
                  <option value="" disabled>Select doctor</option>
                  @for (d of doctors(); track d._id) { <option [value]="d._id">{{ d.name }}</option> }
                </select>
              </div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-light" (click)="showForm.set(false)">Cancel</button><button class="btn btn-primary" [disabled]="saving()">Start consultation</button></div>
          </form>
        </div>
      </div>
    }
  `,
})
export class VisitsComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  items = signal<Visit[]>([]);
  doctors = signal<Doctor[]>([]);
  showForm = signal(false);
  error = signal('');
  formError = signal('');
  saving = signal(false);

  presets = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'week', label: 'Last 7 days' },
    { key: 'month', label: 'This month' },
    { key: 'all', label: 'All' },
  ];
  preset = 'today';
  from = today();
  to = today();
  q = '';
  private searchTimer: any;
  doctorId = '';
  status = '';
  patient: PatientRef | null = null;
  formDoctor = '';

  canPrint = () => this.auth.hasModule('prescriptions') && this.auth.has('prescriptions.print');
  age = ageText;
  badge = (s: string) => `badge ${STATUS_CLASS[s] ?? 'bg-secondary'}`;

  ngOnInit() {
    this.http.get<Doctor[]>(`${API}/users/doctors`).subscribe((d) => this.doctors.set(d));
    this.load();
    const pid = this.route.snapshot.queryParamMap.get('newFor');
    if (pid && this.auth.has('opd.create')) {
      this.http.get<PatientRef>(`${API}/patients/${pid}`).subscribe((p) => this.openForm(p));
    }
  }

  load() {
    const params: Record<string, string> = {};
    if (this.from) params['from'] = this.from;
    if (this.to) params['to'] = this.to;
    if (this.q.trim()) params['q'] = this.q.trim();
    if (this.doctorId) params['doctorId'] = this.doctorId;
    if (this.status) params['status'] = this.status;
    this.http.get<Visit[]>(`${API}/visits`, { params }).subscribe({
      next: (v) => {
        this.items.set(v);
        this.error.set('');
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  setPreset(key: string) {
    this.preset = key;
    const first = new Date();
    first.setDate(1);
    const monthStart = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`;
    const [from, to] =
      key === 'today' ? [today(), today()]
      : key === 'yesterday' ? [today(-1), today(-1)]
      : key === 'week' ? [today(-6), today()]
      : key === 'month' ? [monthStart, today()]
      : ['', ''];
    this.from = from;
    this.to = to;
    this.load();
  }

  /** Waits for a pause in typing before searching. */
  searchChanged() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 300);
  }

  openForm(p?: PatientRef) {
    this.patient = p ?? null;
    this.formDoctor = this.doctors().length === 1 ? this.doctors()[0]._id : '';
    this.formError.set('');
    this.showForm.set(true);
  }

  start() {
    if (!this.patient || !this.formDoctor) {
      this.formError.set('Select a patient and a doctor');
      return;
    }
    this.saving.set(true);
    this.http.post<Visit>(`${API}/visits`, { patientId: this.patient._id, doctorId: this.formDoctor }).subscribe({
      next: (v) => this.router.navigate(['/opd', v._id]),
      error: (e) => {
        this.saving.set(false);
        this.formError.set(errorMessage(e));
      },
    });
  }
}
