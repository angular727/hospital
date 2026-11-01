import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { LabOrder, LabTest } from '../../core/models';
import { saveBlob } from '../../core/util';

/** The lab tests of one visit: order tests from the checkup screen and read the results and report files here. */
@Component({
  selector: 'app-visit-lab',
  imports: [FormsModule, DecimalPipe],
  template: `
    @if (allowed()) {
      <div class="card border-0 shadow-sm mb-3">
        <div class="card-header bg-white d-flex justify-content-between align-items-center">
          <span class="fw-semibold"><i class="bi bi-eyedropper me-1"></i>Lab tests</span>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-sm btn-outline-secondary" title="Refresh" (click)="load()"><i class="bi bi-arrow-repeat"></i></button>
            @if (!readonly() && auth.has('lab.create')) {
              <button type="button" class="btn btn-sm btn-primary" (click)="openForm()"><i class="bi bi-plus-lg me-1"></i>Order lab tests</button>
            }
          </div>
        </div>
        <div class="card-body">
          @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }
          @for (o of orders(); track o._id) {
            <div class="border rounded p-2 mb-2">
              <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <span><code>{{ o.orderNo }}</code> <span class="badge text-bg-light border ms-1">{{ o.labId?.name }}</span> <span class="text-muted small ms-1">{{ o.day }}</span></span>
                <span class="badge" [class.text-bg-warning]="o.status === 'ordered'" [class.text-bg-success]="o.status === 'completed'" [class.text-bg-secondary]="o.status === 'cancelled'">
                  {{ o.status === 'ordered' ? 'Waiting for result' : o.status === 'completed' ? 'Report ready' : 'Cancelled' }}
                </span>
              </div>
              <div class="table-responsive mt-2">
                <table class="table table-sm align-middle mb-0">
                  <thead class="table-light"><tr><th>Test</th><th>Result</th><th>Unit</th><th>Normal range</th></tr></thead>
                  <tbody>
                    @for (it of o.items; track it._id) {
                      <tr>
                        <td>{{ it.name }}</td>
                        <td [class.fw-semibold]="it.result">{{ it.result || 'Waiting' }}</td>
                        <td>{{ it.unit || '' }}</td>
                        <td>{{ it.normalRange || '' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              @if (o.files?.length) {
                <div class="mt-2 d-flex flex-wrap gap-2">
                  @for (f of o.files; track f._id) {
                    <button type="button" class="btn btn-sm btn-outline-primary" (click)="download(o, f)"><i class="bi bi-paperclip me-1"></i>{{ f.name }}</button>
                  }
                </div>
              }
            </div>
          } @empty {
            <div class="text-muted small">{{ loaded() ? (emergencyId() ? 'No lab tests ordered for this case.' : 'No lab tests ordered for this visit.') : 'Loading…' }}</div>
          }
        </div>
      </div>

      @if (showForm()) {
        <div class="modal d-block modal-backdrop-custom" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <form class="modal-content" (ngSubmit)="save()">
              <div class="modal-header">
                <h5 class="modal-title">Order lab tests</h5>
                <button type="button" class="btn-close" (click)="showForm.set(false)"></button>
              </div>
              <div class="modal-body">
                @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
                <input class="form-control form-control-sm mb-2" placeholder="Search tests" [ngModel]="testQ()" (ngModelChange)="testQ.set($event)" name="tq" />
                <div class="border rounded p-2" style="max-height: 260px; overflow: auto">
                  @for (t of visibleTests(); track t._id) {
                    <div class="form-check d-flex justify-content-between">
                      <span>
                        <input class="form-check-input" type="checkbox" [id]="'vt-' + t._id" [checked]="selected().has(t._id)" (change)="toggle(t._id)" />
                        <label class="form-check-label" [for]="'vt-' + t._id">{{ t.name }} <span class="badge text-bg-light border ms-1">{{ t.labId?.name }}</span> <span class="text-muted small">{{ t.category }}</span></label>
                      </span>
                      <span class="text-muted">{{ t.price | number: '1.0-2' }}</span>
                    </div>
                  } @empty {
                    <div class="text-muted small">{{ tests().length ? 'No test matches your search' : 'No tests in the list yet. Ask the lab or the admin to add them.' }}</div>
                  }
                </div>
                <div class="d-flex justify-content-between mt-2"><span>{{ selected().size }} test(s) selected</span><strong>Total: {{ total() | number: '1.0-2' }}</strong></div>
                @if (labCount() > 1) { <div class="form-text">These tests belong to {{ labCount() }} labs. One order is made for each lab, and each goes to its own lab.</div> }
                @if (auth.has('billing.create')) {
                  <label class="form-label mt-3">Bill</label>
                  <select class="form-select" name="billing" [(ngModel)]="billing">
                    <option value="unpaid">Add to the bill, patient pays later</option>
                    <option value="none">No bill</option>
                  </select>
                }
                <textarea class="form-control mt-3" rows="2" name="notes" [(ngModel)]="notes" placeholder="Notes for the lab (optional)"></textarea>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-light" (click)="showForm.set(false)">Cancel</button>
                <button class="btn btn-primary" [disabled]="saving()">Send to lab</button>
              </div>
            </form>
          </div>
        </div>
      }
    }
  `,
})
export class VisitLabComponent implements OnInit {
  private http = inject(HttpClient);
  auth = inject(AuthService);

  /** The lab card belongs to one visit or to one emergency case. */
  visitId = input('');
  emergencyId = input('');
  patientId = input.required<string>();
  /** Read-only view (a finished visit): results are shown but no new order can be placed. */
  readonly = input(false);

  orders = signal<LabOrder[]>([]);
  loaded = signal(false);
  error = signal('');
  allowed = computed(() => this.auth.has('lab.view') || this.auth.has('lab.create'));

  showForm = signal(false);
  formError = signal('');
  saving = signal(false);
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
  billing = 'unpaid';
  notes = '';

  ngOnInit() {
    this.load();
  }

  load() {
    if (!this.allowed() || !this.auth.has('lab.view')) {
      this.loaded.set(true);
      return;
    }
    this.http.get<LabOrder[]>(`${API}/lab/orders`, { params: this.emergencyId() ? { emergencyId: this.emergencyId() } : { visitId: this.visitId() } }).subscribe({
      next: (list) => {
        // The list has no attached files, so load each order once more to get them.
        (list.length ? forkJoin(list.map((o) => this.http.get<LabOrder>(`${API}/lab/orders/${o._id}`))) : of([] as LabOrder[])).subscribe({
          next: (full) => {
            this.orders.set(full);
            this.loaded.set(true);
            this.error.set('');
          },
          error: (e) => this.error.set(errorMessage(e)),
        });
      },
      error: (e) => {
        this.loaded.set(true);
        this.error.set(errorMessage(e));
      },
    });
  }

  download(o: LabOrder, f: { _id: string; name: string }) {
    this.http.get(`${API}/lab/orders/${o._id}/files/${f._id}`, { responseType: 'blob' }).subscribe({
      next: (blob) => saveBlob(blob, f.name),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  openForm() {
    this.formError.set('');
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
    if (!this.selected().size) return this.formError.set('Select at least one test');
    this.saving.set(true);
    this.http
      .post<{ orders: LabOrder[] }>(`${API}/lab/orders`, {
        patientId: this.patientId(),
        visitId: this.visitId() || undefined,
        emergencyId: this.emergencyId() || undefined,
        testIds: [...this.selected()],
        billing: this.auth.has('billing.create') ? this.billing : 'unpaid',
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
