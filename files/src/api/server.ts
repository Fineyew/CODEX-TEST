function adminOnly(req: any, res: any, next: any) {
  const adminList = (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!adminList.length) return res.status(403).send('No admin users configured');
  const userId = req.user && req.user.id;
  if (!userId || !adminList.includes(userId)) return res.status(403).send('Not an admin');
  return next();
}

// reload module endpoint (global)
app.post('/api/admin/modules/:name/reload', authMiddleware, adminOnly, async (req, res) => {
  const name = req.params.name;
  try {
    const mm = (require('../core/ModuleManager').default) as any;
    // if app has module manager instance accessible: this is a simple RPC; in your app ensure you can access module manager instance
    // Here we attempt to access global bot ModuleManager via require cache (you should expose it in your boot)
    const DynoBot = require('../core/Bot').default;
    // This depends on your app layout; safer pattern: export your bot instance somewhere accessible.
    const botInstance = (DynoBot as any).instance || (global as any).bot;
    if (!botInstance || !botInstance.modules) return res.status(500).send('Module manager not available');
    const ok = await botInstance.modules.reload(name);
    if (ok) return res.json({ reloaded: true });
    return res.status(500).json({ reloaded: false });
  } catch (err) {
    logger.error('Reload module failed', err as Error);
    return res.status(500).send('Reload failed');
  }
});