import { Service } from 'node-windows';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svc = new Service({
    name: 'KairosBackend',
    description: 'KairosLab Virtual Office Backend API',
    script: path.join(__dirname, 'server.js'),
    nodeOptions: [],
    env: [{ name: 'NODE_ENV', value: 'production' }],
});

svc.on('install', () => {
    svc.start();
    console.log('KAIROS Backend service installed and started.');
});

svc.install();
