import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { Doctor, EmergencyDetail, WardRow } from '../../core/models';
import { VisitLabComponent } from '../lab/visit-lab.component';

/** One emergency patient: triage, treatment entries with their charges, and the closing step. */
@Component({
  selector: 'app-emergency-case',
  imports: [FormsModule, RouterLink, DecimalPipe, DatePipe, VisitLabComponent],
  template: `
    <a routerLink="/emergency" class="text-decoration-none small"><i class="bi bi-arrow-left"></i> Emergency</a>
    @if (error()) { <div class="alert alert-danger py-2 mt-2">{{ error() }}</div> }

    @if (c(); as x) {
      <div class="d-flex justify-content-between align-items-center my-3 flex-wrap gap-2">
        <h3 class="mb-0">
          <span class="badge text-uppercase me-2" [style.background]="colour(x.triage.level)">{{ x.triage.level }}</span>{{ x.patientId.name }}
          <small class="text-muted fs-6">{{ x.patientId.mrn }} · {{ x.caseNo }}</small>
        </h3>
        <div class="d-flex gap-2 flex-wrap">
          @if (x.status !== 'closed' && auth.has('emergency.edit')) { <button class="btn btn-outline-warning" (click)="openRefer()"><i class="bi bi-person-lines-fill me-1"></i>Send to another doctor</button> }
          @if (x.invoiceId) { <a class="btn btn-outline-secondary" [routerLink]="['/billing', x.invoiceId._id]"><i class="bi bi-receipt me-1"></i>Bill {{ x.invoiceId.invoiceNo }}</a> }
          @if (x.status !== 'closed' && auth.has('emergency.close')) { <button class="btn btn-success" (click)="openClose()"><i class="bi bi-box-arrow-right me-1"></i>Close case</button> }
        </div>
      </div>

      <div class="row g-3">
        <div class="col-lg-5">
          <div class="card border-0 shadow-sm mb-3">
            <div class="card-header bg-white d-flex justify-content-between align-items-center fw-semibold">
              <span>Patient</span>
              @if (x.status !== 'closed' && auth.has('emergency.edit')) { <button class="btn btn-sm btn-outline-secondary" (click)="editPatient.set(!editPatient())">{{ editPatient() ? 'Cancel' : 'Fill in details' }}</button> }
            </div>
            <div class="card-body">
              @if (editPatient()) {
                <div class="row g-2">
                  <div class="col-12"><label class="form-label small mb-0">Name</label><input class="form-control form-control-sm" name="en" [(ngModel)]="pName" /></div>
                  <div class="col-4"><label class="form-label small mb-0">Age</label><input type="number" class="form-control form-control-sm" name="ea" [(ngModel)]="pAge" /></div>
                  <div class="col-4"><label class="form-label small mb-0">Gender</label><select class="form-select form-select-sm" name="eg" [(ngModel)]="pGender"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
                  <div class="col-4"><label class="form-label small mb-0">Phone</label><input class="form-control form-control-sm" name="ep" [(ngModel)]="pPhone" /></div>
                  <div class="col-12"><label class="form-label small mb-0">Allergies</label><input class="form-control form-control-sm" name="eal" [(ngModel)]="pAllergies" /></div>
                  <div class="col-12"><button class="btn btn-sm btn-primary" [disabled]="saving()" (click)="savePatient()">Save details</button></div>
                </div>
              } @else {
                <div class="text-capitalize">{{ x.patientId.gender }}{{ x.patientId.age ? ' · ' + x.patientId.age + ' years' : '' }}</div>
                @if (x.patientId.phone) { <div class="small text-muted"><i class="bi bi-telephone me-1"></i>{{ x.patientId.phone }}</div> }
                @if (x.patientId.allergies) { <div class="badge text-bg-danger mt-1">Allergy: {{ x.patientId.allergies }}</div> }
              }
              <hr class="my-2" />
              <div class="small text-muted">Arrived {{ x.arrivedAt | date: 'medium' }}</div>
              @if (x.complaint) { <div class="mt-1"><i class="bi bi-chat-left-text me-1"></i>{{ x.complaint }}</div> }
              @if (x.arrival) { <div class="small mt-1"><i class="bi bi-truck me-1"></i>Brought by: <strong>{{ arrivalLabel(x.arrival) }}</strong></div> }
              @if (vitalsText(x.vitals)) { <div class="small mt-1"><i class="bi bi-activity me-1"></i>On arrival: {{ vitalsText(x.vitals) }}</div> }
              <div class="small mt-2"><i class="bi bi-person-badge me-1"></i>Doctor: <strong>{{ x.doctorId?.name || 'not decided yet' }}</strong></div>
              @if (x.status !== 'closed' && auth.has('emergency.edit')) {
                <div class="mt-3">
                  <div class="small fw-semibold mb-1">How serious?</div>
                  <div class="btn-group btn-group-sm w-100">
                    @for (t of levels; track t) {
                      <button type="button" class="btn" [style.background]="x.triage.level === t ? colour(t) : ''" [style.color]="x.triage.level === t ? '#fff' : ''" [class.btn-outline-secondary]="x.triage.level !== t" (click)="setTriage(t)">{{ t }}</button>
                    }
                  </div>
                </div>
                @if (!x.doctorId && doctors().length) {
                  <select class="form-select form-select-sm mt-2" [(ngModel)]="pickDoctor" name="pd" (ngModelChange)="setDoctor($event)">
                    <option value="">Choose the doctor</option>
                    @for (d of doctors(); track d._id) { <option [value]="d._id">{{ d.name }}</option> }
                  </select>
                }
              }
            </div>
          </div>

          <div class="card border-0 shadow-sm">
            <div class="card-header bg-white fw-semibold"><i class="bi bi-cash-coin me-1"></i>{{ x.status === 'closed' ? 'Final charges' : 'Charges so far' }} <span class="small text-muted fw-normal">(billed when the case is closed)</span></div>
            <div class="card-body small">
              @for (l of x.billPreview.lines; track l.description + l.rate) { <div class="d-flex justify-content-between"><span>{{ l.description }} × {{ l.qty }}</span><strong>{{ l.qty * l.rate | number: '1.0-0' }}</strong></div> }
              @if (!x.billPreview.lines.length) { <div class="text-muted">No charge yet.</div> }
              <hr class="my-2" />
              <div class="d-flex justify-content-between fs-6"><span>Total</span><strong>{{ x.billPreview.total | number: '1.0-0' }}</strong></div>
            </div>
          </div>
        </div>

        <div class="col-lg-7">
          @if (x.status === 'closed') {
            <div class="alert alert-secondary">
              <strong>Closed:</strong> <span class="text-capitalize">{{ x.outcome?.type }}</span>
              @if (x.outcome?.referredTo) { to {{ x.outcome!.referredTo }} }
              @if (x.outcome?.admissionId; as ad) { · <a [routerLink]="['/ipd', ad._id]">{{ ad.admissionNo }}: {{ ad.wardName }} / {{ ad.bedName }}</a> }
              @if (x.outcome?.summary) { <div class="mt-1">{{ x.outcome!.summary }}</div> }
            </div>
          } @else if (auth.has('emergency.edit')) {
            <div class="card border-0 shadow-sm mb-3">
              <div class="card-header bg-white fw-semibold"><i class="bi bi-bandaid me-1"></i>Treatment</div>
              <div class="card-body">
                @if (noteError()) { <div class="alert alert-danger py-2">{{ noteError() }}</div> }
                <textarea class="form-control mb-2" rows="2" name="ntext" [(ngModel)]="noteText" placeholder="What was done? How is the patient?"></textarea>
                <div class="row g-2 mb-2">
                  <div class="col-4"><input class="form-control form-control-sm" name="nbp" [(ngModel)]="nv.bp" placeholder="BP" /></div>
                  <div class="col-4"><input type="number" class="form-control form-control-sm" name="npulse" [(ngModel)]="nv.pulse" placeholder="Pulse" /></div>
                  <div class="col-4"><input type="number" class="form-control form-control-sm" name="nspo2" [(ngModel)]="nv.spo2" placeholder="SpO₂" /></div>
                </div>
                <div class="d-flex justify-content-between align-items-center mb-1"><span class="small fw-semibold">Medicines and procedures</span><button type="button" class="btn btn-sm btn-outline-primary" (click)="addItem()">+ Add</button></div>
                @for (i of items; track $index) {
                  <div class="row g-2 mb-1">
                    <div class="col-3"><select class="form-select form-select-sm" [name]="'it' + $index" [(ngModel)]="i.type"><option value="medicine">Medicine</option><option value="procedure">Procedure</option></select></div>
                    <div class="col-4"><input class="form-control form-control-sm" [name]="'in' + $index" [(ngModel)]="i.name" placeholder="Name" /></div>
                    <div class="col-2"><input class="form-control form-control-sm" [name]="'id' + $index" [(ngModel)]="i.dose" placeholder="Dose" /></div>
                    <div class="col-2"><input type="number" min="0" class="form-control form-control-sm" [name]="'ic' + $index" [(ngModel)]="i.charge" placeholder="Charge" /></div>
                    <div class="col-1"><button type="button" class="btn btn-sm btn-outline-danger w-100" (click)="items.splice($index, 1)"><i class="bi bi-x-lg"></i></button></div>
                  </div>
                }
                <button class="btn btn-primary mt-2" [disabled]="saving()" (click)="saveNote()">Save treatment</button>
              </div>
            </div>
          }

          <app-visit-lab [emergencyId]="x._id" [patientId]="x.patientId._id" [readonly]="x.status === 'closed'" />

          <div class="card border-0 shadow-sm">
            <div class="card-header bg-white fw-semibold"><i class="bi bi-journal-medical me-1"></i>Treatment record ({{ x.notes.length }})</div>
            <div class="list-group list-group-flush">
              @for (n of reversed(); track n._id) {
                <div class="list-group-item" [class.list-group-item-warning]="n.kind === 'referral'">
                  <div class="d-flex justify-content-between small text-muted"><span>{{ n.at | date: 'medium' }}</span><span>{{ n.byName }}</span></div>
                  @if (vitalsText(n.vitals)) { <div class="small"><i class="bi bi-activity me-1"></i>{{ vitalsText(n.vitals) }}</div> }
                  @if (n.kind === 'referral') { <span class="badge text-bg-warning me-1">Sent to another doctor</span> }
                  @if (n.text) { <div>{{ n.text }}</div> }
                  @if (n.items.length) { <div class="small mt-1">@for (i of n.items; track $index) { <span class="badge text-bg-light border me-1">{{ i.type === 'procedure' ? 'Procedure' : 'Medicine' }}: {{ i.name }}{{ i.dose ? ' · ' + i.dose : '' }}{{ i.charge ? ' · Rs. ' + i.charge : '' }}</span> }</div> }
                </div>
              } @empty { <div class="list-group-item text-muted">Nothing written yet.</div> }
            </div>
          </div>
        </div>
      </div>

      @if (showRefer()) {
        <div class="modal d-block modal-backdrop-custom" tabindex="-1">
          <div class="modal-dialog">
            <form class="modal-content" (ngSubmit)="refer()">
              <div class="modal-header"><h5 class="modal-title">Send {{ x.patientId.name }} to another doctor</h5><button type="button" class="btn-close" (click)="showRefer.set(false)"></button></div>
              <div class="modal-body">
                @if (referError()) { <div class="alert alert-danger py-2">{{ referError() }}</div> }
                <label class="form-label">Doctor *</label>
                <select class="form-select mb-3" name="rdoc" [(ngModel)]="referDoctor">
                  <option value="">Select doctor</option>
                  @for (d of otherDoctors(); track d._id) { <option [value]="d._id">{{ d.name }}{{ d.specialization ? ' (' + d.specialization + ')' : '' }}</option> }
                </select>
                <label class="form-label">Why? *</label>
                <textarea class="form-control" rows="3" name="rreason" [(ngModel)]="referReason" placeholder="e.g. Deep wound, needs stitches by a surgeon"></textarea>
                <div class="form-text">The case stays open and moves to that doctor. The treatment record shows who sent it, to whom, and why.</div>
              </div>
              <div class="modal-footer"><button type="button" class="btn btn-light" (click)="showRefer.set(false)">Cancel</button><button class="btn btn-warning" [disabled]="saving()">Send</button></div>
            </form>
          </div>
        </div>
      }

      @if (showClose()) {
        <div class="modal d-block modal-backdrop-custom" tabindex="-1">
          <div class="modal-dialog">
            <form class="modal-content" (ngSubmit)="close()">
              <div class="modal-header"><h5 class="modal-title">Close case: {{ x.patientId.name }}</h5><button type="button" class="btn-close" (click)="showClose.set(false)"></button></div>
              <div class="modal-body">
                @if (closeError()) { <div class="alert alert-danger py-2">{{ closeError() }}</div> }
                <label class="form-label">How does it end?</label>
                <select class="form-select mb-3" name="outcome" [(ngModel)]="outcome">
                  <option value="discharged">Sent home</option>
                  @if (canAdmit()) { <option value="admitted">Give a bed (in-patient)</option> }
                  <option value="referred">Referred to another hospital</option>
                  <option value="left">Left without treatment</option>
                  <option value="other">Other</option>
                </select>
                @if (outcome === 'admitted') {
                  <label class="form-label">Bed *</label>
                  <select class="form-select mb-2" name="bed" [(ngModel)]="bedId">
                    <option value="">Select a free bed</option>
                    @for (w of freeWards(); track w._id) { <optgroup [label]="w.name">@for (b of w.freeBeds; track b._id) { <option [value]="b._id">{{ b.name }} (Rs. {{ b.dailyCharge | number: '1.0-0' }} a day)</option> }</optgroup> }
                  </select>
                  @if (!x.doctorId) {
                    <label class="form-label">Doctor in charge *</label>
                    <select class="form-select mb-2" name="doc" [(ngModel)]="closeDoctor"><option value="">Select doctor</option>@for (d of doctors(); track d._id) { <option [value]="d._id">{{ d.name }}</option> }</select>
                  }
                }
                @if (outcome === 'referred') { <label class="form-label">Which hospital? *</label><input class="form-control mb-2" name="ref" [(ngModel)]="referredTo" /> }
                <label class="form-label">Summary and advice</label>
                <textarea class="form-control mb-3" rows="3" name="sum" [(ngModel)]="summary"></textarea>
                <label class="form-label">Discount (optional)</label>
                <input type="number" min="0" class="form-control" name="disc" [(ngModel)]="discount" />
                <div class="alert alert-info py-2 mt-3 mb-0 small">A bill of <strong>Rs. {{ x.billPreview.total | number: '1.0-0' }}</strong> is made now, after the treatment.</div>
              </div>
              <div class="modal-footer"><button type="button" class="btn btn-light" (click)="showClose.set(false)">Cancel</button><button class="btn btn-success" [disabled]="saving()">Close and make bill</button></div>
            </form>
          </div>
        </div>
      }
    }
  `,
})
export class EmergencyCaseComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  auth = inject(AuthService);

  c = signal<EmergencyDetail | null>(null);
  error = signal('');
  saving = signal(false);
  doctors = signal<Doctor[]>([]);
  wards = signal<WardRow[]>([]);
  levels = ['red', 'yellow', 'green'];

  editPatient = signal(false);
  pName = '';
  pAge: number | null = null;
  pGender = 'male';
  pPhone = '';
  pAllergies = '';
  pickDoctor = '';

  noteText = '';
  nv: { bp: string; pulse: number | null; spo2: number | null } = { bp: '', pulse: null, spo2: null };
  items: { type: string; name: string; dose: string; charge: number | null }[] = [];
  noteError = signal('');

  showRefer = signal(false);
  referError = signal('');
  referDoctor = '';
  referReason = '';
  otherDoctors = computed(() => this.doctors().filter((d) => d._id !== this.c()?.doctorId?._id));
  arrivalLabel = (v: string) => ({ ambulance: 'Ambulance', family: 'Family', self: 'Came by himself', police: 'Police', other: 'Other' } as Record<string, string>)[v] ?? v;

  showClose = signal(false);
  closeError = signal('');
  outcome = 'discharged';
  bedId = '';
  closeDoctor = '';
  referredTo = '';
  summary = '';
  discount = 0;

  reversed = computed(() => [...(this.c()?.notes ?? [])].reverse());
  canAdmit = () => this.auth.hasModule('ipd') && this.auth.has('ipd.create');
  freeWards = computed(() =>
    this.wards().filter((w) => w.isActive).map((w) => ({ ...w, freeBeds: w.beds.filter((b) => b.isActive && !b.occupied) })).filter((w) => w.freeBeds.length)
  );

  ngOnInit() {
    this.load();
    this.http.get<Doctor[]>(`${API}/users/doctors`).subscribe((d) => this.doctors.set(d));
  }

  private get id() {
    return this.route.snapshot.paramMap.get('id');
  }

  colour = (level: string) => (level === 'red' ? '#dc3545' : level === 'yellow' ? '#e0a800' : '#198754');

  vitalsText(v?: Record<string, unknown>) {
    if (!v) return '';
    const parts: string[] = [];
    if (v['bp']) parts.push(`BP ${v['bp']}`);
    if (v['pulse']) parts.push(`Pulse ${v['pulse']}`);
    if (v['temperature']) parts.push(`${v['temperature']}°F`);
    if (v['spo2']) parts.push(`SpO₂ ${v['spo2']}%`);
    if (v['sugar']) parts.push(`Sugar ${v['sugar']}`);
    return parts.join(' · ');
  }

  load() {
    this.http.get<EmergencyDetail>(`${API}/emergency/cases/${this.id}`).subscribe({
      next: (x) => {
        this.c.set(x);
        this.pName = x.patientId.name;
        this.pAge = x.patientId.age ?? null;
        this.pGender = x.patientId.gender ?? 'male';
        this.pPhone = x.patientId.phone ?? '';
        this.pAllergies = x.patientId.allergies ?? '';
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  private update(body: Record<string, unknown>, done?: () => void) {
    this.saving.set(true);
    this.http.put<EmergencyDetail>(`${API}/emergency/cases/${this.id}`, body).subscribe({
      next: (x) => {
        this.saving.set(false);
        this.c.set(x);
        done?.();
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }

  setTriage(level: string) {
    this.update({ triage: level });
  }

  setDoctor(id: string) {
    if (id) this.update({ doctorId: id });
  }

  savePatient() {
    this.update({ patient: { name: this.pName, age: this.pAge, gender: this.pGender, phone: this.pPhone, allergies: this.pAllergies } }, () => this.editPatient.set(false));
  }

  addItem() {
    this.items.push({ type: 'medicine', name: '', dose: '', charge: null });
  }

  saveNote() {
    this.noteError.set('');
    const items = this.items.filter((i) => i.name.trim()).map((i) => ({ type: i.type, name: i.name, dose: i.dose, charge: Number(i.charge) || 0 }));
    this.saving.set(true);
    this.http.post<EmergencyDetail>(`${API}/emergency/cases/${this.id}/notes`, { text: this.noteText, vitals: this.nv, items }).subscribe({
      next: (x) => {
        this.saving.set(false);
        this.c.set(x);
        this.noteText = '';
        this.nv = { bp: '', pulse: null, spo2: null };
        this.items = [];
      },
      error: (e) => {
        this.saving.set(false);
        this.noteError.set(errorMessage(e));
      },
    });
  }

  openRefer() {
    this.referError.set('');
    this.referDoctor = '';
    this.referReason = '';
    this.showRefer.set(true);
  }

  refer() {
    this.referError.set('');
    if (!this.referDoctor) return this.referError.set('Select the doctor');
    if (!this.referReason.trim()) return this.referError.set('Write why the case is sent to this doctor');
    this.saving.set(true);
    this.http.post<EmergencyDetail>(`${API}/emergency/cases/${this.id}/refer`, { doctorId: this.referDoctor, reason: this.referReason }).subscribe({
      next: (x) => {
        this.saving.set(false);
        this.showRefer.set(false);
        this.c.set(x);
      },
      error: (e) => {
        this.saving.set(false);
        this.referError.set(errorMessage(e));
      },
    });
  }

  openClose() {
    this.closeError.set('');
    this.outcome = 'discharged';
    this.bedId = '';
    this.closeDoctor = '';
    this.referredTo = '';
    this.summary = '';
    this.discount = 0;
    if (this.canAdmit()) this.http.get<WardRow[]>(`${API}/ipd/wards`).subscribe((w) => this.wards.set(w));
    this.showClose.set(true);
  }

  close() {
    this.closeError.set('');
    if (this.outcome === 'admitted' && !this.bedId) return this.closeError.set('Select a bed');
    if (this.outcome === 'referred' && !this.referredTo.trim()) return this.closeError.set('Write which hospital the patient is referred to');
    this.saving.set(true);
    this.http
      .post<EmergencyDetail>(`${API}/emergency/cases/${this.id}/close`, {
        type: this.outcome, summary: this.summary, referredTo: this.referredTo, bedId: this.bedId || undefined,
        doctorId: this.closeDoctor || undefined, discount: Number(this.discount) || 0,
      })
      .subscribe({
        next: (x) => {
          this.saving.set(false);
          this.showClose.set(false);
          this.c.set(x);
        },
        error: (e) => {
          this.saving.set(false);
          this.closeError.set(errorMessage(e));
        },
      });
  }
}
