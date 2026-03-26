/**
 * KAIROS Market Canvas
 * Animated candlestick background
 */

export function initMarketCanvas() {
    const canvas = document.getElementById('marketCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const CANDLE_W = 10;
    const CANDLE_GAP = 5;
    let width, height, candles = [];

    function resize() {
        width  = canvas.width  = window.innerWidth;
        height = canvas.height = window.innerHeight;
        buildCandles();
    }

    function buildCandles() {
        candles = [];
        let price = height / 2;
        const total = Math.ceil(width / (CANDLE_W + CANDLE_GAP)) + 10;
        for (let i = 0; i < total; i++) {
            const change = (Math.random() - 0.5) * 30;
            const open  = price;
            const close = price + change;
            const high  = Math.max(open, close) + Math.random() * 15;
            const low   = Math.min(open, close) - Math.random() * 15;
            candles.push({ open, close, high, low });
            price = close;
        }
    }

    let offset = 0;

    function animate() {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, width, height);

        offset -= 0.5;
        if (offset <= -(CANDLE_W + CANDLE_GAP)) {
            offset = 0;
            candles.shift();
            const last = candles[candles.length - 1];
            let change = (Math.random() - 0.5) * 30;
            if (last.close < height * 0.2) change += 5;
            if (last.close > height * 0.8) change -= 5;
            const open  = last.close;
            const close = open + change;
            const high  = Math.max(open, close) + Math.random() * 15;
            const low   = Math.min(open, close) - Math.random() * 15;
            candles.push({ open, close, high, low });
        }

        for (let i = 0; i < candles.length; i++) {
            const c = candles[i];
            const x = i * (CANDLE_W + CANDLE_GAP) + offset;
            const green = c.close >= c.open;
            const color = green ? 'rgba(0,240,144,0.15)' : 'rgba(255,59,48,0.15)';
            const wick  = green ? 'rgba(0,240,144,0.3)'  : 'rgba(255,59,48,0.3)';

            ctx.strokeStyle = wick;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + CANDLE_W / 2, c.high);
            ctx.lineTo(x + CANDLE_W / 2, c.low);
            ctx.stroke();

            ctx.fillStyle = color;
            const bodyH = Math.max(Math.abs(c.close - c.open), 1);
            const bodyY = Math.min(c.open, c.close);
            ctx.fillRect(x, bodyY, CANDLE_W, bodyH);
        }

        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    resize();
    animate();
}
