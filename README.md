# json-flap-report

Find fields that repeatedly change, disappear, reappear, change type, or return to earlier values across a newline-delimited JSON snapshot history.

## Run from GitHub

```sh
npx --yes github:b69ca/json-flap-report snapshots.jsonl
npx --yes github:b69ca/json-flap-report snapshots.jsonl --state device --time observedAt --ignore /lastSeen --json
```

The package is not currently published to npm. Install it from GitHub with `npm install --global github:b69ca/json-flap-report` if you prefer the shorter `json-flap-report` command.

Each non-empty input line is one complete JSON snapshot. Objects are flattened to JSON Pointer paths; arrays are treated as atomic values so index shifts do not create hundreds of false field changes. Reports include:

- changes and churn rate per field;
- presence across the snapshot history;
- distinct typed states;
- flaps, defined as a field returning to the state it held two transitions earlier;
- an event timeline with optional source timestamps in JSON mode.

Values are represented by 12-character SHA-256 fingerprints rather than copied into reports. This preserves equality and return-to-prior-state detection without casually exposing configuration values. Fingerprints are identifiers, not protection against guessing low-entropy values.

Repeat `--ignore` with JSON Pointer or dotted paths to remove expected noise. `--fail-above N` exits with code 1 when any field changes more than `N` times, making the command usable as a CI stability gate. Invalid input exits 2.

Generic JSON diff tools compare two documents. Schema tools identify structural compatibility. This utility instead summarizes behavior across a history, aimed at captured device state, generated configuration, API polling results, and flaky fixtures.

Zero runtime dependencies, Node.js 20+, MIT licensed.
