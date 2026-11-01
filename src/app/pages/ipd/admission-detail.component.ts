import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { AdmissionDetail } from '../../core/models';

/** One patient in a bed: the bed team writes the daily checkup and medicines, and the doctor discharges. */
@Component({
  selector: 'app-admission-detail',
  imports: [FormsModule, RouterLink, DecimalPipe, DatePipe],
  template: `
    <div class="d-print-none"><a routerLink="/ipd" class="text-decoration-none small"><i class="bi bi-arrow-left"></i> In-patients</a></div>
    @if (error()) { <div class="alert alert-danger py-2 mt-2 d-print-none">{{ error() }}</div> }

    @if (a(); as x) {
      <div class="d-flex justify-content-between align-items-center my-3 flex-wrap gap-2 d-print-none">
        <h3 class="mb-0">{{ x.patientId.name }} <small class="text-muted fs-6">{{ x.patientId.mrn }}</small>
          <span class="badge fs-6 ms-2" [class.text-bg-warning]="x.status === 'admitted'" [class.text-bg-success]="x.status === 'discharged'">{{ x.status === 'admitted' ? 'In bed' : 'Discharged' }}</span>
        </h3>
        <div class="d-flex gap-2">
          @if (x.invoiceId) { <a class="btn btn-outline-secondary" [routerLink]="['/billing', x.invoiceId._id]"><i class="bi bi-receipt me-1"></i>Bill {{ x.invoiceId.invoiceNo }}</a> }
          @if (x.status === 'discharged') { <button class="btn btn-outline-primary" (click)="print()"><i class="bi bi-printer me-1"></i>Print discharge summary</button> }
          @if (x.status === 'admitted' && auth.has('ipd.discharge')) { <button class="btn btn-success" (click)="showDischarge.set(true)"><i class="bi bi-box-arrow-right me-1"></i>Discharge</button> }
        </div>
      </div>

      <div class="card border-0 shadow-sm mb-3">
        <div class="card-body">
          <div class="d-none d-print-block text-center mb-3"><h4 class="mb-0">{{ auth.me()?.hospital?.name }}</h4><div class="text-muted">Discharge summary</div></div>
          <div class="row g-2">
            <div class="col-md-4"><div class="small text-muted">Patient</div><strong>{{ x.patientId.name }}</strong> ({{ x.patientId.mrn }})<div class="small text-muted text-capitalize">{{ x.patientId.gender }}{{ x.patientId.age ? ' · ' + x.patientId.age + ' y' : '' }}</div></div>
            <div class="col-md-4"><div class="small text-muted">Bed</div>{{ x.wardName }} / {{ x.bedName }}<div class="small text-muted">Rs. {{ x.bedRate | number: '1.0-0' }} a day</div></div>
            <div class="col-md-4"><div class="small text-muted">Doctor in charge</div>{{ x.doctorId.name }}</div>
            <div class="col-md-4"><div class="small text-muted">Admitted</div>{{ x.day }} <code>{{ x.admissionNo }}</code></div>
            @if (x.status === 'discharged' && x.discharge) {
              <div class="col-md-4"><div class="small text-muted">Discharged</div>{{ x.discharge.day }} · {{ x.discharge.days }} day(s)</div>
              <div class="col-md-4"><div class="small text-muted">Condition</div><span class="text-capitalize">{{ x.discharge.condition }}</span></div>
            }
            @if (x.patientId.allergies) { <div class="col-12"><span class="badge text-bg-danger">Allergy: {{ x.patientId.allergies }}</span></div> }
            @if (x.diagnosis) { <div class="col-12"><div class="small text-muted">Diagnosis</div>{{ x.diagnosis }}</div> }
            @if (x.notes) { <div class="col-12"><div class="small text-muted">Notes for the bed team</div>{{ x.notes }}</div> }
            @if (x.discharge?.summary) { <div class="col-12"><div class="small text-muted">Discharge advice</div>{{ x.discharge!.summary }}</div> }
          </div>
        </div>
      </div>

      @if (x.status === 'admitted' && auth.has('ipd.edit')) {
        <div class="card border-0 shadow-sm mb-3 d-print-none">
          <div class="card-header bg-white fw-semibold"><i class="bi bi-clipboard2-pulse me-1"></i>Today's round (bed team)</div>
          <div class="card-body">
            @if (roundError()) { <div class="alert alert-danger py-2">{{ roundError() }}</div> }
            <div class="row g-2 mb-2">
              <div class="col-6 col-md-3"><label class="form-label small mb-0">BP</label><input class="form-control form-control-sm" name="bp" [(ngModel)]="vitals.bp" placeholder="120/80" /></div>
              <div class="col-6 col-md-3"><label class="form-label small mb-0">Pulse</label><input type="number" class="form-control form-control-sm" name="pulse" [(ngModel)]="vitals.pulse" /></div>
              <div class="col-6 col-md-3"><label class="form-label small mb-0">Temp (°F)</label><input type="number" step="0.1" class="form-control form-control-sm" name="temp" [(ngModel)]="vitals.temperature" /></div>
              <div class="col-6 col-md-3"><label class="form-label small mb-0">SpO₂ / Sugar</label>
                <div class="input-group input-group-sm"><input type="number" class="form-control" name="spo2" [(ngModel)]="vitals.spo2" placeholder="SpO₂" /><input type="number" class="form-control" name="sugar" [(ngModel)]="vitals.sugar" placeholder="Sugar" /></div>
              </div>
            </div>
            <label class="form-label small mb-0">Checkup notes</label>
            <textarea class="form-control mb-2" rows="2" name="rnotes" [(ngModel)]="roundNotes" placeholder="How is the patient today?"></textarea>
            <div class="d-flex justify-content-between align-items-center mb-1"><span class="small fw-semibold">Medicines given</span><button type="button" class="btn btn-sm btn-outline-primary" (click)="addMedicine()">+ Medicine</button></div>
            @for (m of medicines; track $index) {
              <div class="row g-2 mb-1">
                <div class="col-md-5"><input class="form-control form-control-sm" [name]="'mn' + $index" [(ngModel)]="m.name" placeholder="Medicine" /></div>
                <div class="col-md-3"><input class="form-control form-control-sm" [name]="'md' + $index" [(ngModel)]="m.dose" placeholder="Dose" /></div>
                <div class="col-md-3"><input type="number" min="0" class="form-control form-control-sm" [name]="'mc' + $index" [(ngModel)]="m.charge" placeholder="Charge (optional)" /></div>
                <div class="col-md-1"><button type="button" class="btn btn-sm btn-outline-danger w-100" (click)="medicines.splice($index, 1)"><i class="bi bi-x-lg"></i></button></div>
              </div>
            }
            <button class="btn btn-primary mt-2" [disabled]="saving()" (click)="saveRound()">Save round</button>
          </div>
        </div>
      }

      <div class="card border-0 shadow-sm mb-3">
        <div class="card-header bg-white fw-semibold"><i class="bi bi-journal-medical me-1"></i>Rounds ({{ x.rounds.length }})</div>
        <div class="list-group list-group-flush">
          @for (r of reversed(x); track r._id) {
            <div class="list-group-item">
              <div class="d-flex justify-content-between small text-muted"><span>{{ r.day }} · {{ r.at | date: 'shortTime' }}</span><span>{{ r.byName }}</span></div>
              @if (vitalsText(r.vitals)) { <div class="small"><i class="bi bi-activity me-1"></i>{{ vitalsText(r.vitals) }}</div> }
              @if (r.notes) { <div>{{ r.notes }}</div> }
              @if (r.medicines.length) {
                <div class="small mt-1">@for (m of r.medicines; track $index) { <span class="badge text-bg-light border me-1">{{ m.name }}{{ m.dose ? ' · ' + m.dose : '' }}{{ m.charge ? ' · Rs. ' + m.charge : '' }}</span> }</div>
              }
            </div>
          } @empty { <div class="list-group-item text-muted">No round written yet.</div> }
        </div>
      </div>

      <div class="card border-0 shadow-sm mb-3 d-print-none">
        <div class="card-header bg-white fw-semibold"><i class="bi bi-cash-coin me-1"></i>{{ x.status === 'admitted' ? 'Bill so far' : 'Final bill' }}</div>
        <div class="card-body small">
          <div class="d-flex justify-content-between"><span>Bed: {{ x.billPreview.days }} day(s) × {{ x.billPreview.bedRate | number: '1.0-0' }}</span><strong>{{ x.billPreview.bedCharge | number: '1.0-0' }}</strong></div>
          @for (l of x.billPreview.lines; track l.name + l.rate) { <div class="d-flex justify-content-between"><span>{{ l.name }} × {{ l.qty }}</span><strong>{{ l.qty * l.rate | number: '1.0-0' }}</strong></div> }
          <hr class="my-2" />
          <div class="d-flex justify-content-between fs-6"><span>Total</span><strong>{{ x.billPreview.total | number: '1.0-0' }}</strong></div>
        </div>
      </div>

      @if (showDischarge()) {
        <div class="modal d-block modal-backdrop-custom d-print-none" tabindex="-1">
          <div class="modal-dialog">
            <form class="modal-content" (ngSubmit)="discharge()">
              <div class="modal-header"><h5 class="modal-title">Discharge {{ x.patientId.name }}</h5><button type="button" class="btn-close" (click)="showDischarge.set(false)"></button></div>
              <div class="modal-body">
                @if (dischargeError()) { <div class="alert alert-danger py-2">{{ dischargeError() }}</div> }
                <label class="form-label">Condition</label>
                <select class="form-select mb-3" name="cond" [(ngModel)]="condition">
                  @for (c of conditions; track c) { <option [value]="c" class="text-capitalize">{{ c }}</option> }
                </select>
                <label class="form-label">Advice for home (medicines, diet, follow-up)</label>
                <textarea class="form-control mb-3" rows="3" name="summary" [(ngModel)]="summary"></textarea>
                <label class="form-label">Discount (optional)</label>
                <input type="number" min="0" class="form-control" name="disc" [(ngModel)]="discount" />
                <div class="alert alert-info py-2 mt-3 mb-0 small">The bed becomes free and a bill of <strong>Rs. {{ x.billPreview.total | number: '1.0-0' }}</strong> ({{ x.billPreview.days }} day(s) of bed and medicines) is made.</div>
              </div>
              <div class="modal-footer"><button type="button" class="btn btn-light" (click)="showDischarge.set(false)">Cancel</button><button class="btn btn-success" [disabled]="saving()">Discharge and make bill</button></div>
            </form>
          </div>
        </div>
      }
    }
  `,
})
export class AdmissionDetailComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  auth = inject(AuthService);

  a = signal<AdmissionDetail | null>(null);
  error = signal('');
  saving = signal(false);
  roundError = signal('');
  dischargeError = signal('');
  showDischarge = signal(false);

  vitals: { bp: string; pulse: number | null; temperature: number | null; spo2: number | null; sugar: number | null } = { bp: '', pulse: null, temperature: null, spo2: null, sugar: null };
  roundNotes = '';
  medicines: { name: string; dose: string; charge: number | null }[] = [];

  conditions = ['recovered', 'improved', 'referred', 'left against advice', 'other'];
  condition = 'recovered';
  summary = '';
  discount = 0;

  ngOnInit() {
    this.load();
  }

  private get id() {
    return this.route.snapshot.paramMap.get('id');
  }

  load() {
    this.http.get<AdmissionDetail>(`${API}/ipd/admissions/${this.id}`).subscribe({
      next: (x) => this.a.set(x),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  reversed = (x: AdmissionDetail) => [...x.rounds].reverse();

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

  addMedicine() {
    this.medicines.push({ name: '', dose: '', charge: null });
  }

  saveRound() {
    this.roundError.set('');
    const v = this.vitals;
    const medicines = this.medicines.filter((m) => m.name.trim()).map((m) => ({ name: m.name, dose: m.dose, charge: Number(m.charge) || 0 }));
    this.saving.set(true);
    this.http
      .post(`${API}/ipd/admissions/${this.id}/rounds`, {
        vitals: { bp: v.bp, pulse: v.pulse, temperature: v.temperature, spo2: v.spo2, sugar: v.sugar },
        notes: this.roundNotes, medicines,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.vitals = { bp: '', pulse: null, temperature: null, spo2: null, sugar: null };
          this.roundNotes = '';
          this.medicines = [];
          this.load();
        },
        error: (e) => {
          this.saving.set(false);
          this.roundError.set(errorMessage(e));
        },
      });
  }

  discharge() {
    this.dischargeError.set('');
    this.saving.set(true);
    this.http.post(`${API}/ipd/admissions/${this.id}/discharge`, { condition: this.condition, summary: this.summary, discount: Number(this.discount) || 0 }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showDischarge.set(false);
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.dischargeError.set(errorMessage(e));
      },
    });
  }

  print() {
    window.print();
  }
}
