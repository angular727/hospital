import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { API, errorMessage } from '../../core/api';
import { HasPermissionDirective } from '../../core/has-permission.directive';
import { Invoice } from '../../core/models';
import { LoadingService } from '../../core/loading.service';
import { STATUS_CLASS } from '../../core/util';

@Component({
  selector: 'app-invoices',
  imports: [FormsModule, RouterLink, DecimalPipe, HasPermissionDirective],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <h3 class="mb-0">Billing</h3>
      <a *hasPermission="'billing.create'" class="btn btn-primary" routerLink="/billing/new"><i class="bi bi-plus-lg me-1"></i>New invoice</a>
    </div>

    @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }

    <div class="row g-3 mb-3">
      <div class="col-6 col-md-3"><div class="card stat-card"><div class="card-body"><div class="label">Billed</div><div class="value">{{ totalBilled() | number: '1.0-0' }}</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card stat-card"><div class="card-body"><div class="label">Received</div><div class="value">{{ totalPaid() | number: '1.0-0' }}</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card stat-card"><div class="card-body"><div class="label">Outstanding</div><div class="value text-danger">{{ totalDue() | number: '1.0-0' }}</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card stat-card"><div class="card-body"><div class="label">Invoices</div><div class="value">{{ items().length }}</div></div></div></div>
    </div>

    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body py-2 d-flex gap-3 align-items-end flex-wrap">
        <div style="min-width: 220px"><label class="form-label small mb-0">Search</label><input class="form-control form-control-sm" placeholder="Invoice no, patient name, phone" [ngModel]="q" (ngModelChange)="onSearch($event)" /></div>
        <div>
          <label class="form-label small mb-0">Status</label>
          <select class="form-select form-select-sm" [ngModel]="status" (ngModelChange)="status = $event; load()">
            <option value="">All</option><option value="due">Has balance</option><option value="unpaid">Unpaid</option><option value="partial">Partial</option><option value="paid">Paid</option>
          </select>
        </div>
        <div><label class="form-label small mb-0">From</label><input type="date" class="form-control form-control-sm" [ngModel]="from" (ngModelChange)="from = $event; load()" /></div>
        <div><label class="form-label small mb-0">To</label><input type="date" class="form-control form-control-sm" [ngModel]="to" (ngModelChange)="to = $event; load()" /></div>
        <button class="btn btn-sm btn-outline-secondary" (click)="clear()">Clear</button>
      </div>
    </div>

    <div class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-light"><tr><th>Invoice</th><th>Date</th><th>Patient</th><th>Doctor</th><th class="text-end">Total</th><th class="text-end">Paid</th><th class="text-end">Balance</th><th>Status</th><th></th></tr></thead>
          <tbody>
            @for (i of items(); track i._id) {
              <tr>
                <td><code>{{ i.invoiceNo }}</code></td>
                <td>{{ i.day }}</td>
                <td><span class="fw-semibold">{{ i.patientId?.name }}</span><div class="small text-muted">{{ i.patientId?.mrn }}</div></td>
                <td>{{ i.doctorId?.name || '—' }}</td>
                <td class="text-end">{{ i.total | number: '1.0-2' }}</td>
                <td class="text-end">{{ i.paid | number: '1.0-2' }}</td>
                <td class="text-end" [class.text-danger]="i.balance > 0">{{ i.balance | number: '1.0-2' }}</td>
                <td><span class="badge" [class]="badge(i.status)">{{ i.status }}</span></td>
                <td class="text-end"><a class="btn btn-sm btn-outline-primary" [routerLink]="['/billing', i._id]">Open</a></td>
              </tr>
            } @empty { <tr><td colspan="9" class="text-center text-muted py-4">@if (loading.busy()) { <span class="spinner-border spinner-border-sm me-2"></span>Loading invoices… } @else { No invoices found }</td></tr> }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class InvoicesComponent implements OnInit {
  private http = inject(HttpClient);
  loading = inject(LoadingService);

  items = signal<Invoice[]>([]);
  error = signal('');
  q = '';
  status = '';
  from = '';
  to = '';
  private timer: any;

  totalBilled = computed(() => this.items().reduce((s, i) => s + i.total, 0));
  totalPaid = computed(() => this.items().reduce((s, i) => s + i.paid, 0));
  totalDue = computed(() => this.items().reduce((s, i) => s + i.balance, 0));
  badge = (s: string) => `badge ${STATUS_CLASS[s] ?? 'bg-secondary'}`;

  ngOnInit() {
    this.load();
  }

  onSearch(v: string) {
    this.q = v;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(), 300);
  }

  clear() {
    this.q = this.status = this.from = this.to = '';
    this.load();
  }

  load() {
    const params: Record<string, string> = {};
    if (this.q.trim()) params['q'] = this.q.trim();
    if (this.status) params['status'] = this.status;
    if (this.from) params['from'] = this.from;
    if (this.to) params['to'] = this.to;
    this.http.get<Invoice[]>(`${API}/invoices`, { params }).subscribe({
      next: (i) => {
        this.items.set(i);
        this.error.set('');
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }
}
