import { createApp } from './app.js';
const { app, db, mailer } = createApp();
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Hazem portfolio listening on 0.0.0.0:${port}`);
  console.log('Studio: /admin. First-run access is in private/ADMIN_ACCESS.md (never served publicly).');
});
const close = () => server.close(async () => { await mailer.stop(); db.pragma('wal_checkpoint(TRUNCATE)'); db.close(); process.exit(0); });
process.on('SIGTERM', close);
process.on('SIGINT', close);
