import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { Doctor } from '../../core/models';
import { LoadingService } from '../../core/loading.service';
import { today } from '../../core/util';

interface Daily {
  date: string;
  received: number;
  refunded: number;
  net: number;
  byMethod: Record<string, number>;
  collectedByDoctor: { doctor: string; collected: number }[];
  billedByDoctor: { doctor: string; invoices: number; billed: number; discount: number }[];
  billedTotal: number;
  invoicesCount: number;
  appointments: Record<string, number>;
  visits: number;
  newPatients: number;
}

interface VisitsReport {
  from: string;
  to: string;
  truncated: boolean;
  rows: {
    visitId: string;
    visitNo: string;
    date: string;
    token: number | null;
    status: 'open' | 'completed';
    patient: { _id: string; name: string; mrn: string; gender?: string; age?: number; phone?: string } | null;
    doctor: string;
    complaint: string;
    diagnosis: string;
    invoiceNo: string;
    billed: number;
    paid: number;
    due: number;
  }[];
  summary: {
    visits: number;
    uniquePatients: number;
    newPatients: number;
    billed: number;
    paid: number;
    due: number;
    byDoctor: { doctor: string; visits: number; billed: number; paid: number }[];
  };
}

interface Summary {
  from: string;
  to: string;
  income: { date: string; total: number }[];
  totalIncome: number;
  outstanding: number;
  outstandingCount: number;
  topDiagnoses: { diagnosis: string; count: number }[];
  visits: number;
  newPatients: number;
}

@Component({
  selector: 'app-reports',
  imports: [FormsModule, DecimalPipe],
  styles: `
    .seg { background: #e3eeee; border-radius: 0.8rem; padding: 4px; gap: 2px; }
    .seg .nav-link { border-radius: 0.6rem; color: #0f4c4c; font-weight: 500; padding: 0.4rem 1.05rem; }
    .seg .nav-link:hover:not(.active) { background: rgba(255, 255, 255, 0.55); }
    .seg .nav-link.active { background: #fff; color: #0f4c4c; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14); }
    .filters { border-radius: 0.9rem !important; }
    .filters .form-label { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6c757d; }
    .filters .form-control, .filters .form-select { border-radius: 0.5rem; }
    .sheet { border-radius: 1rem; padding: 1.6rem 1.8rem; }
    .period { display: inline-flex; align-items: center; gap: 0.4rem; background: #e0f2f1; color: #0f766e; font-size: 0.8rem; font-weight: 600; border-radius: 2rem; padding: 0.2rem 0.75rem; }
    .stat-card { border-radius: 0.9rem; border: 1px solid #edf1f1; box-shadow: none; }
    .tile { display: flex; align-items: center; gap: 0.8rem; }
    .tile .ico { width: 40px; height: 40px; border-radius: 0.7rem; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0; }
    .tile .label { font-size: 0.68rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: #6c757d; }
    .tile .value { font-size: 1.55rem; font-weight: 700; line-height: 1.15; color: #134e4a; }
    .rtable { border-collapse: separate; border-spacing: 0; }
    .rtable thead th { background: #f4f8f8; color: #5b6b6b; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; border: 0; padding: 0.7rem 0.6rem; white-space: nowrap; }
    .rtable thead th:first-child { border-radius: 0.6rem 0 0 0.6rem; }
    .rtable thead th:last-child { border-radius: 0 0.6rem 0.6rem 0; }
    .rtable tbody td { padding: 0.75rem 0.6rem; border-color: #eef2f2; vertical-align: middle; }
    .rtable tbody tr:hover td { background: #f8fbfb; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .token { background: #134e4a; color: #fff; border-radius: 0.45rem; padding: 2px 8px; font-weight: 700; font-size: 0.8rem; }
    .avatar { width: 34px; height: 34px; border-radius: 50%; background: #d7ecea; color: #0f766e; font-weight: 700; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .pill { display: inline-flex; align-items: center; gap: 0.35rem; border-radius: 2rem; padding: 0.15rem 0.65rem; font-size: 0.75rem; font-weight: 600; }
    .pill::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .pill.done { background: #dcfce7; color: #15803d; }
    .pill.open { background: #fef3c7; color: #b45309; }
    .empty { padding: 2.5rem 0; color: #8a9a9a; text-align: center; }
    .empty i { font-size: 2rem; display: block; margin-bottom: 0.4rem; opacity: 0.6; }
    @media print { .seg, .filters { display: none; } .period { background: none; padding: 0; } .stat-card { border: 1px solid #ddd; } }
  `,
  template: `
    <div class="no-print d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <h3 class="mb-0">Reports</h3>
      <ul class="nav seg">
        <li class="nav-item"><button class="nav-link" [class.active]="tab() === 'visits'" (click)="tab.set('visits')">Patients report</button></li>
        <li class="nav-item"><button class="nav-link" [class.active]="tab() === 'daily'" (click)="tab.set('daily')">Daily cash report</button></li>
        <li class="nav-item"><button class="nav-link" [class.active]="tab() === 'summary'" (click)="tab.set('summary')">Summary</button></li>
      </ul>
    </div>
    @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }

    @if (tab() === 'daily') {
      <div class="no-print card filters border-0 shadow-sm mb-3">
        <div class="card-body py-3 d-flex gap-3 align-items-end">
          <div><label class="form-label small mb-0">Date</label><input type="date" class="form-control form-control-sm" [ngModel]="date" (ngModelChange)="date = $event; loadDaily()" /></div>
          <button class="btn btn-sm btn-outline-secondary" (click)="date = todayStr; loadDaily()">Today</button>
          @if (auth.has('reports.export')) { <button class="btn btn-sm btn-primary ms-auto" (click)="print()"><i class="bi bi-printer me-1"></i>Print</button> }
        </div>
      </div>

      @if (daily(); as d) {
        <div class="print-sheet">
          <div class="mb-3">
            <div class="fs-4 fw-bold" style="color:#0f4c4c">{{ auth.me()?.hospital?.name }}</div>
            <div class="text-muted">Daily cash report · {{ d.date }}</div>
            <div class="small text-muted">Money received and billed on this day (from Billing). For the list of patients seen, open the Patients report.</div>
          </div>
          <div class="row g-3 mb-3">
            <div class="col-6 col-md-3"><div class="card stat-card"><div class="card-body"><div class="label">Received</div><div class="value">{{ d.received | number: '1.0-0' }}</div></div></div></div>
            <div class="col-6 col-md-3"><div class="card stat-card"><div class="card-body"><div class="label">Refunded</div><div class="value text-danger">{{ d.refunded | number: '1.0-0' }}</div></div></div></div>
            <div class="col-6 col-md-3"><div class="card stat-card"><div class="card-body"><div class="label">Net collection</div><div class="value">{{ d.net | number: '1.0-0' }}</div></div></div></div>
            <div class="col-6 col-md-3"><div class="card stat-card"><div class="card-body"><div class="label">Billed today</div><div class="value">{{ d.billedTotal | number: '1.0-0' }}</div></div></div></div>
          </div>

          <div class="row g-3">
            <div class="col-md-6">
              <div class="fw-semibold mb-1">Net by payment method</div>
              <table class="table table-sm">
                <tbody>
                  @for (m of methodRows(d); track m[0]) { <tr><td class="text-capitalize">{{ m[0] }}</td><td class="text-end">{{ m[1] | number: '1.0-2' }}</td></tr> }
                  @empty { <tr><td class="text-muted">No payments</td></tr> }
                </tbody>
              </table>
            </div>
            <div class="col-md-6">
              <div class="fw-semibold mb-1">Collected by doctor</div>
              <table class="table table-sm">
                <tbody>
                  @for (c of d.collectedByDoctor; track c.doctor) { <tr><td>{{ c.doctor }}</td><td class="text-end">{{ c.collected | number: '1.0-2' }}</td></tr> }
                  @empty { <tr><td class="text-muted">No payments</td></tr> }
                </tbody>
              </table>
            </div>
            <div class="col-12">
              <div class="fw-semibold mb-1">Billing by doctor ({{ d.invoicesCount }} invoices)</div>
              <table class="table table-sm">
                <thead class="table-light"><tr><th>Doctor</th><th class="text-end">Invoices</th><th class="text-end">Discount</th><th class="text-end">Billed</th></tr></thead>
                <tbody>
                  @for (b of d.billedByDoctor; track b.doctor) { <tr><td>{{ b.doctor }}</td><td class="text-end">{{ b.invoices }}</td><td class="text-end">{{ b.discount | number: '1.0-2' }}</td><td class="text-end">{{ b.billed | number: '1.0-2' }}</td></tr> }
                  @empty { <tr><td colspan="4" class="text-muted">No invoices</td></tr> }
                </tbody>
              </table>
            </div>
            <div class="col-12">
              <div class="fw-semibold mb-1">Activity</div>
              <div class="small">
                New patients: <strong>{{ d.newPatients }}</strong> · Visits: <strong>{{ d.visits }}</strong>
                @for (s of apptRows(d); track s[0]) { · <span class="text-capitalize">{{ s[0] }}</span>: <strong>{{ s[1] }}</strong> }
              </div>
            </div>
          </div>
        </div>
      }
    }

    @if (tab() === 'summary') {
      <div class="card filters border-0 shadow-sm mb-3">
        <div class="card-body py-3 d-flex gap-3 align-items-end flex-wrap">
          <div><label class="form-label small mb-0">From</label><input type="date" class="form-control form-control-sm" [ngModel]="from" (ngModelChange)="from = $event; loadSummary()" /></div>
          <div><label class="form-label small mb-0">To</label><input type="date" class="form-control form-control-sm" [ngModel]="to" (ngModelChange)="to = $event; loadSummary()" /></div>
        </div>
      </div>

      @if (summary(); as s) {
        <div class="row g-3 mb-3">
          <div class="col-6 col-md-3"><div class="card stat-card"><div class="card-body"><div class="label">Income (net)</div><div class="value">{{ s.totalIncome | number: '1.0-0' }}</div></div></div></div>
          <div class="col-6 col-md-3"><div class="card stat-card"><div class="card-body"><div class="label">Outstanding dues</div><div class="value text-danger">{{ s.outstanding | number: '1.0-0' }}</div><div class="small text-muted">{{ s.outstandingCount }} invoice(s)</div></div></div></div>
          <div class="col-6 col-md-3"><div class="card stat-card"><div class="card-body"><div class="label">Visits</div><div class="value">{{ s.visits }}</div></div></div></div>
          <div class="col-6 col-md-3"><div class="card stat-card"><div class="card-body"><div class="label">New patients</div><div class="value">{{ s.newPatients }}</div></div></div></div>
        </div>
        <div class="row g-3">
          <div class="col-lg-7">
            <div class="card border-0 shadow-sm"><div class="card-header bg-white fw-semibold">Income per day</div>
              <div class="card-body">
                @for (d of s.income; track d.date) {
                  <div class="d-flex align-items-center mb-1 small">
                    <div style="width:90px">{{ d.date }}</div>
                    <div class="flex-grow-1 bg-light rounded"><div class="rounded" style="background:#14b8a6; height:14px" [style.width.%]="pct(d.total, s)"></div></div>
                    <div class="text-end" style="width:90px">{{ d.total | number: '1.0-0' }}</div>
                  </div>
                } @empty { <div class="text-muted">No income in this period</div> }
              </div>
            </div>
          </div>
          <div class="col-lg-5">
            <div class="card border-0 shadow-sm"><div class="card-header bg-white fw-semibold">Top diagnoses</div>
              <ul class="list-group list-group-flush">
                @for (t of s.topDiagnoses; track t.diagnosis) { <li class="list-group-item d-flex justify-content-between text-capitalize">{{ t.diagnosis }}<span class="badge bg-secondary">{{ t.count }}</span></li> }
                @empty { <li class="list-group-item text-muted">No diagnoses recorded</li> }
              </ul>
            </div>
          </div>
        </div>
      }
    }

    @if (tab() === 'visits') {
      <div class="no-print card filters border-0 shadow-sm mb-3">
        <div class="card-body py-3 d-flex gap-3 align-items-end flex-wrap">
          <div><label class="form-label small mb-0">From</label><input type="date" class="form-control form-control-sm" [ngModel]="vFrom" (ngModelChange)="vFrom = $event; loadVisits()" /></div>
          <div><label class="form-label small mb-0">To</label><input type="date" class="form-control form-control-sm" [ngModel]="vTo" (ngModelChange)="vTo = $event; loadVisits()" /></div>
          <div>
            <label class="form-label small mb-0">Doctor</label>
            <select class="form-select form-select-sm" [ngModel]="vDoctor" (ngModelChange)="vDoctor = $event; loadVisits()">
              <option value="">All doctors</option>
              @for (d of doctors(); track d._id) { <option [value]="d._id">{{ d.name }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label small mb-0">Status</label>
            <select class="form-select form-select-sm" [ngModel]="vStatus" (ngModelChange)="vStatus = $event; loadVisits()">
              <option value="">All</option><option value="completed">Completed</option><option value="open">Not finished</option>
            </select>
          </div>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary" (click)="quick(0)">Today</button>
            <button class="btn btn-outline-secondary" (click)="quick(-6)">Last 7 days</button>
            <button class="btn btn-outline-secondary" (click)="quick(-29)">Last 30 days</button>
          </div>
          <div class="ms-auto d-flex gap-2">
            @if (auth.has('reports.export')) {
              <button class="btn btn-sm btn-outline-primary" [disabled]="!vr()?.rows?.length" (click)="downloadCsv()"><i class="bi bi-filetype-csv me-1"></i>Excel (CSV)</button>
              <button class="btn btn-sm btn-primary" (click)="print()"><i class="bi bi-printer me-1"></i>Print</button>
            }
          </div>
        </div>
      </div>

      @if (vr(); as r) {
        <div class="print-sheet sheet" style="max-width: none">
          <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-4">
            <div>
              <div class="fs-4 fw-bold" style="color:#0f4c4c">{{ auth.me()?.hospital?.name }}</div>
              <div class="text-muted small">Patients report</div>
            </div>
            <div class="d-flex gap-2 flex-wrap">
              <span class="period"><i class="bi bi-calendar3"></i>{{ r.from === r.to ? r.from : r.from + '  to  ' + r.to }}</span>
              @if (doctorName()) { <span class="period"><i class="bi bi-person-badge"></i>{{ doctorName() }}</span> }
            </div>
          </div>

          <div class="row g-3 mb-4">
            <div class="col-6 col-md-4 col-xl-2"><div class="card stat-card"><div class="card-body tile"><span class="ico" style="background:#e0f2fe;color:#0369a1"><i class="bi bi-journal-medical"></i></span><div><div class="label">Checkups</div><div class="value">{{ r.summary.visits }}</div></div></div></div></div>
            <div class="col-6 col-md-4 col-xl-2"><div class="card stat-card"><div class="card-body tile"><span class="ico" style="background:#ede9fe;color:#6d28d9"><i class="bi bi-people"></i></span><div><div class="label">Patients</div><div class="value">{{ r.summary.uniquePatients }}</div></div></div></div></div>
            <div class="col-6 col-md-4 col-xl-2"><div class="card stat-card"><div class="card-body tile"><span class="ico" style="background:#e0f2f1;color:#0f766e"><i class="bi bi-person-plus"></i></span><div><div class="label">New patients</div><div class="value">{{ r.summary.newPatients }}</div></div></div></div></div>
            <div class="col-6 col-md-4 col-xl-2"><div class="card stat-card"><div class="card-body tile"><span class="ico" style="background:#fef3c7;color:#b45309"><i class="bi bi-receipt"></i></span><div><div class="label">Billed</div><div class="value">{{ r.summary.billed | number: '1.0-0' }}</div></div></div></div></div>
            <div class="col-6 col-md-4 col-xl-2"><div class="card stat-card"><div class="card-body tile"><span class="ico" style="background:#dcfce7;color:#15803d"><i class="bi bi-cash-coin"></i></span><div><div class="label">Received</div><div class="value">{{ r.summary.paid | number: '1.0-0' }}</div></div></div></div></div>
            <div class="col-6 col-md-4 col-xl-2"><div class="card stat-card"><div class="card-body tile"><span class="ico" style="background:#fee2e2;color:#b91c1c"><i class="bi bi-exclamation-circle"></i></span><div><div class="label">Due</div><div class="value" [class.text-danger]="r.summary.due > 0">{{ r.summary.due | number: '1.0-0' }}</div></div></div></div></div>
          </div>

          @if (r.summary.byDoctor.length > 1) {
            <div class="fw-semibold mb-2">By doctor</div>
            <div class="row g-3 mb-4">
              @for (d of r.summary.byDoctor; track d.doctor) {
                <div class="col-md-6 col-xl-4">
                  <div class="card border-0 shadow-sm h-100" style="border-left: 4px solid #0f766e !important">
                    <div class="card-body py-3">
                      <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="fw-semibold"><i class="bi bi-person-badge me-1 text-muted"></i>{{ d.doctor }}</span>
                        <span class="badge bg-secondary-subtle text-secondary-emphasis">{{ d.visits }} checkup{{ d.visits === 1 ? '' : 's' }}</span>
                      </div>
                      <div class="d-flex justify-content-between small text-muted"><span>Received {{ d.paid | number: '1.0-0' }}</span><span>Billed {{ d.billed | number: '1.0-0' }}</span></div>
                      <div class="progress mt-1" style="height: 6px"><div class="progress-bar" style="background:#14b8a6" [style.width.%]="d.billed ? (d.paid / d.billed) * 100 : 0"></div></div>
                      @if (d.billed - d.paid > 0) { <div class="small text-danger mt-1">Due {{ d.billed - d.paid | number: '1.0-0' }}</div> }
                    </div>
                  </div>
                </div>
              }
            </div>
          }

          <div class="table-responsive">
            <table class="table table-sm rtable align-middle mb-0">
              <thead>
                <tr><th>#</th><th>Date</th><th>Token</th><th>Patient</th><th>Age / Sex</th><th>Doctor</th><th>Complaint</th><th>Diagnosis</th><th>Status</th><th class="num">Billed</th><th class="num">Paid</th><th class="num">Due</th></tr>
              </thead>
              <tbody>
                @for (v of r.rows; track v.visitId; let i = $index) {
                  <tr>
                    <td class="text-muted">{{ i + 1 }}</td>
                    <td class="text-nowrap">{{ v.date }}</td>
                    <td>@if (v.token) { <span class="token">#{{ v.token }}</span> }</td>
                    <td>
                      <div class="d-flex align-items-center gap-2">
                        <span class="avatar">{{ initials(v.patient?.name) }}</span>
                        <div><div class="fw-semibold">{{ v.patient?.name }}</div><div class="small text-muted">{{ v.patient?.mrn }}{{ v.patient?.phone ? ' · ' + v.patient?.phone : '' }}</div></div>
                      </div>
                    </td>
                    <td class="text-capitalize text-nowrap">{{ v.patient?.age ?? '' }} {{ v.patient?.gender }}</td>
                    <td>{{ v.doctor }}</td>
                    <td>{{ v.complaint || '—' }}</td>
                    <td>{{ v.diagnosis || '—' }}</td>
                    <td><span class="pill" [class.done]="v.status === 'completed'" [class.open]="v.status === 'open'">{{ v.status === 'open' ? 'Not finished' : 'Completed' }}</span></td>
                    <td class="num">{{ v.billed | number: '1.0-0' }}</td>
                    <td class="num">{{ v.paid | number: '1.0-0' }}</td>
                    <td class="num" [class.text-danger]="v.due > 0" [class.fw-semibold]="v.due > 0">{{ v.due | number: '1.0-0' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="12"><div class="empty">@if (loading.busy()) { <span class="spinner-border spinner-border-sm me-2"></span>Loading report… } @else { <i class="bi bi-clipboard2-pulse"></i>No checkups in this period }</div></td></tr>
                }
              </tbody>
            </table>
          </div>
          @if (r.truncated) { <div class="small text-warning">Only the first 1000 checkups are shown. Narrow the dates.</div> }
        </div>
      }
    }
  `,
})
export class ReportsComponent implements OnInit {
  private http = inject(HttpClient);
  loading = inject(LoadingService);
  auth = inject(AuthService);

  tab = signal<'visits' | 'daily' | 'summary'>('visits');
  daily = signal<Daily | null>(null);
  summary = signal<Summary | null>(null);
  vr = signal<VisitsReport | null>(null);
  doctors = signal<Doctor[]>([]);
  error = signal('');

  todayStr = today();
  date = today();
  from = today(-29);
  to = today();
  vFrom = today();
  vTo = today();
  vDoctor = '';
  vStatus = '';

  ngOnInit() {
    this.loadVisits();
    this.loadDaily();
    this.loadSummary();
    this.http.get<Doctor[]>(`${API}/users/doctors`).subscribe((d) => this.doctors.set(d));
  }

  initials = (name?: string) => (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

  doctorName = () => this.doctors().find((d) => d._id === this.vDoctor)?.name ?? '';

  quick(daysBack: number) {
    this.vFrom = today(daysBack);
    this.vTo = today();
    this.loadVisits();
  }

  loadVisits() {
    const params: Record<string, string> = { from: this.vFrom, to: this.vTo };
    if (this.vDoctor) params['doctorId'] = this.vDoctor;
    if (this.vStatus) params['status'] = this.vStatus;
    this.http.get<VisitsReport>(`${API}/reports/visits`, { params }).subscribe({
      next: (r) => {
        this.vr.set(r);
        this.error.set('');
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  /** Downloads the table as a CSV file that opens in Excel. */
  downloadCsv() {
    const r = this.vr();
    if (!r) return;
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Date', 'Token', 'Visit', 'Patient ID', 'Patient', 'Age', 'Gender', 'Phone', 'Doctor', 'Complaint', 'Diagnosis', 'Status', 'Invoice', 'Billed', 'Paid', 'Due'];
    const lines = [head.map(cell).join(',')];
    for (const v of r.rows) {
      lines.push([v.date, v.token ?? '', v.visitNo, v.patient?.mrn, v.patient?.name, v.patient?.age, v.patient?.gender, v.patient?.phone, v.doctor, v.complaint, v.diagnosis, v.status, v.invoiceNo, v.billed, v.paid, v.due].map(cell).join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `patients-report-${r.from}${r.from === r.to ? '' : '-to-' + r.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  loadDaily() {
    this.http.get<Daily>(`${API}/reports/daily`, { params: { date: this.date } }).subscribe({
      next: (d) => {
        this.daily.set(d);
        this.error.set('');
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  loadSummary() {
    this.http.get<Summary>(`${API}/reports/summary`, { params: { from: this.from, to: this.to } }).subscribe({
      next: (s) => this.summary.set(s),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  methodRows = (d: Daily) => Object.entries(d.byMethod);
  apptRows = (d: Daily) => Object.entries(d.appointments);
  pct = (v: number, s: Summary) => {
    const max = Math.max(...s.income.map((i) => i.total), 1);
    return Math.max((v / max) * 100, 2);
  };

  print() {
    window.print();
  }
}
