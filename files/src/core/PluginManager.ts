import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import tar from 'tar';
import logger from './logger';
import ModuleManager from './ModuleManager';

const exec = promisify(execCb);

export default class PluginManager {
  private modulesDir: string;
  constructor(private moduleManager: ModuleManager, modulesDir?: string) {
    this.modulesDir = modulesDir || path.join(process.cwd(), 'modules');
    if (!fs.existsSync(this.modulesDir)) {
      fs.mkdirSync(this.modulesDir, { recursive: true });
    }
  }

  /**
   * Install a plugin.
   * - source: npm package name (e.g. '@scope/pkg' or 'pkg@1.2.3') OR git url (https://...git or git+ssh://...)
   * Returns { name, installedPath } on success.
   */
  public async installPlugin(source: string): Promise<{ name: string; installedPath: string }> {
    logger.info(`Installing plugin from ${source}`);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-'));
    try {
      let pkgFolder = tmp;
      // Git source?
      if (/(\.git$|git\+|github\.com|gitlab\.com)/i.test(source)) {
        // git clone <source> tmp
        await exec(`git clone ${source} ${tmp}`);
        // repo likely contains package code directly
      } else {
        // npm pack => creates a tarball in cwd; run npm pack in tmp
        const cwd = tmp;
        // use npm pack in a temp folder and then extract the tarball
        const { stdout } = await exec(`npm pack ${source}`, { cwd });
        // stdout contains tarball file name
        const tarball = stdout.trim().split('\n').pop()!;
        const tarballPath = path.join(cwd, tarball);
        // extract tarball to tmp/extracted
        const extracted = path.join(tmp, 'extracted');
        fs.mkdirSync(extracted);
        await tar.x({ file: tarballPath, cwd: extracted, strip: 1 });
        pkgFolder = extracted;
      }

      // read package.json to find package name
      const pkgJsonPath = path.join(pkgFolder, 'package.json');
      let pkgName = path.basename(source).replace(/[^a-z0-9_\-]/gi, '');
      if (fs.existsSync(pkgJsonPath)) {
        try {
          const pj = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
          pkgName = pj.name ? pj.name.replace(/[^a-z0-9_\-]/gi, '') : pkgName;
        } catch (e) {
          // ignore
        }
      }

      const dest = path.join(this.modulesDir, pkgName);
      if (fs.existsSync(dest)) {
        throw new Error(`Module ${pkgName} already exists at ${dest}`);
      }

      // move package folder into modules dir
      fs.renameSync(pkgFolder, dest);

      // attempt to load the module
      const loaded = await this.moduleManager.loadModule(path.join(dest, 'index.js'), pkgName)
        || await this.moduleManager.loadModule(path.join(dest, 'index.ts'), pkgName);
      if (!loaded) {
        // attempt to load by filename matching
        const files = fs.readdirSync(dest);
        let ok = false;
        for (const f of files) {
          if (f.endsWith('.js') || f.endsWith('.ts')) {
            const maybe = await this.moduleManager.loadModule(path.join(dest, f), pkgName);
            if (maybe) { ok = true; break; }
          }
        }
        if (!ok) {
          // rollback: remove installed folder
          await this.safeRm(dest);
          throw new Error('Failed to load plugin after installation (rolled back).');
        }
      }

      logger.info(`Plugin installed: ${pkgName}`);
      return { name: pkgName, installedPath: dest };
    } catch (err) {
      logger.error('Plugin install failed', err as Error);
      // cleanup tmp
      try { await this.safeRm(tmp); } catch (e) {}
      throw err;
    }
  }

  /**
   * Uninstall plugin by module name (folder under modules/)
   */
  public async uninstallPlugin(moduleName: string): Promise<boolean> {
    const dest = path.join(this.modulesDir, moduleName);
    if (!fs.existsSync(dest)) return false;
    // attempt to unload module if currently loaded
    try {
      const mod = this.moduleManager.get(moduleName);
      if (mod && mod.unload) {
        await mod.unload();
      }
    } catch (e) {
      logger.warn('Failed to unload module before uninstall', (e as Error).message);
    }
    // remove folder
    await this.safeRm(dest);
    // clear require cache entries referencing the module
    try {
      Object.keys(require.cache).forEach((k) => {
        if (k.startsWith(dest)) delete require.cache[k];
      });
    } catch (e) {}
    logger.info(`Plugin uninstalled: ${moduleName}`);
    return true;
  }

  // Helper: remove dir recursively
  private async safeRm(p: string) {
    if (!fs.existsSync(p)) return;
    // Node 12+ supports fs.rmSync with recursive; fallback to rmdir
    try {
      fs.rmSync(p, { recursive: true, force: true });
    } catch (e) {
      // fallback
      const rimraf = (await import('fs')).rmdirSync;
      try { rimraf(p, { recursive: true } as any); } catch (_) {}
    }
  }
}