import fs from 'fs';
import path from 'path';
import logger from './logger';

export default class LocaleManager {
  private locales: Map<string, Record<string, string>> = new Map();
  private dir: string;

  constructor(localesDir?: string) {
    this.dir = localesDir || path.join(process.cwd(), 'locales');
    this.loadAll();
  }

  loadAll() {
    if (!fs.existsSync(this.dir)) {
      logger.info('Locales directory not found, creating', { dir: this.dir });
      fs.mkdirSync(this.dir, { recursive: true });
      return;
    }
    const files = fs.readdirSync(this.dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const code = path.basename(file, '.json');
        const raw = fs.readFileSync(path.join(this.dir, file), 'utf8');
        const obj = JSON.parse(raw);
        this.locales.set(code, obj);
      } catch (err) {
        logger.error('Failed to load locale', err as Error);
      }
    }
    logger.info(`Loaded locales: ${[...this.locales.keys()].join(', ')}`);
  }

  t(key: string, vars?: Record<string, any>, locale = 'en'): string {
    const lc = this.locales.get(locale) || this.locales.get('en') || {};
    let template = (lc && lc[key]) || key;
    if (vars) {
      for (const k of Object.keys(vars)) {
        template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]));
      }
    }
    return template;
  }

  reloadLocale(locale: string) {
    const file = path.join(this.dir, `${locale}.json`);
    if (!fs.existsSync(file)) return false;
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const obj = JSON.parse(raw);
      this.locales.set(locale, obj);
      return true;
    } catch (err) {
      logger.error('Failed to reload locale', err as Error);
      return false;
    }
  }
}