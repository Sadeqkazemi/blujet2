/** Shared alias for `jsonb` columns — matches TypeORM's `Json` type
 * (effectively `unknown`, no compile-time shape) so the migration stays
 * behaviour-neutral. Several columns have documented-but-untyped shapes in
 * service code comments (e.g. `FlightInstance.aiSuggestion`); giving them
 * real interfaces is a follow-up, not part of this mechanical port. */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
