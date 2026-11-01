import { DecimalPipe } from '@angular/common';
import { Component, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Invoice, Prescription, Visit } from '../core/models';
import { STATUS_CLASS } from '../core/util';

/**
 * Every earlier visit of one patient as an expandable report: complaint, vitals, diagnosis,
 * medicines, advice, tests, follow-up and the bill. Used in the patient profile and in the doctor's consultation.
 */
@Component({
  selector: 'app-visit-history',
  imports: [RouterLink, DecimalPipe],
  template: `
    @for (v of visits(); track v._id) {
      @let rx = rxOf(v._id);
      @let inv = invOf(v._id);
      <div class="border rounded mb-2 bg-white">
        <button type="button" class="w-100 text-start btn btn-light d-flex justify-content-between align-items-center gap-2" (click)="toggle(v._id)">
          <span class="flex-grow-1">
            <strong>{{ v.date }}</strong>
            <span class="text-muted"> · {{ v.doctorId?.name }}</span>
            <span class="badge ms-1" [class]="badge(v.status)">{{ v.status }}</span>
            <span class="ms-2">{{ summary(v, rx) }}</span>
          </span>
          <i class="bi" [class.bi-chevron-down]="!isOpen(v._id)" [class.bi-chevron-up]="isOpen(v._id)"></i>
        </button>

        @if (isOpen(v._id)) {
          <div class="p-3 border-top small">
            @if (vitals(v); as vt) { <div class="mb-2"><span class="badge bg-light text-dark border">{{ vt }}</span></div> }

            <div class="row g-2">
              @if (v.complaint) { <div class="col-md-6"><div class="text-muted">Complaint</div><div>{{ v.complaint }}</div></div> }
              @if (v.history) { <div class="col-md-6"><div class="text-muted">History</div><div>{{ v.history }}</div></div> }
              @if (v.examination) { <div class="col-md-6"><div class="text-muted">Examination</div><div>{{ v.examination }}</div></div> }
              @if (v.diagnosis) { <div class="col-md-6"><div class="text-muted">Diagnosis</div><div class="fw-bold">{{ v.diagnosis }}</div></div> }
              @if (v.notes) { <div class="col-12"><div class="text-muted">Doctor's notes</div><div>{{ v.notes }}</div></div> }
            </div>

            @if (rx; as r) {
              @if (r.items.length) {
                <div class="text-muted mt-3">Medicines <code>{{ r.rxNo }}</code></div>
                <table class="table table-sm mb-1">
                  <thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
                  <tbody>
                    @for (i of r.items; track $index) {
                      <tr><td class="fw-semibold">{{ i.medicine }}</td><td>{{ i.dose }}</td><td>{{ i.frequency }}</td><td>{{ i.duration }}</td><td>{{ i.instructions }}</td></tr>
                    }
                  </tbody>
                </table>
              }
              @if (r.advice) { <div><span class="text-muted">Advice:</span> {{ r.advice }}</div> }
              @if (r.tests) { <div><span class="text-muted">Tests advised:</span> {{ r.tests }}</div> }
            }
            @if (v.followUpDate) { <div><span class="text-muted">Follow-up:</span> {{ v.followUpDate }}</div> }

            @if (!hasContent(v, rx)) { <div class="text-muted fst-italic">No details were recorded for this visit.</div> }

            @if (inv) {
              <div class="mt-2">
                <span class="text-muted">Bill:</span> <code>{{ inv.invoiceNo }}</code> · total {{ inv.total | number: '1.0-0' }}
                · <span class="badge" [class]="badge(inv.status)">{{ inv.status === 'paid' ? 'paid' : 'due ' + (inv.balance | number: '1.0-0') }}</span>
              </div>
            }

            <div class="mt-2 d-flex gap-2">
              @if (rx) { <a class="btn btn-sm btn-outline-dark" [routerLink]="['/prescriptions', rx._id, 'print']"><i class="bi bi-printer me-1"></i>Prescription / PDF</a> }
              @if (links()) { <a class="btn btn-sm btn-outline-primary" [routerLink]="['/opd', v._id]">Open visit</a> }
              @if (inv && billLinks()) { <a class="btn btn-sm btn-outline-primary" [routerLink]="['/billing', inv._id]">Open bill</a> }
            </div>
          </div>
        }
      </div>
    } @empty {
      <div class="text-muted small">{{ emptyText() }}</div>
    }
  `,
})
export class VisitHistoryComponent {
  visits = input<Visit[]>([]);
  prescriptions = input<Prescription[]>([]);
  invoices = input<Invoice[]>([]);
  /** Expand the newest visit by default. */
  openFirst = input(true);
  links = input(true);
  billLinks = input(false);
  emptyText = input('No earlier visits.');

  private expanded = signal<Record<string, boolean>>({});

  badge = (s: string) => `badge ${STATUS_CLASS[s] ?? 'bg-secondary'}`;

  rxOf = (visitId: string): Prescription | undefined => this.prescriptions().find((p) => (p.visitId?._id ?? p.visitId) === visitId);
  invOf = (visitId: string): Invoice | undefined => this.invoices().find((i) => (i.visitId?._id ?? i.visitId) === visitId);

  isOpen(id: string): boolean {
    const set = this.expanded()[id];
    return set ?? (this.openFirst() && this.visits()[0]?._id === id);
  }

  toggle(id: string) {
    const now = this.isOpen(id);
    this.expanded.update((e) => ({ ...e, [id]: !now }));
  }

  summary(v: Visit, rx?: Prescription): string {
    const parts: string[] = [];
    if (v.diagnosis) parts.push(v.diagnosis);
    else if (v.complaint) parts.push(v.complaint);
    if (rx?.items.length) parts.push('💊 ' + rx.items.map((i) => i.medicine).join(', '));
    return parts.join(' — ');
  }

  vitals(v: Visit): string {
    const x = v.vitals;
    if (!x) return '';
    const p: string[] = [];
    if (x.bp) p.push(`BP ${x.bp}`);
    if (x.pulse) p.push(`Pulse ${x.pulse}`);
    if (x.temperature) p.push(`Temp ${x.temperature}°F`);
    if (x.spo2) p.push(`SpO₂ ${x.spo2}%`);
    if (x.weight) p.push(`Weight ${x.weight} kg`);
    if (x.height) p.push(`Height ${x.height} cm`);
    if (x.sugar) p.push(`Sugar ${x.sugar}`);
    return p.join(' · ');
  }

  hasContent(v: Visit, rx?: Prescription): boolean {
    return !!(this.vitals(v) || v.complaint || v.history || v.examination || v.diagnosis || v.notes || v.followUpDate || rx?.items.length || rx?.advice || rx?.tests);
  }
}
