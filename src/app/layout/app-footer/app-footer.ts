import { Component } from '@angular/core';

/**
 * Application footer: brand mark plus the copyright notice, separated from the
 * page content by the divider of the supplied design.
 */
@Component({
  selector: 'app-footer',
  styleUrl: './app-footer.scss',
  templateUrl: './app-footer.html',
})
export class AppFooter {
  /** Current calendar year for the copyright notice. */
  protected readonly year = new Date().getFullYear();
}
