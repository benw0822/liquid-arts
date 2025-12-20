
export const config = {
    runtime: 'edge',
};

export default async function handler(request) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
        return new Response('Missing Bar ID', { status: 400 });
    }

    // Credentials (Ideally env vars, but using public ones for now matched with client)
    const SUPABASE_URL = 'https://wgnskednopbfngvjmviq.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P';

    try {
        // 1. Fetch Bar Data via REST
        // Need: title, description, vibe, location, image, cover_image
        // Also need first bar_image if cover/image missing.
        // To keep it simple and fast, let's fetch basic info + bar_images

        // Construct Query: select=*,bar_images(image_url,display_order)
        const queryUrl = `${SUPABASE_URL}/rest/v1/bars?id=eq.${id}&select=*,bar_images(image_url,display_order)`;

        const dbRes = await fetch(queryUrl, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        const data = await dbRes.json();
        const bar = data && data.length > 0 ? data[0] : null;

        if (!bar) {
            return new Response('Bar Not Found', { status: 404 });
        }

        // 2. Determine Image
        // Priority: Cover > Image > Sorted Gallery > Logo
        let finalImage = 'https://liquid-arts.vercel.app/assets/logo_vertical.png';

        if (bar.cover_image) {
            finalImage = bar.cover_image;
        } else if (bar.image) {
            finalImage = bar.image;
        } else if (bar.bar_images && bar.bar_images.length > 0) {
            // Sort
            const sorted = data[0].bar_images.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
            finalImage = sorted[0].image_url;
        }

        // 3. Determine Description
        const description = bar.description || `Experience ${bar.title}, a ${bar.vibe || 'unique'} cocktail bar in ${bar.location}.`;
        const title = `${bar.title} | Liquid Arts`;

        // 4. Construct HTML Response
        // We include a script to redirect humans immediately to the real app
        const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <meta name="description" content="${description}">
        
        <!-- Open Graph -->
        <meta property="og:type" content="website">
        <meta property="og:url" content="https://liquid-arts.vercel.app/bar.html?id=${id}">
        <meta property="og:title" content="${title}">
        <meta property="og:description" content="${description}">
        <meta property="og:image" content="${finalImage}">
        
        <!-- Twitter -->
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="${title}">
        <meta name="twitter:description" content="${description}">
        <meta name="twitter:image" content="${finalImage}">

        <!-- Redirect Script -->
        <script>
            // Optional: You could check user agent to NOT redirect bots, but bots usually ignore JS rewrites anyway.
            // Redirect to the actual app page
            window.location.href = '/bar.html?id=${id}';
        </script>
      </head>
      <body>
        <h1>${title}</h1>
        <p>${description}</p>
        <img src="${finalImage}" style="max-width: 500px;">
        <p>Redirecting to app...</p>
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
