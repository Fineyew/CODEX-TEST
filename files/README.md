## Final Checklist & Running Steps (verification)

1. Prereqs
   - Node 18+ or 20 recommended
   - npm installed
   - Docker (recommended) for Mongo/Redis/Lavalink services
   - git (if you plan to install plugins from git sources)

2. Prepare .env (copy .env.example → .env) and fill:
   - DISCORD_TOKEN (only when you plan to run the bot)
   - MONGO_URI (e.g., mongodb://localhost:27017/dynobot)
   - REDIS_URI (e.g., redis://localhost:6379)
   - LAVALINK_HOST / LAVALINK_PORT / LAVALINK_PASSWORD (if using Lavalink)
   - CLIENT_ID / CLIENT_SECRET / JWT_SECRET (for dashboard OAuth)
   - ADMIN_USER_IDS (comma-separated user ids who may use admin API endpoints)
   - HOT_RELOAD=1 during dev to enable module watcher

3. Install deps:
   - npm ci

4. Start dev stack (recommended):
   - docker compose up -d
     (includes mongo, redis and lavalink if configured in your compose)

5. Run tests:
   - npm test
   - Expected: all tests pass (module reload test, IPC tests, model tests, API auth tests)

6. Start the bot & API:
   - npm run dev
   - Visit metrics: http://localhost:9400/metrics
   - Dashboard API (dev): http://localhost:3000

7. Manual plugin install (dev only, inspect plugin before installing):
   - HOT_RELOAD=1 npm run dev
   - Use PluginManager.installPlugin('git-url-or-npm-package') via a small script or REPL (or extend admin API to call install)
   - To uninstall: PluginManager.uninstallPlugin('moduleName')

8. Smoke test in Discord:
   - Invite the bot to a test guild
   - Try moderation commands, automod triggers, music commands (after starting Lavalink)
   - Try custom commands: !ccadd hello Hello {user} → then !hello
   - Try reaction roles, autorole, modmail DM flow, backups

## Security & Safety
- Do not install plugins from untrusted sources.
- For production: use HTTPS, set cookies secure flag, store secrets in a vault, and don't run sample plugin installs on public hosts.

## Final notes
- If tests fail locally, paste the failing logs and I'll provide targeted fixes.
- When you're ready and have run the test suite, let me know results and any errors and I will iterate to resolve them.