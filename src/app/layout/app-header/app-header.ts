import { Component, output } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-header',
  styleUrl: './app-header.scss',
  templateUrl: './app-header.html',
})
export class AppHeader {
  /** The user asked to log in; the application shell owns the dialog. */
  readonly loginRequested = output<void>();

  /** The user asked to register; the application shell owns the dialog. */
  readonly registerRequested = output<void>();
}
