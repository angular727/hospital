import { environment } from '../../environments/environment';

export const API = environment.apiUrl;

/** Host of the backend the app is talking to, shown in the sidebar so it is clear where data comes from. */
export const API_HOST = (() => {
  try {
    return new URL(API).host;
  } catch {
    return API;
  }
})();

export const errorMessage = (err: any): string => {
  if (err?.status === 0) return 'Cannot reach the server. Check your internet connection and try again.';
  return err?.error?.message || err?.message || 'Something went wrong';
};
