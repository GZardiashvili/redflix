import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';
import { FilterOptionsService } from './core/services/filter-options.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    // `/filter-options` is application-wide configuration, so it is loaded once before the
    // app renders and cached by the service for every later consumer.
    provideAppInitializer(() => inject(FilterOptionsService).load()),
    // A stored token is exchanged for the authoritative user through `/me` before the app
    // renders. Without a token this is a no-op guest startup.
    provideAppInitializer(() => inject(AuthService).restoreSession()),
  ],
};
