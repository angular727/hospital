import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { LabFileInfo, LabOrder } from '../../core/models';
import { PAY_METHODS, saveBlob } from '../../core/util';

/** One lab order: enter the results, then print the report. */
@Component({
  selector: 'app-lab-order-detail',
  imports: [FormsModule, RouterLink, DecimalPipe],
  template: `
    <div class="d-print-none">
      <a routerLink="/lab" class="text-decoration-none small"><i class="bi bi-arrow-left"></i> Lab orders</a>
    </div>
    @if (error()) { <div class="alert alert-danger py-2 mt-2 d-print-none">{{ error() }}</div> }

    @if (order(); as o) {
      <div class="d-flex justify-content-between align-items-center my-3 flex-wrap gap-2 d-print-none">
        <h3 class="mb-0">{{ o.orderNo }}
          <span class="badge fs-6 ms-2" [class.text-bg-warning]="o.status === 'ordered'" [class.text-bg-success]="o.status === 'completed'" [class.text-bg-secondary]="o.status === 'cancelled'">
            {{ o.status === 'ordered' ? 'Waiting for results' : o.status === 'completed' ? 'Completed' : 'Cancelled' }}
          </span>
        </h3>
        <div class="d-flex gap-2">
          @if (o.invoiceId) { <a class="btn btn-outline-secondary" [routerLink]="['/billing', o.invoiceId._id]"><i class="bi bi-receipt me-1"></i>Bill {{ o.invoiceId.invoiceNo }}</a> }
          @if (auth.has('lab.print') && o.status !== 'cancelled') { <button class="btn btn-outline-primary" (click)="print()"><i class="bi bi-printer me-1"></i>Print report</button> }
        </div>
      </div>

      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="d-none d-print-block text-center mb-3"><h4 class="mb-0">{{ o.labId?.name || 'Laboratory' }}</h4><div class="text-muted">Laboratory report</div></div>
          <div class="row g-2 mb-3">
            <div class="col-md-4"><div class="text-muted small">Patient</div><strong>{{ o.patientId.name }}</strong> <span class="text-muted">({{ o.patientId.mrn }})</span></div>
            <div class="col-md-4"><div class="text-muted small">Age / gender</div>{{ o.patientId.age ?? '—' }} / {{ o.patientId.gender || '—' }}</div>
            <div class="col-md-4"><div class="text-muted small">Date</div>{{ o.day }}</div>
            <div class="col-md-4"><div class="text-muted small">Lab</div>{{ o.labId?.name || '—' }}</div>
            <div class="col-md-4"><div class="text-muted small">Ordered by</div>{{ o.doctorId?.name || '—' }}</div>
            @if (o.visitId) { <div class="col-md-4"><div class="text-muted small">Visit</div><code>{{ o.visitId.visitNo }}</code></div> }
            @if (o.notes) { <div class="col-12"><div class="text-muted small">Notes</div>{{ o.notes }}</div> }
          </div>

          <div class="table-responsive">
            <table class="table align-middle">
              <thead class="table-light"><tr><th>Test</th><th style="width:220px">Result</th><th>Unit</th><th>Normal range</th><th>Remarks</th></tr></thead>
              <tbody>
                @for (it of o.items; track it._id) {
                  <tr>
                    <td class="fw-semibold">{{ it.name }}</td>
                    <td>
                      @if (canEnter()) {
                        <input class="form-control form-control-sm d-print-none" [name]="'r' + it._id" [(ngModel)]="results[it._id].result" />
                        <span class="d-none d-print-inline">{{ it.result }}</span>
                      } @else { {{ it.result || '—' }} }
                    </td>
                    <td>{{ it.unit || '' }}</td>
                    <td>{{ it.normalRange || '' }}</td>
                    <td>
                      @if (canEnter()) {
                        <input class="form-control form-control-sm d-print-none" [name]="'m' + it._id" [(ngModel)]="results[it._id].remarks" />
                        <span class="d-none d-print-inline">{{ it.remarks }}</span>
                      } @else { {{ it.remarks || '' }} }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="border rounded p-3 mt-3 mb-3 d-print-none">
            <div class="fw-semibold mb-2"><i class="bi bi-cash-coin me-1"></i>Fee</div>
            <div class="d-flex flex-wrap gap-4 small mb-2">
              <span>Tests: <strong>{{ fee(o) | number: '1.0-0' }}</strong></span>
              @if (o.invoiceId; as b) {
                <span>Bill {{ b.invoiceNo }}: total <strong>{{ b.total | number: '1.0-0' }}</strong></span>
                <span>Paid <strong>{{ b.paid | number: '1.0-0' }}</strong></span>
                <span>Due <strong [class.text-danger]="b.balance > 0">{{ b.balance | number: '1.0-0' }}</strong></span>
                <span class="badge" [class.text-bg-success]="b.status === 'paid'" [class.text-bg-warning]="b.status === 'partial'" [class.text-bg-danger]="b.status === 'unpaid'" [class.text-bg-secondary]="b.status === 'cancelled'">{{ b.status }}</span>
              }
            </div>
            @if (o.invoiceId && o.invoiceId.balance > 0 && o.status !== 'cancelled' && auth.has('lab.collect')) {
              <div class="d-flex gap-2 align-items-center flex-wrap">
                <input type="number" min="1" class="form-control form-control-sm" style="width: 130px" name="payAmount" [(ngModel)]="payAmount" />
                <select class="form-select form-select-sm text-capitalize" style="width: 130px" name="payMethod" [(ngModel)]="payMethod">
                  @for (m of methods; track m) { <option [value]="m">{{ m }}</option> }
                </select>
                <button type="button" class="btn btn-sm btn-success" [disabled]="paying()" (click)="receive()">Receive payment</button>
              </div>
            } @else if (!o.invoiceId) { <div class="text-muted small">No bill was made for this order.</div> }
          </div>

          <div class="mt-3 mb-3 d-print-none">
            <div class="fw-semibold mb-2"><i class="bi bi-paperclip me-1"></i>Report files</div>
            @if (o.files?.length) {
              <div class="d-flex flex-wrap gap-2 mb-2">
                @for (f of o.files; track f._id) {
                  <span class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-outline-primary" (click)="download(f)">{{ f.name }} <span class="text-muted small">({{ kb(f.size) }} KB)</span></button>
                    @if (canEnter()) { <button type="button" class="btn btn-outline-danger" title="Delete file" (click)="removeFile(f)"><i class="bi bi-trash"></i></button> }
                  </span>
                }
              </div>
            } @else { <div class="text-muted small mb-2">No file attached.</div> }
            @if (canEnter()) {
              <input type="file" class="form-control form-control-sm" style="max-width: 360px" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" [disabled]="uploading()" (change)="upload($event)" />
              <div class="form-text">PDF, JPG or PNG, up to 2 MB each, 5 files per order.</div>
            }
          </div>

          @if (o.status === 'cancelled') { <div class="alert alert-secondary py-2 mb-0">Cancelled: {{ o.cancelReason }}</div> }

          @if (canEnter()) {
            <div class="d-flex gap-2 d-print-none">
              <button class="btn btn-primary" [disabled]="saving()" (click)="saveResults()">Save results</button>
              @if (canCancel(o)) { <button class="btn btn-outline-danger" (click)="cancel()">Cancel order</button> }
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class LabOrderDetailComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  auth = inject(AuthService);

  order = signal<LabOrder | null>(null);
  error = signal('');
  saving = signal(false);
  uploading = signal(false);
  paying = signal(false);
  payAmount = 0;
  payMethod = 'cash';
  methods = PAY_METHODS;
  results: Record<string, { result: string; remarks: string }> = {};

  ngOnInit() {
    this.http.get<LabOrder>(`${API}/lab/orders/${this.route.snapshot.paramMap.get('id')}`).subscribe({
      next: (o) => this.set(o),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  fee = (o: LabOrder) => o.items.reduce((s, i) => s + (i.price || 0), 0);

  private set(o: LabOrder) {
    this.order.set(o);
    this.payAmount = o.invoiceId?.balance ?? 0;
    this.results = Object.fromEntries(o.items.map((i) => [i._id, { result: i.result ?? '', remarks: i.remarks ?? '' }]));
  }

  canEnter = () => this.auth.has('lab.edit') && this.order()?.status !== 'cancelled';
  canCancel = (o: LabOrder) => o.status === 'ordered' && !o.items.some((i) => i.result);

  saveResults() {
    const o = this.order();
    if (!o) return;
    this.saving.set(true);
    this.error.set('');
    this.http
      .put<LabOrder>(`${API}/lab/orders/${o._id}/results`, { results: Object.entries(this.results).map(([itemId, r]) => ({ itemId, ...r })) })
      .subscribe({
        next: (u) => {
          this.saving.set(false);
          this.set(u);
        },
        error: (e) => {
          this.saving.set(false);
          this.error.set(errorMessage(e));
        },
      });
  }

  cancel() {
    const o = this.order();
    const reason = o && prompt('Reason for cancelling this lab order?');
    if (!o || !reason?.trim()) return;
    this.http.post<LabOrder>(`${API}/lab/orders/${o._id}/cancel`, { reason }).subscribe({
      next: (u) => this.set(u),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  receive() {
    const o = this.order();
    if (!o) return;
    const amount = Number(this.payAmount) || 0;
    if (amount <= 0) return this.error.set('Enter a valid amount');
    this.paying.set(true);
    this.error.set('');
    this.http.post<LabOrder>(`${API}/lab/orders/${o._id}/payment`, { amount, method: this.payMethod }).subscribe({
      next: (fresh) => {
        this.paying.set(false);
        // Only the bill changed: results typed but not saved yet stay as they are.
        this.order.update((cur) => (cur ? { ...cur, invoiceId: fresh.invoiceId } : cur));
        this.payAmount = fresh.invoiceId?.balance ?? 0;
      },
      error: (e) => {
        this.paying.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }

  kb = (bytes: number) => Math.max(Math.round(bytes / 1024), 1);

  /** Reload only the file list, so results the technician has typed but not saved are not lost. */
  private refreshFiles() {
    const o = this.order();
    if (!o) return;
    this.http.get<LabOrder>(`${API}/lab/orders/${o._id}`).subscribe({
      next: (fresh) => this.order.update((cur) => (cur ? { ...cur, files: fresh.files } : cur)),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const o = this.order();
    if (!file || !o) return;
    if (file.size > 2 * 1024 * 1024) {
      this.error.set('File is too big (maximum 2 MB)');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result).split(',')[1] ?? '';
      this.uploading.set(true);
      this.error.set('');
      this.http.post(`${API}/lab/orders/${o._id}/files`, { name: file.name, mimeType: file.type, data }).subscribe({
        next: () => {
          this.uploading.set(false);
          input.value = '';
          this.refreshFiles();
        },
        error: (e) => {
          this.uploading.set(false);
          input.value = '';
          this.error.set(errorMessage(e));
        },
      });
    };
    reader.readAsDataURL(file);
  }

  download(f: LabFileInfo) {
    const o = this.order();
    if (!o) return;
    this.http.get(`${API}/lab/orders/${o._id}/files/${f._id}`, { responseType: 'blob' }).subscribe({
      next: (blob) => saveBlob(blob, f.name),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  removeFile(f: LabFileInfo) {
    const o = this.order();
    if (!o || !confirm(`Delete "${f.name}"?`)) return;
    this.http.delete(`${API}/lab/orders/${o._id}/files/${f._id}`).subscribe({
      next: () => this.refreshFiles(),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  print() {
    window.print();
  }
}
