module.exports = {
  apps: [
    {
      name: 'kairos-backend',
      script: 'server.js',
      cwd: 'C:\\Users\\Administrator\\Desktop\\KairosLab_Virtual_Office\\backend',
      env: { NODE_ENV: 'development' },
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: 'kairos-frontend',
      script: 'C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\http-server\\bin\\http-server',
      args: '. -p 5500 -c-1 --cors',
      cwd: 'C:\\Users\\Administrator\\Desktop\\KairosLab_Virtual_Office',
      watch: false,
      autorestart: true,
    }
  ]
};
