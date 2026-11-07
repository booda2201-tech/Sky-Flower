import { Routes } from '@angular/router';
import { adminGuard } from './admin/admin-auth.service';
import { HomePageComponent } from './home/home-page.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomePageComponent },
  {
    path: 'order',
    loadComponent: () => import('./checkout/order-page.component').then((m) => m.OrderPageComponent),
  },
  // ---- the shop's admin (demo login, mock data) -------------------------------------------
  {
    path: 'admin/login',
    loadComponent: () => import('./admin/admin-login.component').then((m) => m.AdminLoginComponent),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin/admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./admin/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'orders',
        loadComponent: () => import('./admin/orders-page.component').then((m) => m.OrdersPageComponent),
      },
      {
        path: 'customers',
        loadComponent: () => import('./admin/customers-page.component').then((m) => m.CustomersPageComponent),
      },
      {
        path: 'products',
        loadComponent: () => import('./admin/products-page.component').then((m) => m.ProductsPageComponent),
      },
      {
        path: 'settings',
        loadComponent: () => import('./admin/settings-page.component').then((m) => m.SettingsPageComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
