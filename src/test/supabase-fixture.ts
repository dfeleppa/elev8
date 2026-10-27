// Small stateful database fixture for route regressions. Queries apply filters,
// ordering and pagination to rows so tests exercise outcomes, not call counts.
export type FixtureRow = Record<string, unknown>;
export function createDatabaseFixture(initial: Record<string, FixtureRow[]>) {
  const tables = structuredClone(initial);
  let beforeUpdate: (() => void) | undefined;
  let failure: string | null = null;
  class Query {
    private filters: Array<(row: FixtureRow) => boolean> = [];
    private orders: Array<{ key: string; ascending: boolean; nullsFirst: boolean }> = [];
    private bounds: [number, number] | undefined;
    private patch: FixtureRow | undefined;
    private inserts: FixtureRow[] | undefined;
    constructor(private table: string) {}
    select() { return this; }
    eq(key: string, value: unknown) { this.filters.push(row => row[key] === value); return this; }
    neq(key: string, value: unknown) { this.filters.push(row => row[key] !== value); return this; }
    lte(key: string, value: string) { this.filters.push(row => typeof row[key] === "string" && row[key] <= value); return this; }
    order(key: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}) {
      this.orders.push({ key, ascending: options.ascending ?? true, nullsFirst: options.nullsFirst ?? !(options.ascending ?? true) });
      return this;
    }
    range(start: number, end: number) { this.bounds = [start, end]; return this; }
    limit(count: number) { return this.range(0, count - 1); }
    update(patch: FixtureRow) { this.patch = patch; return this; }
    insert(rows: FixtureRow | FixtureRow[]) { this.inserts = Array.isArray(rows) ? rows : [rows]; return this; }
    private async execute(single = false) {
      if (failure) return { data: null, error: { message: failure } };
      const table = tables[this.table] ??= [];
      if (this.patch) { beforeUpdate?.(); beforeUpdate = undefined; }
      let rows = table.filter(row => this.filters.every(filter => filter(row)));
      if (this.patch) rows.forEach(row => Object.assign(row, this.patch));
      if (this.inserts) {
        rows = this.inserts.map(row => ({ id: `fixture-${table.length + 1}`, role: "member", ...row }));
        table.push(...rows);
      }
      rows = [...rows].sort((a, b) => {
        for (const { key, ascending, nullsFirst } of this.orders) {
          const av = a[key], bv = b[key];
          if (av === bv) continue;
          if (av == null) return nullsFirst ? -1 : 1;
          if (bv == null) return nullsFirst ? 1 : -1;
          const comparison = String(av).localeCompare(String(bv));
          if (comparison) return ascending ? comparison : -comparison;
        }
        return 0;
      });
      if (this.bounds) rows = rows.slice(this.bounds[0], this.bounds[1] + 1);
      return { data: single ? rows[0] ?? null : rows, error: null };
    }
    maybeSingle() { return this.execute(true); }
    single() { return this.execute(true); }
    then<TResult1 = Awaited<ReturnType<Query["execute"]>>, TResult2 = never>(
      fulfilled?: ((value: Awaited<ReturnType<Query["execute"]>>) => TResult1 | PromiseLike<TResult1>) | null,
      rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) { return this.execute().then(fulfilled, rejected); }
  }
  return {
    tables,
    from: (table: string) => new Query(table),
    beforeUpdate: (callback: () => void) => { beforeUpdate = callback; },
    fail: (message: string) => { failure = message; },
  };
}
