/**
 * Simple API Key Auth Middleware
 * For single-user setup — validates a shared secret
 * Upgrade to Supabase Auth / JWT when needed
 */

export function authMiddleware(req, res, next) {
    // Skip auth in development
    if (process.env.NODE_ENV === 'development') {
        return next();
    }

    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
}
