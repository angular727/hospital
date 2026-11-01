import { HttpContext, HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize, tap } from 'rxjs';
import { LoadingService } from './loading.service';

/** Background refreshes (auto-refreshing lists) set this so they do not flash the loading bar. */
export const SILENT = new HttpContextToken<boolean>(() => false);
export const silent = () => new HttpContext().set(SILENT, true);

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);
  const quiet = req.context.get(SILENT);
  if (!quiet) loading.start();

  return next(req).pipe(
    tap({
      next: (e) => {
        if (e instanceof HttpResponse) loading.online.set(true);
      },
      // Status 0 means the browser could not reach the server (offline, DNS, CORS, server down).
      error: (e: HttpErrorResponse) => loading.online.set(e.status !== 0),
    }),
    finalize(() => {
      if (!quiet) loading.end();
    })
  );
};
