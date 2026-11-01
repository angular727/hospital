import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AuthService } from './auth.service';

/** Usage: <button *hasPermission="'users.create'">  — hidden unless the user holds that permission. */
@Directive({ selector: '[hasPermission]', standalone: true })
export class HasPermissionDirective {
  private auth = inject(AuthService);
  private tpl = inject(TemplateRef<unknown>);
  private vcr = inject(ViewContainerRef);

  readonly hasPermission = input.required<string>();

  constructor() {
    effect(() => {
      this.auth.me(); // re-evaluate when the profile loads
      this.vcr.clear();
      if (this.auth.has(this.hasPermission())) this.vcr.createEmbeddedView(this.tpl);
    });
  }
}
