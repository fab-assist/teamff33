import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

function drawIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const radius = size * 0.1;

    // Fond orange avec coins arrondis
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();

    // Texte "FA"
    ctx.fillStyle = 'white';
    ctx.font = `bold ${size * 0.38}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FA', size / 2, size / 2 + size * 0.02);

    return canvas.toBuffer('image/png');
}

// Générer les icônes
const icons = [
    { size: 512, name: 'pwa-512x512.png' },
    { size: 192, name: 'pwa-192x192.png' },
    { size: 180, name: 'apple-touch-icon.png' }
];

console.log('Génération des icônes PWA...\n');

icons.forEach(({ size, name }) => {
    const buffer = drawIcon(size);
    const path = join(publicDir, name);
    writeFileSync(path, buffer);
    console.log(`✓ ${name} (${size}x${size})`);
});

console.log('\nIcônes générées dans le dossier public/');
