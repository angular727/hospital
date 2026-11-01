import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { LoadingService } from '../../core/loading.service';
import { Doctor, EmergencyRow, PatientRef } from '../../core/models';
import { PatientPickerComponent } from '../../shared/patient-picker.component';

/** The emergency desk: who is waiting (red first), and the form to register a patient in seconds. */
@Component({
  selector: 'app-emergency',
  imports: [FormsModule, RouterLink, DecimalPipe, PatientPickerComponent],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <h3 class="mb-0"><i class="bi bi-lightning-charge-fill text-danger me-1"></i>Emergency</h3>
      @if (auth.has('emergency.create')) { <button class="btn btn-danger" (click)="openForm()"><i class="bi bi-plus-lg me-1"></i>Register patient</button> }
    </div>
    @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }

    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body py-2 d-flex align-items-center gap-2 flex-wrap">
        <ul class="nav nav-pills">
          <li class="nav-item"><button class="nav-link py-1" [class.active]="view === 'active'" (click)="view = 'active'; load()">Waiting and in treatment</button></li>
          <li class="nav-item"><button class="nav-link py-1" [class.active]="view === 'closed'" (click)="view = 'closed'; load()">Closed</button></li>
        </ul>
        <div class="input-group" style="max-width: 260px">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input class="form-control" placeholder="Patient, MR no. or case no." [(ngModel)]="q" (keyup.enter)="load()" />
        </div>
        <button class="btn btn-outline-secondary" (click)="load()"><i class="bi bi-arrow-repeat"></i></button>
        @if (auth.me()?.user?.isDoctor) {
          <div class="form-check ms-2 mb-0"><input class="form-check-input" type="checkbox" id="mine" name="mine" [(ngModel)]="mine" (ngModelChange)="load()" /><label class="form-check-label small" for="mine">My patients only</label></div>
        }
        @if (view === 'active') { <span class="ms-auto small text-muted">Refreshes by itself every 20 seconds</span> }
      </div>
    </div>

    @if (view === 'active') {
      <div class="row g-3">
        @for (c of rows(); track c._id) {
          <div class="col-12 col-md-6 col-xl-4">
            <div class="card shadow-sm h-100 border-0" [style.border-left]="'6px solid ' + colour(c.triage.level)">
              <div class="card-body d-flex flex-column gap-1">
                <div class="d-flex align-items-center gap-2">
                  <span class="badge text-uppercase" [style.background]="colour(c.triage.level)">{{ c.triage.level }}</span>
                  <div class="flex-grow-1 text-truncate"><span class="fw-semibold">{{ c.patientId.name }}</span> <span class="text-muted small">{{ c.patientId.mrn }}</span></div>
                  <span class="badge" [class.text-bg-secondary]="c.status === 'waiting'" [class.text-bg-info]="c.status === 'in-treatment'">{{ c.status === 'waiting' ? 'waiting' : 'in treatment' }}</span>
                </div>
                <div class="small text-muted text-capitalize">{{ c.patientId.gender }}{{ c.patientId.age ? ' · ' + c.patientId.age + ' y' : '' }} · <i class="bi bi-clock"></i> {{ wait(c.waitingMinutes) }} · <code>{{ c.caseNo }}</code></div>
                @if (c.arrival) { <div class="small"><span class="badge text-bg-light border"><i class="bi bi-truck me-1"></i>{{ arrivalLabel(c.arrival) }}</span></div> }
                @if (c.complaint) { <div class="small"><i class="bi bi-chat-left-text me-1"></i>{{ c.complaint }}</div> }
                @if (c.doctorId) { <div class="small text-muted"><i class="bi bi-person-badge me-1"></i>{{ c.doctorId.name }}</div> }
                <a class="btn btn-sm btn-primary mt-auto align-self-start" [routerLink]="['/emergency', c._id]">Open <i class="bi bi-arrow-right"></i></a>
              </div>
            </div>
          </div>
        } @empty {
          <div class="col-12 text-center text-muted py-5">
            @if (loading.busy()) { <span class="spinner-border spinner-border-sm me-2"></span>Loading… } @else { No emergency patients right now. }
          </div>
        }
      </div>
    } @else {
      <div class="card border-0 shadow-sm">
        <div class="table-responsive">
          <table class="table table-hover mb-0 align-middle">
            <thead class="table-light"><tr><th>Case</th><th>Patient</th><th>Level</th><th>Ended as</th><th>Doctor</th><th>Date</th><th></th></tr></thead>
            <tbody>
              @for (c of rows(); track c._id) {
                <tr>
                  <td><code>{{ c.caseNo }}</code></td>
                  <td>{{ c.patientId.name }}<div class="small text-muted">{{ c.patientId.mrn }}</div></td>
                  <td><span class="badge text-uppercase" [style.background]="colour(c.triage.level)">{{ c.triage.level }}</span></td>
                  <td class="text-capitalize">{{ c.outcome?.type }}@if (c.outcome?.referredTo) { <span class="text-muted small"> to {{ c.outcome!.referredTo }}</span> }</td>
                  <td>{{ c.doctorId?.name || '—' }}</td>
                  <td>{{ c.day }}</td>
                  <td class="text-end"><a class="btn btn-sm btn-outline-primary" [routerLink]="['/emergency', c._id]">Open</a></td>
                </tr>
              } @empty { <tr><td colspan="7" class="text-center text-muted py-4">No closed cases</td></tr> }
            </tbody>
          </table>
        </div>
      </div>
    }

    @if (showForm()) {
      <div class="modal d-block modal-backdrop-custom" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <form class="modal-content" (ngSubmit)="save()">
            <div class="modal-header"><h5 class="modal-title">Register emergency patient</h5><button type="button" class="btn-close" (click)="showForm.set(false)"></button></div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <div class="mb-3">
                <div class="small fw-semibold mb-1">How serious?</div>
                <div class="btn-group w-100">
                  @for (t of levels; track t.value) {
                    <button type="button" class="btn" [style.background]="triage === t.value ? colour(t.value) : ''" [style.color]="triage === t.value ? '#fff' : ''" [class.btn-outline-secondary]="triage !== t.value" (click)="triage = t.value">{{ t.label }}</button>
                  }
                </div>
              </div>
              <div class="form-check form-check-inline mb-2"><input class="form-check-input" type="radio" id="m-new" name="mode" value="new" [(ngModel)]="mode" /><label class="form-check-label" for="m-new">New patient</label></div>
              <div class="form-check form-check-inline mb-2"><input class="form-check-input" type="radio" id="m-old" name="mode" value="existing" [(ngModel)]="mode" /><label class="form-check-label" for="m-old">Already registered</label></div>
              @if (mode === 'existing') {
                <app-patient-picker [(patient)]="existing" />
              } @else {
                <div class="row g-2">
                  <div class="col-md-5"><label class="form-label small mb-0">Name <span class="text-muted">(leave empty if not known)</span></label><input class="form-control" name="pname" [(ngModel)]="name" placeholder="Unknown patient" autocomplete="off" /></div>
                  <div class="col-4 col-md-2"><label class="form-label small mb-0">Age</label><input type="number" min="0" class="form-control" name="page" [(ngModel)]="age" /></div>
                  <div class="col-4 col-md-2"><label class="form-label small mb-0">Gender</label><select class="form-select" name="pgender" [(ngModel)]="gender"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
                  <div class="col-4 col-md-3"><label class="form-label small mb-0">Phone</label><input class="form-control" name="pphone" [(ngModel)]="phone" /></div>
                </div>
              }
              <label class="form-label small mb-0 mt-3">What happened?</label>
              <input class="form-control" name="complaint" [(ngModel)]="complaint" placeholder="e.g. Road accident, chest pain, high fever" />
              <div class="row g-2 mt-1">
                <div class="col-6 col-md-3"><label class="form-label small mb-0">BP</label><input class="form-control form-control-sm" name="bp" [(ngModel)]="vitals.bp" placeholder="120/80" /></div>
                <div class="col-6 col-md-3"><label class="form-label small mb-0">Pulse</label><input type="number" class="form-control form-control-sm" name="pulse" [(ngModel)]="vitals.pulse" /></div>
                <div class="col-6 col-md-3"><label class="form-label small mb-0">SpO₂</label><input type="number" class="form-control form-control-sm" name="spo2" [(ngModel)]="vitals.spo2" /></div>
                <div class="col-6 col-md-3"><label class="form-label small mb-0">Emergency fee</label><input type="number" min="0" class="form-control form-control-sm" name="fee" [(ngModel)]="fee" /></div>
              </div>
              <div class="row g-2 mt-1">
                <div class="col-md-6">
                  <label class="form-label small mb-0">Brought by</label>
                  <select class="form-select form-select-sm" name="arrival" [(ngModel)]="arrival">
                    <option value="">Not noted</option>
                    @for (a of arrivals; track a.value) { <option [value]="a.value">{{ a.label }}</option> }
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label small mb-0">Doctor (optional)</label>
                  <select class="form-select form-select-sm" name="doctorId" [(ngModel)]="doctorId">
                    <option value="">Not decided yet</option>
                    @for (d of doctors(); track d._id) { <option [value]="d._id">{{ d.name }}</option> }
                  </select>
                </div>
              </div>
              <div class="form-text mt-2">Treatment comes first. The fee and the charges are billed when the case is closed.</div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-light" (click)="showForm.set(false)">Cancel</button><button class="btn btn-danger" [disabled]="saving()">Register</button></div>
          </form>
        </div>
      </div>
    }
  `,
})
export class EmergencyComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  auth = inject(AuthService);
  loading = inject(LoadingService);

  view: 'active' | 'closed' = 'active';
  q = '';
  rows = signal<EmergencyRow[]>([]);
  doctors = signal<Doctor[]>([]);
  error = signal('');
  private timer: ReturnType<typeof setInterval> | undefined;

  levels = [
    { value: 'red', label: 'Red: at once' },
    { value: 'yellow', label: 'Yellow: soon' },
    { value: 'green', label: 'Green: can wait' },
  ];
  showForm = signal(false);
  formError = signal('');
  saving = signal(false);
  triage = 'yellow';
  mode: 'new' | 'existing' = 'new';
  existing: PatientRef | null = null;
  name = '';
  age: number | null = null;
  gender = 'male';
  phone = '';
  complaint = '';
  vitals: { bp: string; pulse: number | null; spo2: number | null } = { bp: '', pulse: null, spo2: null };
  fee: number | null = null;
  doctorId = '';
  arrival = '';
  mine = false;
  arrivals = [
    { value: 'ambulance', label: 'Ambulance' },
    { value: 'family', label: 'Family' },
    { value: 'self', label: 'Came by himself' },
    { value: 'police', label: 'Police' },
    { value: 'other', label: 'Other' },
  ];
  arrivalLabel = (v: string) => this.arrivals.find((a) => a.value === v)?.label ?? v;

  ngOnInit() {
    this.load();
    this.timer = setInterval(() => this.view === 'active' && !this.showForm() && this.load(), 20000);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  colour = (level: string) => (level === 'red' ? '#dc3545' : level === 'yellow' ? '#e0a800' : '#198754');
  wait = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);

  load() {
    const params: Record<string, string> = { status: this.view };
    if (this.q.trim()) params['q'] = this.q.trim();
    if (this.mine) params['mine'] = '1';
    this.http.get<EmergencyRow[]>(`${API}/emergency/cases`, { params }).subscribe({
      next: (r) => {
        this.rows.set(r);
        this.error.set('');
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  openForm() {
    this.formError.set('');
    this.triage = 'yellow';
    this.mode = 'new';
    this.existing = null;
    this.name = '';
    this.age = null;
    this.gender = 'male';
    this.phone = '';
    this.complaint = '';
    this.vitals = { bp: '', pulse: null, spo2: null };
    this.fee = null;
    this.doctorId = '';
    this.arrival = '';
    this.http.get<Doctor[]>(`${API}/users/doctors`).subscribe((d) => {
      this.doctors.set(d);
      const me = this.auth.me()?.user;
      if (me?.isDoctor && d.some((x) => x._id === me.id)) this.doctorId = me.id;
    });
    this.showForm.set(true);
  }

  save() {
    this.formError.set('');
    if (this.mode === 'existing' && !this.existing) return this.formError.set('Select the patient');
    this.saving.set(true);
    const body: Record<string, unknown> = {
      triage: this.triage, arrival: this.arrival || undefined, complaint: this.complaint || undefined, fee: Number(this.fee) || 0, doctorId: this.doctorId || undefined,
      vitals: { bp: this.vitals.bp, pulse: this.vitals.pulse, spo2: this.vitals.spo2 },
    };
    if (this.mode === 'existing') body['patientId'] = this.existing!._id;
    else body['patient'] = { name: this.name, age: this.age, gender: this.gender, phone: this.phone };
    this.http.post<EmergencyRow>(`${API}/emergency/cases`, body).subscribe({
      next: (c) => {
        this.saving.set(false);
        this.showForm.set(false);
        this.router.navigate(['/emergency', c._id]);
      },
      error: (e) => {
        this.saving.set(false);
        this.formError.set(errorMessage(e));
      },
    });
  }
}
