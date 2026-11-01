import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { Doctor, QueueItem, UnfinishedVisit } from '../../core/models';
import { silent } from '../../core/loading.interceptor';
import { STATUS_CLASS, ageText } from '../../core/util';
import { LoaderComponent } from '../../shared/loader.component';

/** The doctor's list of pending patients. Refreshes by itself every 15 seconds. */
@Component({
  selector: 'app-queue',
  imports: [FormsModule, RouterLink, DecimalPipe, LoaderComponent],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <h3 class="mb-0">Pending patients</h3>
      <div class="d-flex gap-2 align-items-center">
        <select class="form-select form-select-sm" [ngModel]="doctorId" (ngModelChange)="doctorId = $event; load()">
          <option value="">All doctors</option>
          @for (d of doctors(); track d._id) { <option [value]="d._id">{{ d.name }}</option> }
        </select>
        <button class="btn btn-sm btn-outline-secondary" (click)="load()"><i class="bi bi-arrow-repeat"></i></button>
      </div>
    </div>
    @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }
    @if (notice()) { <div class="alert alert-success py-2">{{ notice() }}</div> }

    @if (others() > 0) {
      <div class="alert alert-info py-2 d-flex justify-content-between align-items-center">
        <span><i class="bi bi-info-circle me-1"></i>{{ others() }} more patient(s) are waiting for other doctors.</span>
        <button class="btn btn-sm btn-info" (click)="doctorId = ''; load()">Show all</button>
      </div>
    }

    <ul class="nav nav-tabs mb-3">
      <li class="nav-item"><button class="nav-link" [class.active]="tab() === 'pending'" (click)="setTab('pending')">Waiting @if (tab() === 'pending') { <span class="badge bg-secondary">{{ items().length }}</span> }</button></li>
      <li class="nav-item"><button class="nav-link" [class.active]="tab() === 'done'" (click)="setTab('done')">Seen today @if (tab() === 'done') { <span class="badge bg-secondary">{{ items().length }}</span> }</button></li>
    </ul>

    @if (tab() === 'pending' && old().length) {
      <div class="card border-warning shadow-sm mb-3">
        <div class="card-header bg-warning-subtle fw-semibold"><i class="bi bi-exclamation-triangle me-1"></i>Unfinished from earlier days ({{ old().length }})</div>
        <div class="list-group list-group-flush">
          @for (u of old(); track u._id) {
            <div class="list-group-item d-flex align-items-center gap-3 flex-wrap">
              <span class="badge bg-secondary">{{ u.date }}</span>
              @if (u.token) { <span class="badge bg-dark fs-6">#{{ u.token }}</span> }
              <div class="flex-grow-1">
                <span class="fw-semibold">{{ u.patient.name }}</span>
                <span class="text-muted small ms-1">{{ u.patient.mrn }} · {{ u.doctor.name }}</span>
                @if (u.reason) { <div class="small text-muted">{{ u.reason }}</div> }
              </div>
              <button class="btn btn-sm btn-primary" (click)="finishOld(u)">Finish checkup</button>
              <button class="btn btn-sm btn-outline-secondary" (click)="cancelOld(u)">Patient did not stay</button>
            </div>
          }
        </div>
      </div>
    }

    <div class="row g-3">
      @for (q of items(); track q._id) {
        <div class="col-12 col-md-6 col-xl-4">
          <div class="card border-0 shadow-sm h-100" [class.border-start]="q.status === 'in-consultation'" [class.border-info]="q.status === 'in-consultation'" style="border-width: 4px !important">
            <div class="card-body d-flex flex-column gap-1">
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-dark fs-6 flex-shrink-0">#{{ q.token }}</span>
                <div class="flex-grow-1 text-truncate">
                  <span class="fw-semibold">{{ q.patient.name }}</span>
                  <span class="text-muted small ms-1">{{ q.patient.mrn }}</span>
                </div>
                <span class="badge flex-shrink-0" [class]="badge(q.status)">{{ q.status === 'in-consultation' ? 'in consultation' : q.status }}</span>
              </div>
              <div class="small text-muted text-capitalize">
                {{ q.patient.gender }}{{ age(q.patient) ? ' · ' + age(q.patient) : '' }}{{ q.doctor.name && !doctorId ? ' · ' + q.doctor.name : '' }}
                <span class="ms-1 text-nowrap"><i class="bi bi-clock me-1"></i>{{ waited(q) }}</span>
              </div>
              @if (q.reason) { <div class="small"><i class="bi bi-chat-left-text me-1"></i>{{ q.reason }}</div> }
              @if (q.patient.allergies) { <div class="small text-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i>Allergy: {{ q.patient.allergies }}</div> }
              @if (vitalsText(q)) { <div class="small text-muted border rounded px-2 py-1 bg-light">{{ vitalsText(q) }}</div> }
              <div class="mt-auto pt-2">
                @if (q.invoice || q.lab) {
                  <div class="mb-2 d-flex flex-wrap gap-1">
                    @if (q.invoice) { <span class="badge" [class]="badge(q.invoice.status)">{{ q.invoice.status === 'paid' ? 'fee paid' : 'fee due ' + (q.invoice.balance | number: '1.0-0') }}</span> }
                    @if (q.lab; as l) {
                      @if (l.completed === l.orders) { <span class="badge text-bg-success"><i class="bi bi-file-earmark-check me-1"></i>Report ready</span> }
                      @else { <span class="badge text-bg-warning"><i class="bi bi-hourglass-split me-1"></i>Lab pending {{ l.completed }}/{{ l.orders }}</span> }
                    }
                  </div>
                }
                <div class="d-flex gap-2">
                  @if (q.visitId) {
                    @if (tab() === 'pending') {
                      <button class="btn btn-primary btn-sm flex-grow-1" [disabled]="busy() === q._id" (click)="open(q)">
                        {{ q.status === 'in-consultation' ? 'Continue checkup' : 'Start checkup' }} <i class="bi bi-arrow-right"></i>
                      </button>
                      <button class="btn btn-outline-danger btn-sm flex-shrink-0" title="Cancel this checkup" (click)="askCancel(q)"><i class="bi bi-x-circle"></i> Cancel</button>
                    } @else {
                      <a class="btn btn-outline-secondary btn-sm" [routerLink]="['/opd', q.visitId]">View</a>
                    }
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      } @empty {
        <div class="col-12">
          @if (!loaded()) {
            <app-loader text="Loading patients…" />
          } @else {
            <div class="text-center text-muted py-5">{{ tab() === 'pending' ? 'No patients waiting. New check-ins from reception appear here automatically.' : 'No patients seen yet today.' }}</div>
          }
        </div>
      }
    </div>

    @if (cancelling(); as c) {
      <div class="modal d-block modal-backdrop-custom" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <form class="modal-content" (ngSubmit)="confirmCancel()">
            <div class="modal-header"><h5 class="modal-title">Cancel checkup</h5><button type="button" class="btn-close" (click)="cancelling.set(null)"></button></div>
            <div class="modal-body">
              <p class="mb-2">Cancel the checkup of <strong>{{ c.patient.name }}</strong> (token #{{ c.token }})?</p>
              @if (c.invoice) {
                <div class="alert alert-warning py-2 small">
                  @if (c.invoice.paid > 0) { The fee paid ({{ c.invoice.paid | number: '1.0-0' }}) will be refunded and the bill cancelled. }
                  @else { The unpaid bill ({{ c.invoice.balance | number: '1.0-0' }}) will be cancelled. }
                </div>
              }
              <label class="form-label">Reason</label>
              <div class="d-flex flex-wrap gap-1 mb-2">
                @for (r of cancelReasons; track r) {
                  <button type="button" class="btn btn-sm" [class.btn-secondary]="cancelReason === r" [class.btn-outline-secondary]="cancelReason !== r" (click)="cancelReason = r">{{ r }}</button>
                }
              </div>
              <textarea class="form-control" rows="2" name="reason" [(ngModel)]="cancelReason" placeholder="Why is this checkup cancelled?"></textarea>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" (click)="cancelling.set(null)">Keep</button>
              <button class="btn btn-danger" [disabled]="!cancelReason.trim() || busy() === c._id">Cancel checkup</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class QueueComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AuthService);

  items = signal<QueueItem[]>([]);
  doctors = signal<Doctor[]>([]);
  tab = signal<'pending' | 'done'>('pending');
  error = signal('');
  busy = signal('');
  others = signal(0);
  /** False until the first list has arrived, so an empty list is not shown while still loading. */
  loaded = signal(false);
  old = signal<UnfinishedVisit[]>([]);
  doctorId = '';

  private timer: any;
  age = ageText;
  badge = (s: string) => `badge ${STATUS_CLASS[s] ?? 'bg-secondary'}`;

  ngOnInit() {
    this.http.get<Doctor[]>(`${API}/users/doctors`).subscribe((d) => {
      this.doctors.set(d);
      // A doctor sees their own patients first.
      const mine = this.auth.me()?.user;
      if (mine?.isDoctor && d.some((x) => x._id === mine.id)) this.doctorId = mine.id;
      this.load();
    });
    this.timer = setInterval(() => this.load(true), 15000);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  setTab(t: 'pending' | 'done') {
    this.tab.set(t);
    this.load();
  }

  /** `quiet` is used by the automatic refresh so it does not flash the loading bar. */
  load(quiet = false) {
    const context = quiet ? silent() : undefined;
    const pending = this.tab() === 'pending';
    const params: Record<string, string> = { status: pending ? 'waiting,in-consultation' : 'completed' };
    if (this.doctorId) params['doctorId'] = this.doctorId;
    this.http.get<QueueItem[]>(`${API}/reception/queue`, { params, context }).subscribe({
      next: (r) => {
        this.items.set(r);
        this.error.set('');
        this.loaded.set(true);
        if (pending) this.loadOld(quiet);
        // When filtered to one doctor, tell the user if patients are waiting for the others.
        if (pending && this.doctorId) {
          this.http.get<QueueItem[]>(`${API}/reception/queue`, { params: { status: params['status'] }, context }).subscribe({
            next: (all) => this.others.set(Math.max(all.length - r.length, 0)),
          });
        } else {
          this.others.set(0);
        }
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  loadOld(quiet = false) {
    const params: Record<string, string> = {};
    if (this.doctorId) params['doctorId'] = this.doctorId;
    this.http
      .get<UnfinishedVisit[]>(`${API}/reception/unfinished`, { params, context: quiet ? silent() : undefined })
      .subscribe({ next: (r) => this.old.set(r), error: () => {} });
  }

  finishOld(u: UnfinishedVisit) {
    this.router.navigate(['/opd', u.visitId]);
  }

  cancelOld(u: UnfinishedVisit) {
    if (!confirm(`Close the unfinished visit of ${u.patient.name} (${u.date}) as "did not stay"?`)) return;
    this.http.post(`${API}/visits/${u.visitId}/cancel`, {}).subscribe({
      next: () => this.loadOld(),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  notice = signal('');
  cancelling = signal<QueueItem | null>(null);
  cancelReason = '';
  cancelReasons = ['Patient left', 'Doctor not available', 'Emergency', 'Wrong entry'];

  askCancel(q: QueueItem) {
    this.cancelReason = '';
    this.cancelling.set(q);
  }

  confirmCancel() {
    const q = this.cancelling();
    if (!q?.visitId || !this.cancelReason.trim()) return;
    this.busy.set(q._id);
    this.http.post<{ refunded?: number }>(`${API}/visits/${q.visitId}/cancel`, { reason: this.cancelReason.trim() }).subscribe({
      next: (r) => {
        this.busy.set('');
        this.cancelling.set(null);
        this.notice.set(r.refunded ? `Checkup cancelled. ${r.refunded} refunded to ${q.patient.name}.` : 'Checkup cancelled.');
        setTimeout(() => this.notice.set(''), 5000);
        this.load();
      },
      error: (e) => {
        this.busy.set('');
        this.cancelling.set(null);
        this.error.set(errorMessage(e));
      },
    });
  }

  waited(q: QueueItem) {
    const mins = Math.max(Math.round((Date.now() - new Date(q.createdAt).getTime()) / 60000), 0);
    return mins < 1 ? 'just now' : mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  vitalsText(q: QueueItem) {
    const v = q.vitals;
    if (!v) return '';
    const parts: string[] = [];
    if (v.bp) parts.push(`BP ${v.bp}`);
    if (v.pulse) parts.push(`Pulse ${v.pulse}`);
    if (v.temperature) parts.push(`${v.temperature}°F`);
    if (v.spo2) parts.push(`SpO₂ ${v.spo2}%`);
    if (v.weight) parts.push(`${v.weight} kg`);
    if (v.sugar) parts.push(`Sugar ${v.sugar}`);
    return parts.join(' · ');
  }

  open(q: QueueItem) {
    this.busy.set(q._id);
    this.http.post(`${API}/visits/${q.visitId}/start`, {}).subscribe({
      next: () => this.router.navigate(['/opd', q.visitId]),
      error: (e) => {
        this.busy.set('');
        this.error.set(errorMessage(e));
      },
    });
  }
}
