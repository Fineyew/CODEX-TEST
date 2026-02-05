import fs from 'fs';
import path from 'path';
import ModuleManager from '../src/core/ModuleManager';
import PluginManager from '../src/core/PluginManager';
import Bot from '../src/core/Bot';

// Mock ModuleManager.loadModule to avoid executing real plugin code
jest.mock('../src/core/ModuleManager');

describe('PluginManager (mocked)', () => {
  const tmpModulesDir = path.join(process.cwd(), 'temp-modules-test');
  let pluginManager: PluginManager;
  let mm: any;

  beforeAll(() => {
    if (!fs.existsSync(tmpModulesDir)) fs.mkdirSync(tmpModulesDir);
    const bot = new Bot();
    mm = new ModuleManager(bot, tmpModulesDir) as any;
    // Provide a mocked loadModule implementation
    mm.loadModule = jest.fn().mockImplementation(async (fp: string, name: string) => {
      // simulate success if folder exists
      if (fs.existsSync(path.dirname(fp))) return { name };
      return null;
    });
    pluginManager = new PluginManager(mm, tmpModulesDir);
  });

  afterAll(() => {
    try { fs.rmSync(tmpModulesDir, { recursive: true, force: true }); } catch (e) {}
  });

  test('uninstall non-existent plugin returns false', async () => {
    const res = await pluginManager.uninstallPlugin('no-such-plugin');
    expect(res).toBe(false);
  });

  test.skip('install npm package (requires network and npm) - manual test', async () => {
    // This test is skipped in CI; kept for manual verification.
  });
});