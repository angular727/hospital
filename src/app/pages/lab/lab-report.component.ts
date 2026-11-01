import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { API, errorMessage } from '../../core/api';
import { LoadingService } from '../../core/loading.service';
import { Lab, LabReport } from '../../core/models';
import { addDays, today } from '../../core/util';

/** The lab report for a period: what was ordered and done, and the fee (billed, paid, due). Prints cleanly. */
@Component({
  selector: 'app-lab-report',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="d-print-none">
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h3 class="mb-0">Lab report</h3>
        <button class="btn btn-outline-dark" [disabled]="!report()" (click)="print()"><i class="bi bi-printer me-1"></i>Print</button>
      </div>

      <div class="card border-0 shadow-sm mb-3">
        <div class="card-body py-2 d-flex align-items-end gap-3 flex-wrap">
          <div>
            <div class="small text-muted">Period</div>
            <div class="btn-group btn-group-sm">
              @for (p of presets; track p.label) {
                <button type="button" class="btn btn-outline-primary" (click)="preset(p.label)">{{ p.label }}</button>
              }
            </div>
          </div>
          <div><label class="small text-muted d-block">From</label><input type="date" class="form-control form-control-sm" [(ngModel)]="from" (change)="load()" /></div>
          <div><label class="small text-muted d-block">To</label><input type="date" class="form-control form-control-sm" [(ngModel)]="to" (change)="load()" /></div>
          @if (labs().length > 1) {
            <div>
              <label class="small text-muted d-block">Lab</label>
              <select class="form-select form-select-sm" [(ngModel)]="labId" (change)="load()">
                <option value="">All labs</option>
                @for (l of labs(); track l._id) { <option [value]="l._id">{{ l.name }}</option> }
              </select>
            </div>
          }
        </div>
      </div>
      @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }
    </div>

    @if (report(); as r) {
      <div class="d-none d-print-block text-center mb-3">
        <h4 class="mb-0">Lab report</h4>
        <div class="text-muted">{{ labTitle() }} · {{ r.from }} to {{ r.to }}</div>
      </div>

      <div class="row g-3 mb-3">
        @for (c of cards(); track c.label) {
          <div class="col-6 col-md-3">
            <div class="card border-0 shadow-sm h-100"><div class="card-body py-3">
              <div class="small text-muted">{{ c.label }}</div>
              <div class="fs-4 fw-semibold" [class.text-danger]="c.danger && c.value > 0">{{ c.value | number: '1.0-0' }}</div>
            </div></div>
          </div>
        }
      </div>
      @if (r.totals.cancelled) { <div class="small text-muted mb-3">{{ r.totals.cancelled }} cancelled order(s) are not counted above.</div> }
      @if (r.totals.received) { <div class="small text-muted mb-3">Money received at the lab counter in this period: <strong>{{ r.totals.received | number: '1.0-0' }}</strong>. It is also in the hospital's daily cash report.</div> }

      @if (r.byLab.length > 1 || !labId) {
        <div class="card border-0 shadow-sm mb-3">
          <div class="card-header bg-white fw-semibold">By lab</div>
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead class="table-light"><tr><th>Lab</th><th class="text-end">Orders</th><th class="text-end">Tests</th><th class="text-end">Done</th><th class="text-end">Pending</th><th class="text-end">Billed</th><th class="text-end">Paid</th><th class="text-end">Due</th><th class="text-end">Received here</th></tr></thead>
              <tbody>
                @for (l of r.byLab; track l.labId) {
                  <tr>
                    <td class="fw-semibold">{{ l.lab }}</td>
                    <td class="text-end">{{ l.orders }}</td><td class="text-end">{{ l.tests }}</td><td class="text-end">{{ l.completed }}</td><td class="text-end">{{ l.pending }}</td>
                    <td class="text-end">{{ l.billed | number: '1.0-0' }}</td><td class="text-end">{{ l.paid | number: '1.0-0' }}</td>
                    <td class="text-end" [class.text-danger]="l.due > 0">{{ l.due | number: '1.0-0' }}</td><td class="text-end">{{ l.received | number: '1.0-0' }}</td>
                  </tr>
                } @empty { <tr><td colspan="9" class="text-center text-muted py-3">No lab orders in this period</td></tr> }
              </tbody>
            </table>
          </div>
        </div>
      }

      <div class="row g-3">
        <div class="col-lg-6">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-header bg-white fw-semibold">Busiest tests</div>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light"><tr><th>Test</th><th class="text-end">Done</th><th class="text-end">Fee</th></tr></thead>
                <tbody>
                  @for (t of r.topTests; track t.name) { <tr><td>{{ t.name }}</td><td class="text-end">{{ t.count }}</td><td class="text-end">{{ t.revenue | number: '1.0-0' }}</td></tr> }
                  @empty { <tr><td colspan="3" class="text-center text-muted py-3">Nothing yet</td></tr> }
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-header bg-white fw-semibold">Doctors who ordered the most</div>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light"><tr><th>Doctor</th><th class="text-end">Orders</th><th class="text-end">Fee</th></tr></thead>
                <tbody>
                  @for (d of r.byDoctor; track d.doctor) { <tr><td>{{ d.doctor }}</td><td class="text-end">{{ d.orders }}</td><td class="text-end">{{ d.billed | number: '1.0-0' }}</td></tr> }
                  @empty { <tr><td colspan="3" class="text-center text-muted py-3">Nothing yet</td></tr> }
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="col-12">
          <div class="card border-0 shadow-sm">
            <div class="card-header bg-white fw-semibold">Day by day</div>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light"><tr><th>Date</th><th class="text-end">Orders</th><th class="text-end">Tests</th><th class="text-end">Billed</th></tr></thead>
                <tbody>
                  @for (d of r.byDay; track d.day) { <tr><td>{{ d.day }}</td><td class="text-end">{{ d.orders }}</td><td class="text-end">{{ d.tests }}</td><td class="text-end">{{ d.billed | number: '1.0-0' }}</td></tr> }
                  @empty { <tr><td colspan="4" class="text-center text-muted py-3">No lab orders in this period</td></tr> }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div class="small text-muted mt-3">A bill can cover more than one lab, so each lab's billed, paid and due amounts are its share of the bill, in proportion to its own tests.</div>
    } @else if (!error()) {
      <div class="text-muted">@if (loading.busy()) { <span class="spinner-border spinner-border-sm me-2"></span>Loading report… }</div>
    }
  `,
})
export class LabReportComponent implements OnInit {
  private http = inject(HttpClient);
  loading = inject(LoadingService);

  from = addDays(today(), -29);
  to = today();
  labId = '';
  labs = signal<Lab[]>([]);
  report = signal<LabReport | null>(null);
  error = signal('');

  presets = [{ label: 'Today' }, { label: 'Yesterday' }, { label: 'Last 7 days' }, { label: 'This month' }];

  labTitle = computed(() => {
    const l = this.labs();
    return this.labId ? l.find((x) => x._id === this.labId)?.name ?? 'Lab' : l.length === 1 ? l[0].name : 'All labs';
  });

  cards = computed(() => {
    const t = this.report()?.totals;
    if (!t) return [];
    return [
      { label: 'Orders', value: t.orders, danger: false },
      { label: 'Tests', value: t.tests, danger: false },
      { label: 'Completed', value: t.completed, danger: false },
      { label: 'Pending', value: t.pending, danger: false },
      { label: 'Billed', value: t.billed, danger: false },
      { label: 'Paid', value: t.paid, danger: false },
      { label: 'Due', value: t.due, danger: true },
      { label: 'Received at lab', value: t.received, danger: false },
    ];
  });

  ngOnInit() {
    this.http.get<Lab[]>(`${API}/lab/labs`).subscribe((l) => this.labs.set(l));
    this.load();
  }

  preset(label: string) {
    const t = today();
    if (label === 'Today') [this.from, this.to] = [t, t];
    else if (label === 'Yesterday') [this.from, this.to] = [addDays(t, -1), addDays(t, -1)];
    else if (label === 'Last 7 days') [this.from, this.to] = [addDays(t, -6), t];
    else [this.from, this.to] = [t.slice(0, 8) + '01', t];
    this.load();
  }

  load() {
    const params: Record<string, string> = { from: this.from, to: this.to };
    if (this.labId) params['labId'] = this.labId;
    this.http.get<LabReport>(`${API}/lab/reports/summary`, { params }).subscribe({
      next: (r) => {
        this.report.set(r);
        this.error.set('');
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  print() {
    window.print();
  }
}
