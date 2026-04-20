/**
 * PM2: корректный entrypoint — src/index.js из каталога server/.
 * Не используйте несуществующий server/index.js в образе, если в деплой не попадает shim из репо.
 * instances: 1 — избегает лишних параллельных процессов на PaaS, где оркестратор сам масштабирует.
 */
module.exports = {
  apps: [
    {
      name: 'base56',
      script: 'src/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
