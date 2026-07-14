/** A single forward-only schema or data migration. */
export type Migration = {
  /** Unique id stored in schema_migrations.name */
  name: string;
  /** Apply migration. Must be safe to run only once; runner never swallows errors. */
  up: () => Promise<void>;
};
