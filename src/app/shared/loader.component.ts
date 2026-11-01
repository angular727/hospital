import { Component, input } from '@angular/core';

/** A small spinner with text. Usage: <app-loader /> or <app-loader text="Loading patients…" />. */
@Component({
  selector: 'app-loader',
  template: `
    <div class="d-flex align-items-center justify-content-center gap-2 text-muted py-4">
      <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      <span>{{ text() }}</span>
    </div>
  `,
})
export class LoaderComponent {
  text = input('Loading…');
}
