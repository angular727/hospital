import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

/** Must be logged in. Loads profile/modules/permissions on first visit or page refresh. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.token()) return router.createUrlTree(['/login']);
  if (auth.me()) return true;
  return auth.loadMe().pipe(
    map(() => true),
    catchError(() => {
      auth.logout();
      return of(false);
    })
  );
};

export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isSuperAdmin() ? true : inject(Router).createUrlTree(['/dashboard']);
};

/** Route needs a module the hospital owns AND a permission the role grants. */
export const accessGuard =
  (module: string, perm: string): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    return auth.hasModule(module) && auth.has(perm) ? true : inject(Router).createUrlTree(['/dashboard']);
  };
