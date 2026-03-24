# Import F2 Exclusion (Bulk)

Use this when you have a plain-text extraction of `Appendix F2` and want to refresh
`f2_cc_exclusion.entries` in `config/discharge/exclusion_rules.json`.

## 1) Build normalized payload from text

```bash
node scripts/build-f2-exclusion-from-text.mjs "<path-to-appendix-f2.txt>"
```

This prints JSON to stdout with shape:

- `version`
- `source`
- `entries[]` (`cc_code`, `cc_label`, `principal_exclusions`, optional `same_as`)

## 2) Replace config section

Copy output into:

- `config/discharge/exclusion_rules.json` -> `f2_cc_exclusion`

## 3) Verify

Run:

```bash
npm test
```

Then verify an expected pair in workspace output shows:

- `F2 exclusion: SDx ... may not increase complexity when PDx is ...`

in `warnings` / `DX Coach`.
