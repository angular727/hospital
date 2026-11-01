import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { LoadingService } from '../../core/loading.service';
import { AdmissionRow, Doctor, PatientRef, WardRow } from '../../core/models';
import { PatientPickerComponent } from '../../shared/patient-picker.component';

/** Patients in beds: how full the wards are, who is admitted, and the form where the doctor gives a bed. */
@Component({
  selector: 'app-admissions',
  imports: [FormsModule, RouterLink, DecimalPipe, PatientPickerComponent],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <h3 class="mb-0">In-patients</h3>
      @if (auth.has('ipd.create')) { <button class="btn btn-primary" (click)="openForm()"><i class="bi bi-plus-lg me-1"></i>Admit patient</button> }
    </div>
    @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }

    <div class="row g-3 mb-3">
      @for (w of wards(); track w._id) {
        @if (w.isActive) {
          <div class="col-6 col-md-3">
            <div class="card border-0 shadow-sm h-100"><div class="card-body py-3">
              <div class="small text-muted">{{ w.name }}</div>
              <div class="fs-4 fw-semibold">{{ w.occupiedBeds }}<span class="fs-6 text-muted"> / {{ w.totalBeds }} beds</span></div>
              <div class="progress mt-1" style="height: 4px"><div class="progress-bar" [style.width.%]="w.totalBeds ? (w.occupiedBeds * 100) / w.totalBeds : 0"></div></div>
            </div></div>
          </div>
        }
      }
    </div>

    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body py-2 d-flex align-items-center gap-2 flex-wrap">
        <ul class="nav nav-pills">
          @for (t of tabs; track t.value) {
            <li class="nav-item"><button class="nav-link py-1" [class.active]="status === t.value" (click)="status = t.value; load()">{{ t.label }}</button></li>
          }
        </ul>
        <div class="input-group" style="max-width: 280px">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input class="form-control" placeholder="Patient, MR no. or admission no." [(ngModel)]="q" (keyup.enter)="load()" />
        </div>
        @if (wards().length > 1) {
          <select class="form-select" style="max-width: 180px" [(ngModel)]="wardId" (change)="load()">
            <option value="">All wards</option>
            @for (w of wards(); track w._id) { <option [value]="w._id">{{ w.name }}</option> }
          </select>
        }
        <button class="btn btn-outline-secondary" (click)="load()">Search</button>
      </div>
    </div>

    <div class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table table-hover mb-0 align-middle">
          <thead class="table-light"><tr><th>No.</th><th>Patient</th><th>Bed</th><th>Doctor</th><th>Since</th><th class="text-end">Days</th><th>Status</th><th></th></tr></thead>
          <tbody>
            @for (a of rows(); track a._id) {
              <tr>
                <td><code>{{ a.admissionNo }}</code></td>
                <td>{{ a.patientId.name }}<div class="small text-muted">{{ a.patientId.mrn }}</div></td>
                <td>{{ a.wardName }} <span class="text-muted">/</span> {{ a.bedName }}</td>
                <td>{{ a.doctorId.name }}</td>
                <td>{{ a.day }}</td>
                <td class="text-end">{{ a.daysStayed }}</td>
                <td>
                  <span class="badge" [class.text-bg-warning]="a.status === 'admitted'" [class.text-bg-success]="a.status === 'discharged'">{{ a.status === 'admitted' ? 'In bed' : 'Discharged' }}</span>
                </td>
                <td class="text-end"><a class="btn btn-sm btn-outline-primary" [routerLink]="['/ipd', a._id]">Open</a></td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="text-center text-muted py-4">
                @if (loading.busy()) { <span class="spinner-border spinner-border-sm me-2"></span>Loading… } @else { No patients here }
              </td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (showForm()) {
      <div class="modal d-block modal-backdrop-custom" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <form class="modal-content" (ngSubmit)="save()">
            <div class="modal-header"><h5 class="modal-title">Admit patient</h5><button type="button" class="btn-close" (click)="showForm.set(false)"></button></div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <label class="form-label">Patient *</label>
              <app-patient-picker [(patient)]="patient" />
              <div class="row g-3 mt-1">
                <div class="col-md-6">
                  <label class="form-label">Doctor in charge *</label>
                  <select class="form-select" name="doctorId" [(ngModel)]="doctorId">
                    <option value="">Select doctor</option>
                    @for (d of doctors(); track d._id) { <option [value]="d._id">{{ d.name }}</option> }
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Bed *</label>
                  <select class="form-select" name="bedId" [(ngModel)]="bedId">
                    <option value="">Select a free bed</option>
                    @for (w of freeWards(); track w._id) {
                      <optgroup [label]="w.name">
                        @for (b of w.freeBeds; track b._id) { <option [value]="b._id">{{ b.name }} (Rs. {{ b.dailyCharge | number: '1.0-0' }} a day)</option> }
                      </optgroup>
                    }
                  </select>
                  @if (!freeWards().length) { <div class="form-text text-danger">No free bed. Add beds in "Wards and beds" or discharge a patient.</div> }
                </div>
                <div class="col-12"><label class="form-label">Diagnosis</label><input class="form-control" name="diagnosis" [(ngModel)]="diagnosis" placeholder="Why the patient needs a bed" /></div>
                <div class="col-12"><label class="form-label">Notes for the bed team</label><textarea class="form-control" rows="2" name="notes" [(ngModel)]="notes" placeholder="Medicines, diet, things to watch (optional)"></textarea></div>
              </div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-light" (click)="showForm.set(false)">Cancel</button><button class="btn btn-primary" [disabled]="saving()">Give bed</button></div>
          </form>
        </div>
      </div>
    }
  `,
})
export class AdmissionsComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  auth = inject(AuthService);
  loading = inject(LoadingService);

  tabs = [
    { value: 'admitted', label: 'In bed' },
    { value: 'discharged', label: 'Discharged' },
    { value: '', label: 'All' },
  ];
  status = 'admitted';
  q = '';
  wardId = '';
  rows = signal<AdmissionRow[]>([]);
  wards = signal<WardRow[]>([]);
  doctors = signal<Doctor[]>([]);
  error = signal('');

  showForm = signal(false);
  formError = signal('');
  saving = signal(false);
  patient: PatientRef | null = null;
  doctorId = '';
  bedId = '';
  diagnosis = '';
  notes = '';
  private visitId = '';

  /** Wards that still have a free, active bed, each with its free beds. */
  freeWards = computed(() =>
    this.wards()
      .filter((w) => w.isActive)
      .map((w) => ({ ...w, freeBeds: w.beds.filter((b) => b.isActive && !b.occupied) }))
      .filter((w) => w.freeBeds.length)
  );

  ngOnInit() {
    this.loadWards();
    this.load();
    // The doctor's checkup screen opens this page with ?admit=1&patientId=…&visitId=… to give a bed to that patient.
    const q = this.route.snapshot.queryParamMap;
    if (q.get('admit') && this.auth.has('ipd.create')) {
      this.openForm();
      this.visitId = q.get('visitId') ?? '';
      const pid = q.get('patientId');
      if (pid) this.http.get<PatientRef>(`${API}/patients/${pid}`).subscribe((p) => (this.patient = p));
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  loadWards() {
    this.http.get<WardRow[]>(`${API}/ipd/wards`).subscribe({ next: (w) => this.wards.set(w), error: (e) => this.error.set(errorMessage(e)) });
  }

  load() {
    const params: Record<string, string> = {};
    if (this.status) params['status'] = this.status;
    if (this.q.trim()) params['q'] = this.q.trim();
    if (this.wardId) params['wardId'] = this.wardId;
    this.http.get<AdmissionRow[]>(`${API}/ipd/admissions`, { params }).subscribe({
      next: (r) => {
        this.rows.set(r);
        this.error.set('');
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  openForm() {
    this.formError.set('');
    this.patient = null;
    this.bedId = '';
    this.diagnosis = '';
    this.notes = '';
    this.visitId = '';
    this.loadWards();
    this.http.get<Doctor[]>(`${API}/users/doctors`).subscribe((d) => {
      this.doctors.set(d);
      // A doctor admitting a patient is the doctor in charge unless another one is picked.
      const me = this.auth.me()?.user;
      this.doctorId = me?.isDoctor && d.some((x) => x._id === me.id) ? me.id : '';
    });
    this.showForm.set(true);
  }

  save() {
    this.formError.set('');
    if (!this.patient) return this.formError.set('Select a patient');
    if (!this.doctorId) return this.formError.set('Select the doctor in charge');
    if (!this.bedId) return this.formError.set('Select a bed');
    this.saving.set(true);
    this.http
      .post<AdmissionRow>(`${API}/ipd/admissions`, {
        patientId: this.patient._id, doctorId: this.doctorId, bedId: this.bedId,
        visitId: this.visitId || undefined, diagnosis: this.diagnosis || undefined, notes: this.notes || undefined,
      })
      .subscribe({
        next: (a) => {
          this.saving.set(false);
          this.showForm.set(false);
          this.router.navigate(['/ipd', a._id]);
        },
        error: (e) => {
          this.saving.set(false);
          this.formError.set(errorMessage(e));
        },
      });
  }
}
