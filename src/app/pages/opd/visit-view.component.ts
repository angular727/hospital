import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { Prescription, Visit } from '../../core/models';
import { STATUS_CLASS, ageText } from '../../core/util';
import { LoaderComponent } from '../../shared/loader.component';
import { VisitLabComponent } from '../lab/visit-lab.component';

/** Read-only summary of one visit: patient, vitals, diagnosis and treatment. */
@Component({
  selector: 'app-visit-view',
  imports: [RouterLink, LoaderComponent, VisitLabComponent],
  styles: `
    .vv-card { border: 0; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }
    .vv-title { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #0f766e; margin-bottom: 0.75rem; }
    .vv-label { font-size: 0.75rem; color: #6c757d; }
    .vv-value { font-weight: 600; }
    .vv-tile { background: #f4f7f7; border-radius: 0.5rem; padding: 0.6rem 0.75rem; text-align: center; height: 100%; }
    .vv-tile .num { font-size: 1.15rem; font-weight: 700; color: #134e4a; }
    .vv-accent { border-left: 4px solid #0f766e; }
    .vv-table th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: #0f766e; background: #f0f7f6; }
  `,
  template: `
    @if (error()) { <div class="alert alert-danger py-2 mt-3">{{ error() }}</div> }
    @if (!visit() && !error()) { <app-loader text="Loading visit…" /> }

    @if (visit(); as v) {
      <div class="vv-card card mb-3 mt-3">
        <div class="card-body d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <div class="d-flex align-items-center gap-2">
              <h4 class="mb-0">Visit {{ v.visitNo }}</h4>
              <span class="badge" [class]="badge(v.status)">{{ v.status }}</span>
            </div>
            <div class="text-muted small mt-1"><i class="bi bi-calendar3 me-1"></i>{{ v.date }} <span class="mx-1">·</span> <i class="bi bi-person-badge me-1"></i>{{ v.doctorId?.name }}</div>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            @if (rx()?._id && canPrint()) {
              <a class="btn btn-outline-dark" [routerLink]="['/prescriptions', rx()!._id, 'print']" [queryParams]="{ auto: 'print' }"><i class="bi bi-printer me-1"></i>Print</a>
              <a class="btn btn-outline-dark" [routerLink]="['/prescriptions', rx()!._id, 'print']" [queryParams]="{ auto: 'pdf' }"><i class="bi bi-file-earmark-pdf me-1"></i>PDF</a>
            }
            @if (canEdit() && v.status !== 'cancelled') {
              <a class="btn btn-outline-primary" [routerLink]="['/opd', v._id]"><i class="bi bi-pencil me-1"></i>Edit</a>
            }
          </div>
        </div>
      </div>

      @if (v.status === 'cancelled') {
        <div class="alert alert-secondary py-2"><strong>Cancelled</strong>{{ v.cancelReason ? ': ' + v.cancelReason : '' }}</div>
      }

      <div class="vv-card card mb-3">
        <div class="card-body">
          <div class="vv-title">Patient</div>
          <div class="row g-3">
            <div class="col-6 col-md-3"><div class="vv-label">Name</div><div class="vv-value">{{ v.patientId?.name }}</div></div>
            <div class="col-6 col-md-3"><div class="vv-label">Patient No</div><div class="vv-value">{{ v.patientId?.mrn }}</div></div>
            <div class="col-6 col-md-3"><div class="vv-label">Age / Sex</div><div class="vv-value text-capitalize">{{ age(v.patientId) || '—' }} · {{ v.patientId?.gender }}</div></div>
            <div class="col-6 col-md-3"><div class="vv-label">Phone</div><div class="vv-value">{{ v.patientId?.phone || '—' }}</div></div>
            <div class="col-6 col-md-3"><div class="vv-label">CNIC</div><div class="vv-value">{{ v.patientId?.cnic || '—' }}</div></div>
            <div class="col-6 col-md-3"><div class="vv-label">Address</div><div class="vv-value">{{ v.patientId?.address || v.patientId?.city || '—' }}</div></div>
            @if (v.patientId?.allergies) { <div class="col-12 col-md-6"><div class="vv-label text-danger">Allergies</div><div class="vv-value text-danger">{{ v.patientId.allergies }}</div></div> }
          </div>
        </div>
      </div>

      <div class="vv-card card mb-3">
        <div class="card-body">
          <div class="vv-title">Vital signs</div>
          <div class="row g-2">
            @for (t of vitalTiles(v); track t.label) {
              <div class="col-4 col-md"><div class="vv-tile"><div class="vv-label">{{ t.label }}</div><div class="num">{{ t.value }}</div></div></div>
            }
          </div>
        </div>
      </div>

      @if (sections(v).length) {
        <div class="row g-3 mb-3">
          @for (s of sections(v); track s.title) {
            <div [class]="s.wide ? 'col-12' : 'col-md-6'">
              <div class="vv-card vv-accent card h-100"><div class="card-body">
                <div class="vv-title">{{ s.title }}</div>
                <div style="white-space: pre-wrap">{{ s.text }}</div>
              </div></div>
            </div>
          }
        </div>
      }

      <div class="vv-card card mb-3">
        <div class="card-body">
          <div class="vv-title">Treatment</div>
          @if (rx()?.items?.length) {
            <div class="table-responsive">
              <table class="vv-table table table-sm align-middle mb-0">
                <thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
                <tbody>
                  @for (it of rx()!.items; track $index) {
                    <tr><td class="fw-semibold">{{ it.medicine }}</td><td>{{ it.dose }}</td><td>{{ it.frequency }}</td><td>{{ it.duration }}</td><td>{{ it.instructions }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          } @else { <div class="text-muted">No medicines prescribed.</div> }
          @if (rx()?.advice || rx()?.tests) {
            <div class="row g-3 mt-1">
              @if (rx()?.advice) { <div class="col-md-6"><div class="vv-label">Advice</div><div>{{ rx()!.advice }}</div></div> }
              @if (rx()?.tests) { <div class="col-md-6"><div class="vv-label">Tests advised</div><div>{{ rx()!.tests }}</div></div> }
            </div>
          }
          @if (v.followUpDate) { <div class="mt-3"><span class="badge bg-info-subtle text-info-emphasis"><i class="bi bi-calendar-check me-1"></i>Follow-up: {{ v.followUpDate }}</span></div> }
        </div>
      </div>

      <app-visit-lab [visitId]="v._id" [patientId]="v.patientId._id" [readonly]="true" />

      <button class="btn btn-success mb-4" (click)="back()"><i class="bi bi-arrow-left me-1"></i>Go back</button>
    }
  `,
})
export class VisitViewComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private location = inject(Location);

  visit = signal<Visit | null>(null);
  rx = signal<Prescription | null>(null);
  error = signal('');

  age = ageText;
  badge = (s: string) => `badge ${STATUS_CLASS[s] ?? 'bg-secondary'}`;
  canEdit = () => this.auth.has('opd.edit');
  canPrint = () => this.auth.hasModule('prescriptions') && this.auth.has('prescriptions.print');

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.http.get<Visit>(`${API}/visits/${id}`).subscribe({
      next: (v) => this.visit.set(v),
      error: (e) => this.error.set(errorMessage(e)),
    });
    if (this.auth.hasModule('prescriptions') && this.auth.has('prescriptions.view')) {
      this.http.get<Prescription[]>(`${API}/prescriptions`, { params: { visitId: id ?? '' } }).subscribe({
        next: (r) => this.rx.set(r[0] ?? null),
        error: () => {},
      });
    }
  }

  /** Vitals that were recorded; empty ones are left out. */
  vitalTiles(v: Visit) {
    const x = v.vitals;
    const tiles = [
      { label: 'BP', value: x?.bp },
      { label: 'Pulse', value: x?.pulse },
      { label: 'Temp °F', value: x?.temperature },
      { label: 'SpO₂ %', value: x?.spo2 },
      { label: 'Weight kg', value: x?.weight },
      { label: 'Height cm', value: x?.height },
      { label: 'Sugar', value: x?.sugar },
    ];
    return tiles.filter((t) => t.value !== undefined && t.value !== null && t.value !== '');
  }

  /** Only the text sections that were actually filled in. */
  sections(v: Visit) {
    return [
      { title: 'Complaint', text: v.complaint, wide: false },
      { title: 'Diagnosis', text: v.diagnosis, wide: false },
      { title: 'History', text: v.history, wide: false },
      { title: 'Examination', text: v.examination, wide: false },
    ].filter((s) => s.text);
  }

  back() {
    this.location.back();
  }
}
