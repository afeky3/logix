// PM2 process definitions for the test server (planning/SERVER-DETAILS.md §8).
// Deploy: pnpm install && npx prisma generate && npx nest build && pm2 restart logix-api logix-worker
// First run: pm2 start ecosystem.config.js && pm2 save
module.exports = {
  apps: [
    {
      name: 'logix-api',
      script: 'dist/main.js',
      cwd: __dirname,
      env_file: '.env',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
    },
    {
      name: 'logix-worker',
      script: 'dist/worker.js',
      cwd: __dirname,
      env_file: '.env',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '250M',
    },
  ],
};
