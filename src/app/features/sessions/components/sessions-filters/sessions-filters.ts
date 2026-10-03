import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { TimeBand } from '../../../../core/models/filter-options';
import { FilterOptionsService } from '../../../../core/services/filter-options.service';

/** Slugs currently checked, per category, as emitted to the page. */
export interface SessionsFiltersValue {
  venues: string[];
  formats: string[];
  languages: string[];
  bands: string[];
}

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
 * payload. The checked state mirrors the `selection` input (which the page reads
 * from the URL), so external state — including Back/Forward navigation — moves
 * the checkboxes. The component emits only on user interaction, never in reaction
 * to its input, which is what keeps the URL round-trip from looping.
 */
@Component({
  imports: [],
  selector: 'app-sessions-filters',
  styleUrl: './sessions-filters.scss',
  templateUrl: './sessions-filters.html',
})
export class SessionsFilters {
  private readonly filterOptions = inject(FilterOptionsService);

  /** Selection owned by the page; drives the checkboxes. */
  readonly selection = input.required<SessionsFiltersValue>();

  /** Authoritative lists owned by `/filter-options`; empty until the initializer resolves. */
  protected readonly venues = computed(() => this.filterOptions.value()?.venues ?? []);
  protected readonly languages = computed(() => this.filterOptions.value()?.languages ?? []);

  private readonly allFormats = computed(() => this.filterOptions.value()?.formats ?? []);

  /** Time-of-day options with the API label split into its name and time hint. */
  protected readonly bands = computed<BandOption[]>(() =>
    (this.filterOptions.value()?.timeBands ?? []).map(splitBandLabel),
  );

  // Each group mirrors the incoming selection, so a URL change (a click, a shared
  // link or Back/Forward) updates the boxes. `update`/`set` still apply a click
  // immediately; the page echoes the same value back through the URL, which is
  // idempotent and therefore emits nothing further.
  protected readonly selectedVenues = linkedSignal(() => this.selection().venues);
  protected readonly selectedLanguages = linkedSignal(() => this.selection().languages);
  protected readonly selectedBands = linkedSignal(() => this.selection().bands);

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
   * Formats mirror the incoming selection, narrowed to what the venues offer: a
   * format the current venues do not play is dropped here, so it can never reach
   * the API — whether it was clicked or restored from the URL.
   */
  protected readonly selectedFormats = linkedSignal({
    source: () => ({ selected: this.selection().formats, available: this.availableFormats() }),
    computation: ({ selected, available }) =>
      selected.filter((slug) => available.some((format) => format.slug === slug)),
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
