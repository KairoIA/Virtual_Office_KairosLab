/**
 * Web Search Service — Free (DuckDuckGo)
 * No API key needed
 */

export async function webSearch(query) {
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'KairosLab/1.0' },
        });
        const html = await res.text();

        // Parse results from DuckDuckGo HTML
        const results = [];
        const regex = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
        let match;
        while ((match = regex.exec(html)) !== null && results.length < 5) {
            results.push({
                url: match[1],
                title: match[2].replace(/<\/?[^>]+(>|$)/g, '').trim(),
                snippet: match[3].replace(/<\/?[^>]+(>|$)/g, '').trim(),
            });
        }

        // Fallback: simpler regex if the above doesn't match
        if (results.length === 0) {
            const simpleRegex = /<a[^>]*class="result__url"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
            while ((match = simpleRegex.exec(html)) !== null && results.length < 5) {
                results.push({
                    url: match[1],
                    title: '',
                    snippet: match[2].replace(/<\/?[^>]+(>|$)/g, '').trim(),
                });
            }
        }

        // Also try DuckDuckGo Instant Answer API for quick facts
        const iaRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
        const iaData = await iaRes.json();

        let instantAnswer = '';
        if (iaData.Abstract) instantAnswer = iaData.Abstract;
        else if (iaData.Answer) instantAnswer = iaData.Answer;

        return {
            query,
            instant_answer: instantAnswer || null,
            results: results.length > 0 ? results : [{ title: 'Sin resultados detallados', snippet: 'Intenta reformular la búsqueda' }],
        };
    } catch (err) {
        return { query, error: err.message, results: [] };
    }
}
