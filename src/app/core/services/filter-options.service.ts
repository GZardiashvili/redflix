import { HttpClient } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError, toApiError } from '../api/api-error';
import { ApiResponse } from '../api/api-response';
import { API_BASE_URL } from '../config/api.config';
import { FilterOptions } from '../models/filter-options';

/**
 * Application-wide owner of the `/filter-options` configuration.
 *
 * The payload is requested once per application session and cached in memory, so every feature
 * reads the same values instead of issuing its own request or keeping its own copy. Consumers
 * only need {@link value}; caching is an implementation detail.
 */
@Service()
export class FilterOptionsService {
  private readonly http = inject(HttpClient);

  private readonly filterOptions = signal<FilterOptions | null>(null);
  private readonly failure = signal<ApiError | null>(null);
  private pending: Promise<void> | null = null;

  /** Cached filter options, or `null` until they have been loaded successfully. */
  readonly value = this.filterOptions.asReadonly();

  /** Failure of the load, or `null` when it succeeded. Kept for a later global error state. */
  readonly error = this.failure.asReadonly();

  /**
   * Loads `/filter-options`, performing the HTTP request only on the first call: later calls
   * reuse the same pending or settled promise and never issue a second request.
   *
   * A failed load is recorded in {@link error} rather than thrown, because the app initializer
   * awaits this during bootstrap and the shell must still start.
   */
  load(): Promise<void> {
    this.pending ??= this.fetchFilterOptions();

    return this.pending;
  }

  private async fetchFilterOptions(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<FilterOptions>>(`${API_BASE_URL}/filter-options`),
      );

      this.filterOptions.set(response.data);
    } catch (error) {
      this.failure.set(toApiError(error));
    }
  }
}
