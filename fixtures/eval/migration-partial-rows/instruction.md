The migrator only stamps the first row. Fix `migrate` so every row with `status=legacy` becomes `migrated` and keeps its `id`. Do not rewrite hidden tests.
