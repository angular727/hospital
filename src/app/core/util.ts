/** Local calendar day as YYYY-MM-DD (the hospital's day). */
export const today = (offsetDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Copies text to the clipboard. Falls back to the old method when the browser blocks the modern one. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* try the fallback below */
  }
  try {
    const box = document.createElement('textarea');
    box.value = text;
    box.style.position = 'fixed';
    box.style.opacity = '0';
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(box);
    return ok;
  } catch {
    return false;
  }
}

/** Add (or subtract) days to a YYYY-MM-DD string. */
export const addDays = (day: string, n: number): string => {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

export const ageText = (p: { age?: number | null; dob?: string | null } | null | undefined): string => {
  if (!p) return '';
  if (p.dob) {
    const b = new Date(p.dob);
    const now = new Date();
    let y = now.getFullYear() - b.getFullYear();
    if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) y--;
    return y >= 0 ? `${y} y` : '';
  }
  return p.age || p.age === 0 ? `${p.age} y` : '';
};

export const STATUS_CLASS: Record<string, string> = {
  scheduled: 'bg-secondary',
  waiting: 'bg-warning text-dark',
  'in-consultation': 'bg-info text-dark',
  completed: 'bg-success',
  cancelled: 'bg-danger',
  'no-show': 'bg-dark',
  open: 'bg-info text-dark',
  unpaid: 'bg-danger',
  partial: 'bg-warning text-dark',
  paid: 'bg-success',
};

export const PAY_METHODS = ['cash', 'card', 'online', 'insurance', 'other'];

export const FREQUENCIES = ['1+0+0', '0+1+0', '0+0+1', '1+0+1', '1+1+1', '1+1+1+1', 'SOS', 'Stat'];
export const DURATIONS = ['3 days', '5 days', '7 days', '10 days', '14 days', '1 month', 'Continue'];

/** What a bill line is for. The bill stays the same for every department; each module adds its own type. */
export const ITEM_TYPES: { value: string; label: string }[] = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'lab', label: 'Lab' },
  { value: 'medicine', label: 'Medicine' },
  { value: 'bed', label: 'Bed / ward' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'other', label: 'Other' },
];

/** Saves a downloaded file (a Blob) to the computer, or opens it when the browser can show it. */
export const saveBlob = (blob: Blob, name: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
