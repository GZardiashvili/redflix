import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
  },
  {
    path: 'sessions',
    loadComponent: () => import('./features/sessions/sessions-page').then((m) => m.SessionsPage),
  },
  {
    path: 'movies/:slug',
    loadComponent: () =>
      import('./features/movie-details/movie-details-page').then((m) => m.MovieDetailsPage),
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile-page').then((m) => m.ProfilePage),
  },
];
