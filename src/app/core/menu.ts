export interface MenuItem {
  label: string;
  icon: string;
  link: string;
  /** Items that share a section become one dropdown group in the sidebar. No section: a plain link. */
  section?: string;
  superAdminOnly?: boolean;
  /** Hospital must own this module (Super Admin controls). */
  module?: string;
  /** Role must grant this permission (Hospital Admin controls). */
  permission?: string;
}

/** Icon shown on each dropdown group. A new section without an entry here gets a folder icon. */
export const GROUP_ICONS: Record<string, string> = {
  'Front desk': 'bi-person-workspace',
  Doctor: 'bi-heart-pulse',
  Laboratory: 'bi-eyedropper',
  Ward: 'bi-hospital',
  Settings: 'bi-gear',
};

// Add one entry here for every new module screen. The sidebar filters it automatically.
// Keep the items of one section next to each other.
export const MENU: MenuItem[] = [
  { label: 'Dashboard', icon: 'bi-speedometer2', link: '/dashboard' },
  { label: 'Hospitals', icon: 'bi-hospital', link: '/admin/hospitals', superAdminOnly: true },

  { label: 'Reception', icon: 'bi-person-plus', link: '/reception', section: 'Front desk', module: 'reception', permission: 'reception.create' },
  { label: 'Patients', icon: 'bi-people', link: '/patients', section: 'Front desk', module: 'patients', permission: 'patients.view' },
  { label: 'Billing', icon: 'bi-receipt', link: '/billing', section: 'Front desk', module: 'billing', permission: 'billing.view' },
  { label: 'Reception desks', icon: 'bi-diagram-2', link: '/reception-desks', section: 'Front desk', module: 'reception', permission: 'reception.manage' },

  { label: 'Pending patients', icon: 'bi-people-fill', link: '/queue', section: 'Doctor', module: 'opd', permission: 'opd.view' },
  { label: 'Visits', icon: 'bi-journal-medical', link: '/opd', section: 'Doctor', module: 'opd', permission: 'opd.view' },
  { label: 'Medicines', icon: 'bi-capsule', link: '/medicines', section: 'Doctor', module: 'prescriptions', permission: 'prescriptions.create' },

  { label: 'Lab orders', icon: 'bi-clipboard2-check', link: '/lab', section: 'Laboratory', module: 'lab', permission: 'lab.view' },
  { label: 'Lab tests', icon: 'bi-clipboard2-pulse', link: '/lab-tests', section: 'Laboratory', module: 'lab', permission: 'lab.edit' },
  { label: 'Lab report', icon: 'bi-graph-up', link: '/lab-report', section: 'Laboratory', module: 'lab', permission: 'lab.report' },
  { label: 'Labs', icon: 'bi-buildings', link: '/labs', section: 'Laboratory', module: 'lab', permission: 'lab.manage' },

  { label: 'Emergency', icon: 'bi-lightning-charge-fill', link: '/emergency', module: 'emergency', permission: 'emergency.view' },

  { label: 'In-patients', icon: 'bi-person-lines-fill', link: '/ipd', section: 'Ward', module: 'ipd', permission: 'ipd.view' },
  { label: 'Wards and beds', icon: 'bi-grid-3x3-gap', link: '/ipd-wards', section: 'Ward', module: 'ipd', permission: 'ipd.manage' },

  { label: 'Reports', icon: 'bi-bar-chart-line', link: '/reports', module: 'reports', permission: 'reports.view' },

  { label: 'Users', icon: 'bi-person-gear', link: '/settings/users', section: 'Settings', module: 'users', permission: 'users.view' },
  { label: 'Roles', icon: 'bi-shield-lock', link: '/settings/roles', section: 'Settings', module: 'users', permission: 'users.view' },
  { label: 'Hospital profile', icon: 'bi-building-gear', link: '/settings/hospital', section: 'Settings', module: 'users', permission: 'users.edit' },
];
