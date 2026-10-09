import { Component, input, output } from '@angular/core';
import { HorizontalWheelScroll } from '../../../../shared/utils/horizontal-wheel-scroll.directive';
import { SessionDateOption, upcomingDateOptions } from '../../session-date';

/**
 * Horizontal seven-day picker for the Sessions sidebar.
 *
 * The list always starts on today and is built from local date parts, so the
 * emitted value is the local calendar day and never shifts across UTC midnight.
 * Selection is owned by the parent page: this component renders the `selected`
 * input and emits `dateSelected` when another day is picked.
 */
@Component({
  imports: [HorizontalWheelScroll],
  selector: 'app-date-selector',
  styleUrl: './date-selector.scss',
  templateUrl: './date-selector.html',
})
export class DateSelector {
  /** Currently highlighted day (`YYYY-MM-DD`), owned by the parent page. */
  readonly selected = input.required<string>();

  /** Emitted with the local `YYYY-MM-DD` of the day the user picked. */
  readonly dateSelected = output<string>();

  /** The seven days offered, starting today. */
  protected readonly options: SessionDateOption[] = upcomingDateOptions();
}
