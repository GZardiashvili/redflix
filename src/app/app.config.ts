import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { FilterOptionsService } from './core/services/filter-options.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),
    // `/filter-options` is application-wide configuration, so it is loaded once before the
    // app renders and cached by the service for every later consumer.
    provideAppInitializer(() => inject(FilterOptionsService).load()),
  ],
};
