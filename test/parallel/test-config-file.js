'use strict';

const {
  isWindows,
  spawnPromisified,
  skipIfSQLiteMissing,
} = require('../common');
skipIfSQLiteMissing();
const fixtures = require('../common/fixtures');
const tmpdir = require('../common/tmpdir');
const { match, strictEqual, deepStrictEqual } = require('node:assert');
const { test, it, describe } = require('node:test');
const { chmodSync, writeFileSync, constants } = require('node:fs');
const { join } = require('node:path');

test('should handle non existing json', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--experimental-config-file',
    'i-do-not-exist.json',
    '-p', '"Hello, World!"',
  ]);
  match(result.stderr, /Cannot read configuration from i-do-not-exist\.json: no such file or directory/);
  match(result.stderr, /i-do-not-exist\.json: not found/);
  strictEqual(result.stdout, '');
  strictEqual(result.code, 9);
});

test('should handle empty json', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--experimental-config-file',
    fixtures.path('rc/empty.json'),
    '-p', '"Hello, World!"',
  ]);
  match(result.stderr, /Can't parse/);
  match(result.stderr, /empty\.json: invalid content/);
  strictEqual(result.stdout, '');
  strictEqual(result.code, 9);
});

test('should handle empty object json', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/empty-object.json'),
    '-p', '"Hello, World!"',
  ]);
  strictEqual(result.stderr, '');
  match(result.stdout, /Hello, World!/);
  strictEqual(result.code, 0);
});

test('should parse boolean flag', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--experimental-config-file',
    fixtures.path('rc/transform-types.json'),
    fixtures.path('typescript/ts/transformation/test-enum.ts'),
  ]);
  match(result.stderr, /--experimental-config-file is an experimental feature and might change at any time/);
  match(result.stdout, /Hello, TypeScript!/);
  strictEqual(result.code, 0);
});

test('should parse boolean flag defaulted to true', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--experimental-config-file',
    fixtures.path('rc/warnings-false.json'),
    '-p', 'process.emitWarning("A warning")',
  ]);
  strictEqual(result.stderr, '');
  strictEqual(result.stdout, 'undefined\n');
  strictEqual(result.code, 0);
});

test('should throw an error when a flag is declared twice', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/override-property.json'),
    fixtures.path('typescript/ts/transformation/test-enum.ts'),
  ]);
  match(result.stderr, /Option --experimental-transform-types is already defined/);
  strictEqual(result.stdout, '');
  strictEqual(result.code, 9);
});


test('should override env-file', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/transform-types.json'),
    '--env-file', fixtures.path('dotenv/node-options-no-tranform.env'),
    fixtures.path('typescript/ts/transformation/test-enum.ts'),
  ]);
  strictEqual(result.stderr, '');
  match(result.stdout, /Hello, TypeScript!/);
  strictEqual(result.code, 0);
});

test('should not override NODE_OPTIONS', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/transform-types.json'),
    fixtures.path('typescript/ts/transformation/test-enum.ts'),
  ], {
    env: {
      ...process.env,
      NODE_OPTIONS: '--no-experimental-transform-types',
    },
  });
  match(result.stderr, /ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX/);
  strictEqual(result.stdout, '');
  strictEqual(result.code, 1);
});

test('should not override CLI flags', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--no-experimental-transform-types',
    '--experimental-config-file',
    fixtures.path('rc/transform-types.json'),
    fixtures.path('typescript/ts/transformation/test-enum.ts'),
  ]);
  match(result.stderr, /ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX/);
  strictEqual(result.stdout, '');
  strictEqual(result.code, 1);
});

test('should parse array flag correctly', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/import.json'),
    '--eval', 'setTimeout(() => console.log("D"),99)',
  ]);
  strictEqual(result.stderr, '');
  strictEqual(result.stdout, 'A\nB\nC\nD\n');
  strictEqual(result.code, 0);
});

test('should validate invalid array flag', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/invalid-import.json'),
    '--eval', 'setTimeout(() => console.log("D"),99)',
  ]);
  match(result.stderr, /invalid-import\.json: invalid content/);
  strictEqual(result.stdout, '');
  strictEqual(result.code, 9);
});

test('should validate array flag as string', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/import-as-string.json'),
    '--eval', 'setTimeout(() => console.log("B"),99)',
  ]);
  strictEqual(result.stderr, '');
  strictEqual(result.stdout, 'A\nB\n');
  strictEqual(result.code, 0);
});

test('should throw at unknown flag', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/unknown-flag.json'),
    '-p', '"Hello, World!"',
  ]);
  match(result.stderr, /Unknown or not allowed option some-unknown-flag for namespace nodeOptions/);
  strictEqual(result.stdout, '');
  strictEqual(result.code, 9);
});

test('should throw at flag not available in NODE_OPTIONS', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/not-node-options-flag.json'),
    '-p', '"Hello, World!"',
  ]);
  match(result.stderr, /Unknown or not allowed option test for namespace nodeOptions/);
  strictEqual(result.stdout, '');
  strictEqual(result.code, 9);
});

test('unsigned flag should be parsed correctly', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/numeric.json'),
    '-p', 'http.maxHeaderSize',
  ]);
  strictEqual(result.stderr, '');
  strictEqual(result.stdout, '4294967295\n');
  strictEqual(result.code, 0);
});

test('numeric flag should not allow negative values', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/negative-numeric.json'),
    '-p', 'http.maxHeaderSize',
  ]);
  match(result.stderr, /Invalid value for --max-http-header-size/);
  match(result.stderr, /negative-numeric\.json: invalid content/);
  strictEqual(result.stdout, '');
  strictEqual(result.code, 9);
});

test('v8 flag should not be allowed in config file', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/v8-flag.json'),
    '-p', '"Hello, World!"',
  ]);
  match(result.stderr, /V8 flag --abort-on-uncaught-exception is currently not supported/);
  strictEqual(result.stdout, '');
  strictEqual(result.code, 9);
});

test('string flag should be parsed correctly', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--test',
    '--experimental-config-file',
    fixtures.path('rc/string.json'),
    fixtures.path('rc/test.js'),
  ]);
  strictEqual(result.stderr, '');
  strictEqual(result.stdout, '.\n');
  strictEqual(result.code, 0);
});

test('host port flag should be parsed correctly', { skip: !process.features.inspector }, async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--expose-internals',
    '--experimental-config-file',
    fixtures.path('rc/host-port.json'),
    '-p', 'require("internal/options").getOptionValue("--inspect-port").port',
  ]);
  strictEqual(result.stderr, '');
  strictEqual(result.stdout, '65535\n');
  strictEqual(result.code, 0);
});

test('--inspect=true should be parsed correctly', { skip: !process.features.inspector }, async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/inspect-true.json'),
    '--inspect-port', '0',
    '-p', 'require("node:inspector").url()',
  ]);
  match(result.stderr, /^Debugger listening on (ws:\/\/[^\s]+)/);
  match(result.stdout, /ws:\/\/[^\s]+/);
  strictEqual(result.code, 0);
});

test('--inspect=false should be parsed correctly', { skip: !process.features.inspector }, async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/inspect-false.json'),
    '-p', 'require("node:inspector").url()',
  ]);
  strictEqual(result.stderr, '');
  strictEqual(result.stdout, 'undefined\n');
  strictEqual(result.code, 0);
});

test('no op flag should throw', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/no-op.json'),
    '-p', '"Hello, World!"',
  ]);
  match(result.stderr, /No-op flag --http-parser is currently not supported/);
  match(result.stderr, /no-op\.json: invalid content/);
  strictEqual(result.stdout, '');
  strictEqual(result.code, 9);
});

test('should not allow users to sneak in a flag', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/sneaky-flag.json'),
    '-p', '"Hello, World!"',
  ]);
  match(result.stderr, /The number of NODE_OPTIONS doesn't match the number of flags in the config file/);
  strictEqual(result.stdout, '');
  strictEqual(result.code, 9);
});

test('non object root', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/non-object-root.json'),
    '-p', '"Hello, World!"',
  ]);
  match(result.stderr, /Root value unexpected not an object for/);
  strictEqual(result.stdout, '');
  strictEqual(result.code, 9);
});

test('non object node options', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/non-object-node-options.json'),
    '-p', '"Hello, World!"',
  ]);
  match(result.stderr, /"nodeOptions" value unexpected for/);
  strictEqual(result.stdout, '');
  strictEqual(result.code, 9);
});

test('should throw correct error when a json is broken', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/broken.json'),
    '-p', '"Hello, World!"',
  ]);
  match(result.stderr, /Can't parse/);
  match(result.stderr, /broken\.json: invalid content/);
  strictEqual(result.stdout, '');
  strictEqual(result.code, 9);
});

test('broken value in node_options', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-config-file',
    fixtures.path('rc/broken-node-options.json'),
    '-p', '"Hello, World!"',
  ]);
  match(result.stderr, /Can't parse/);
  match(result.stderr, /broken-node-options\.json: invalid content/);
  strictEqual(result.stdout, '');
  strictEqual(result.code, 9);
});

test('should use node.config.json as default', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-default-config-file',
    '-p', 'http.maxHeaderSize',
  ], {
    cwd: fixtures.path('rc/default'),
  });
  strictEqual(result.stderr, '');
  strictEqual(result.stdout, '10\n');
  strictEqual(result.code, 0);
});

test('should override node.config.json when specificied', async () => {
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-default-config-file',
    '--experimental-config-file',
    fixtures.path('rc/default/override.json'),
    '-p', 'http.maxHeaderSize',
  ], {
    cwd: fixtures.path('rc/default'),
  });
  strictEqual(result.stderr, '');
  strictEqual(result.stdout, '20\n');
  strictEqual(result.code, 0);
});
// Skip on windows because it doesn't support chmod changing read permissions
// Also skip if user is root because it would have read permissions anyway
test('should throw an error when the file is non readable', {
  skip: isWindows || process.getuid() === 0,
}, async () => {
  tmpdir.refresh();
  const dest = join(tmpdir.path, 'node.config.json');
  writeFileSync(dest, JSON.stringify({
    nodeOptions: { 'max-http-header-size': 10 }
  }));
  chmodSync(dest, constants.O_RDONLY);
  const result = await spawnPromisified(process.execPath, [
    '--no-warnings',
    '--experimental-default-config-file',
    '-p', 'http.maxHeaderSize',
  ], {
    cwd: tmpdir.path,
  });
  match(result.stderr, /Cannot read configuration from node\.config\.json: permission denied/);
  strictEqual(result.stdout, '');
  strictEqual(result.code, 9);
});

describe('namespace-scoped options', () => {
  it('should parse a namespace-scoped option correctly', async () => {
    const result = await spawnPromisified(process.execPath, [
      '--no-warnings',
      '--expose-internals',
      '--experimental-config-file',
      fixtures.path('rc/namespaced/node.config.json'),
      '-p', 'require("internal/options").getOptionValue("--test-isolation")',
    ]);
    strictEqual(result.stderr, '');
    strictEqual(result.stdout, 'none\n');
    strictEqual(result.code, 0);
  });

  it('should throw an error when a namespace-scoped option is not recognised', async () => {
    const result = await spawnPromisified(process.execPath, [
      '--no-warnings',
      '--experimental-config-file',
      fixtures.path('rc/unknown-flag-namespace.json'),
      '-p', '"Hello, World!"',
    ]);
    match(result.stderr, /Unknown or not allowed option unknown-flag for namespace testRunner/);
    strictEqual(result.stdout, '');
    strictEqual(result.code, 9);
  });

  it('should not throw an error when a namespace is not recognised', async () => {
    const result = await spawnPromisified(process.execPath, [
      '--no-warnings',
      '--experimental-config-file',
      fixtures.path('rc/unknown-namespace.json'),
      '-p', '"Hello, World!"',
    ]);
    strictEqual(result.stderr, '');
    strictEqual(result.stdout, 'Hello, World!\n');
    strictEqual(result.code, 0);
  });

  it('should handle an empty namespace valid namespace', async () => {
    const result = await spawnPromisified(process.execPath, [
      '--no-warnings',
      '--experimental-config-file',
      fixtures.path('rc/empty-valid-namespace.json'),
      '-p', '"Hello, World!"',
    ]);
    strictEqual(result.stderr, '');
    strictEqual(result.stdout, 'Hello, World!\n');
    strictEqual(result.code, 0);
  });

  it('should throw an error if a namespace-scoped option has already been set in node options', async () => {
    const result = await spawnPromisified(process.execPath, [
      '--no-warnings',
      '--expose-internals',
      '--experimental-config-file',
      fixtures.path('rc/override-node-option-with-namespace.json'),
      '-p', 'require("internal/options").getOptionValue("--test-isolation")',
    ]);
    match(result.stderr, /Option --test-isolation is already defined/);
    strictEqual(result.stdout, '');
    strictEqual(result.code, 9);
  });

  it('should throw an error if a node option has already been set in a namespace-scoped option', async () => {
    const result = await spawnPromisified(process.execPath, [
      '--no-warnings',
      '--expose-internals',
      '--experimental-config-file',
      fixtures.path('rc/override-namespace.json'),
      '-p', 'require("internal/options").getOptionValue("--test-isolation")',
    ]);
    match(result.stderr, /Option --test-isolation is already defined/);
    strictEqual(result.stdout, '');
    strictEqual(result.code, 9);
  });

  it('should prioritise CLI namespace-scoped options over config file options', async () => {
    const result = await spawnPromisified(process.execPath, [
      '--no-warnings',
      '--expose-internals',
      '--test-isolation', 'process',
      '--experimental-config-file',
      fixtures.path('rc/namespaced/node.config.json'),
      '-p', 'require("internal/options").getOptionValue("--test-isolation")',
    ]);
    strictEqual(result.stderr, '');
    strictEqual(result.stdout, 'process\n');
    strictEqual(result.code, 0);
  });

  it('should append namespace-scoped config file options with CLI options in case of array', async () => {
    const result = await spawnPromisified(process.execPath, [
      '--no-warnings',
      '--expose-internals',
      '--test-coverage-exclude', 'cli-pattern1',
      '--test-coverage-exclude', 'cli-pattern2',
      '--experimental-config-file',
      fixtures.path('rc/namespace-with-array.json'),
      '-p', 'JSON.stringify(require("internal/options").getOptionValue("--test-coverage-exclude"))',
    ]);
    strictEqual(result.stderr, '');
    const excludePatterns = JSON.parse(result.stdout);
    const expected = [
      'config-pattern1',
      'config-pattern2',
      'cli-pattern1',
      'cli-pattern2',
    ];
    deepStrictEqual(excludePatterns, expected);
    strictEqual(result.code, 0);
  });

  it('should allow setting kDisallowedInEnvvar in the config file if part of a namespace', async () => {
    // This test assumes that the --test-concurrency flag is configured as kDisallowedInEnvVar
    // and that it is part of at least one namespace.
    const result = await spawnPromisified(process.execPath, [
      '--no-warnings',
      '--expose-internals',
      '--experimental-config-file',
      fixtures.path('rc/namespace-with-disallowed-envvar.json'),
      '-p', 'require("internal/options").getOptionValue("--test-concurrency")',
    ]);
    strictEqual(result.stderr, '');
    strictEqual(result.stdout, '1\n');
    strictEqual(result.code, 0);
  });

  it('should override namespace-scoped config file options with CLI options', async () => {
    // This test assumes that the --test-concurrency flag is configured as kDisallowedInEnvVar
    // and that it is part of at least one namespace.
    const result = await spawnPromisified(process.execPath, [
      '--no-warnings',
      '--expose-internals',
      '--test-concurrency', '2',
      '--experimental-config-file',
      fixtures.path('rc/namespace-with-disallowed-envvar.json'),
      '-p', 'require("internal/options").getOptionValue("--test-concurrency")',
    ]);
    strictEqual(result.stderr, '');
    strictEqual(result.stdout, '2\n');
    strictEqual(result.code, 0);
  });
});
