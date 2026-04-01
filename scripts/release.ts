// scripts/release.ts
// Ejecutar con: pnpm release
// Este script hace TODO: incrementa versión, compila, publica

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

function exec(cmd: string) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

async function main() {
  console.log('\n🚀 ARIESPos — Sistema de actualizaciones\n');

  // Leer versión actual del package.json raíz
  const pkgPath = path.join(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const currentVersion = pkg.version;
  console.log(`Versión actual: ${currentVersion}`);

  // Preguntar tipo de actualización
  console.log('\n¿Qué tipo de actualización es?');
  console.log('  1. patch  → corrección de errores (1.0.0 → 1.0.1)');
  console.log('  2. minor  → nuevas funciones    (1.0.0 → 1.1.0)');
  console.log('  3. major  → cambio grande        (1.0.0 → 2.0.0)');
  const tipo = await question('\nElegí (1/2/3): ');

  const bumpType = tipo.trim() === '2' ? 'minor' : tipo.trim() === '3' ? 'major' : 'patch';

  // Pedir descripción de los cambios
  const descripcion = await question('\n¿Qué cambios incluye esta versión? (breve descripción):\n> ');
  rl.close();

  // Incrementar versión en package.json raíz
  exec(`npm version ${bumpType} --no-git-tag-version`);

  // Sincronizar versión en desktop/package.json
  const pkgNew = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const newVersion = pkgNew.version;
  console.log(`\n✅ Nueva versión: ${newVersion}`);

  const desktopPkgPath = path.join(process.cwd(), 'packages', 'desktop', 'package.json');
  const desktopPkg = JSON.parse(fs.readFileSync(desktopPkgPath, 'utf-8'));
  desktopPkg.version = newVersion;
  fs.writeFileSync(desktopPkgPath, JSON.stringify(desktopPkg, null, 2) + '\n');
  console.log('▶ Versión sincronizada en packages/desktop/package.json');

  const mobilePkgPath = path.join(process.cwd(), 'ariespos-mobile', 'package.json');
  if (fs.existsSync(mobilePkgPath)) {
    const mobilePkg = JSON.parse(fs.readFileSync(mobilePkgPath, 'utf-8'));
    mobilePkg.version = newVersion;
    fs.writeFileSync(mobilePkgPath, JSON.stringify(mobilePkg, null, 2) + '\n');
    console.log('▶ Versión sincronizada en ariespos-mobile/package.json');
  }

  // Verificar TypeScript
  console.log('\n🔍 Verificando TypeScript...');
  exec('pnpm --filter @ariespos/desktop typecheck');

  // Guardar changelog
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  const fecha = new Date().toLocaleDateString('es-AR');
  const changelogEntry = `\n## v${newVersion} — ${fecha}\n${descripcion.trim()}\n`;
  const existing = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf-8') : '';
  fs.writeFileSync(changelogPath, changelogEntry + existing);

  // Commit, tag y push
  exec('git add .');
  exec(`git commit -m "release: v${newVersion} — ${descripcion.trim().slice(0, 72)}"`);
  exec(`git tag v${newVersion}`);

  console.log('\n📤 Subiendo a GitHub...');
  exec('git push origin main');
  exec(`git push origin v${newVersion}`);

  console.log(`
╔════════════════════════════════════════════════════════╗
║  ✅ Release v${newVersion} enviado a GitHub
║
║  GitHub Actions está compilando ahora:
║  • El instalador .exe para Windows
║  • La APK para Android
║
║  En 10-15 minutos estará disponible en:
║  https://github.com/steevengerard10/ariespos/releases
║
║  Los programas instalados se actualizarán solos
║  la próxima vez que los abran.
╚════════════════════════════════════════════════════════╝
  `);
}

main().catch(console.error);
