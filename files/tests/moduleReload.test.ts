import fs from 'fs';
import path from 'path';
import rimraf from 'rimraf';
import ModuleManager from '../src/core/ModuleManager';

// Helper: write JS module file
function writeModule(dir: string, name: string, content: string) {
  const modDir = path.join(dir, name);
  if (!fs.existsSync(modDir)) fs.mkdirSync(modDir, { recursive: true });
  const idx = path.join(modDir, 'index.js');
  fs.writeFileSync(idx, content, 'utf8');
  return idx;
}

describe('ModuleManager reload rollback', () => {
  const tmpDir = path.join(process.cwd(), 'temp-modules-reload-test');
  const moduleName = 'goodmod';

  beforeAll(() => {
    if (fs.existsSync(tmpDir)) rimraf.sync(tmpDir);
    fs.mkdirSync(tmpDir);
  });

  afterAll(() => {
    try { rimraf.sync(tmpDir); } catch (e) {}
  });

  test('reload rolls back to previous instance on failing reload', async () => {
    // Good module that registers successfully
    const goodContent = `
      module.exports = class GoodModule {
        constructor(bot) { this.bot = bot; this.name = '${moduleName}'; }
        register() { if(!this.bot.reg) this.bot.reg=[]; this.bot.reg.push('${moduleName}'); }
        unload() { if(this.bot.reg) this.bot.reg = this.bot.reg.filter(x => x !== '${moduleName}'); this.unloaded = true; }
      };
    `;
    // Bad module that throws during register
    const badContent = `
      module.exports = class BadModule {
        constructor(bot) { this.bot = bot; this.name = '${moduleName}'; }
        register() { throw new Error('boom during register'); }
        unload() { this.unloaded = true; }
      };
    `;

    // Write good module and load
    writeModule(tmpDir, moduleName, goodContent);

    // Minimal bot stub expected by ModuleManager modules
    const botStub: any = { hotReloadEnabled: false, registerCommand: () => {}, client: { on: () => {} } };
    const mm = new ModuleManager(botStub, tmpDir);

    // loadAll should load good module
    await mm.loadAll();
    const inst1 = mm.get(moduleName);
    expect(inst1).toBeDefined();
    expect(botStub.reg).toBeDefined();
    expect(botStub.reg.includes(moduleName)).toBe(true);

    // Overwrite with bad module
    writeModule(tmpDir, moduleName, badContent);

    // Attempt reload: ModuleManager.reload should attempt to load bad module,
    // catch the error, and rollback to previous instance.
    const reloaded = await mm.reload(moduleName);
    // reload returns boolean based on success; since bad module fails, it should return falsey
    expect(reloaded).toBe(false);

    // The old instance should still be present in manager
    const inst2 = mm.get(moduleName);
    expect(inst2).toBeDefined();
    // botStub.reg should still include the module name (rollback restored it)
    expect(botStub.reg.includes(moduleName)).toBe(true);
  });
});