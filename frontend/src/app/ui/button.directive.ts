import {Directive, input} from '@angular/core';

/** Shared action buttons. Keep native form, focus, and disabled semantics. */
@Directive({
  selector: 'button[rxButton]',
  standalone: true,
  host: {'class': 'rx-button', '[attr.data-variant]': 'rxButton()'},
})
export class ButtonDirective {
  readonly rxButton = input<'primary' | 'secondary' | 'destructive'>('primary');
}
