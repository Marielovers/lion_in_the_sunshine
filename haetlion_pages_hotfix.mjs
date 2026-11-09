/**
 * Targeted GitHub Pages fix for lion_in_the_sunshine.
 * Does not overwrite game logic, custom placement, parameter settings, or assets.
 * Run from the directory containing package.json: node haetlion_pages_hotfix.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

function patch(filename, fixes) {
  if (!existsSync(filename)) throw new Error(`File not found: ${filename}. Run this from the project root.`);
  const before = readFileSync(filename, 'utf8');
  let after = before;
  for (const [oldText, newText] of fixes) {
    if (after.includes(oldText)) {
      after = after.replaceAll(oldText, newText);
    } else if (!after.includes(newText)) {
      console.warn(`  ! Pattern not found in ${filename}: ${JSON.stringify(oldText.slice(0, 90))}`);
    }
  }
  if (after !== before) {
    writeFileSync(filename, after, 'utf8');
    console.log(`  Fixed: ${filename}`);
  } else {
    console.log(`  Unchanged: ${filename}`);
  }
}

if (!existsSync('package.json') || !existsSync('vite.config.mjs')) {
  throw new Error('Open a CMD window in your game project folder (the one with package.json) and run again.');
}

patch('tests/project.test.mjs', [
  ["../assets/model/", "../public/assets/model/"],
]);
patch('tests/mobile-ui.test.mjs', [
  ["read('assets/bed.png')", "read('public/assets/bed.png')"],
]);
patch('tools/setup-runtime.mjs', [
  ["path.join(root, 'assets', 'vendor')", "path.join(root, 'public', 'assets', 'vendor')"],
]);
patch('game.js', [
  ["const LOCAL_CORE = '/assets/vendor/live2dcubismcore.min.js';",
   "const assetUrl = path => `${import.meta.env.BASE_URL}assets/${path}`;\nconst LOCAL_CORE = assetUrl('vendor/live2dcubismcore.min.js');"],
  ["fetch('/assets/vendor/core-version.txt'", "fetch(assetUrl('vendor/core-version.txt')"],
  ["this.audio.src='./assets/voice/'+name+'.wav';", "this.audio.src=assetUrl('voice/'+name+'.wav');"],
  ["new Audio('./assets/sfx/'+name+'.wav')", "new Audio(assetUrl('sfx/'+name+'.wav'))"],
  ["src:'/assets/model/햇리온.model3.json'", "src:assetUrl('model/햇리온.model3.json')"],
  ["fetch('/assets/model/햇리온.model3.json')", "fetch(assetUrl('model/햇리온.model3.json'))"],
]);

const game = readFileSync('game.js', 'utf8');
if (/['"`]\/?assets\/(?:model|voice|sfx|vendor)\//.test(game)) {
  console.warn('WARNING: Some hard-coded asset paths remain in game.js; inspect them.');
}
console.log('\nDone. Next: npm test && npm run build, then git add -A && git commit -m "Fix Pages test and asset paths" && git push');
