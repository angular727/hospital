import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';

interface Profile {
  name: string;
  code: string;
  phone?: string;
  address?: string;
  tagline?: string;
  printFooter?: string;
  invoicePrefix?: string;
}

@Component({
  selector: 'app-hospital-profile',
  imports: [FormsModule],
  template: `
    <h3 class="mb-3">Hospital profile</h3>
    @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }
    @if (notice()) { <div class="alert alert-success py-2">{{ notice() }}</div> }

    <div class="row">
      <div class="col-lg-7">
        <form class="card border-0 shadow-sm" (ngSubmit)="save()">
          <div class="card-body">
            <p class="text-muted small">These details are printed on prescriptions and receipts.</p>
            <div class="row g-3">
              <div class="col-md-6"><label class="form-label">Hospital name</label><input class="form-control" [value]="p.name" disabled /><div class="form-text">Set by the software administrator.</div></div>
              <div class="col-md-6"><label class="form-label">Phone</label><input class="form-control" name="phone" [(ngModel)]="p.phone" /></div>
              <div class="col-12"><label class="form-label">Address</label><input class="form-control" name="address" [(ngModel)]="p.address" /></div>
              <div class="col-12"><label class="form-label">Tagline</label><input class="form-control" name="tagline" [(ngModel)]="p.tagline" placeholder="e.g. Family &amp; General Healthcare" /></div>
              <div class="col-12"><label class="form-label">Footer text</label><input class="form-control" name="footer" [(ngModel)]="p.printFooter" placeholder="e.g. Open Mon–Sat 9am–9pm · Emergency: 03xx-xxxxxxx" /></div>
              <div class="col-md-4"><label class="form-label">Invoice prefix</label><input class="form-control" name="prefix" [(ngModel)]="p.invoicePrefix" maxlength="8" /><div class="form-text">e.g. INV → INV-000001</div></div>
            </div>
          </div>
          <div class="card-footer bg-white"><button class="btn btn-primary" [disabled]="saving()">Save</button></div>
        </form>
      </div>
    </div>
  `,
})
export class HospitalProfileComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  p: Profile = { name: '', code: '' };
  error = signal('');
  notice = signal('');
  saving = signal(false);

  ngOnInit() {
    this.http.get<Profile>(`${API}/hospital-profile`).subscribe({ next: (p) => (this.p = p), error: (e) => this.error.set(errorMessage(e)) });
  }

  save() {
    this.saving.set(true);
    const { phone, address, tagline, printFooter, invoicePrefix } = this.p;
    this.http.put<Profile>(`${API}/hospital-profile`, { phone, address, tagline, printFooter, invoicePrefix }).subscribe({
      next: (p) => {
        this.p = p;
        this.saving.set(false);
        this.error.set('');
        this.notice.set('Saved');
        setTimeout(() => this.notice.set(''), 3000);
        this.auth.loadMe().subscribe(); // refresh letterhead data
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }
}
