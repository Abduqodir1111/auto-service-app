// STOMVP API PM2 ecosystem
// Created 2026-04-26
//
// Защита от OOM на 2GB box:
//   - node_args --max-old-space-size=768  → V8 не возьмёт больше 768MB heap
//   - max_memory_restart 600M             → PM2 graceful restart, если RSS > 600MB
module.exports = {
  apps: [
    {
      name: 'stomvp-api',
      script: '/opt/stomvp/app/apps/api/dist/apps/api/src/main.js',
      cwd: '/opt/stomvp/app/apps/api',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '600M',
      node_args: '--max-old-space-size=768',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      kill_timeout: 5000,
    },
  ],
};
