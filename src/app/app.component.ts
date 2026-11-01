import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingService } from './core/loading.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <div class="top-loader" [class.on]="loading.bar()"></div>

    @if (!loading.online()) {
      <div class="status-banner offline no-print">
        <i class="bi bi-wifi-off me-2"></i>Cannot reach the server. Check your internet connection, then try again.
      </div>
    } @else if (loading.slow()) {
      <div class="status-banner slow no-print">
        <span class="spinner-border spinner-border-sm me-2"></span>The server is taking longer than usual (it may be waking up). Please wait…
      </div>
    }

    <router-outlet />
  `,
  styles: `
    .top-loader { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 3000; overflow: hidden; opacity: 0; transition: opacity .2s; pointer-events: none; }
    .top-loader.on { opacity: 1; }
    .top-loader::before { content: ''; position: absolute; inset: 0; width: 40%; background: linear-gradient(90deg, transparent, #14b8a6, #0f4c4c, transparent); animation: slide 1s ease-in-out infinite; }
    @keyframes slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(260%); } }
    .status-banner { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 3000; padding: 10px 18px; border-radius: 999px; font-size: .9rem; box-shadow: 0 4px 16px rgba(0,0,0,.2); max-width: 92vw; }
    .status-banner.slow { background: #fff3cd; color: #664d03; }
    .status-banner.offline { background: #f8d7da; color: #58151c; }
  `,
})
export class AppComponent {
  loading = inject(LoadingService);
}
