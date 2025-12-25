export const config = {
    runtime: 'edge',
};

export default async function handler(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
        return new Response('Missing URL parameter', { status: 400 });
    }

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'LiquidArts-Bot/1.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
            }
        });

        if (!response.ok) {
            return new Response(`Failed to fetch URL: ${response.status}`, { status: 502 });
        }

        const html = await response.text();

        // Simple Regex Parsers for OG tags and Title
        const getMetaContent = (prop) => {
            const regex = new RegExp(`<meta property="${prop}" content="([^"]*)"`, 'i');
            const match = html.match(regex);
            if (match) return match[1];
            // Try name attribute as fallback
            const regexName = new RegExp(`<meta name="${prop}" content="([^"]*)"`, 'i');
            const matchName = html.match(regexName);
            return matchName ? matchName[1] : null;
        };

        const getTitle = () => {
             const ogTitle = getMetaContent('og:title');
             if (ogTitle) return ogTitle;
             const match = html.match(/<title>([^<]*)<\/title>/i);
             return match ? match[1] : '';
        };

        const getImage = () => {
            return getMetaContent('og:image') || getMetaContent('twitter:image') || '';
        };

        const getDescription = () => {
            return getMetaContent('og:description') || getMetaContent('description') || '';
        };

        const title = getTitle();
        const image = getImage();
        const description = getDescription();
        
        // Resolve relative image URLs
        let finalImage = image;
        if (image && !image.startsWith('http')) {
            try {
                finalImage = new URL(image, targetUrl).toString();
            } catch (e) {
                // Keep original if resolution fails
            }
        }

        const data = {
            title: title || '',
            image: finalImage || '',
            description: description || '',
            url: targetUrl
        };

        return new Response(JSON.stringify(data), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*', // Allow client-side calls
                'Cache-Control': 's-maxage=3600, stale-while-revalidate'
            }
        });

    } catch (err) {
        console.error('Metadata fetch error:', err);
        return new Response(JSON.stringify({ error: 'Failed to fetch metadata' }), { 
            status: 500,
             headers: { 'Content-Type': 'application/json' }
        });
    }
}
