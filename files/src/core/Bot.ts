import LocaleManager from './LocaleManager';
import ModuleManager from './ModuleManager';
// ... other imports

export default class Bot {
  // ... existing props
  public locales!: LocaleManager;
  public hotReloadEnabled = process.env.HOT_RELOAD === '1';

  constructor() {
    // existing constructor code...

    // init locale manager
    this.locales = new LocaleManager(process.env.LOCALES_DIR || path.join(process.cwd(), 'locales'));
  }

  // helper for modules to get localized strings
  public t(key: string, vars?: Record<string, any>, locale?: string) {
    return this.locales.t(key, vars, locale || 'en');
  }
  // ... rest of Bot class
}