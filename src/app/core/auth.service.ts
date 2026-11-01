import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { switchMap, tap } from 'rxjs';
import { API } from './api';
import { Me } from './models';

const TOKEN_KEY = 'hospital_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly token = signal<string | null>(this.readToken());
  readonly me = signal<Me | null>(null);
  readonly isSuperAdmin = computed(() => !!this.me()?.user.isSuperAdmin);

  private readToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  login(body: { hospitalCode?: string; username: string; password: string }) {
    return this.http.post<{ token: string }>(`${API}/auth/login`, body).pipe(
      tap((r) => {
        try {
          localStorage.setItem(TOKEN_KEY, r.token);
        } catch {}
        this.token.set(r.token);
      }),
      switchMap(() => this.loadMe())
    );
  }

  loadMe() {
    return this.http.get<Me>(`${API}/auth/me`).pipe(tap((m) => this.me.set(m)));
  }

  logout() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    this.token.set(null);
    this.me.set(null);
    this.router.navigate(['/login']);
  }

  /** Layer 1: does the hospital own this module? */
  hasModule(key: string): boolean {
    const me = this.me();
    return !!me && (me.user.isSuperAdmin || me.modules.includes(key));
  }

  /** Layer 2: does the user's role grant this permission? (UI convenience only; the API enforces it.) */
  has(perm: string): boolean {
    const me = this.me();
    return !!me && (me.user.isSuperAdmin || me.permissions.includes(perm));
  }
}
