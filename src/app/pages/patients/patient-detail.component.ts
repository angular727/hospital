import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { Appointment, Invoice, Patient, Prescription, Visit } from '../../core/models';
import { STATUS_CLASS, ageText } from '../../core/util';
import { LoaderComponent } from '../../shared/loader.component';
import { VisitHistoryComponent } from '../../shared/visit-history.component';

interface History {
  visits: Visit[];
  prescriptions: Prescription[];
  invoices: Invoice[];
  appointments: Appointment[];
}

@Component({
  selector: 'app-patient-detail',
  imports: [RouterLink, CurrencyPipe, VisitHistoryComponent, LoaderComponent],
  template: `
    <a routerLink="/patients" class="text-decoration-none small"><i class="bi bi-arrow-left"></i> Patients</a>
    @if (error()) { <div class="alert alert-danger py-2 mt-2">{{ error() }}</div> }
    @if (!patient() && !error()) { <app-loader text="Loading patient…" /> }

    @if (patient(); as p) {
      <div class="card border-0 shadow-sm my-3">
        <div class="card-body">
          <div class="d-flex justify-content-between flex-wrap gap-3">
            <div>
              <h4 class="mb-1">{{ p.name }} <small class="text-muted fs-6">{{ p.mrn }}</small></h4>
              <div class="text-muted text-capitalize">{{ p.gender }}{{ age(p) ? ' · ' + age(p) : '' }}{{ p.bloodGroup ? ' · ' + p.bloodGroup : '' }}</div>
              <div class="mt-2 small">
                @if (p.phone) { <span class="me-3"><i class="bi bi-telephone"></i> {{ p.phone }}</span> }
                @if (p.cnic) { <span class="me-3"><i class="bi bi-card-text"></i> {{ p.cnic }}</span> }
                @if (p.address || p.city) { <span><i class="bi bi-geo-alt"></i> {{ addr(p) }}</span> }
              </div>
              @if (p.fatherName) { <div class="small text-muted">S/D/W of {{ p.fatherName }}</div> }
              @if (p.emergencyName || p.emergencyPhone) { <div class="small text-muted">Emergency: {{ p.emergencyName }} {{ p.emergencyPhone }}</div> }
            </div>
            <div class="d-flex gap-2 align-items-start flex-wrap">
              @if (auth.hasModule('reception') && auth.has('reception.create')) {
                <button class="btn btn-primary" (click)="go('/reception', { patientId: p._id })"><i class="bi bi-person-plus me-1"></i>New check-in</button>
              }
              @if (auth.hasModule('billing') && auth.has('billing.create')) {
                <button class="btn btn-outline-primary" (click)="go('/billing/new', { patientId: p._id })"><i class="bi bi-receipt me-1"></i>New bill</button>
              }
            </div>
          </div>
          @if (p.allergies) { <div class="alert alert-danger py-2 mt-3 mb-0"><i class="bi bi-exclamation-triangle-fill me-1"></i><strong>Allergies:</strong> {{ p.allergies }}</div> }
          @if (p.chronicConditions) { <div class="alert alert-warning py-2 mt-2 mb-0"><strong>Chronic conditions:</strong> {{ p.chronicConditions }}</div> }
          @if (p.notes) { <div class="small text-muted mt-2">{{ p.notes }}</div> }
        </div>
      </div>

      @if (history(); as h) {
        <ul class="nav nav-tabs mb-3">
          @for (t of tabs(h); track t.key) {
            <li class="nav-item"><button class="nav-link" [class.active]="tab() === t.key" (click)="tab.set(t.key)">{{ t.label }} <span class="badge bg-secondary">{{ t.count }}</span></button></li>
          }
        </ul>

        <div class="card border-0 shadow-sm">
          <div class="table-responsive">
            @switch (tab()) {
              @case ('visits') {
                <div class="p-3">
                  <app-visit-history [visits]="h.visits" [prescriptions]="h.prescriptions" [invoices]="h.invoices" [billLinks]="true" emptyText="No visits yet" />
                </div>
              }
              @case ('prescriptions') {
                <table class="table table-hover mb-0">
                  <thead class="table-light"><tr><th>Rx</th><th>Date</th><th>Doctor</th><th>Medicines</th><th></th></tr></thead>
                  <tbody>
                    @for (r of h.prescriptions; track r._id) {
                      <tr><td><code>{{ r.rxNo }}</code></td><td>{{ r.date }}</td><td>{{ r.doctorId?.name }}</td><td>{{ names(r) }}</td>
                        <td class="text-end"><a class="btn btn-sm btn-outline-primary" [routerLink]="['/prescriptions', r._id, 'print']">View / print</a></td></tr>
                    } @empty { <tr><td colspan="5" class="text-center text-muted py-4">No prescriptions yet</td></tr> }
                  </tbody>
                </table>
              }
              @case ('invoices') {
                <table class="table table-hover mb-0">
                  <thead class="table-light"><tr><th>Invoice</th><th>Date</th><th class="text-end">Total</th><th class="text-end">Paid</th><th class="text-end">Balance</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    @for (i of h.invoices; track i._id) {
                      <tr><td><code>{{ i.invoiceNo }}</code></td><td>{{ i.day }}</td><td class="text-end">{{ i.total | currency: 'PKR ' : 'symbol' : '1.0-0' }}</td><td class="text-end">{{ i.paid | currency: 'PKR ' : 'symbol' : '1.0-0' }}</td><td class="text-end">{{ i.balance | currency: 'PKR ' : 'symbol' : '1.0-0' }}</td>
                        <td><span class="badge" [class]="badge(i.status)">{{ i.status }}</span></td>
                        <td class="text-end"><a class="btn btn-sm btn-outline-primary" [routerLink]="['/billing', i._id]">Open</a></td></tr>
                    } @empty { <tr><td colspan="7" class="text-center text-muted py-4">No invoices yet</td></tr> }
                  </tbody>
                </table>
              }
              @case ('appointments') {
                <table class="table mb-0">
                  <thead class="table-light"><tr><th>Date</th><th>Time</th><th>Token</th><th>Doctor</th><th>Reason</th><th>Status</th></tr></thead>
                  <tbody>
                    @for (a of h.appointments; track a._id) {
                      <tr><td>{{ a.date }}</td><td>{{ a.time || '—' }}</td><td>#{{ a.token }}</td><td>{{ a.doctorId.name }}</td><td>{{ a.reason || '—' }}</td><td><span class="badge" [class]="badge(a.status)">{{ a.status }}</span></td></tr>
                    } @empty { <tr><td colspan="6" class="text-center text-muted py-4">No appointments</td></tr> }
                  </tbody>
                </table>
              }
            }
          </div>
        </div>
      }
    }
  `,
})
export class PatientDetailComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  auth = inject(AuthService);

  patient = signal<Patient | null>(null);
  history = signal<History | null>(null);
  tab = signal('visits');
  error = signal('');

  age = ageText;
  addr = (p: Patient) => [p.address, p.city].filter((x) => x).join(", ");
  badge = (s: string) => `badge ${STATUS_CLASS[s] ?? 'bg-secondary'}`;
  names = (r: Prescription) => r.items.map((i) => i.medicine).join(', ');

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.http.get<Patient>(`${API}/patients/${id}`).subscribe({
      next: (p) => this.patient.set(p),
      error: (e) => this.error.set(errorMessage(e)),
    });
    this.http.get<History>(`${API}/patients/${id}/history`).subscribe({
      next: (h) => this.history.set(h),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  /** Only tabs the user is allowed to see (the API returns empty lists for the rest). */
  tabs(h: History) {
    const all = [
      { key: 'visits', label: 'Visits', count: h.visits.length, show: this.auth.hasModule('opd') && this.auth.has('opd.view') },
      { key: 'prescriptions', label: 'Prescriptions', count: h.prescriptions.length, show: this.auth.hasModule('prescriptions') && this.auth.has('prescriptions.view') },
      { key: 'invoices', label: 'Bills', count: h.invoices.length, show: this.auth.hasModule('billing') && this.auth.has('billing.view') },
      { key: 'appointments', label: 'Appointments', count: h.appointments.length, show: this.auth.hasModule('appointments') && this.auth.has('appointments.view') },
    ].filter((t) => t.show);
    if (all.length && !all.some((t) => t.key === this.tab())) setTimeout(() => this.tab.set(all[0].key));
    return all;
  }

  go(path: string, queryParams: Record<string, string>) {
    this.router.navigate([path], { queryParams });
  }
}
