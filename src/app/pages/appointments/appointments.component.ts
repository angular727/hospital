import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { HasPermissionDirective } from '../../core/has-permission.directive';
import { Appointment, ApptStatus, Doctor, PatientRef, Visit } from '../../core/models';
import { STATUS_CLASS, addDays, ageText, today } from '../../core/util';
import { PatientPickerComponent } from '../../shared/patient-picker.component';

@Component({
  selector: 'app-appointments',
  imports: [FormsModule, RouterLink, HasPermissionDirective, PatientPickerComponent],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <h3 class="mb-0">Appointments &amp; queue</h3>
      <button *hasPermission="'appointments.create'" class="btn btn-primary" (click)="openForm()"><i class="bi bi-calendar-plus me-1"></i>New appointment / walk-in</button>
    </div>

    @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }

    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body py-2 d-flex gap-3 align-items-end flex-wrap">
        <div>
          <label class="form-label small mb-0">Date</label>
          <div class="input-group input-group-sm">
            <button class="btn btn-outline-secondary" (click)="shift(-1)"><i class="bi bi-chevron-left"></i></button>
            <input type="date" class="form-control" [ngModel]="date" (ngModelChange)="date = $event; load()" />
            <button class="btn btn-outline-secondary" (click)="shift(1)"><i class="bi bi-chevron-right"></i></button>
          </div>
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
            <option value="">All</option>
            @for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }
          </select>
        </div>
        <button class="btn btn-sm btn-outline-secondary" (click)="date = todayStr; load()">Today</button>
        <div class="ms-auto small text-muted">
          Waiting: <strong>{{ count('waiting') }}</strong> · In consultation: <strong>{{ count('in-consultation') }}</strong> · Done: <strong>{{ count('completed') }}</strong>
        </div>
      </div>
    </div>

    <div class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-light"><tr><th>Token</th><th>Time</th><th>Patient</th><th>Doctor</th><th>Reason</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
          <tbody>
            @for (a of items(); track a._id) {
              <tr [class.table-light]="a.status === 'cancelled' || a.status === 'no-show'">
                <td><span class="badge bg-dark fs-6">#{{ a.token }}</span></td>
                <td>{{ a.time || (a.type === 'walk-in' ? 'walk-in' : '—') }}</td>
                <td>
                  <a class="fw-semibold text-decoration-none" [routerLink]="['/patients', a.patientId._id]">{{ a.patientId.name }}</a>
                  <div class="small text-muted">{{ a.patientId.mrn }} {{ age(a.patientId) ? '· ' + age(a.patientId) : '' }}</div>
                </td>
                <td>{{ a.doctorId.name }}</td>
                <td>{{ a.reason || '—' }}</td>
                <td><span class="badge" [class]="badge(a.status)">{{ a.status }}</span></td>
                <td class="text-end text-nowrap">
                  @if (a.status === 'scheduled') {
                    <button *hasPermission="'appointments.edit'" class="btn btn-sm btn-outline-warning me-1" (click)="setStatus(a, 'waiting')">Check-in</button>
                  }
                  @if (a.status === 'scheduled' || a.status === 'waiting') {
                    @if (canConsult()) { <button class="btn btn-sm btn-primary me-1" (click)="startConsultation(a)">Start consultation</button> }
                    <button *hasPermission="'appointments.edit'" class="btn btn-sm btn-outline-secondary me-1" (click)="setStatus(a, 'no-show')">No-show</button>
                    <button *hasPermission="'appointments.edit'" class="btn btn-sm btn-outline-danger" (click)="cancel(a)">Cancel</button>
                  }
                  @if (a.status === 'in-consultation' && a.visitId && canOpenVisit()) {
                    <a class="btn btn-sm btn-info" [routerLink]="['/opd', a.visitId]">Open visit</a>
                  }
                  @if (a.status === 'completed' && a.visitId && canOpenVisit()) {
                    <a class="btn btn-sm btn-outline-success" [routerLink]="['/opd', a.visitId]">View visit</a>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="text-center text-muted py-4">No appointments for this day</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (showForm()) {
      <div class="modal d-block modal-backdrop-custom" tabindex="-1">
        <div class="modal-dialog">
          <form class="modal-content" (ngSubmit)="save()">
            <div class="modal-header"><h5 class="modal-title">New appointment</h5><button type="button" class="btn-close" (click)="showForm.set(false)"></button></div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <div class="mb-3"><label class="form-label">Patient *</label><app-patient-picker [(patient)]="form.patient" /></div>
              <div class="mb-3">
                <label class="form-label">Doctor *</label>
                <select class="form-select" name="doctor" [(ngModel)]="form.doctorId" required>
                  <option value="" disabled>Select doctor</option>
                  @for (d of doctors(); track d._id) { <option [value]="d._id">{{ d.name }}{{ d.specialization ? ' — ' + d.specialization : '' }}</option> }
                </select>
                @if (!doctors().length) { <div class="form-text text-danger">No doctors yet. Open Users and mark a user as "Doctor".</div> }
              </div>
              <div class="mb-3">
                <div class="form-check form-check-inline"><input class="form-check-input" type="radio" name="type" id="t1" value="appointment" [(ngModel)]="form.type" /><label class="form-check-label" for="t1">Appointment</label></div>
                <div class="form-check form-check-inline"><input class="form-check-input" type="radio" name="type" id="t2" value="walk-in" [(ngModel)]="form.type" /><label class="form-check-label" for="t2">Walk-in (joins queue now)</label></div>
              </div>
              <div class="row g-3">
                <div class="col-6"><label class="form-label">Date</label><input type="date" class="form-control" name="date" [(ngModel)]="form.date" required /></div>
                <div class="col-6"><label class="form-label">Time</label><input type="time" class="form-control" name="time" [(ngModel)]="form.time" [disabled]="form.type === 'walk-in'" /></div>
                <div class="col-12"><label class="form-label">Reason / complaint</label><input class="form-control" name="reason" [(ngModel)]="form.reason" /></div>
              </div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-light" (click)="showForm.set(false)">Cancel</button><button class="btn btn-primary" [disabled]="saving()">Book &amp; get token</button></div>
          </form>
        </div>
      </div>
    }
  `,
})
export class AppointmentsComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  items = signal<Appointment[]>([]);
  doctors = signal<Doctor[]>([]);
  showForm = signal(false);
  error = signal('');
  formError = signal('');
  saving = signal(false);

  todayStr = today();
  date = today();
  doctorId = '';
  status = '';
  statuses: ApptStatus[] = ['scheduled', 'waiting', 'in-consultation', 'completed', 'cancelled', 'no-show'];
  form = this.emptyForm();

  age = ageText;
  badge = (s: string) => `badge ${STATUS_CLASS[s] ?? 'bg-secondary'}`;
  count = (s: string) => this.items().filter((a) => a.status === s).length;
  canConsult = () => this.auth.hasModule('opd') && this.auth.has('opd.create');
  canOpenVisit = () => this.auth.hasModule('opd') && this.auth.has('opd.view');

  ngOnInit() {
    this.http.get<Doctor[]>(`${API}/users/doctors`).subscribe((d) => this.doctors.set(d));
    this.load();
    const pid = this.route.snapshot.queryParamMap.get('patientId');
    if (pid && this.auth.has('appointments.create')) {
      this.http.get<PatientRef>(`${API}/patients/${pid}`).subscribe((p) => this.openForm(p));
    }
  }

  private emptyForm() {
    return { patient: null as PatientRef | null, doctorId: '', type: 'appointment', date: today(), time: '', reason: '' };
  }

  shift(days: number) {
    this.date = addDays(this.date, days);
    this.load();
  }

  load() {
    const params: Record<string, string> = { date: this.date };
    if (this.doctorId) params['doctorId'] = this.doctorId;
    if (this.status) params['status'] = this.status;
    this.http.get<Appointment[]>(`${API}/appointments`, { params }).subscribe({
      next: (a) => {
        this.items.set(a);
        this.error.set('');
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  openForm(patient?: PatientRef) {
    this.form = { ...this.emptyForm(), patient: patient ?? null, doctorId: this.doctors().length === 1 ? this.doctors()[0]._id : this.doctorId };
    this.formError.set('');
    this.showForm.set(true);
  }

  save() {
    const f = this.form;
    if (!f.patient || !f.doctorId) {
      this.formError.set('Select a patient and a doctor');
      return;
    }
    this.saving.set(true);
    this.http
      .post<Appointment>(`${API}/appointments`, { patientId: f.patient._id, doctorId: f.doctorId, type: f.type, date: f.date, time: f.type === 'walk-in' ? undefined : f.time || undefined, reason: f.reason || undefined })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showForm.set(false);
          this.date = f.date;
          this.load();
        },
        error: (e) => {
          this.saving.set(false);
          this.formError.set(errorMessage(e));
        },
      });
  }

  setStatus(a: Appointment, status: ApptStatus) {
    this.http.put(`${API}/appointments/${a._id}`, { status }).subscribe({ next: () => this.load(), error: (e) => this.error.set(errorMessage(e)) });
  }

  cancel(a: Appointment) {
    if (confirm(`Cancel token #${a.token} for ${a.patientId.name}?`)) this.setStatus(a, 'cancelled');
  }

  startConsultation(a: Appointment) {
    this.http.post<Visit>(`${API}/visits`, { appointmentId: a._id }).subscribe({
      next: (v) => this.router.navigate(['/opd', v._id]),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }
}
