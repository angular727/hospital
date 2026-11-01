import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { Doctor, PatientRef, QueueItem, Vitals } from '../../core/models';
import { silent } from '../../core/loading.interceptor';
import { PAY_METHODS, STATUS_CLASS, ageText, today } from '../../core/util';
import { PatientPickerComponent } from '../../shared/patient-picker.component';

interface PatientSummary {
  patient: PatientRef & { fatherName?: string; cnic?: string; city?: string };
  last: { date: string; visitNo: string; doctor?: { _id: string; name: string }; vitals?: Vitals; complaint?: string; diagnosis?: string } | null;
  pending: { token: number | null; status: string; date?: string; doctor?: { _id: string; name: string } } | null;
}

interface Slip {
  token: number;
  date: string;
  patientName: string;
  mrn: string;
  doctor: string;
  feeText: string;
  invoiceNo?: string;
  time: string;
}

@Component({
  selector: 'app-reception',
  imports: [FormsModule, DecimalPipe, RouterLink, PatientPickerComponent],
  template: `
    <div class="no-print">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h3 class="mb-0">Reception — new check-in</h3>
      </div>
      @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }

      <div class="row g-3">
        <div class="col-xl-7">
          <form class="card border-0 shadow-sm" (ngSubmit)="submit()">
            <div class="card-body">
              <ul class="nav nav-pills mb-3">
                <li class="nav-item"><button type="button" class="nav-link py-1" [class.active]="!existing" (click)="setExisting(false)">New patient</button></li>
                <li class="nav-item"><button type="button" class="nav-link py-1" [class.active]="existing" (click)="setExisting(true)">Returning patient</button></li>
              </ul>

              @if (existing) {
                <div class="row g-2 mb-2">
                  <div class="col-md-4">
                    <label class="form-label mb-0">Search by</label>
                    <select class="form-select" name="searchBy" [(ngModel)]="searchBy">
                      <option value="name">Name</option>
                      <option value="cnic">CNIC</option>
                      <option value="phone">Phone</option>
                      <option value="mrn">MR Number</option>
                    </select>
                  </div>
                  <div class="col-md-8">
                    <label class="form-label mb-0">Find patient</label>
                    <app-patient-picker [by]="searchBy" [patient]="picked" (patientChange)="onPicked($event)" />
                  </div>
                </div>
              }

              @if (pendingInfo(); as pd) {
                <div class="alert alert-warning py-2 mt-2 mb-2">
                  <i class="bi bi-exclamation-triangle-fill me-1"></i>
                  <strong>Checkup already pending</strong>{{ pd.token ? ': token #' + pd.token : '' }} with {{ pd.doctor?.name }} ({{ pd.date && pd.date !== todayStr ? 'from ' + pd.date + ', not finished' : pd.status === 'in-consultation' ? 'with the doctor now' : 'waiting' }}). Complete or cancel it first.
                </div>
              }
              @if (lastInfo(); as l) {
                <div class="alert alert-info py-2 mt-2 mb-2 small">
                  <i class="bi bi-clock-history me-1"></i>Last visit <strong>{{ l.date }}</strong> with {{ l.doctor?.name }}{{ l.diagnosis ? ' — ' + l.diagnosis : '' }}.
                  The doctor and vitals below are copied from that visit: please update them to today's readings.
                </div>
              }
              @if (dups().length) {
                <div class="alert alert-warning py-2 mt-2 mb-2">
                  <div class="fw-semibold mb-1"><i class="bi bi-people me-1"></i>This phone number is already registered:</div>
                  @for (d of dups(); track d._id) {
                    <div class="d-flex justify-content-between align-items-center border-top pt-1 mt-1">
                      <span>{{ d.name }} <small class="text-muted">{{ d.mrn }}{{ d.age ? ' · ' + d.age + ' y' : '' }}</small></span>
                      <button type="button" class="btn btn-sm btn-primary" (click)="useExisting(d)">Use this patient</button>
                    </div>
                  }
                  <button type="button" class="btn btn-sm btn-outline-secondary mt-2" (click)="submit(true)">No, register as a new patient</button>
                </div>
              }

              @if (!existing || picked) {
                <div class="row g-2">
                  <div class="col-md-6"><label class="form-label mb-0">Patient name *</label><input class="form-control" name="name" [(ngModel)]="p.name" [disabled]="existing" autofocus /></div>
                  <div class="col-md-3 col-6"><label class="form-label mb-0">Age</label><input type="number" min="0" max="130" class="form-control" name="age" [(ngModel)]="p.age" /></div>
                  <div class="col-md-3 col-6">
                    <label class="form-label mb-0">Gender</label>
                    <select class="form-select" name="gender" [(ngModel)]="p.gender"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select>
                  </div>
                  <div class="col-md-6"><label class="form-label mb-0">Phone</label><input class="form-control" name="phone" [(ngModel)]="p.phone" placeholder="03xx-xxxxxxx" /></div>
                  <div class="col-md-6"><label class="form-label mb-0">Father / husband name</label><input class="form-control" name="father" [(ngModel)]="p.fatherName" /></div>
                  @if (more) {
                    <div class="col-md-4"><label class="form-label mb-0">CNIC</label><input class="form-control" name="cnic" [(ngModel)]="p.cnic" /></div>
                    <div class="col-md-4"><label class="form-label mb-0">City</label><input class="form-control" name="city" [(ngModel)]="p.city" /></div>
                    <div class="col-md-4"><label class="form-label mb-0 text-danger">Allergies</label><input class="form-control" name="allergies" [(ngModel)]="p.allergies" /></div>
                  }
                </div>
                <button type="button" class="btn btn-link btn-sm px-0" (click)="more = !more">{{ more ? 'Fewer details' : 'More details (CNIC, city, allergies)' }}</button>
              }

              <hr />
              <div class="row g-2 align-items-end">
                <div class="col-md-5">
                  <label class="form-label mb-0">Doctor *</label>
                  <select class="form-select" name="doctor" [(ngModel)]="doctorId" (ngModelChange)="onDoctor()" [disabled]="!doctorsLoaded()">
                    <option value="" disabled>{{ doctorsLoaded() ? 'Select doctor' : 'Loading doctors…' }}</option>
                    @for (d of doctors(); track d._id) { <option [value]="d._id">{{ d.name }}{{ d.specialization ? ' — ' + d.specialization : '' }}</option> }
                  </select>
                  @if (doctorsLoaded() && !doctors().length) {
                    <div class="form-text text-danger">
                      No doctors yet. Go to <a routerLink="/settings/users">Users</a>, add a user (or edit an existing one) and tick
                      <strong>"This user is a doctor"</strong>.
                    </div>
                  }
                </div>
                <div class="col-md-7"><label class="form-label mb-0">Complaint</label><input class="form-control" name="complaint" [(ngModel)]="complaint" placeholder="e.g. fever, cough" /></div>
              </div>

              <div class="fw-semibold mt-3 mb-1">Vitals <small class="text-muted fw-normal">(optional)</small></div>
              <div class="row g-2">
                <div class="col-4 col-md-2"><label class="form-label small mb-0">BP</label><input class="form-control" name="bp" [(ngModel)]="v.bp" placeholder="120/80" /></div>
                <div class="col-4 col-md-2"><label class="form-label small mb-0">Pulse</label><input type="number" class="form-control" name="pulse" [(ngModel)]="v.pulse" /></div>
                <div class="col-4 col-md-2"><label class="form-label small mb-0">Temp °F</label><input type="number" step="0.1" class="form-control" name="temp" [(ngModel)]="v.temperature" /></div>
                <div class="col-4 col-md-2"><label class="form-label small mb-0">Weight kg</label><input type="number" step="0.1" class="form-control" name="weight" [(ngModel)]="v.weight" /></div>
                <div class="col-4 col-md-2"><label class="form-label small mb-0">SpO₂ %</label><input type="number" class="form-control" name="spo2" [(ngModel)]="v.spo2" /></div>
                <div class="col-4 col-md-2"><label class="form-label small mb-0">Sugar</label><input type="number" class="form-control" name="sugar" [(ngModel)]="v.sugar" /></div>
              </div>

              @if (canBill) {
                <div class="fw-semibold mt-3 mb-1">Consultation fee</div>
                <div class="row g-2 align-items-center">
                  <div class="col-md-3"><input type="number" min="0" class="form-control" name="fee" [(ngModel)]="feeAmount" /></div>
                  <div class="col-md-9">
                    <div class="form-check form-check-inline"><input class="form-check-input" type="radio" name="mode" id="m1" value="paid" [(ngModel)]="feeMode" /><label class="form-check-label" for="m1">Received now</label></div>
                    <div class="form-check form-check-inline"><input class="form-check-input" type="radio" name="mode" id="m2" value="later" [(ngModel)]="feeMode" /><label class="form-check-label" for="m2">Pay later</label></div>
                    <div class="form-check form-check-inline"><input class="form-check-input" type="radio" name="mode" id="m3" value="free" [(ngModel)]="feeMode" /><label class="form-check-label" for="m3">Free / no fee</label></div>
                    @if (feeMode === 'paid') {
                      <select class="form-select form-select-sm d-inline-block w-auto ms-2" name="method" [(ngModel)]="method">@for (m of methods; track m) { <option [value]="m">{{ m }}</option> }</select>
                    }
                  </div>
                </div>
              }
            </div>
            <div class="card-footer bg-white">
              <button class="btn btn-primary btn-lg" [disabled]="saving() || !!pendingInfo()">@if (saving()) { <span class="spinner-border spinner-border-sm me-2"></span>Sending… } @else { <i class="bi bi-check2-circle me-1"></i>Submit &amp; send to doctor }</button>
            </div>
          </form>
        </div>

        <div class="col-xl-5">
          <div class="card border-0 shadow-sm">
            <div class="card-header bg-white d-flex justify-content-between align-items-center">
              <span class="fw-semibold">Waiting now <span class="badge bg-secondary">{{ queue().length }}</span></span>
              <button class="btn btn-sm btn-outline-secondary" (click)="loadQueue()"><i class="bi bi-arrow-repeat"></i></button>
            </div>
            <div class="list-group list-group-flush">
              @for (q of queue(); track q._id) {
                <div class="list-group-item d-flex align-items-center gap-2">
                  <span class="badge bg-dark fs-6">#{{ q.token }}</span>
                  <div class="flex-grow-1">
                    <div class="fw-semibold">{{ q.patient.name }}</div>
                    <div class="small text-muted">{{ q.doctor.name }}{{ q.reason ? ' · ' + q.reason : '' }}</div>
                  </div>
                  @if (q.invoice) {
                    <span class="badge" [class]="badge(q.invoice.status)">{{ q.invoice.status === 'paid' ? 'paid' : 'due ' + (q.invoice.balance | number: '1.0-0') }}</span>
                  }
                  <span class="badge" [class]="badge(q.status)">{{ q.status === 'in-consultation' ? 'with doctor' : q.status }}</span>
                </div>
              } @empty {
                <div class="list-group-item text-muted text-center py-4">
                  @if (!queueLoaded()) { <span class="spinner-border spinner-border-sm me-2"></span>Loading… } @else { No patients waiting }
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>

    @if (slip(); as s) {
      <div class="modal d-block modal-backdrop-custom no-print" tabindex="-1">
        <div class="modal-dialog modal-sm modal-dialog-centered">
          <div class="modal-content text-center">
            <div class="modal-body">
              <div class="text-success fs-1"><i class="bi bi-check-circle-fill"></i></div>
              <div class="text-muted small">Token number</div>
              <div class="display-3 fw-bold" style="color:#0f4c4c">{{ s.token }}</div>
              <div class="fw-semibold">{{ s.patientName }}</div>
              <div class="small text-muted">{{ s.mrn }} · {{ s.doctor }}</div>
              <div class="small mt-1">{{ s.feeText }}</div>
            </div>
            <div class="modal-footer justify-content-center">
              <button class="btn btn-outline-dark" (click)="printSlip()"><i class="bi bi-printer me-1"></i>Print slip</button>
              <button class="btn btn-primary" (click)="slip.set(null)">Next patient</button>
            </div>
          </div>
        </div>
      </div>
      <div class="d-none d-print-block slip">
        <div class="text-center">
          <div class="fw-bold fs-5">{{ auth.me()?.hospital?.name }}</div>
          <div class="small">{{ auth.me()?.hospital?.phone }}</div>
          <hr class="my-1" />
          <div>Token</div>
          <div class="slip-token">{{ s.token }}</div>
          <div class="fw-semibold">{{ s.patientName }}</div>
          <div class="small">{{ s.mrn }}</div>
          <div class="small">Doctor: {{ s.doctor }}</div>
          <div class="small">{{ s.date }} {{ s.time }}</div>
          <div class="small">{{ s.feeText }}{{ s.invoiceNo ? ' (' + s.invoiceNo + ')' : '' }}</div>
          <hr class="my-1" />
          <div class="small">Please wait for your turn</div>
        </div>
      </div>
    }
  `,
  styles: `
    .slip { width: 280px; margin: 0 auto; }
    .slip-token { font-size: 64px; font-weight: 800; line-height: 1; }
  `,
})
export class ReceptionComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  auth = inject(AuthService);

  doctors = signal<Doctor[]>([]);
  doctorsLoaded = signal(false);
  searchBy = 'name';
  queue = signal<QueueItem[]>([]);
  queueLoaded = signal(false);
  slip = signal<Slip | null>(null);
  pendingInfo = signal<PatientSummary['pending']>(null);
  todayStr = today();
  lastInfo = signal<PatientSummary['last']>(null);
  dups = signal<PatientRef[]>([]);
  error = signal('');
  saving = signal(false);

  existing = false;
  more = false;
  picked: PatientRef | null = null;
  p = this.emptyPatient();
  v = this.emptyVitals();
  doctorId = '';
  complaint = '';
  feeAmount = 0;
  feeMode: 'paid' | 'later' | 'free' = 'paid';
  method = 'cash';
  methods = PAY_METHODS;
  canBill = this.auth.hasModule('billing');

  private timer: any;
  age = ageText;
  badge = (s: string) => `badge ${STATUS_CLASS[s] ?? 'bg-secondary'}`;

  ngOnInit() {
    this.http.get<Doctor[]>(`${API}/users/doctors`).subscribe({
      next: (d) => {
        this.doctors.set(d);
        this.doctorsLoaded.set(true);
        if (d.length === 1) {
          this.doctorId = d[0]._id;
          this.onDoctor();
        }
        this.applyWantedDoctor();
      },
      error: () => this.doctorsLoaded.set(true),
    });
    this.loadQueue();
    this.timer = setInterval(() => this.loadQueue(true), 15000);

    // Opened from a patient's profile ("New check-in"): start with that patient selected.
    const pid = this.route.snapshot.queryParamMap.get('patientId');
    if (pid) {
      this.http.get<PatientSummary>(`${API}/reception/patient/${pid}`).subscribe({
        next: (s) => {
          this.existing = true;
          this.onPicked(s.patient);
        },
        error: (e) => this.error.set(errorMessage(e)),
      });
    }
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  private emptyPatient() {
    return { name: '', age: null as number | null, gender: 'male', phone: '', fatherName: '', cnic: '', city: '', allergies: '' };
  }

  private emptyVitals() {
    return { bp: '', pulse: null as number | null, temperature: null as number | null, weight: null as number | null, spo2: null as number | null, sugar: null as number | null };
  }

  setExisting(v: boolean) {
    this.existing = v;
    this.error.set('');
    this.dups.set([]);
    this.pendingInfo.set(null);
    this.lastInfo.set(null);
    if (!v) this.picked = null;
  }

  /** A returning patient was chosen: fill their details, last doctor and last vitals. */
  onPicked(p: PatientRef | null) {
    this.picked = p;
    this.error.set('');
    this.pendingInfo.set(null);
    this.lastInfo.set(null);
    if (!p) {
      this.p = this.emptyPatient();
      this.v = this.emptyVitals();
      return;
    }
    this.http.get<PatientSummary>(`${API}/reception/patient/${p._id}`).subscribe({
      next: (s) => {
        const x = s.patient;
        this.p = {
          name: x.name, age: x.age ?? null, gender: x.gender || 'male', phone: x.phone ?? '', fatherName: x.fatherName ?? '',
          cnic: x.cnic ?? '', city: x.city ?? '', allergies: x.allergies ?? '',
        };
        this.pendingInfo.set(s.pending);
        this.lastInfo.set(s.last);
        if (s.last) {
          const lv = s.last.vitals ?? {};
          this.v = { bp: lv.bp ?? '', pulse: lv.pulse ?? null, temperature: lv.temperature ?? null, weight: lv.weight ?? null, spo2: lv.spo2 ?? null, sugar: lv.sugar ?? null };
          this.wantedDoctor = s.last.doctor?._id ?? '';
          this.applyWantedDoctor();
        }
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  /** The returning patient's last doctor, selected as soon as the doctor list is available. */
  private wantedDoctor = '';

  private applyWantedDoctor() {
    if (this.wantedDoctor && this.doctors().some((d) => d._id === this.wantedDoctor)) {
      this.doctorId = this.wantedDoctor;
      this.onDoctor();
    }
  }

  /** Same phone number was already registered: switch to that patient instead of creating a duplicate. */
  useExisting(d: PatientRef) {
    this.dups.set([]);
    this.existing = true;
    this.onPicked(d);
  }

  onDoctor() {
    const d = this.doctors().find((x) => x._id === this.doctorId);
    this.feeAmount = d?.consultationFee ?? 0;
  }

  /** `quiet` is used by the automatic refresh so it does not flash the loading bar. */
  loadQueue(quiet = false) {
    this.http
      .get<QueueItem[]>(`${API}/reception/queue`, { context: quiet ? silent() : undefined })
      .subscribe({
        next: (q) => {
          this.queue.set(q);
          this.queueLoaded.set(true);
        },
        error: () => this.queueLoaded.set(true),
      });
  }

  submit(allowDuplicate = false) {
    this.error.set('');
    if (!this.doctorId) return this.error.set('Select a doctor');
    if (this.existing && !this.picked) return this.error.set('Search and select the patient');
    if (!this.existing && !this.p.name.trim()) return this.error.set('Enter the patient name');
    if (this.pendingInfo()) return this.error.set('This patient already has a pending checkup');

    this.saving.set(true);
    this.dups.set([]);
    const body: Record<string, unknown> = { doctorId: this.doctorId, complaint: this.complaint, vitals: this.v, patient: this.p };
    if (this.existing) body['patientId'] = this.picked!._id;
    if (allowDuplicate) body['allowDuplicate'] = true;
    if (this.canBill) body['fee'] = { amount: this.feeAmount, mode: this.feeMode, method: this.method };

    this.http
      .post<{ token: number; date: string; patient: { name: string; mrn: string }; doctor: { name: string }; invoice: { invoiceNo: string; status: string; balance: number } | null }>(`${API}/reception/checkin`, body)
      .subscribe({
        next: (r) => {
          this.saving.set(false);
          const inv = r.invoice;
          this.slip.set({
            token: r.token,
            date: r.date,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            patientName: r.patient.name,
            mrn: r.patient.mrn,
            doctor: r.doctor.name,
            invoiceNo: inv?.invoiceNo,
            feeText: !inv ? 'No fee' : inv.status === 'paid' ? 'Fee paid' : `Fee due: ${inv.balance}`,
          });
          this.reset();
          this.loadQueue();
        },
        error: (e) => {
          this.saving.set(false);
          const body = e?.error;
          if (body?.code === 'DUPLICATE') this.dups.set(body.matches);
          else if (body?.code === 'PENDING') {
            this.pendingInfo.set({ token: body.pending.token, status: body.pending.status, date: body.pending.date, doctor: { _id: '', name: body.pending.doctor } });
            this.loadQueue();
          } else this.error.set(errorMessage(e));
        },
      });
  }

  private reset() {
    this.dups.set([]);
    this.pendingInfo.set(null);
    this.lastInfo.set(null);
    this.p = this.emptyPatient();
    this.v = this.emptyVitals();
    this.picked = null;
    this.complaint = '';
    this.feeMode = 'paid';
    this.onDoctor();
  }

  printSlip() {
    window.print();
  }
}
