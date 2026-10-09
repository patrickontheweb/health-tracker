# Reading the Angular front end

Start with `frontend/src/app/app.component.html`: the page written as an Angular template. Its companion `app.component.ts` holds state and responds to actions.

1. **Bindings:** `{{ ... }}` displays values; `[disabled]` sets a field's state; `(click)` connects a button to a TypeScript method.
2. **Forms:** `[(ngModel)]="cardio"` keeps an input and the component field in sync. `(ngSubmit)="save()"` handles the form. `FormsModule` enables these features.
3. **Signals:** `selectedDate`, `entries` and `loading` are signals. Calling one reads it; `.set()` changes it. Angular then updates the template. `computed()` derives weekly totals and cards from saved entries.
4. **Control flow:** `@for` renders cards and days. `@if` switches sign-in controls and the first-login password form.
5. **Services:** `HabitsApiService` calls Spring Boot; `AuthService` talks to Cognito; `ConfigService` reads the AWS settings. `inject()` provides these services.
6. **Pure functions:** `habits.ts` contains date boundaries, weekly totals and validation. These are tested independently of Angular and make a useful place to experiment.

This app uses standalone components and Angular's built-in forms and HTTP support. There is no component library or state-management package to learn first.

First, change a label and run `pnpm start` to see it update. Next, change one progress card's target in the component's `cards` definition. Adding a new stored habit requires updating the entry type, API validation, repository and template together.

Official next step: [Angular's first-app tutorial](https://angular.dev/tutorials/first-app).
