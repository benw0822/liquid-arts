
export const config = {
    runtime: 'edge',
};

export default async function handler(request) {
    const url = new URL(request.url);
    // Extract slug from query param (injected by Vercel rewrite) or path
    let slug = url.searchParams.get('slug');

    if (!slug) {
        // Fallback if not injected, try path
        const pathParts = url.pathname.split('/');
        slug = pathParts[pathParts.length - 1];
    }

    const userAgent = request.headers.get('user-agent') || '';
    const isBot = /facebookexternalhit|line-poker|twitterbot|whatsapp|telegrambot|discordbot|googlebot|bingbot/i.test(userAgent);

    // Credentials
    const SUPABASE_URL = 'https://wgnskednopbfngvjmviq.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P';

    // --- BOT LOGIC (Server-Side SEO) ---
    if (isBot) {
        try {
            // 1. Fetch Bar Data by Slug
            const queryUrl = `${SUPABASE_URL}/rest/v1/bars?slug=eq.${slug}&select=*,bar_images(image_url,display_order)`;

            const dbRes = await fetch(queryUrl, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });

            const data = await dbRes.json();
            const bar = data && data.length > 0 ? data[0] : null;

            if (!bar) {
                // If slug not found, maybe return 404 or just the normal page?
                // For bots, 404 is honest.
                return new Response('Bar Not Found', { status: 404 });
            }

            // 2. SEO Logic (Same as before)
            let finalImage = 'https://liquid-arts.vercel.app/assets/logo_vertical.png';
            if (bar.cover_image) finalImage = bar.cover_image;
            else if (bar.image) finalImage = bar.image;
            else if (bar.bar_images && bar.bar_images.length > 0) {
                const sorted = data[0].bar_images.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
                finalImage = sorted[0].image_url;
            }

            const description = bar.description || `Experience ${bar.title}, a ${bar.vibe || 'unique'} cocktail bar in ${bar.location}.`;
            const title = `${bar.title} | 亞洲酒吧文化社群 - Liquid Arts`;

            // 3. SEO HTML Response
            const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <meta name="description" content="${description}">
          
          <meta property="og:type" content="website">
          <meta property="og:url" content="${url.href}">
          <meta property="og:title" content="${title}">
          <meta property="og:description" content="${description}">
          <meta property="og:image" content="${finalImage}">
          
          <meta name="twitter:card" content="summary_large_image">
          <meta name="twitter:title" content="${title}">
          <meta name="twitter:description" content="${description}">
          <meta name="twitter:image" content="${finalImage}">
        </head>
        <body>
          <h1>${title}</h1>
          <p>${description}</p>
          <img src="${finalImage}" alt="${title}">
        </body>
        </html>
      `;

            return new Response(html, {
                headers: { 'content-type': 'text/html;charset=UTF-8' },
            });

        } catch (err) {
            return new Response('Error generating preview: ' + err.message, { status: 500 });
        }
    }

    // --- HUMAN LOGIC (Serve App) ---
    // We need to serve the content of /bar.html
    // Since we are in an Edge Function, we can fetch the static asset from the deployment.
    // URL Construction: origin + /bar.html

    try {
        const appUrl = new URL('/bar.html', request.url);
        const appRes = await fetch(appUrl);

        // We return the response directly, allowing the browser to render the SPA
        // IMPORTANT: We must ensure the status and headers are passed through
        return new Response(appRes.body, {
            status: appRes.status,
            headers: appRes.headers
        });
    } catch (err) {
        return new Response('Error loading app: ' + err.message, { status: 500 });
    }
}
