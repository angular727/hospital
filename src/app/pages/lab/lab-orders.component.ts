import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { LoadingService } from '../../core/loading.service';
import { Lab, LabOrder, LabTest, PatientRef } from '../../core/models';
import { PAY_METHODS, today } from '../../core/util';
import { PatientPickerComponent } from '../../shared/patient-picker.component';

/** Lab orders: today's list, plus a form to order tests for a patient. */
@Component({
  selector: 'app-lab-orders',
  imports: [FormsModule, RouterLink, DecimalPipe, PatientPickerComponent],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <h3 class="mb-0">Lab orders</h3>
      @if (auth.has('lab.create')) {
        <button class="btn btn-primary" (click)="openForm()"><i class="bi bi-plus-lg me-1"></i>New lab order</button>
      }
    </div>

    @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }

    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body py-2 d-flex align-items-center gap-2 flex-wrap">
        <div class="input-group" style="max-width: 300px">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input class="form-control" placeholder="Patient, MR no. or order no." [(ngModel)]="q" (keyup.enter)="load()" />
        </div>
        <input type="date" class="form-control" style="max-width: 160px" [(ngModel)]="from" (change)="load()" />
        <span class="text-muted">to</span>
        <input type="date" class="form-control" style="max-width: 160px" [(ngModel)]="to" (change)="load()" />
        <select class="form-select" style="max-width: 160px" [(ngModel)]="status" (change)="load()">
          <option value="">All status</option>
          <option value="ordered">Waiting for result</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        @if (labs().length > 1) {
          <select class="form-select" style="max-width: 200px" [(ngModel)]="labId" (change)="load()">
            <option value="">All labs</option>
            @for (l of labs(); track l._id) { <option [value]="l._id">{{ l.name }}</option> }
          </select>
        }
        <button class="btn btn-outline-secondary" (click)="load()">Search</button>
      </div>
    </div>

    <div class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table table-hover mb-0 align-middle">
          <thead class="table-light"><tr><th>Order</th><th>Date</th><th>Patient</th><th>Lab</th><th>Tests</th><th class="text-end">Fee</th><th>Status</th><th class="text-end"></th></tr></thead>
          <tbody>
            @for (o of orders(); track o._id) {
              <tr>
                <td><code>{{ o.orderNo }}</code></td>
                <td>{{ o.day }}</td>
                <td>{{ o.patientId.name }}<div class="small text-muted">{{ o.patientId.mrn }}</div></td>
                <td>{{ o.labId?.name || '—' }}</td>
                <td>{{ summary(o) }}</td>
                <td class="text-end text-nowrap">{{ fee(o) | number: '1.0-0' }}@if (o.invoiceId && o.status !== 'cancelled') { <div class="small" [class.text-danger]="o.invoiceId.balance > 0" [class.text-success]="o.invoiceId.balance <= 0">{{ o.invoiceId.balance > 0 ? 'bill due ' + (o.invoiceId.balance | number: '1.0-0') : 'bill paid' }}</div> }</td>
                <td>
                  <span class="badge" [class.text-bg-warning]="o.status === 'ordered'" [class.text-bg-success]="o.status === 'completed'" [class.text-bg-secondary]="o.status === 'cancelled'">
                    {{ o.status === 'ordered' ? 'Waiting' : o.status === 'completed' ? 'Completed' : 'Cancelled' }}
                  </span>
                </td>
                <td class="text-end"><a class="btn btn-sm btn-outline-primary" [routerLink]="['/lab', o._id]">{{ o.status === 'ordered' && auth.has('lab.edit') ? 'Enter results' : 'Open' }}</a></td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="text-center text-muted py-4">
                @if (loading.busy()) { <span class="spinner-border spinner-border-sm me-2"></span>Loading lab orders… }
                @else { No lab orders found }
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
            <div class="modal-header">
              <h5 class="modal-title">New lab order</h5>
              <button type="button" class="btn-close" (click)="showForm.set(false)"></button>
            </div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <label class="form-label">Patient *</label>
              <app-patient-picker [(patient)]="patient" />

              <label class="form-label mt-3">Tests *</label>
              <input class="form-control form-control-sm mb-2" placeholder="Search tests" [ngModel]="testQ()" (ngModelChange)="testQ.set($event)" name="tq" />
              <div class="border rounded p-2" style="max-height: 240px; overflow: auto">
                @for (t of visibleTests(); track t._id) {
                  <div class="form-check d-flex justify-content-between">
                    <span>
                      <input class="form-check-input" type="checkbox" [id]="'t-' + t._id" [checked]="selected().has(t._id)" (change)="toggle(t._id)" />
                      <label class="form-check-label" [for]="'t-' + t._id">{{ t.name }} <span class="badge text-bg-light border ms-1">{{ t.labId?.name }}</span> <span class="text-muted small">{{ t.category }}</span></label>
                    </span>
                    <span class="text-muted">{{ t.price | number: '1.0-2' }}</span>
                  </div>
                } @empty {
                  <div class="text-muted small">{{ tests().length ? 'No test matches your search' : 'No tests yet. Add them in "Lab tests" first.' }}</div>
                }
              </div>
              <div class="d-flex justify-content-between mt-2"><span>{{ selected().size }} test(s) selected</span><strong>Total: {{ total() | number: '1.0-2' }}</strong></div>
              @if (labCount() > 1) { <div class="form-text">These tests belong to {{ labCount() }} labs. One order is made for each lab, with one bill for everything.</div> }

              @if (billingOn) {
                <div class="row g-2 mt-2">
                  <div class="col-md-6">
                    <label class="form-label">Bill</label>
                    <select class="form-select" name="billing" [(ngModel)]="billing">
                      <option value="unpaid">Create bill, payment later</option>
                      <option value="paid">Create bill, paid now</option>
                      <option value="none">No bill</option>
                    </select>
                  </div>
                  @if (billing === 'paid') {
                    <div class="col-md-6">
                      <label class="form-label">Payment method</label>
                      <select class="form-select text-capitalize" name="method" [(ngModel)]="method">@for (m of methods; track m) { <option [value]="m">{{ m }}</option> }</select>
                    </div>
                  }
                </div>
              }
              <textarea class="form-control mt-3" rows="2" name="notes" [(ngModel)]="notes" placeholder="Notes for the lab (optional)"></textarea>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" (click)="showForm.set(false)">Cancel</button>
              <button class="btn btn-primary" [disabled]="saving()">Place order</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class LabOrdersComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  auth = inject(AuthService);
  loading = inject(LoadingService);

  orders = signal<LabOrder[]>([]);
  error = signal('');
  q = '';
  from = today();
  to = today();
  status = '';
  labId = '';
  labs = signal<Lab[]>([]);

  showForm = signal(false);
  formError = signal('');
  saving = signal(false);
  patient: PatientRef | null = null;
  tests = signal<LabTest[]>([]);
  testQ = signal('');
  selected = signal(new Set<string>());
  visibleTests = computed(() => {
    const q = this.testQ().trim().toLowerCase();
    const active = this.tests().filter((t) => t.isActive);
    const list = q ? active.filter((t) => t.name.toLowerCase().includes(q) || (t.category ?? '').toLowerCase().includes(q)) : active;
    return [...list].sort((a, b) => (a.labId?.name ?? '').localeCompare(b.labId?.name ?? '') || a.name.localeCompare(b.name));
  });
  total = computed(() => this.tests().filter((t) => this.selected().has(t._id)).reduce((s, t) => s + t.price, 0));
  /** How many labs the selected tests belong to: each lab gets its own order. */
  labCount = computed(() => new Set(this.tests().filter((t) => this.selected().has(t._id)).map((t) => t.labId?._id)).size);
  billingOn = this.auth.has('billing.create');
  billing = 'unpaid';
  method = 'cash';
  methods = PAY_METHODS;
  notes = '';

  ngOnInit() {
    this.load();
    this.http.get<Lab[]>(`${API}/lab/labs`).subscribe((l) => this.labs.set(l));
    const q = this.route.snapshot.queryParamMap;
    if (q.get('new') && this.auth.has('lab.create')) {
      this.openForm();
      const pid = q.get('patientId');
      if (pid) this.http.get<PatientRef>(`${API}/patients/${pid}`).subscribe((p) => (this.patient = p));
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  load() {
    const params: Record<string, string> = {};
    if (this.q.trim()) params['q'] = this.q.trim();
    if (this.from) params['from'] = this.from;
    if (this.to) params['to'] = this.to;
    if (this.status) params['status'] = this.status;
    if (this.labId) params['labId'] = this.labId;
    this.http.get<LabOrder[]>(`${API}/lab/orders`, { params }).subscribe({
      next: (o) => {
        this.orders.set(o);
        this.error.set('');
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  fee = (o: LabOrder) => o.items.reduce((s, i) => s + (i.price || 0), 0);

  summary(o: LabOrder) {
    const names = o.items.map((i) => i.name);
    return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2} more` : names.join(', ');
  }

  openForm() {
    this.formError.set('');
    this.patient = null;
    this.selected.set(new Set());
    this.testQ.set('');
    this.billing = 'unpaid';
    this.notes = '';
    this.http.get<LabTest[]>(`${API}/lab/tests`, { params: { active: '1' } }).subscribe({
      next: (t) => this.tests.set(t),
      error: (e) => this.formError.set(errorMessage(e)),
    });
    this.showForm.set(true);
  }

  toggle(id: string) {
    const s = new Set(this.selected());
    if (!s.delete(id)) s.add(id);
    this.selected.set(s);
  }

  save() {
    this.formError.set('');
    if (!this.patient) return this.formError.set('Select a patient');
    if (!this.selected().size) return this.formError.set('Select at least one test');
    this.saving.set(true);
    this.http
      .post<{ orders: LabOrder[] }>(`${API}/lab/orders`, {
        patientId: this.patient._id,
        testIds: [...this.selected()],
        billing: this.billingOn ? this.billing : 'none',
        method: this.method,
        notes: this.notes || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showForm.set(false);
          this.load();
        },
        error: (e) => {
          this.saving.set(false);
          this.formError.set(errorMessage(e));
        },
      });
  }
}
