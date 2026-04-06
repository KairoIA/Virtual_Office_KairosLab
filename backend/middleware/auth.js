/**
 * Simple API Key Auth Middleware
 * For single-user setup — validates a shared secret
 * Upgrade to Supabase Auth / JWT when needed
 */

// Request counters — reset daily at midnight
let stats = { authorized: 0, blocked: 0, since: new Date().toISOString().split('T')[0] };

function resetIfNewDay() {
    const today = new Date().toISOString().split('T')[0];
    if (stats.since !== today) {
        stats = { authorized: 0, blocked: 0, since: today };
    }
}

export function getAuthStats() {
    resetIfNewDay();
    return { ...stats };
}

export function authMiddleware(req, res, next) {
    resetIfNewDay();

    // Skip auth in development
    if (process.env.NODE_ENV === 'development') {
        stats.authorized++;
        return next();
    }

    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_SECRET) {
        stats.blocked++;
        return res.status(401).json({ error: 'Unauthorized' });
    }

    stats.authorized++;
    next();
}
