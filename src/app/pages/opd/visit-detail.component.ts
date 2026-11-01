import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { Medicine, Prescription, RxItem, Visit, Vitals } from '../../core/models';
import { DURATIONS, FREQUENCIES, STATUS_CLASS, ageText } from '../../core/util';
import { LoaderComponent } from '../../shared/loader.component';
import { VisitHistoryComponent } from '../../shared/visit-history.component';
import { VisitLabComponent } from '../lab/visit-lab.component';

@Component({
  selector: 'app-visit-detail',
  imports: [FormsModule, RouterLink, VisitHistoryComponent, LoaderComponent, VisitLabComponent],
  template: `
    <a routerLink="/queue" class="text-decoration-none small"><i class="bi bi-arrow-left"></i> Pending patients</a>
    @if (error()) { <div class="alert alert-danger py-2 mt-2">{{ error() }}</div> }
    @if (notice()) { <div class="alert alert-success py-2 mt-2">{{ notice() }}</div> }
    @if (!visit() && !error()) { <app-loader text="Loading checkup…" /> }

    @if (visit(); as v) {
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 my-3">
        <div>
          <h4 class="mb-0">{{ v.patientId.name }} <small class="text-muted fs-6">{{ v.patientId.mrn }}</small></h4>
          <div class="text-muted small">
            {{ v.visitNo }} · {{ v.date }} · {{ v.doctorId.name }}
            <span class="badge ms-1" [class]="badge(v.status)">{{ v.status }}</span>
          </div>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <button class="btn btn-outline-secondary" [class.active]="showHistory()" (click)="showHistory.set(!showHistory())">
            <i class="bi bi-clock-history me-1"></i>History <span class="badge bg-secondary">{{ previous().length }}</span>
          </button>
          @if (canAdmit()) {
            <a class="btn btn-outline-primary" routerLink="/ipd" [queryParams]="{ admit: 1, patientId: v.patientId._id, visitId: v._id }"><i class="bi bi-hospital me-1"></i>Admit to bed</a>
          }
          @if (rx()._id && canPrint()) {
            <a class="btn btn-outline-dark" [routerLink]="['/prescriptions', rx()._id, 'print']" [queryParams]="{ auto: 'print' }"><i class="bi bi-printer me-1"></i>Print</a>
            <a class="btn btn-outline-dark" [routerLink]="['/prescriptions', rx()._id, 'print']" [queryParams]="{ auto: 'pdf' }"><i class="bi bi-file-earmark-pdf me-1"></i>PDF</a>
          }
        </div>
      </div>

      <div class="row g-3">
        <div class="col-12">
          <div class="card border-0 shadow-sm">
            <div class="card-body small d-flex flex-wrap align-items-center gap-3 py-2">
              <span class="fw-semibold">Patient</span>
              <span class="text-capitalize">{{ v.patientId.gender }}{{ age(v.patientId) ? ' · ' + age(v.patientId) : '' }}{{ v.patientId.bloodGroup ? ' · ' + v.patientId.bloodGroup : '' }}</span>
              @if (v.patientId.phone) { <span><i class="bi bi-telephone"></i> {{ v.patientId.phone }}</span> }
              @if (v.patientId.allergies) { <span class="alert alert-danger py-0 px-2 mb-0"><strong>Allergies:</strong> {{ v.patientId.allergies }}</span> }
              @if (v.patientId.chronicConditions) { <span class="alert alert-warning py-0 px-2 mb-0"><strong>Chronic:</strong> {{ v.patientId.chronicConditions }}</span> }
            </div>
          </div>
        </div>

        <div class="col-12">
          @if (showHistory()) {
            <div class="card border-0 shadow-sm mb-3">
              <div class="card-header bg-white fw-semibold"><i class="bi bi-clock-history me-1"></i>All earlier visits</div>
              <div class="card-body">
                <app-visit-history [visits]="previous()" [prescriptions]="prevRx()" [openFirst]="true" emptyText="First visit: no earlier history." />
              </div>
            </div>
          }

          @if (copiedFrom(); as c) {
            <div class="alert alert-info py-2 d-flex justify-content-between align-items-center">
              <span><i class="bi bi-clipboard-check me-1"></i>History, diagnosis and medicines are filled from the last visit ({{ c }}). Change anything that is different today.</span>
              <button type="button" class="btn btn-link btn-sm p-0" (click)="clearCopied()">Clear</button>
            </div>
          }

          <fieldset [disabled]="!canEdit()">
            <div class="card border-0 shadow-sm mb-3">
              <div class="card-header bg-white fw-semibold">Vitals</div>
              <div class="card-body">
                <div class="row g-2">
                  <div class="col-6 col-md-3"><label class="form-label small mb-0">BP (mmHg)</label><input class="form-control" placeholder="120/80" [(ngModel)]="vitals.bp" name="bp" /></div>
                  <div class="col-6 col-md-3"><label class="form-label small mb-0">Pulse (/min)</label><input type="number" class="form-control" [(ngModel)]="vitals.pulse" name="pulse" /></div>
                  <div class="col-6 col-md-3"><label class="form-label small mb-0">Temp (°F)</label><input type="number" step="0.1" class="form-control" [(ngModel)]="vitals.temperature" name="temp" /></div>
                  <div class="col-6 col-md-3"><label class="form-label small mb-0">SpO₂ (%)</label><input type="number" class="form-control" [(ngModel)]="vitals.spo2" name="spo2" /></div>
                  <div class="col-6 col-md-3"><label class="form-label small mb-0">Weight (kg)</label><input type="number" step="0.1" class="form-control" [(ngModel)]="vitals.weight" name="weight" /></div>
                  <div class="col-6 col-md-3"><label class="form-label small mb-0">Height (cm)</label><input type="number" class="form-control" [(ngModel)]="vitals.height" name="height" /></div>
                  <div class="col-6 col-md-3"><label class="form-label small mb-0">Sugar (mg/dL)</label><input type="number" class="form-control" [(ngModel)]="vitals.sugar" name="sugar" /></div>
                  <div class="col-6 col-md-3"><label class="form-label small mb-0">BMI <span class="text-muted">(automatic)</span></label><input class="form-control" [value]="bmiText()" placeholder="needs weight &amp; height" title="Calculated from weight and height" disabled /></div>
                </div>
              </div>
            </div>

            <div class="card border-0 shadow-sm mb-3">
              <div class="card-header bg-white fw-semibold">Consultation</div>
              <div class="card-body">
                <div class="row g-3">
                  <div class="col-md-6"><label class="form-label">Complaint</label><textarea class="form-control" rows="2" [(ngModel)]="f.complaint" name="complaint"></textarea></div>
                  <div class="col-md-6"><label class="form-label">History</label><textarea class="form-control" rows="2" [(ngModel)]="f.history" name="history"></textarea></div>
                  <div class="col-md-6"><label class="form-label">Examination</label><textarea class="form-control" rows="2" [(ngModel)]="f.examination" name="exam"></textarea></div>
                  <div class="col-md-6"><label class="form-label">Diagnosis</label><textarea class="form-control" rows="2" [(ngModel)]="f.diagnosis" name="diagnosis"></textarea></div>
                  <div class="col-md-8"><label class="form-label">Doctor's notes (private)</label><textarea class="form-control" rows="2" [(ngModel)]="f.notes" name="notes"></textarea></div>
                  <div class="col-md-4"><label class="form-label">Follow-up date</label><input type="date" class="form-control" [(ngModel)]="f.followUpDate" name="followUp" /></div>
                </div>
              </div>
            </div>
          </fieldset>

          <app-visit-lab [visitId]="v._id" [patientId]="v.patientId._id" />

          @if (showRx()) {
            <fieldset [disabled]="!canEditRx()">
              <div class="card border-0 shadow-sm mb-3">
                <div class="card-header bg-white d-flex justify-content-between align-items-center">
                  <span class="fw-semibold">Prescription @if (rx().rxNo) { <code class="ms-1">{{ rx().rxNo }}</code> }</span>
                  <div class="position-relative flex-grow-1 ms-3">
                    <div class="input-group input-group-sm">
                      <span class="input-group-text"><i class="bi bi-search"></i></span>
                      <input
                        class="form-control"
                        name="medsearch"
                        placeholder="Search a medicine and select it…"
                        autocomplete="off"
                        [ngModel]="medQuery()"
                        (ngModelChange)="medQuery.set($event); medOpen.set(true)"
                        (focus)="medOpen.set(true)"
                        (blur)="closeMedList()"
                        (keydown.enter)="$event.preventDefault(); pickFirstMedicine()"
                        (keydown.escape)="medOpen.set(false)"
                      />
                    </div>
                    @if (medOpen() && medQuery().trim()) {
                      <div class="list-group position-absolute w-100 shadow" style="z-index: 1060; max-height: 300px; overflow: auto">
                        @for (m of medMatches(); track m._id) {
                          <button type="button" class="list-group-item list-group-item-action py-2" (mousedown)="$event.preventDefault(); addFromList(m)">
                            <div class="fw-semibold">{{ m.name }}</div>
                            <div class="small text-muted">{{ medSummary(m) || 'no saved details' }}</div>
                          </button>
                        }
                        <button type="button" class="list-group-item list-group-item-action py-2 text-primary" (mousedown)="$event.preventDefault(); addTyped()">
                          <i class="bi bi-plus-lg me-1"></i>Add "{{ medQuery().trim() }}" as a new medicine
                        </button>
                      </div>
                    }
                  </div>
                </div>
                <div class="card-body">
                  <div class="table-responsive">
                    <table class="table table-sm align-middle mb-2">
                      <thead><tr><th style="width:28%">Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Instructions</th><th></th></tr></thead>
                      <tbody>
                        @for (it of items(); track $index) {
                          <tr>
                            <td><input class="form-control form-control-sm" [(ngModel)]="it.medicine" (ngModelChange)="onMedicine(it, $event)" list="meds" autocomplete="off" [name]="'m' + $index" placeholder="Type a medicine name…" /></td>
                            <td><input class="form-control form-control-sm" [(ngModel)]="it.dose" (input)="it.auto = false" [name]="'d' + $index" placeholder="1 tab" /></td>
                            <td><input class="form-control form-control-sm" list="freqs" [(ngModel)]="it.frequency" (input)="it.auto = false" [name]="'f' + $index" placeholder="1+0+1" /></td>
                            <td><input class="form-control form-control-sm" list="durs" [(ngModel)]="it.duration" (input)="it.auto = false" [name]="'u' + $index" placeholder="5 days" /></td>
                            <td><input class="form-control form-control-sm" [(ngModel)]="it.instructions" (input)="it.auto = false" [name]="'i' + $index" placeholder="after meals" /></td>
                            <td><button type="button" class="btn btn-sm btn-outline-danger" (click)="removeItem($index)"><i class="bi bi-x-lg"></i></button></td>
                          </tr>
                        } @empty {
                          <tr><td colspan="6" class="text-muted text-center py-3">No medicines yet. Search a medicine above and select it.</td></tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  <datalist id="freqs">@for (x of frequencies; track x) { <option [value]="x"></option> }</datalist>
                  <datalist id="meds">@for (m of meds(); track m._id) { <option [value]="m.name">{{ medSummary(m) }}</option> }</datalist>
                  <datalist id="durs">@for (x of durations; track x) { <option [value]="x"></option> }</datalist>
                  <div class="small text-muted mb-2"><i class="bi bi-lightbulb me-1"></i>Pick a saved medicine from the list and its dose, frequency and duration fill in by themselves. New medicines are saved to your list automatically. <a routerLink="/medicines">Manage medicines</a></div>
                  <div class="row g-3">
                    <div class="col-md-6"><label class="form-label">Advice</label><textarea class="form-control" rows="2" [ngModel]="rx().advice" (ngModelChange)="patchRx({ advice: $event })" name="advice"></textarea></div>
                    <div class="col-md-6"><label class="form-label">Tests advised</label><textarea class="form-control" rows="2" [ngModel]="rx().tests" (ngModelChange)="patchRx({ tests: $event })" name="tests"></textarea></div>
                  </div>
                </div>
              </div>
            </fieldset>
          }
          @if (canEdit()) {
            <div class="d-flex justify-content-end gap-2 mb-4">
              @if (rx()._id && canPrint()) {
                <a class="btn btn-outline-dark" [routerLink]="['/prescriptions', rx()._id, 'print']" [queryParams]="{ auto: 'print' }"><i class="bi bi-printer me-1"></i>Print</a>
                <a class="btn btn-outline-dark" [routerLink]="['/prescriptions', rx()._id, 'print']" [queryParams]="{ auto: 'pdf' }"><i class="bi bi-file-earmark-pdf me-1"></i>PDF</a>
              }
              @if (showRx() && canPrint()) {
                <button class="btn btn-outline-success px-4" [disabled]="saving()" (click)="saveAndPdf()"><i class="bi bi-file-earmark-pdf me-1"></i>Submit &amp; PDF</button>
              }
              <button class="btn btn-success px-4" [disabled]="saving()" (click)="save()">@if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span>Saving… } @else { <i class="bi bi-check2-circle me-1"></i>Save }</button>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class VisitDetailComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  visit = signal<Visit | null>(null);
  previous = signal<Visit[]>([]);
  prevRx = signal<Prescription[]>([]);
  /** The hospital's medicine list, used for suggestions and auto-fill. */
  meds = signal<Medicine[]>([]);
  rx = signal<Partial<Prescription>>({});
  items = signal<RxItem[]>([]);
  showHistory = signal(false);
  /** Date of the earlier visit whose values were copied into this form (null when nothing was copied). */
  copiedFrom = signal<string | null>(null);
  error = signal('');
  notice = signal('');
  saving = signal(false);

  vitals: Vitals = {};
  f: Partial<Visit> = {};
  frequencies = FREQUENCIES;
  durations = DURATIONS;

  age = ageText;
  badge = (s: string) => `badge ${STATUS_CLASS[s] ?? 'bg-secondary'}`;
  canEdit = () => this.auth.has('opd.edit');
  canAdmit = () => this.auth.has('ipd.create');
  showRx = () => this.auth.hasModule('prescriptions') && (this.auth.has('prescriptions.view') || this.auth.has('prescriptions.create'));
  canEditRx = () => (this.rx()._id ? this.auth.has('prescriptions.edit') : this.auth.has('prescriptions.create'));
  canPrint = () => this.auth.hasModule('prescriptions') && this.auth.has('prescriptions.print');

  private id = '';
  // The last-visit values are copied once everything they depend on has loaded.
  private loaded = { previous: false, prevRx: false, thisRx: false };

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    const rxOn = this.showRx();
    if (!rxOn) this.loaded.prevRx = this.loaded.thisRx = true;

    window.addEventListener('pagehide', this.release);
    this.http.get<Visit>(`${API}/visits/${this.id}`).subscribe({
      next: (v) => {
        this.visit.set(v);
        // Opening the form puts the patient "with doctor" (also after a page reload).
        if (v.status === 'open' && this.canEdit()) this.http.post(`${API}/visits/${this.id}/start`, {}).subscribe({ error: () => {} });
        this.vitals = { ...(v.vitals ?? {}) };
        this.f = { complaint: v.complaint, history: v.history, examination: v.examination, diagnosis: v.diagnosis, notes: v.notes, followUpDate: v.followUpDate };

        this.http.get<Visit[]>(`${API}/visits`, { params: { patientId: v.patientId._id } }).subscribe((all) => {
          this.previous.set(all.filter((x) => x._id !== v._id && x.status !== 'cancelled').slice(0, 20));
          this.loaded.previous = true;
          this.copyFromLast();
        });
        if (rxOn) {
          this.http.get<Prescription[]>(`${API}/prescriptions`, { params: { patientId: v.patientId._id } }).subscribe((list) => {
            this.prevRx.set(list);
            this.loaded.prevRx = true;
            this.copyFromLast();
          });
        }
      },
      error: (e) => this.error.set(errorMessage(e)),
    });

    if (rxOn) {
      this.http.get<Medicine[]>(`${API}/medicines`).subscribe({ next: (m) => this.meds.set(m), error: () => {} });
      this.http.get<Prescription[]>(`${API}/prescriptions`, { params: { visitId: this.id } }).subscribe((list) => {
        if (list[0]) this.setRx(list[0]);
        this.loaded.thisRx = true;
        this.copyFromLast();
      });
    }
  }

  ngOnDestroy() {
    window.removeEventListener('pagehide', this.release);
    this.release();
  }

  /** Leaving the form without saving puts the patient back to "waiting". Uses fetch keepalive so it also survives closing the tab. */
  private release = () => {
    if (this.visit()?.status !== 'open' || !this.canEdit()) return;
    fetch(`${API}/visits/${this.id}/release`, {
      method: 'POST',
      keepalive: true,
      headers: { Authorization: `Bearer ${this.auth.token()}`, 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => {});
  };

  /**
   * "Start checkup": a fresh visit gets the history, examination, diagnosis and medicines of the patient's
   * last completed visit, so the doctor only edits what changed. Never overwrites anything already written.
   */
  private copyFromLast() {
    if (!this.loaded.previous || !this.loaded.prevRx || !this.loaded.thisRx) return;
    const v = this.visit();
    if (!v || v.status !== 'open' || this.copiedFrom() || this.rx()._id) return;
    const untouched = !this.f.history && !this.f.examination && !this.f.diagnosis && !this.f.notes && !this.items().length;
    if (!untouched) return;

    const last = this.previous().find((p) => p.status === 'completed');
    if (!last) return;
    const lastRx = this.prevRx().find((r) => (r.visitId?._id ?? r.visitId) === last._id);

    this.f = { ...this.f, history: last.history, examination: last.examination, diagnosis: last.diagnosis };
    if (lastRx) {
      this.items.set(lastRx.items.map((i) => ({ ...i })));
      this.rx.update((r) => ({ ...r, advice: lastRx.advice, tests: lastRx.tests }));
    }
    const copied = !!(last.history || last.examination || last.diagnosis || lastRx?.items.length || lastRx?.advice || lastRx?.tests);
    if (copied) this.copiedFrom.set(last.date);
  }

  clearCopied() {
    this.f = { ...this.f, history: '', examination: '', diagnosis: '' };
    this.items.set([]);
    this.rx.update((r) => ({ ...r, advice: '', tests: '' }));
    this.copiedFrom.set(null);
  }

  // BMI is shown from the current vitals (plain method so it re-evaluates on every change).
  bmiText() {
    const { weight, height } = this.vitals;
    return weight && height ? (weight / Math.pow(height / 100, 2)).toFixed(1) : '';
  }

  private setRx(r: Prescription) {
    this.rx.set(r);
    this.items.set(r.items.map((i) => ({ ...i })));
  }

  patchRx(p: Partial<Prescription>) {
    this.rx.update((r) => ({ ...r, ...p }));
  }

  medQuery = signal('');
  medOpen = signal(false);
  /** Saved medicines matching what is typed in the search box (best 8). */
  medMatches = computed(() => {
    const q = this.medQuery().trim().toLowerCase();
    return q ? this.meds().filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8) : [];
  });

  /** A medicine was chosen from the search results: add a row with all its saved details filled in. */
  addFromList(m: Medicine) {
    this.items.update((l) => [
      ...l,
      { medicine: m.name, dose: m.dose ?? '', frequency: m.frequency ?? '', duration: m.duration ?? '', instructions: m.instructions ?? '', auto: true },
    ]);
    this.clearMedSearch();
  }

  /** The typed text is not in the list: add a blank row with that name (it is saved to the list when the prescription is saved). */
  addTyped() {
    const name = this.medQuery().trim();
    if (!name) return;
    this.items.update((l) => [...l, { medicine: name, dose: '', frequency: '', duration: '', instructions: '' }]);
    this.clearMedSearch();
  }

  pickFirstMedicine() {
    const first = this.medMatches()[0];
    if (first) this.addFromList(first);
    else this.addTyped();
  }

  closeMedList() {
    setTimeout(() => this.medOpen.set(false), 150);
  }

  private clearMedSearch() {
    this.medQuery.set('');
    this.medOpen.set(false);
  }

  medSummary(m: Medicine): string {
    return [m.dose, m.frequency, m.duration].filter(Boolean).join(' · ');
  }

  /** A medicine from the list was typed or picked: fill its dose, frequency, duration and instructions. */
  onMedicine(it: RxItem, name: string) {
    const m = this.meds().find((x) => x.name.toLowerCase() === String(name ?? '').trim().toLowerCase());
    if (!m) return;
    const untouched = !it.dose && !it.frequency && !it.duration && !it.instructions;
    if (!untouched && !it.auto) return; // the doctor already typed details for this row: keep them
    it.medicine = m.name;
    it.dose = m.dose ?? '';
    it.frequency = m.frequency ?? '';
    it.duration = m.duration ?? '';
    it.instructions = m.instructions ?? '';
    it.auto = true;
  }

  addItem() {
    this.items.update((l) => [...l, { medicine: '', dose: '', frequency: '', duration: '', instructions: '' }]);
  }

  removeItem(i: number) {
    this.items.update((l) => l.filter((_, idx) => idx !== i));
  }

  private flash(msg: string) {
    this.notice.set(msg);
    setTimeout(() => this.notice.set(''), 3500);
  }

  /** One Save: stores the checkup and the prescription and marks the visit completed. */
  async save(): Promise<boolean> {
    this.error.set('');
    this.saving.set(true);
    try {
      // The prescription is saved first; completing the visit locks both.
      const filled = this.items().filter((i) => i.medicine.trim());
      const hasRxContent = filled.length || this.rx().advice || this.rx().tests;
      if (this.showRx() && this.canEditRx() && (hasRxContent || this.rx()._id)) {
        const payload = { items: filled, advice: this.rx().advice, tests: this.rx().tests };
        const saved = this.rx()._id
          ? await firstValueFrom(this.http.put<Prescription>(`${API}/prescriptions/${this.rx()._id}`, payload))
          : await firstValueFrom(this.http.post<Prescription>(`${API}/prescriptions`, { visitId: this.id, ...payload }));
        this.setRx(saved);
      }

      const body: Record<string, unknown> = { ...this.f, vitals: this.vitals, status: 'completed' };
      const v = await firstValueFrom(this.http.put<Visit>(`${API}/visits/${this.id}`, body));
      this.visit.set(v);
      this.copiedFrom.set(null);
      this.flash('Saved');
      return true;
    } catch (e) {
      this.error.set(errorMessage(e));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  /** Saves, then opens the prescription's PDF download (it returns to this visit afterwards). */
  async saveAndPdf() {
    if (!(await this.save()) || !this.rx()._id) return;
    this.router.navigate(['/prescriptions', this.rx()._id, 'print'], { queryParams: { auto: 'pdf' } });
  }
}
