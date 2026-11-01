import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { Invoice, InvoiceItem, PatientRef, Visit } from '../../core/models';
import { ITEM_TYPES, PAY_METHODS } from '../../core/util';
import { PatientPickerComponent } from '../../shared/patient-picker.component';

@Component({
  selector: 'app-invoice-form',
  imports: [FormsModule, RouterLink, DecimalPipe, PatientPickerComponent],
  template: `
    <a routerLink="/billing" class="text-decoration-none small"><i class="bi bi-arrow-left"></i> Billing</a>
    <h3 class="my-3">New invoice</h3>
    @if (existingBill(); as eb) {
      <div class="alert alert-warning py-2">
        This visit already has bill <a [routerLink]="['/billing', eb._id]" class="alert-link">{{ eb.invoiceNo }}</a> ({{ eb.status === 'paid' ? 'paid' : 'due ' + eb.balance }}).
        Create another bill only for extra charges.
      </div>
    }
    @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }

    <form (ngSubmit)="save()">
      <div class="row g-3">
        <div class="col-lg-8">
          <div class="card border-0 shadow-sm mb-3">
            <div class="card-body">
              <label class="form-label">Patient *</label>
              <app-patient-picker [(patient)]="patient" />
              @if (visit()) { <div class="small text-muted mt-2">Linked to visit <code>{{ visit()!.visitNo }}</code> · {{ visit()!.doctorId?.name }}</div> }
            </div>
          </div>

          <div class="card border-0 shadow-sm">
            <div class="card-header bg-white d-flex justify-content-between align-items-center">
              <span class="fw-semibold">Items</span>
              <div class="d-flex gap-2">
                @if (fee() > 0) { <button type="button" class="btn btn-sm btn-outline-secondary" (click)="addConsultation()">+ Consultation fee</button> }
                <button type="button" class="btn btn-sm btn-outline-primary" (click)="addItem()">+ Add item</button>
              </div>
            </div>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light"><tr><th style="width:140px">Type</th><th>Description</th><th style="width:90px">Qty</th><th style="width:130px">Rate</th><th class="text-end" style="width:120px">Amount</th><th style="width:40px"></th></tr></thead>
                <tbody>
                  @for (it of items; track $index) {
                    <tr>
                      <td>
                        <select class="form-select form-select-sm" [name]="'t' + $index" [(ngModel)]="it.type">
                          @for (t of itemTypes; track t.value) { <option [value]="t.value">{{ t.label }}</option> }
                        </select>
                      </td>
                      <td><input class="form-control form-control-sm" [name]="'d' + $index" [(ngModel)]="it.description" placeholder="e.g. Consultation, Injection, Dressing" /></td>
                      <td><input type="number" min="1" class="form-control form-control-sm" [name]="'q' + $index" [(ngModel)]="it.qty" /></td>
                      <td><input type="number" min="0" class="form-control form-control-sm" [name]="'r' + $index" [(ngModel)]="it.rate" /></td>
                      <td class="text-end">{{ line(it) | number: '1.0-2' }}</td>
                      <td><button type="button" class="btn btn-sm btn-outline-danger" (click)="removeItem($index)"><i class="bi bi-x-lg"></i></button></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="col-lg-4">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex justify-content-between"><span>Subtotal</span><strong>{{ subtotal() | number: '1.0-2' }}</strong></div>
              <div class="d-flex justify-content-between align-items-center my-2">
                <span>Discount</span>
                <input type="number" min="0" class="form-control form-control-sm text-end" style="width:120px" name="discount" [(ngModel)]="discount" />
              </div>
              <hr class="my-2" />
              <div class="d-flex justify-content-between fs-5"><span>Total</span><strong>{{ total() | number: '1.0-2' }}</strong></div>

              <hr />
              <div class="fw-semibold mb-2">Payment received now</div>
              <div class="input-group mb-2">
                <input type="number" min="0" class="form-control" name="pay" [(ngModel)]="payAmount" placeholder="0" />
                <button type="button" class="btn btn-outline-secondary" (click)="payAmount = total()">Full</button>
              </div>
              <select class="form-select mb-2" name="method" [(ngModel)]="method">
                @for (m of methods; track m) { <option [value]="m" class="text-capitalize">{{ m }}</option> }
              </select>
              <div class="d-flex justify-content-between text-muted small"><span>Balance after payment</span><strong [class.text-danger]="balance() > 0">{{ balance() | number: '1.0-2' }}</strong></div>

              <textarea class="form-control mt-3" rows="2" name="notes" [(ngModel)]="notes" placeholder="Notes (optional)"></textarea>
              <button class="btn btn-primary w-100 mt-3" [disabled]="saving()">Create invoice</button>
            </div>
          </div>
        </div>
      </div>
    </form>
  `,
})
export class InvoiceFormComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  patient: PatientRef | null = null;
  visit = signal<Visit | null>(null);
  fee = signal(0);
  existingBill = signal<Invoice | null>(null);
  items: InvoiceItem[] = [{ description: '', type: 'consultation', qty: 1, rate: 0 }];
  itemTypes = ITEM_TYPES;
  discount = 0;
  payAmount = 0;
  method = 'cash';
  notes = '';
  methods = PAY_METHODS;
  error = signal('');
  saving = signal(false);

  private visitId = '';

  ngOnInit() {
    const q = this.route.snapshot.queryParamMap;
    const pid = q.get('patientId');
    this.visitId = q.get('visitId') ?? '';
    if (pid) this.http.get<PatientRef>(`${API}/patients/${pid}`).subscribe((p) => (this.patient = p));
    if (this.visitId) {
      this.http.get<Invoice[]>(`${API}/invoices`, { params: { visitId: this.visitId } }).subscribe((l) => this.existingBill.set(l[0] ?? null));
    }
    if (this.visitId && this.auth.has('opd.view')) {
      this.http.get<Visit>(`${API}/visits/${this.visitId}`).subscribe((v) => {
        this.visit.set(v);
        this.patient = this.patient ?? v.patientId;
        this.fee.set(v.doctorId?.consultationFee ?? 0);
        if (this.fee() > 0) {
          this.items = [{ description: `Consultation — ${v.doctorId?.name}`, type: 'consultation', qty: 1, rate: this.fee() }];
        }
      });
    }
  }

  line = (i: InvoiceItem) => Math.round((Number(i.qty) || 0) * (Number(i.rate) || 0) * 100) / 100;
  subtotal = () => this.items.reduce((s, i) => s + this.line(i), 0);
  total = () => Math.max(this.subtotal() - Math.min(Math.max(Number(this.discount) || 0, 0), this.subtotal()), 0);
  balance = () => Math.max(this.total() - (Number(this.payAmount) || 0), 0);

  addItem() {
    this.items.push({ description: '', type: 'other', qty: 1, rate: 0 });
  }

  addConsultation() {
    const v = this.visit();
    this.items.push({ description: `Consultation${v ? ' — ' + v.doctorId?.name : ''}`, type: 'consultation', qty: 1, rate: this.fee() });
  }

  removeItem(i: number) {
    this.items.splice(i, 1);
    if (!this.items.length) this.addItem();
  }

  save() {
    this.error.set('');
    if (!this.patient) return this.error.set('Select a patient');
    const items = this.items.filter((i) => i.description.trim());
    if (!items.length) return this.error.set('Add at least one item with a description');
    if ((Number(this.payAmount) || 0) > this.total()) return this.error.set('Payment cannot be more than the total');
    this.saving.set(true);
    this.http
      .post<Invoice>(`${API}/invoices`, {
        patientId: this.patient._id,
        visitId: this.visitId || undefined,
        items,
        discount: Number(this.discount) || 0,
        notes: this.notes || undefined,
        payment: Number(this.payAmount) > 0 ? { amount: Number(this.payAmount), method: this.method } : undefined,
      })
      .subscribe({
        next: (inv) => this.router.navigate(['/billing', inv._id]),
        error: (e) => {
          this.saving.set(false);
          this.error.set(errorMessage(e));
        },
      });
  }
}
