module.exports = {
  apps: [
    {
      name: 'kairos-backend',
      script: 'server.js',
      cwd: 'C:\\Users\\Administrator\\Desktop\\KairosLab_Virtual_Office\\backend',
      env: { NODE_ENV: 'production' },
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
    // kairos-frontend removed — backend now serves static files on port 5500
  ]
};
