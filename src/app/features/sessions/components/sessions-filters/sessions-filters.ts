import { Component, computed, inject, linkedSignal, output, signal } from '@angular/core';
import { Format, TimeBand } from '../../../../core/models/filter-options';
import { FilterOptionsService } from '../../../../core/services/filter-options.service';

/** Slugs currently checked, per category, as emitted to the page. */
export interface SessionsFiltersValue {
  venues: string[];
  formats: string[];
  languages: string[];
  bands: string[];
}

/** Nothing selected: the state the page starts from and `Clear filters` restores. */
export const NO_SESSIONS_FILTERS: SessionsFiltersValue = {
  venues: [],
  formats: [],
  languages: [],
  bands: [],
};

/** A time-of-day option split into its name and its muted time hint. */
interface BandOption {
  id: string;
  name: string;
  hint: string | null;
}

/**
 * Filter sidebar of the Sessions page: venue, format, language and time-of-day
 * checkbox groups plus the clear/counter footer.
 *
 * The lists are never hardcoded — they come from the cached `/filter-options`
 * payload. Selection is local state; every change is emitted through
 * `filtersChanged` and the page decides what to do with it, so this component
 * never talks to the sessions API.
 */
@Component({
  imports: [],
  selector: 'app-sessions-filters',
  styleUrl: './sessions-filters.scss',
  templateUrl: './sessions-filters.html',
})
export class SessionsFilters {
  private readonly filterOptions = inject(FilterOptionsService);

  /** Authoritative lists owned by `/filter-options`; empty until the initializer resolves. */
  protected readonly venues = computed(() => this.filterOptions.value()?.venues ?? []);
  protected readonly languages = computed(() => this.filterOptions.value()?.languages ?? []);

  private readonly allFormats = computed(() => this.filterOptions.value()?.formats ?? []);

  /** Time-of-day options with the API label split into its name and time hint. */
  protected readonly bands = computed<BandOption[]>(() =>
    (this.filterOptions.value()?.timeBands ?? []).map(splitBandLabel),
  );

  protected readonly selectedVenues = signal<string[]>([]);
  protected readonly selectedLanguages = signal<string[]>([]);
  protected readonly selectedBands = signal<string[]>([]);

  /**
   * Formats the current venue selection can actually show: every format while no
   * venue is selected, otherwise only the formats offered by at least one of the
   * selected venues (`venue.formats`).
   */
  protected readonly availableFormats = computed(() => {
    const selected = this.selectedVenues();
    if (selected.length === 0) {
      return this.allFormats();
    }

    const offered = new Set(this.formatSlugsOf(selected));
    return this.allFormats().filter((format) => offered.has(format.slug));
  });

  /**
   * Selected formats, narrowed whenever changing venues removes one: the linked
   * signal keeps only values still offered, so a stale selection can never reach
   * the API.
   */
  protected readonly selectedFormats = linkedSignal<Format[], string[]>({
    source: this.availableFormats,
    computation: (available, previous) =>
      (previous?.value ?? []).filter((slug) => available.some((format) => format.slug === slug)),
  });

  /** Total checked boxes across the four categories. */
  protected readonly activeCount = computed(
    () =>
      this.selectedVenues().length +
      this.selectedFormats().length +
      this.selectedLanguages().length +
      this.selectedBands().length,
  );

  /** Current selection, emitted after every change (and after `Clear filters`). */
  readonly filtersChanged = output<SessionsFiltersValue>();

  protected toggleVenue(slug: string): void {
    this.selectedVenues.update((current) => toggle(current, slug));
    this.emit();
  }

  protected toggleFormat(slug: string): void {
    this.selectedFormats.update((current) => toggle(current, slug));
    this.emit();
  }

  protected toggleLanguage(slug: string): void {
    this.selectedLanguages.update((current) => toggle(current, slug));
    this.emit();
  }

  protected toggleBand(id: string): void {
    this.selectedBands.update((current) => toggle(current, id));
    this.emit();
  }

  /** Resets every checkbox group; the date is owned by the page and is left untouched. */
  protected clearAll(): void {
    this.selectedVenues.set([]);
    this.selectedFormats.set([]);
    this.selectedLanguages.set([]);
    this.selectedBands.set([]);
    this.emit();
  }

  private emit(): void {
    this.filtersChanged.emit({
      venues: [...this.selectedVenues()],
      formats: [...this.selectedFormats()],
      languages: [...this.selectedLanguages()],
      bands: [...this.selectedBands()],
    });
  }

  /** Every format slug offered by the given venues, deduplicated. */
  private formatSlugsOf(venues: string[]): string[] {
    const wanted = new Set(venues);
    const slugs = new Set<string>();

    for (const venue of this.venues()) {
      if (!wanted.has(venue.slug)) {
        continue;
      }

      for (const format of venue.formats) {
        slugs.add(format.slug);
      }
    }

    return [...slugs];
  }
}

/** Adds `value` when absent, removes it when present, returning a new array. */
function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

/** `Morning (before 12:00)` → `{ name: 'Morning', hint: 'before 12:00' }`. */
function splitBandLabel(band: TimeBand): BandOption {
  const match = /^([^(]+?)\s*\((.+)\)$/.exec(band.label);

  return match
    ? { id: band.id, name: match[1], hint: match[2] }
    : { id: band.id, name: band.label, hint: null };
}
