// PM2 process manager configuration
// Run: pm2 start ecosystem.config.cjs --env production
// Docs: https://pm2.keymetrics.io/docs/usage/application-declaration/

const path = require('path');
const ROOT = __dirname;

module.exports = {
  apps: [
    {
      name: 'phishguard',
      script: path.join(ROOT, 'backend', 'server.js'),
      cwd: path.join(ROOT, 'backend'),

      // Restart policy
      watch: false,
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',

      // Logging — written to backend/logs/
      error_file: path.join(ROOT, 'backend', 'logs', 'pm2-error.log'),
      out_file:   path.join(ROOT, 'backend', 'logs', 'pm2-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },

      env_development: {
        NODE_ENV: 'development',
        PORT: 4000,
      },
    },
  ],
};
