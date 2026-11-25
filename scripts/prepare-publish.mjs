import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const source = path.join(project, 'dist');
const output = path.join(project, 'out');
const marker = path.join(project, '.work', 'publish-output.json');

// Publish only the static site. Local archives and originals live outside dist/.
if (realpathSync(source) !== source || !lstatSync(source).isDirectory()) {
  throw new Error('Expected dist to be a regular directory inside this project.');
}
if (path.dirname(output) !== project || output === source) {
  throw new Error('Refusing to replace an output outside this project.');
}
const previousOutput = lstatSync(output, { throwIfNoEntry: false });
if (previousOutput) {
  if (previousOutput.isSymbolicLink() || !previousOutput.isDirectory()) {
    throw new Error('Refusing to replace out because it is not a regular directory.');
  }
  const owned = existsSync(marker) && JSON.parse(readFileSync(marker, 'utf8')).output === output;
  if (!owned) {
    throw new Error('Existing out was not created by this script; preserve it before publishing.');
  }
  rmSync(output, { recursive: true });
}

mkdirSync(path.dirname(marker), { recursive: true });
writeFileSync(marker, `${JSON.stringify({ output })}\n`);
let omitted = 0;
cpSync(source, output, {
  recursive: true,
  dereference: false,
  filter(filename) {
    const relative = path.relative(source, filename).split(path.sep).join('/');
    const skip = ['.DS_Store', '.gitkeep'].includes(path.basename(filename))
      || /^assets\/Gallery\/[^/]+\.jpe?g$/i.test(relative);
    if (skip) omitted += 1;
    return !skip;
  },
});
console.log(`Prepared out/ for GitHub Pages; excluded ${omitted} original-photo or system files.`);
