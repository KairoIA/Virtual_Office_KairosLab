/**
 * KAIROS Background — Floating Particles
 * Premium dark dashboard aesthetic
 */

export function initMarketCanvas() {
    const canvas = document.getElementById('marketCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width, height;
    let particles = [];
    const PARTICLE_COUNT = 80;
    const CONNECTION_DIST = 150;
    const MOUSE = { x: -1000, y: -1000 };

    // Color palette — cyan/gold accents
    const COLORS = [
        'rgba(0, 242, 255, 0.4)',   // cyan
        'rgba(0, 242, 255, 0.2)',   // cyan dim
        'rgba(201, 168, 76, 0.3)',  // gold
        'rgba(201, 168, 76, 0.15)', // gold dim
        'rgba(163, 113, 247, 0.2)', // purple
        'rgba(255, 255, 255, 0.1)', // white subtle
    ];

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        if (particles.length === 0) createParticles();
    }

    function createParticles() {
        particles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                r: Math.random() * 2 + 0.5,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                pulse: Math.random() * Math.PI * 2,
                pulseSpeed: 0.005 + Math.random() * 0.015,
            });
        }
    }

    function animate() {
        // Dark background with subtle gradient
        const grad = ctx.createRadialGradient(
            width * 0.3, height * 0.3, 0,
            width * 0.5, height * 0.5, Math.max(width, height) * 0.8
        );
        grad.addColorStop(0, '#0a0e14');
        grad.addColorStop(0.5, '#060a0f');
        grad.addColorStop(1, '#030507');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Update & draw particles
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];

            // Move
            p.x += p.vx;
            p.y += p.vy;
            p.pulse += p.pulseSpeed;

            // Wrap around edges
            if (p.x < -10) p.x = width + 10;
            if (p.x > width + 10) p.x = -10;
            if (p.y < -10) p.y = height + 10;
            if (p.y > height + 10) p.y = -10;

            // Subtle mouse attraction
            const dx = MOUSE.x - p.x;
            const dy = MOUSE.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 200 && dist > 0) {
                p.vx += (dx / dist) * 0.01;
                p.vy += (dy / dist) * 0.01;
            }

            // Dampen velocity
            p.vx *= 0.999;
            p.vy *= 0.999;

            // Draw particle with pulse
            const pulseR = p.r + Math.sin(p.pulse) * 0.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, pulseR, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();

            // Glow effect for larger particles
            if (p.r > 1.5) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, pulseR * 3, 0, Math.PI * 2);
                ctx.fillStyle = p.color.replace(/[\d.]+\)$/, '0.05)');
                ctx.fill();
            }
        }

        // Draw connections between nearby particles
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const a = particles[i];
                const b = particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < CONNECTION_DIST) {
                    const alpha = (1 - dist / CONNECTION_DIST) * 0.12;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = `rgba(0, 242, 255, ${alpha})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(animate);
    }

    // Track mouse for subtle interaction
    canvas.addEventListener('mousemove', (e) => {
        MOUSE.x = e.clientX;
        MOUSE.y = e.clientY;
    });
    canvas.addEventListener('mouseleave', () => {
        MOUSE.x = -1000;
        MOUSE.y = -1000;
    });

    window.addEventListener('resize', resize);
    resize();
    animate();
}
