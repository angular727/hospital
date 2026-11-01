import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { API_HOST } from '../core/api';
import { AuthService } from '../core/auth.service';
import { LoadingService } from '../core/loading.service';
import { GROUP_ICONS, MENU, MenuItem } from '../core/menu';

interface NavGroup {
  name: string;
  icon: string;
  items: MenuItem[];
}

/** One sidebar row: a plain link (no section) or a dropdown group (items that share a section). */
interface NavEntry {
  key: string;
  item?: MenuItem;
  group?: NavGroup;
}

const OPEN_KEY = 'sidebar_groups';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="d-flex shell">
      <aside class="sidebar d-flex flex-column d-print-none">
        <div class="brand px-3 py-3">
          <i class="bi bi-heart-pulse-fill me-2"></i>
          <span>{{ auth.me()?.hospital?.name || 'Hospital Manager' }}</span>
        </div>
        <nav class="nav flex-column px-2 flex-grow-1">
          @for (e of entries(); track e.key) {
            @if (e.group; as g) {
              <button type="button" class="nav-link group-btn" [class.has-active]="hasActive(g)" [attr.aria-expanded]="isOpen(g)" (click)="toggle(g)">
                <i class="bi {{ g.icon }} me-2"></i>{{ g.name }}
                <i class="bi bi-chevron-down chev ms-auto" [class.open]="isOpen(g)"></i>
              </button>
              @if (isOpen(g)) {
                <div class="sub">
                  @for (item of g.items; track item.link) {
                    <a class="nav-link sub-link" [routerLink]="item.link" routerLinkActive="active">
                      <i class="bi {{ item.icon }} me-2"></i>{{ item.label }}
                    </a>
                  }
                </div>
              }
            } @else {
              @if (e.item; as item) {
                <a class="nav-link" [routerLink]="item.link" routerLinkActive="active">
                  <i class="bi {{ item.icon }} me-2"></i>{{ item.label }}
                </a>
              }
            }
          }
        </nav>
        <div class="px-3 py-3 small user-box">
          <div class="fw-semibold">{{ auth.me()?.user?.name }}</div>
          <button class="btn btn-sm btn-outline-light mt-2 w-100" (click)="auth.logout()">
            <i class="bi bi-box-arrow-left me-1"></i>Logout
          </button>
        </div>
      </aside>
      <main class="flex-grow-1 p-4">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .shell { min-height: 100vh; }
    .sidebar { width: 240px; flex-shrink: 0; background: #0f4c4c; color: #fff; }
    .brand { font-weight: 700; font-size: 1.05rem; border-bottom: 1px solid rgba(255,255,255,.12); }
    .nav-link { color: rgba(255,255,255,.8); border-radius: .5rem; margin: 2px 0; }
    .nav-link:hover { background: rgba(255,255,255,.08); color: #fff; }
    .nav-link.active { background: #14b8a6; color: #fff; }
    .group-btn { display: flex; align-items: center; width: 100%; background: none; border: 0; text-align: left; font-weight: 600; }
    .group-btn.has-active { color: #fff; }
    .chev { font-size: .75rem; opacity: .7; transition: transform .15s; }
    .chev.open { transform: rotate(180deg); }
    .sub { margin: 0 0 4px 14px; padding-left: 8px; border-left: 1px solid rgba(255,255,255,.15); }
    .sub-link { font-size: .93rem; padding-top: .35rem; padding-bottom: .35rem; }
    .user-box { border-top: 1px solid rgba(255,255,255,.12); }
    .server-line { font-size: .72rem; opacity: .8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #34d399; margin-right: 6px; }
    .dot.busy { background: #fbbf24; animation: pulse 1s infinite; }
    .dot.off { background: #f87171; }
    @keyframes pulse { 50% { opacity: .3; } }
    main { background: #f4f7f7; min-width: 0; }
  `,
})
export class ShellComponent {
  auth = inject(AuthService);
  loading = inject(LoadingService);
  private router = inject(Router);
  apiHost = API_HOST;

  private url = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url }
  );
  /** Groups the person opened or closed by hand. A group with no entry opens by itself while it holds the current page. */
  private opened = signal<Record<string, boolean>>(this.loadOpened());

  /** Item shows only if the hospital owns the module AND the role grants the permission. */
  private visible = computed(() => {
    const me = this.auth.me();
    if (!me) return [];
    return MENU.filter((i) => {
      if (i.superAdminOnly) return me.user.isSuperAdmin;
      if (me.user.isSuperAdmin) return !i.module; // Super Admin has no hospital: only platform screens
      if (i.module && !this.auth.hasModule(i.module)) return false;
      if (i.permission && !this.auth.has(i.permission)) return false;
      return true;
    });
  });

  /** Items without a section stay plain links; items that share a section become one dropdown group. */
  entries = computed<NavEntry[]>(() => {
    const out: NavEntry[] = [];
    const groups = new Map<string, NavGroup>();
    for (const item of this.visible()) {
      if (!item.section) {
        out.push({ key: item.link, item });
        continue;
      }
      let g = groups.get(item.section);
      if (!g) {
        g = { name: item.section, icon: GROUP_ICONS[item.section] ?? 'bi-folder2', items: [] };
        groups.set(item.section, g);
        out.push({ key: 'group:' + item.section, group: g });
      }
      g.items.push(item);
    }
    return out;
  });

  constructor() {
    // Opening a page from anywhere (a button, a link) also opens its group in the sidebar.
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(() => {
      const g = this.entries().find((e) => e.group && this.hasActive(e.group))?.group;
      if (g && this.opened()[g.name] === undefined) this.setOpened(g.name, true);
    });
  }

  hasActive(g: NavGroup): boolean {
    const path = this.url().split('?')[0];
    return g.items.some((i) => path === i.link || path.startsWith(i.link + '/'));
  }

  isOpen(g: NavGroup): boolean {
    const v = this.opened()[g.name];
    return v === undefined ? this.hasActive(g) : v;
  }

  toggle(g: NavGroup) {
    this.setOpened(g.name, !this.isOpen(g));
  }

  private setOpened(name: string, open: boolean) {
    const next = { ...this.opened(), [name]: open };
    this.opened.set(next);
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next));
    } catch {
      /* storage can be blocked: the menu still works for this visit */
    }
  }

  private loadOpened(): Record<string, boolean> {
    try {
      const saved = JSON.parse(localStorage.getItem(OPEN_KEY) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch {
      return {};
    }
  }
}
