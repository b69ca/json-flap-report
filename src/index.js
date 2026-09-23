import { createHash } from 'node:crypto';

const typeOf = value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
const escapePointer = value => String(value).replace(/~/g, '~0').replace(/\//g, '~1');
const pointer = parts => parts.length ? `/${parts.map(escapePointer).join('/')}` : '/';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function fingerprint(value) {
  return createHash('sha256').update(canonical(value)).digest('hex').slice(0, 12);
}

export function getPath(value, path) {
  if (!path) return value;
  return path.split('.').reduce((current, key) => current == null ? undefined : current[key], value);
}

export function flatten(value, parts = [], output = new Map()) {
  const type = typeOf(value);
  if (type === 'object' && Object.keys(value).length) {
    for (const key of Object.keys(value).sort()) flatten(value[key], [...parts, key], output);
  } else {
    output.set(pointer(parts), { type, fingerprint: fingerprint(value) });
  }
  return output;
}

function ignored(path, prefixes) {
  return prefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

export function analyze(snapshots, { statePath = '', timePath = '', ignore = [] } = {}) {
  if (!Array.isArray(snapshots) || snapshots.length < 2) throw new Error('at least two snapshots are required');
  const normalizedIgnore = ignore.map(path => path.startsWith('/') ? path : `/${path.split('.').map(escapePointer).join('/')}`);
  const states = snapshots.map((snapshot, index) => {
    const state = getPath(snapshot, statePath);
    if (state === undefined) throw new Error(`snapshot ${index + 1} is missing state path ${statePath}`);
    const fields = flatten(state);
    for (const path of fields.keys()) if (ignored(path, normalizedIgnore)) fields.delete(path);
    return { fields, time: timePath ? getPath(snapshot, timePath) ?? null : null };
  });
  const paths = new Set(states.flatMap(state => [...state.fields.keys()]));
  const fields = [];
  for (const path of paths) {
    const tokens = [], compressed = [], events = [];
    for (let index = 0; index < states.length; index++) {
      const field = states[index].fields.get(path);
      const token = field ? `${field.type}:${field.fingerprint}` : 'missing';
      tokens.push(token);
      if (!compressed.length || compressed.at(-1) !== token) compressed.push(token);
      if (index === 0 || token === tokens[index - 1]) continue;
      const previous = states[index - 1].fields.get(path);
      const kind = !previous ? 'added' : !field ? 'removed' : previous.type !== field.type ? 'type-changed' : 'value-changed';
      events.push({ index, time: states[index].time, kind, from: previous || null, to: field || null });
    }
    let flaps = 0;
    for (let index = 2; index < compressed.length; index++) if (compressed[index] === compressed[index - 2]) flaps++;
    const changes = events.length;
    if (changes) fields.push({ path, changes, flaps, changeRate: changes / (states.length - 1), presentSnapshots: tokens.filter(token => token !== 'missing').length, distinctStates: new Set(tokens).size, events });
  }
  fields.sort((a, b) => b.flaps - a.flaps || b.changes - a.changes || a.path.localeCompare(b.path));
  return {
    snapshotCount: snapshots.length,
    transitionCount: snapshots.length - 1,
    changedFieldCount: fields.length,
    flappingFieldCount: fields.filter(field => field.flaps > 0).length,
    ignored: normalizedIgnore,
    fields
  };
}
