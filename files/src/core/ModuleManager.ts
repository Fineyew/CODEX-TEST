import fs from 'fs';
import path from 'path';
import logger from './logger';
import Bot from './Bot';
import chokidar from 'chokidar';

export default class ModuleManager {
  public modules = new Map<string, any>();
  private watcher?: chokidar.FSWatcher;
  private modulesDir: string;

  constructor(public bot: Bot, modulesDir?: string) {
    this.modulesDir = modulesDir || path.join(process.cwd(), 'modules');
    if (this.bot.hotReloadEnabled) this.setupWatcher();
  }

  public async loadAll() {
    if (!fs.existsSync(this.modulesDir)) {
      logger.info('No modules directory found.');
      return;
    }
    const entries = fs.readdirSync(this.modulesDir);
    for (const entry of entries) {
      const full = path.join(this.modulesDir, entry);
      if (fs.statSync(full).isDirectory()) {
        const possible = ['index.js', 'index.ts', `${entry}.js`, `${entry}.ts`];
        for (const p of possible) {
          const fp = path.join(full, p);
          if (fs.existsSync(fp)) {
            await this.loadModule(fp, entry);
            break;
          }
        }
      } else if (entry.endsWith('.js') || entry.endsWith('.ts')) {
        await this.loadModule(path.join(this.modulesDir, entry), path.basename(entry, path.extname(entry)));
      }
    }
  }

  public async loadModule(fp: string, name: string) {
    logger.info(`Loading module ${name} from ${fp}`);
    // Attempt to remove existing instance first
    const oldInstance = this.modules.get(name);
    try {
      // clear require cache for file
      try { delete require.cache[require.resolve(fp)]; } catch (_) {}
      // require module
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Mod = require(fp).default || require(fp);
      const instance = new Mod(this.bot);
      // if a previous instance exists, call unload to allow cleanup
      if (oldInstance && oldInstance.unload) {
        try { await oldInstance.unload(); } catch (e) { logger.warn(`Error unloading old module ${name}: ${(e as Error).message}`); }
      }
      // register new instance
      if (instance.register) await instance.register();
      this.modules.set(name, instance);
      logger.info(`Module loaded: ${name}`);
      return instance;
    } catch (err) {
      logger.error(`Failed to load module ${name}: ${(err as Error).message}`);
      // on failure, attempt rollback: restore old instance if present
      if (oldInstance) {
        try {
          if (oldInstance.register) await oldInstance.register();
          this.modules.set(name, oldInstance);
          logger.info(`Rolled back to previous module instance for ${name}`);
        } catch (e) {
          logger.error(`Rollback failed for module ${name}: ${(e as Error).message}`);
          this.modules.delete(name);
        }
      }
      return null;
    }
  }

  public async reload(moduleName: string) {
    const modulePath = path.join(this.modulesDir, moduleName);
    if (!fs.existsSync(modulePath)) return false;
    const possible = ['index.js', 'index.ts', `${moduleName}.js`, `${moduleName}.ts`].map(f => path.join(modulePath, f));
    let fp: string | null = null;
    for (const p of possible) if (fs.existsSync(p)) { fp = p; break; }
    if (!fp) return false;
    const instance = await this.loadModule(fp, moduleName);
    return !!instance;
  }

  private setupWatcher() {
    try {
      this.watcher = chokidar.watch(this.modulesDir, { ignoreInitial: true, persistent: true });
      this.watcher.on('all', async (event, pathChanged) => {
        logger.info(`Module watcher event: ${event} ${pathChanged}`);
        const rel = pathChanged.replace(this.modulesDir + path.sep, '');
        const parts = rel.split(path.sep);
        const moduleName = parts[0];
        if (moduleName) {
          logger.info(`Auto-reloading module: ${moduleName}`);
          await this.reload(moduleName);
        }
      });
      logger.info('Module watcher started (hot reload enabled)');
    } catch (err) {
      logger.error('Failed to start module watcher', err as Error);
    }
  }

  public get(name: string) {
    return this.modules.get(name);
  }
}