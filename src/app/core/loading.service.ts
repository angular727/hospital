import { Injectable, computed, signal } from '@angular/core';

/**
 * Tracks the requests that are currently in flight so the UI can show that data is loading,
 * that the server is slow (e.g. a cold start) or that it cannot be reached at all.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private count = signal(0);

  /** True while at least one (non-silent) request is running. */
  readonly busy = computed(() => this.count() > 0);
  /** The top progress bar is shown a moment after a request starts, so quick requests do not flicker. */
  readonly bar = signal(false);
  /** A request is taking unusually long. */
  readonly slow = signal(false);
  /** False when the last request could not reach the server at all. */
  readonly online = signal(true);

  private barTimer: any;
  private slowTimer: any;

  start() {
    this.count.update((n) => n + 1);
    if (this.count() === 1) {
      this.barTimer = setTimeout(() => this.bar.set(true), 150);
      this.slowTimer = setTimeout(() => this.slow.set(true), 4000);
    }
  }

  end() {
    this.count.update((n) => Math.max(0, n - 1));
    if (this.count() === 0) {
      clearTimeout(this.barTimer);
      clearTimeout(this.slowTimer);
      this.bar.set(false);
      this.slow.set(false);
    }
  }
}
