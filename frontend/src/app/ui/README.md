# Action buttons

Use native buttons with `rxButton="primary"`, `rxButton="secondary"`, or
`rxButton="destructive"`. Import `ButtonDirective` in the standalone component.
Always supply `type="button"` or `type="submit"` explicitly.

- Primary: the main action, such as saving or signing in.
- Secondary: supporting actions, such as canceling, exporting, or logging out.
- Destructive: deleting or irreversibly discarding data. The variant supplies
  appearance only; the feature must implement any required confirmation.

Appearance and interaction states live in `buttons.css`. For example, set
`--rx-button-primary-radius: 0` there to square all primary buttons.
Page styles should control only placement and width, not button appearance.
Calendar cells, habit toggles, disclosure controls, and menu items are separate
interaction patterns and do not use these action variants.
