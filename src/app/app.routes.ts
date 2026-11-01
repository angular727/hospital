import { Routes } from '@angular/router';
import { accessGuard, authGuard, superAdminGuard } from './core/guards';

// Each feature is lazy-loaded, so a module's code is only fetched when it is opened.
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'account/password', loadComponent: () => import('./pages/account/change-password.component').then((m) => m.ChangePasswordComponent) },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent) },
      {
        path: 'admin/hospitals',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./pages/hospitals/hospitals.component').then((m) => m.HospitalsComponent),
      },

      {
        path: 'reception',
        canActivate: [accessGuard('reception', 'reception.create')],
        loadComponent: () => import('./pages/reception/reception.component').then((m) => m.ReceptionComponent),
      },
      {
        path: 'queue',
        canActivate: [accessGuard('opd', 'opd.view')],
        loadComponent: () => import('./pages/queue/queue.component').then((m) => m.QueueComponent),
      },
      {
        path: 'patients',
        canActivate: [accessGuard('patients', 'patients.view')],
        loadComponent: () => import('./pages/patients/patients.component').then((m) => m.PatientsComponent),
      },
      {
        path: 'patients/:id',
        canActivate: [accessGuard('patients', 'patients.view')],
        loadComponent: () => import('./pages/patients/patient-detail.component').then((m) => m.PatientDetailComponent),
      },
      {
        path: 'appointments',
        canActivate: [accessGuard('appointments', 'appointments.view')],
        loadComponent: () => import('./pages/appointments/appointments.component').then((m) => m.AppointmentsComponent),
      },
      {
        path: 'opd',
        canActivate: [accessGuard('opd', 'opd.view')],
        loadComponent: () => import('./pages/opd/visits.component').then((m) => m.VisitsComponent),
      },
      {
        path: 'visits/:id',
        canActivate: [accessGuard('opd', 'opd.view')],
        loadComponent: () => import('./pages/opd/visit-view.component').then((m) => m.VisitViewComponent),
      },
      {
        path: 'opd/:id',
        canActivate: [accessGuard('opd', 'opd.view')],
        loadComponent: () => import('./pages/opd/visit-detail.component').then((m) => m.VisitDetailComponent),
      },
      {
        path: 'prescriptions/:id/print',
        canActivate: [accessGuard('prescriptions', 'prescriptions.view')],
        loadComponent: () => import('./pages/prescriptions/rx-print.component').then((m) => m.RxPrintComponent),
      },
      {
        path: 'medicines',
        canActivate: [accessGuard('prescriptions', 'prescriptions.create')],
        loadComponent: () => import('./pages/medicines/medicines.component').then((m) => m.MedicinesComponent),
      },
      {
        path: 'billing',
        canActivate: [accessGuard('billing', 'billing.view')],
        loadComponent: () => import('./pages/billing/invoices.component').then((m) => m.InvoicesComponent),
      },
      {
        path: 'billing/new',
        canActivate: [accessGuard('billing', 'billing.create')],
        loadComponent: () => import('./pages/billing/invoice-form.component').then((m) => m.InvoiceFormComponent),
      },
      {
        path: 'billing/:id',
        canActivate: [accessGuard('billing', 'billing.view')],
        loadComponent: () => import('./pages/billing/invoice-detail.component').then((m) => m.InvoiceDetailComponent),
      },
      {
        path: 'lab',
        canActivate: [accessGuard('lab', 'lab.view')],
        loadComponent: () => import('./pages/lab/lab-orders.component').then((m) => m.LabOrdersComponent),
      },
      {
        path: 'emergency',
        canActivate: [accessGuard('emergency', 'emergency.view')],
        loadComponent: () => import('./pages/emergency/emergency.component').then((m) => m.EmergencyComponent),
      },
      {
        path: 'emergency/:id',
        canActivate: [accessGuard('emergency', 'emergency.view')],
        loadComponent: () => import('./pages/emergency/emergency-case.component').then((m) => m.EmergencyCaseComponent),
      },
      {
        path: 'ipd',
        canActivate: [accessGuard('ipd', 'ipd.view')],
        loadComponent: () => import('./pages/ipd/admissions.component').then((m) => m.AdmissionsComponent),
      },
      {
        path: 'ipd-wards',
        canActivate: [accessGuard('ipd', 'ipd.manage')],
        loadComponent: () => import('./pages/ipd/wards.component').then((m) => m.WardsComponent),
      },
      {
        path: 'ipd/:id',
        canActivate: [accessGuard('ipd', 'ipd.view')],
        loadComponent: () => import('./pages/ipd/admission-detail.component').then((m) => m.AdmissionDetailComponent),
      },
      {
        path: 'lab-report',
        canActivate: [accessGuard('lab', 'lab.report')],
        loadComponent: () => import('./pages/lab/lab-report.component').then((m) => m.LabReportComponent),
      },
      {
        path: 'labs',
        canActivate: [accessGuard('lab', 'lab.manage')],
        loadComponent: () => import('./pages/lab/labs.component').then((m) => m.LabsComponent),
      },
      {
        path: 'reception-desks',
        canActivate: [accessGuard('reception', 'reception.manage')],
        loadComponent: () => import('./pages/reception/reception-desks.component').then((m) => m.ReceptionDesksComponent),
      },
      {
        path: 'lab-tests',
        canActivate: [accessGuard('lab', 'lab.edit')],
        loadComponent: () => import('./pages/lab/lab-tests.component').then((m) => m.LabTestsComponent),
      },
      {
        path: 'lab/:id',
        canActivate: [accessGuard('lab', 'lab.view')],
        loadComponent: () => import('./pages/lab/lab-order-detail.component').then((m) => m.LabOrderDetailComponent),
      },
      {
        path: 'reports',
        canActivate: [accessGuard('reports', 'reports.view')],
        loadComponent: () => import('./pages/reports/reports.component').then((m) => m.ReportsComponent),
      },

      {
        path: 'settings/users',
        canActivate: [accessGuard('users', 'users.view')],
        loadComponent: () => import('./pages/users/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'settings/roles',
        canActivate: [accessGuard('users', 'users.view')],
        loadComponent: () => import('./pages/roles/roles.component').then((m) => m.RolesComponent),
      },
      {
        path: 'settings/hospital',
        canActivate: [accessGuard('users', 'users.edit')],
        loadComponent: () => import('./pages/settings/hospital-profile.component').then((m) => m.HospitalProfileComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
