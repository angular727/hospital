import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { Invoice } from '../../core/models';
import { PAY_METHODS, STATUS_CLASS } from '../../core/util';
import { LoaderComponent } from '../../shared/loader.component';

@Component({
  selector: 'app-invoice-detail',
  imports: [FormsModule, RouterLink, DecimalPipe, LoaderComponent],
  template: `
    <div class="no-print d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <a routerLink="/billing" class="text-decoration-none small"><i class="bi bi-arrow-left"></i> Billing</a>
      @if (inv(); as i) {
        <div class="d-flex gap-2">
          @if (i.balance > 0 && auth.has('billing.create')) { <button class="btn btn-success" (click)="openPay('payment')"><i class="bi bi-cash-coin me-1"></i>Receive payment</button> }
          @if (i.paid > 0 && auth.has('billing.refund')) { <button class="btn btn-outline-danger" (click)="openPay('refund')">Refund</button> }
          @if (auth.has('billing.print')) { <button class="btn btn-primary" (click)="print()"><i class="bi bi-printer me-1"></i>Print receipt</button> }
        </div>
      }
    </div>
    @if (error()) { <div class="alert alert-danger py-2 no-print">{{ error() }}</div> }
    @if (!inv() && !error()) { <app-loader text="Loading bill…" /> }

    @if (inv(); as i) {
      <div class="print-sheet">
        <div class="text-center pb-2 mb-3 head">
          <div class="hospital-name">{{ hospital()?.name }}</div>
          @if (hospital()?.settings?.tagline) { <div class="text-muted small">{{ hospital()?.settings?.tagline }}</div> }
          <div class="small">{{ hospital()?.address }}{{ hospital()?.phone ? ' · Tel: ' + hospital()?.phone : '' }}</div>
        </div>

        <div class="d-flex justify-content-between mb-3">
          <div>
            <div class="text-muted small">Billed to</div>
            <div class="fw-bold">{{ i.patientId?.name }}</div>
            <div class="small">{{ i.patientId?.mrn }}{{ i.patientId?.phone ? ' · ' + i.patientId.phone : '' }}</div>
            @if (i.doctorId?.name) { <div class="small">Doctor: {{ i.doctorId.name }}</div> }
          </div>
          <div class="text-end">
            <div class="fs-5 fw-bold">{{ i.status === 'paid' ? 'RECEIPT' : 'INVOICE' }}</div>
            <div class="small">No: <strong>{{ i.invoiceNo }}</strong></div>
            <div class="small">Date: {{ i.day }}</div>
            <span class="badge no-print" [class]="badge(i.status)">{{ i.status }}</span>
          </div>
        </div>

        <table class="table table-sm">
          <thead class="table-light"><tr><th>Description</th><th class="text-end">Qty</th><th class="text-end">Rate</th><th class="text-end">Amount</th></tr></thead>
          <tbody>
            @for (it of i.items; track $index) {
              <tr><td>{{ it.description }}</td><td class="text-end">{{ it.qty }}</td><td class="text-end">{{ it.rate | number: '1.0-2' }}</td><td class="text-end">{{ it.amount | number: '1.0-2' }}</td></tr>
            }
          </tbody>
        </table>

        <div class="d-flex justify-content-end">
          <table class="table table-sm totals">
            <tr><td>Subtotal</td><td class="text-end">{{ i.subtotal | number: '1.0-2' }}</td></tr>
            @if (i.discount > 0) { <tr><td>Discount</td><td class="text-end">- {{ i.discount | number: '1.0-2' }}</td></tr> }
            <tr class="fw-bold"><td>Total ({{ hospital()?.settings?.currency }})</td><td class="text-end">{{ i.total | number: '1.0-2' }}</td></tr>
            <tr><td>Paid</td><td class="text-end">{{ i.paid | number: '1.0-2' }}</td></tr>
            <tr class="fw-bold" [class.text-danger]="i.balance > 0"><td>Balance due</td><td class="text-end">{{ i.balance | number: '1.0-2' }}</td></tr>
          </table>
        </div>

        @if (i.payments.length) {
          <div class="fw-semibold small mt-2">Payments</div>
          <table class="table table-sm small">
            <tbody>
              @for (p of i.payments; track p._id) {
                <tr [class.text-danger]="p.type === 'refund'">
                  <td>{{ p.day }}</td><td class="text-capitalize">{{ p.type }} · {{ p.method }}</td><td>{{ p.note }}</td><td class="text-end">{{ p.amount | number: '1.0-2' }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
        @if (i.notes) { <div class="small text-muted">Notes: {{ i.notes }}</div> }
        <div class="text-center small text-muted mt-4">{{ hospital()?.settings?.printFooter || 'Thank you' }}</div>
      </div>
    }

    @if (mode()) {
      <div class="modal d-block modal-backdrop-custom no-print" tabindex="-1">
        <div class="modal-dialog">
          <form class="modal-content" (ngSubmit)="submitPay()">
            <div class="modal-header"><h5 class="modal-title">{{ mode() === 'payment' ? 'Receive payment' : 'Refund' }}</h5><button type="button" class="btn-close" (click)="mode.set('')"></button></div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <div class="mb-3">
                <label class="form-label">Amount</label>
                <input type="number" min="1" class="form-control" name="amount" [(ngModel)]="amount" required />
                <div class="form-text">{{ mode() === 'payment' ? 'Balance due: ' + (inv()!.balance | number: '1.0-2') : 'Paid so far: ' + (inv()!.paid | number: '1.0-2') }}</div>
              </div>
              <div class="mb-3">
                <label class="form-label">Method</label>
                <select class="form-select" name="method" [(ngModel)]="method">@for (m of methods; track m) { <option [value]="m" class="text-capitalize">{{ m }}</option> }</select>
              </div>
              <div class="mb-1">
                <label class="form-label">{{ mode() === 'refund' ? 'Reason *' : 'Note' }}</label>
                <input class="form-control" name="note" [(ngModel)]="note" [required]="mode() === 'refund'" />
              </div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-light" (click)="mode.set('')">Cancel</button><button class="btn" [class.btn-success]="mode() === 'payment'" [class.btn-danger]="mode() === 'refund'" [disabled]="saving()">{{ mode() === 'payment' ? 'Save payment' : 'Refund' }}</button></div>
          </form>
        </div>
      </div>
    }
  `,
  styles: `
    .hospital-name { font-size: 1.5rem; font-weight: 700; color: #0f4c4c; }
    .head { border-bottom: 2px solid #0f4c4c; }
    .totals { width: 300px; }
  `,
})
export class InvoiceDetailComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  auth = inject(AuthService);

  inv = signal<Invoice | null>(null);
  error = signal('');
  formError = signal('');
  saving = signal(false);
  mode = signal<'' | 'payment' | 'refund'>('');

  amount = 0;
  method = 'cash';
  note = '';
  methods = PAY_METHODS;

  hospital = () => this.auth.me()?.hospital;
  badge = (s: string) => `badge ${STATUS_CLASS[s] ?? 'bg-secondary'}`;

  ngOnInit() {
    this.http.get<Invoice>(`${API}/invoices/${this.route.snapshot.paramMap.get('id')}`).subscribe({
      next: (i) => this.inv.set(i),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  openPay(m: 'payment' | 'refund') {
    const i = this.inv()!;
    this.amount = m === 'payment' ? i.balance : 0;
    this.method = 'cash';
    this.note = '';
    this.formError.set('');
    this.mode.set(m);
  }

  submitPay() {
    const i = this.inv()!;
    const path = this.mode() === 'payment' ? 'payments' : 'refund';
    this.saving.set(true);
    this.http.post<Invoice>(`${API}/invoices/${i._id}/${path}`, { amount: Number(this.amount), method: this.method, note: this.note || undefined }).subscribe({
      next: (r) => {
        this.saving.set(false);
        this.inv.set(r);
        this.mode.set('');
      },
      error: (e) => {
        this.saving.set(false);
        this.formError.set(errorMessage(e));
      },
    });
  }

  print() {
    window.print();
  }
}
