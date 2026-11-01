import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { API, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { Prescription } from '../../core/models';
import { ageText } from '../../core/util';

/** A4 prescription with the hospital letterhead. Use the Print button (or Ctrl+P). */
@Component({
  selector: 'app-rx-print',
  imports: [RouterLink],
  template: `
    <div class="no-print d-flex justify-content-between align-items-center mb-3">
      <a [routerLink]="back()" class="text-decoration-none small"><i class="bi bi-arrow-left"></i> Back</a>
      @if (auth.has('prescriptions.print')) {
        <div class="d-flex gap-2">
          <button class="btn btn-outline-dark" (click)="print()"><i class="bi bi-printer me-1"></i>Print</button>
          <button class="btn btn-primary" [disabled]="busy()" (click)="downloadPdf()"><i class="bi bi-file-earmark-pdf me-1"></i>{{ busy() ? 'Creating PDF…' : 'PDF' }}</button>
        </div>
      }
    </div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

    @if (rx(); as r) {
      <div class="print-sheet rx">
        <div class="watermark">{{ hospital()?.name }}</div>

        <div class="head">
          <div class="doc-block">
            <div class="doc-name">{{ r.doctorId?.name }}</div>
            <div class="doc-lines">
              @for (l of headerLines(r); track $index) { <div class="doc-line">{{ l }}</div> }
            </div>
          </div>
          <div class="head-right">
            <div class="dots"><span>Rx No</span><b class="fill text-end" style="padding-right: 28px">{{ r.rxNo }}</b></div>
            <div class="dots"><span>Allergy</span><b class="fill text-danger">{{ r.patientId?.allergies }}</b></div>
          </div>
        </div>
        <div class="rule"></div>

        <div class="info">
          <div class="row-3">
            <div><b>Name:</b> {{ r.patientId?.name }}</div>
            <div><b>MR#:</b> {{ r.patientId?.mrn }}</div>
            <div class="text-end"><b>Age/Sex:</b> <span class="text-capitalize">{{ age(r.patientId) }}{{ r.patientId?.gender ? ' / ' + r.patientId.gender : '' }}</span></div>
          </div>
          <div class="row-3">
            <div><b>Phone:</b> {{ r.patientId?.phone }}</div>
            <div><b>CNIC:</b> {{ r.patientId?.cnic }}</div>
            <div class="text-end"><b>Visit No:</b> {{ r.visitId?.visitNo }} &nbsp; <b>Date:</b> {{ r.date }}</div>
          </div>
        </div>
        <div class="rule"></div>

        @if (vitalsList().length) {
          <div class="vitals">
            @for (v of vitalsList(); track v[0]) { <span><b>{{ v[0] }}:</b> {{ v[1] }}</span> }
          </div>
        }
        <div class="rule thin"></div>

        <div class="body-grid">
          <div class="left">
            <div class="rx-title">Prescription</div>
            <div class="field"><b>Diagnosis:</b> <span>{{ r.visitId?.diagnosis }}</span></div>
            <div class="field"><b>Complaint:</b> <span>{{ r.visitId?.complaint }}</span></div>
            <div class="field"><b>Investigations:</b> <span>{{ r.tests }}</span></div>
            <div class="field"><b>Advice:</b> <span>{{ r.advice }}</span></div>
          </div>
          <div class="right">
            <table class="meds">
              <thead><tr><th style="width:44%">Medicine</th><th>Instructions</th></tr></thead>
              <tbody>
                @for (i of r.items; track $index) {
                  <tr>
                    <td class="m-name">{{ i.medicine }}</td>
                    <td class="m-ins">
                      {{ doseLine(i) }}@if (i.duration || i.instructions) { <span class="small-ins"> · {{ noteLine(i) }}</span> }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="2" class="text-muted">No medicines</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="foot">
          @if (r.visitId?.followUpDate) { <div class="follow">Recommended follow-up Appointment Date: {{ r.visitId.followUpDate }}</div> }
          <div class="nvc"><span>Not valid for court.</span><i></i></div>
          <div class="foot-grid">
            <div class="foot-en">
              @for (l of footerEn(r); track $index) { <div>{{ l }}</div> }
            </div>
            <div class="foot-ur" dir="rtl">
              @for (l of footerUr(r); track $index) { <div>{{ l }}</div> }
            </div>
          </div>
          <div class="rule" style="margin-top: 4px"></div>
        </div>
      </div>
    }
  `,
  styles: `
    .rx { position:relative; min-height:1040px; display:flex; flex-direction:column; overflow:hidden; font-size:11px; color:#111; }
    .watermark { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-35deg); font-size:64px; font-weight:700; color:rgba(0,0,0,.05); white-space:nowrap; pointer-events:none; text-transform:uppercase; }
    .head { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:6px; }
    .doc-block { display:inline-block; }
    .doc-name { font-family:'Times New Roman',Times,serif; font-style:italic; font-weight:700; font-size:27px; color:#222; line-height:1.1; }
    .doc-lines { text-align:left; margin-top:4px; margin-left:108px; }
    .doc-line { font-weight:700; font-size:9.5px; color:#b91c1c; line-height:1.35; }
    .head-right { font-size:8.5px; width:190px; color:#444; }
    .dots { display:flex; gap:4px; margin-bottom:8px; }
    .dots i { flex:1; border-bottom:1px dotted #555; }
    .dots .fill { flex:1; min-height:12px; border-bottom:1px dotted #555; padding:0 4px; font-size:9px; }
    .rule { border-top:1.5px solid #b91c1c; margin:3px 0; }
    .rule.thin { border-top-width:1px; }
    .info { font-size:9px; }
    .row-3 { display:grid; grid-template-columns:1.5fr 1fr 1.4fr; gap:8px; padding:3px 0; }
    .row-3 b { color:#111; }
    .vitals { display:flex; justify-content:space-between; gap:6px; border:1px solid #aaa; padding:5px 10px; font-size:8px; margin:7px 0; }
    .body-grid { display:grid; grid-template-columns:24% 1fr; flex:1; margin-top:6px; }
    .left { padding-right:8px; border-right:1px solid #bbb; }
    .right { padding-left:8px; }
    .rx-title { font-weight:700; text-decoration:underline; font-size:12px; margin-bottom:8px; }
    .field { margin-bottom:7px; font-size:8px; line-height:1.5; }
    .field b { color:#4a1530; font-size:9.5px; }
    .field span { white-space:pre-wrap; }
    .meds { width:100%; border-collapse:collapse; }
    .meds th { background:#0b5d57; color:#fff; text-align:center; font-size:8px; padding:4px 6px; border:1px solid #0b5d57; }
    .meds td { border:1px solid #c4c4c4; padding:4px 6px; vertical-align:middle; }
    .m-name { font-weight:700; font-size:11.5px; }
    .m-ins { text-align:right; font-size:9px; color:#444; }
    .small-ins { font-size:7.5px; color:#666; }
    .foot { margin-top:22px; }
    .follow { text-align:right; font-size:8px; font-weight:700; text-decoration:underline dotted; margin-bottom:3px; }
    .nvc { display:flex; align-items:center; gap:6px; font-size:7px; color:#333; }
    .nvc i { flex:1; border-top:1px solid #b91c1c; }
    @media print { .rx { min-height: 255mm; } }
    .foot-grid { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding-top:2px; }
    .foot-en { font-size:7.5px; color:#333; }
    .foot-ur { font-family:'Noto Nastaliq Urdu',serif; font-size:11px; line-height:2.1; color:#8a1c1c; text-align:right; }
  `,
})
export class RxPrintComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  auth = inject(AuthService);

  rx = signal<Prescription | null>(null);
  error = signal('');
  busy = signal(false);

  age = ageText;
  hospital = () => this.auth.me()?.hospital;
  back = () => (this.rx() ? ['/opd', this.rx()!.visitId?._id ?? ''] : ['/patients']);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    // Opened from the consultation's Print / PDF buttons: do it straight away, then return to the visit.
    const auto = this.route.snapshot.queryParamMap.get('auto');
    this.http.get<Prescription>(`${API}/prescriptions/${id}`).subscribe({
      next: (r) => {
        this.rx.set(r);
        if (auto && this.auth.has('prescriptions.print')) {
          setTimeout(async () => {
            if (auto === 'pdf') await this.downloadPdf();
            else this.print();
            window.history.back();
          }, 500);
        }
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  /** Builds an A4 PDF of the prescription and downloads it (no print dialog needed). */
  async downloadPdf() {
    const r = this.rx();
    const sheet = document.querySelector('.print-sheet') as HTMLElement | null;
    if (!r || !sheet) return;
    this.busy.set(true);
    try {
      const mod: any = await import('html2pdf.js');
      const html2pdf = mod.default ?? mod;
      const patient = String(r.patientId?.name || 'patient').replace(/[^\w]+/g, '_');
      await html2pdf()
        .set({
          margin: 8,
          filename: `Prescription-${r.rxNo}-${patient}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(sheet)
        .save();
    } catch {
      this.error.set('Could not create the PDF. Use Print and choose "Save as PDF".');
    } finally {
      this.busy.set(false);
    }
  }

  /** Recorded vitals as [label, value] pairs. */
  vitalsList(): [string, string][] {
    const v = this.rx()?.visitId?.vitals;
    if (!v) return [];
    const out: [string, string][] = [];
    if (v.bp) out.push(['BP', String(v.bp)]);
    if (v.pulse) out.push(['Heart Rate', String(v.pulse)]);
    if (v.temperature) out.push(['Temperature', `${v.temperature}`]);
    if (v.spo2) out.push(['O2 Sat', `${v.spo2}`]);
    if (v.weight) out.push(['Weight', `${v.weight}`]);
    if (v.sugar) out.push(['Sugar', `${v.sugar}`]);
    return out;
  }

  private lines = (s?: string) => String(s ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

  /** The doctor's own header lines; falls back to qualification, specialization and registration number. */
  headerLines(r: Prescription) {
    const d = r.doctorId ?? {};
    const own = this.lines(d.headerLines);
    if (own.length) return own;
    return [d.qualification, d.specialization, d.registrationNo ? `Reg. No: ${d.registrationNo}` : ''].filter(Boolean) as string[];
  }

  /** The doctor's own footer; falls back to the hospital's address and phone. */
  footerEn(r: Prescription) {
    const own = this.lines(r.doctorId?.footerEn);
    if (own.length) return own;
    const c = this.hospital();
    return [c?.name, [c?.address, c?.phone ? 'Ph: ' + c.phone : ''].filter(Boolean).join(' · '), c?.settings?.printFooter].filter(Boolean) as string[];
  }

  footerUr(r: Prescription) {
    return this.lines(r.doctorId?.footerUr);
  }

  noteLine(i: { duration?: string; instructions?: string }) {
    return [i.duration, i.instructions].filter(Boolean).join(' · ');
  }

  /** "1+0+1" becomes "1 tab — 0 — 1": dose followed by the morning / noon / night pattern. */
  doseLine(i: { dose?: string; frequency?: string }) {
    const freq = String(i.frequency ?? '').replace(/\s*\+\s*/g, ' — ');
    return [i.dose, freq].filter(Boolean).join('   ');
  }

  print() {
    window.print();
  }
}
