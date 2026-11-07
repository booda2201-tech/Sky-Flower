import { Injectable, signal } from '@angular/core';
import { Occasion } from '../data/flower-data';

/** Which occasion the catalogue is filtered to; shared by the occasion cards and the showcase. */
@Injectable({ providedIn: 'root' })
export class OccasionService {
  readonly selected = signal<Occasion | 'All'>('All');

  select(id: Occasion | 'All'): void {
    this.selected.set(id);
  }
}
