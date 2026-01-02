
export const config = {
    runtime: 'edge',
};

export default async function handler(request) {
    const url = new URL(request.url);
    // Extract slug from query param (injected by Vercel rewrite) or path
    let slug = url.searchParams.get('slug');

    if (!slug) {
        // Fallback if not injected, try path /article/:slug
        const pathParts = url.pathname.split('/');
        // pathParts: ["", "article", "slug"]
        if (pathParts.length >= 3 && pathParts[1] === 'article') {
            slug = pathParts[2];
        }
    }

    const userAgent = request.headers.get('user-agent') || '';
    const isBot = /facebookexternalhit|line-poker|twitterbot|whatsapp|telegrambot|discordbot|googlebot|bingbot/i.test(userAgent);

    // Credentials
    const SUPABASE_URL = 'https://wgnskednopbfngvjmviq.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P';

    // --- BOT LOGIC (Server-Side SEO) ---
    if (isBot && slug) {
        try {
            // 1. Fetch Article Data by Slug
            const queryUrl = `${SUPABASE_URL}/rest/v1/articles?slug=eq.${slug}&select=*`;

            const dbRes = await fetch(queryUrl, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });

            const data = await dbRes.json();
            const article = data && data.length > 0 ? data[0] : null;

            if (!article) {
                return new Response('Article Not Found', { status: 404 });
            }

            // 2. SEO Logic
            const title = `${article.title} | Liquid Arts`;
            const description = article.excerpt || article.title;
            const image = article.cover_image || 'https://liquid-arts.vercel.app/assets/logo_vertical.png';
            const pageUrl = url.href;

            // 3. SEO HTML Response
            const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <meta name="description" content="${description}">
          
          <meta property="og:type" content="article">
          <meta property="og:url" content="${pageUrl}">
          <meta property="og:title" content="${title}">
          <meta property="og:description" content="${description}">
          <meta property="og:image" content="${image}">
          
          <meta name="twitter:card" content="summary_large_image">
          <meta name="twitter:title" content="${title}">
          <meta name="twitter:description" content="${description}">
          <meta name="twitter:image" content="${image}">
        </head>
        <body>
          <h1>${title}</h1>
          <p>${description}</p>
          <img src="${image}" alt="${title}">
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
    // Serve journal-details.html
    try {
        // Rewrite to the static file
        // Note: In Vercel Edge Functions, standard 'fetch' to self might trigger infinite loops if not careful,
        // but here we are fetching a specific static asset.
        // Assuming journal-details.html exists at root.
        const appUrl = new URL('/journal-details.html', request.url);
        // Pass query params along if needed, though client-side routing handles slug from path now too.
        if (slug) appUrl.searchParams.set('slug', slug);

        const appPage = await fetch(appUrl);
        return appPage;
    } catch (e) {
        return new Response('Internal Server Error', { status: 500 });
    }
}
