#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { analyze } from './index.js';

const args = process.argv.slice(2);
const valueAfter = (name, fallback = undefined) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
const optionValues = name => args.flatMap((value, index) => value === name ? [args[index + 1]] : []);
const optionNames = new Set(['--state', '--time', '--ignore', '--top', '--fail-above']);
const file = args.find((value, index) => !value.startsWith('--') && !optionNames.has(args[index - 1]));

if (!file || args.includes('--help')) {
  console.log('Usage: json-flap-report FILE.jsonl [--state PATH] [--time PATH] [--ignore PATH]... [--top N] [--fail-above N] [--json]');
  process.exit(file ? 0 : 2);
}

try {
  const input = file === '-' ? process.stdin : createReadStream(file);
  const lines = createInterface({ input, crlfDelay: Infinity });
  const snapshots = [];
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber++;
    if (!line.trim()) continue;
    try { snapshots.push(JSON.parse(line)); }
    catch (error) { throw new Error(`line ${lineNumber}: ${error.message}`); }
  }
  const report = analyze(snapshots, { statePath: valueAfter('--state', ''), timePath: valueAfter('--time', ''), ignore: optionValues('--ignore') });
  const top = Number(valueAfter('--top', 20));
  if (!Number.isInteger(top) || top < 1) throw new Error('--top must be a positive integer');
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`${report.snapshotCount} snapshots, ${report.transitionCount} transitions, ${report.changedFieldCount} changed field(s), ${report.flappingFieldCount} flapping field(s)`);
    for (const field of report.fields.slice(0, top)) console.log(`${field.path}\t${field.changes} changes\t${field.flaps} flaps\t${(field.changeRate * 100).toFixed(1)}% churn\t${field.presentSnapshots}/${report.snapshotCount} present`);
  }
  if (args.includes('--fail-above')) {
    const limit = Number(valueAfter('--fail-above'));
    if (!Number.isInteger(limit) || limit < 0) throw new Error('--fail-above must be a non-negative integer');
    if (report.fields.some(field => field.changes > limit)) process.exitCode = 1;
  }
} catch (error) {
  console.error(`json-flap-report: ${error.message}`);
  process.exitCode = 2;
}
