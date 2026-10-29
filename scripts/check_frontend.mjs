/**
 * scripts/check_frontend.mjs
 * Static analyzer for ES module import/export graph across frontend/js
 * Zero external dependencies (pure Node.js)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', 'frontend', 'js');

// Collect all JS files
function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const allFiles = getAllFiles(ROOT_DIR);
const moduleMap = new Map(); // path -> { namedExports: Set, hasDefault: bool, reExportsStar: Set, imports: [] }
const errors = [];

function stripCommentsAndStrings(code) {
  // Returns code with comments removed, preserving line breaks
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');
}

// Pass 1: Parse exports of every file
for (const filePath of allFiles) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const cleanCode = stripCommentsAndStrings(content);

  const namedExports = new Set();
  let hasDefault = false;
  const reExportsStar = new Set();
  const imports = [];

  // Match: export default ...
  if (/export\s+default\s+/m.test(cleanCode)) {
    hasDefault = true;
  }

  // Match: export const/let/var/function/class x ...
  const declRegex = /export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([a-zA-Z0-9_$]+)/g;
  let match;
  while ((match = declRegex.exec(cleanCode)) !== null) {
    if (namedExports.has(match[1])) {
      errors.push({ type: 'DUPLICATE_EXPORT', file: filePath, name: match[1] });
    }
    namedExports.add(match[1]);
  }

  // Match: export { a, b as c } [from './...']
  const namedExportBlockRegex = /export\s*\{([^}]+)\}(?:\s*from\s*['"]([^'"]+)['"])?/g;
  while ((match = namedExportBlockRegex.exec(cleanCode)) !== null) {
    const specifiers = match[1].split(',');
    const fromPath = match[2];

    for (const spec of specifiers) {
      const parts = spec.trim().split(/\s+as\s+/);
      const original = parts[0]?.trim();
      const exported = (parts[1] || parts[0])?.trim();
      if (!exported) continue;

      if (exported === 'default') {
        hasDefault = true;
      } else {
        if (namedExports.has(exported)) {
          errors.push({ type: 'DUPLICATE_EXPORT', file: filePath, name: exported });
        }
        namedExports.add(exported);
      }
    }

    if (fromPath) {
      imports.push({
        type: 're-export-named',
        source: fromPath,
        specifiers: specifiers.map(s => {
          const p = s.trim().split(/\s+as\s+/);
          return { imported: p[0].trim(), local: (p[1] || p[0]).trim() };
        })
      });
    }
  }

  // Match: export * from './...'
  const starExportRegex = /export\s*\*\s*from\s*['"]([^'"]+)['"]/g;
  while ((match = starExportRegex.exec(cleanCode)) !== null) {
    reExportsStar.add(match[1]);
    imports.push({ type: 're-export-star', source: match[1] });
  }

  // Match: static imports
  // 1) import defaultExport from '...'
  // 2) import * as name from '...'
  // 3) import { a, b as c } from '...'
  // 4) import defaultExport, { a } from '...'
  // 5) import '...'
  const importRegex = /import\s+(?:([a-zA-Z0-9_$]+)\s*,?\s*)?(?:(\*\s*as\s*[a-zA-Z0-9_$]+)\s*,?\s*)?(?:\{([^}]+)\})?\s*from\s*['"]([^'"]+)['"]/g;
  while ((match = importRegex.exec(cleanCode)) !== null) {
    const defaultImport = match[1]?.trim();
    const starImport = match[2]?.trim();
    const namedBlock = match[3];
    const source = match[4]?.trim();

    const namedSpecifiers = [];
    if (namedBlock) {
      for (const s of namedBlock.split(',')) {
        const parts = s.trim().split(/\s+as\s+/);
        const imported = parts[0]?.trim();
        const local = (parts[1] || parts[0])?.trim();
        if (imported) {
          namedSpecifiers.push({ imported, local });
        }
      }
    }

    imports.push({
      type: 'static',
      source,
      defaultImport,
      starImport,
      namedSpecifiers
    });
  }

  // Match: import '...' (side-effect import)
  const sideEffectImportRegex = /import\s+['"]([^'"]+)['"]/g;
  while ((match = sideEffectImportRegex.exec(cleanCode)) !== null) {
    imports.push({
      type: 'side-effect',
      source: match[1]
    });
  }

  // Match: dynamic import('./...')
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(cleanCode)) !== null) {
    imports.push({
      type: 'dynamic',
      source: match[1]
    });
  }

  moduleMap.set(filePath, {
    filePath,
    namedExports,
    hasDefault,
    reExportsStar,
    imports
  });
}

function resolveImportPath(importerPath, relativeSource) {
  // If absolute or external module, ignore
  if (!relativeSource.startsWith('.') && !relativeSource.startsWith('/')) {
    return null;
  }
  const dir = path.dirname(importerPath);
  let resolved = path.resolve(dir, relativeSource);

  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return resolved;
  }

  // Try appending .js
  if (fs.existsSync(resolved + '.js') && fs.statSync(resolved + '.js').isFile()) {
    return resolved + '.js';
  }

  // Try index.js
  const indexJs = path.join(resolved, 'index.js');
  if (fs.existsSync(indexJs) && fs.statSync(indexJs).isFile()) {
    return indexJs;
  }

  return resolved; // May not exist
}

// Helper to check if a module exports a given name (recursing star re-exports)
function moduleExportsName(targetModule, name, visited = new Set()) {
  if (!targetModule || visited.has(targetModule.filePath)) return false;
  visited.add(targetModule.filePath);

  if (targetModule.namedExports.has(name)) return true;

  for (const starRel of targetModule.reExportsStar) {
    const starResolved = resolveImportPath(targetModule.filePath, starRel);
    const starMod = moduleMap.get(starResolved);
    if (starMod && moduleExportsName(starMod, name, visited)) {
      return true;
    }
  }

  return false;
}

// Pass 2: Verify imports against resolved targets
for (const [filePath, mod] of moduleMap.entries()) {
  for (const imp of mod.imports) {
    const resolved = resolveImportPath(filePath, imp.source);
    if (!resolved) continue; // External or non-relative

    if (!fs.existsSync(resolved)) {
      errors.push({
        type: 'MISSING_FILE',
        importer: filePath,
        source: imp.source,
        resolved
      });
      continue;
    }

    const targetMod = moduleMap.get(resolved);
    if (!targetMod) continue;

    // Check default import
    if (imp.defaultImport) {
      if (!targetMod.hasDefault) {
        errors.push({
          type: 'MISSING_DEFAULT_EXPORT',
          importer: filePath,
          target: resolved,
          importedName: imp.defaultImport
        });
      }
    }

    // Check named imports
    if (imp.namedSpecifiers && imp.namedSpecifiers.length > 0) {
      for (const spec of imp.namedSpecifiers) {
        if (spec.imported === 'default') {
          if (!targetMod.hasDefault) {
            errors.push({
              type: 'MISSING_DEFAULT_EXPORT',
              importer: filePath,
              target: resolved,
              importedName: spec.local
            });
          }
        } else {
          if (!moduleExportsName(targetMod, spec.imported)) {
            errors.push({
              type: 'MISSING_NAMED_EXPORT',
              importer: filePath,
              target: resolved,
              importedName: spec.imported
            });
          }
        }
      }
    }
  }
}

// Pass 3: Check circular dependencies (DFS)
const graph = new Map();
for (const [filePath, mod] of moduleMap.entries()) {
  const neighbors = new Set();
  for (const imp of mod.imports) {
    if (imp.type === 'dynamic') continue; // dynamic imports don't block sync initialisation
    const resolved = resolveImportPath(filePath, imp.source);
    if (resolved && moduleMap.has(resolved)) {
      neighbors.add(resolved);
    }
  }
  graph.set(filePath, Array.from(neighbors));
}

function findCycle(node, visited, recursionStack, pathArr) {
  visited.add(node);
  recursionStack.add(node);
  pathArr.push(node);

  const neighbors = graph.get(node) || [];
  for (const neighbor of neighbors) {
    if (!visited.has(neighbor)) {
      const cycle = findCycle(neighbor, visited, recursionStack, pathArr);
      if (cycle) return cycle;
    } else if (recursionStack.has(neighbor)) {
      const cycleStartIdx = pathArr.indexOf(neighbor);
      return pathArr.slice(cycleStartIdx).concat(neighbor);
    }
  }

  recursionStack.delete(node);
  pathArr.pop();
  return null;
}

const visited = new Set();
const recursionStack = new Set();
const cycles = [];

for (const node of graph.keys()) {
  if (!visited.has(node)) {
    const cycle = findCycle(node, visited, recursionStack, []);
    if (cycle) {
      cycles.push(cycle);
    }
  }
}

if (cycles.length > 0) {
  for (const c of cycles) {
    errors.push({
      type: 'CIRCULAR_IMPORT',
      cycle: c.map(p => path.relative(ROOT_DIR, p)).join(' -> ')
    });
  }
}

// Print Report
console.log('='.repeat(70));
console.log(`Frontend ES Module Graph Checker (Node.js)`);
console.log(`Analyzed ${moduleMap.size} modules under: ${ROOT_DIR}`);
console.log('='.repeat(70));

if (errors.length === 0) {
  console.log('✓ All imports and exports verified successfully! Zero mismatches.');
  process.exit(0);
} else {
  console.error(`✗ Found ${errors.length} import/export issues:\n`);
  for (const err of errors) {
    const relImporter = err.importer ? path.relative(ROOT_DIR, err.importer) : (err.file ? path.relative(ROOT_DIR, err.file) : '');
    const relTarget = err.target ? path.relative(ROOT_DIR, err.target) : '';

    if (err.type === 'MISSING_NAMED_EXPORT') {
      console.error(`  [MISSING NAMED EXPORT] in ${relImporter}:`);
      console.error(`    Imported '${err.importedName}' from '${relTarget}', but '${relTarget}' does NOT export '${err.importedName}'.`);
    } else if (err.type === 'MISSING_DEFAULT_EXPORT') {
      console.error(`  [MISSING DEFAULT EXPORT] in ${relImporter}:`);
      console.error(`    Imported default from '${relTarget}', but '${relTarget}' has no default export.`);
    } else if (err.type === 'MISSING_FILE') {
      console.error(`  [MISSING TARGET FILE] in ${relImporter}:`);
      console.error(`    Cannot resolve '${err.source}' -> ${err.resolved}`);
    } else if (err.type === 'DUPLICATE_EXPORT') {
      console.error(`  [DUPLICATE EXPORT] in ${relImporter}:`);
      console.error(`    Export '${err.name}' is declared multiple times.`);
    } else if (err.type === 'CIRCULAR_IMPORT') {
      console.error(`  [CIRCULAR IMPORT CYCLE]:`);
      console.error(`    ${err.cycle}`);
    } else {
      console.error(`  [ERROR]`, err);
    }
    console.error('');
  }
  process.exit(1);
}
