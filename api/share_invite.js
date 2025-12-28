
export const config = {
    runtime: 'edge',
};

export default async function handler(request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');

    if (!code) {
        return new Response('Missing Invitation Code', { status: 400 });
    }

    const userAgent = request.headers.get('user-agent') || '';
    const isBot = /facebookexternalhit|line-poker|twitterbot|whatsapp|telegrambot|discordbot|googlebot|bingbot/i.test(userAgent);

    // Credentials
    const SUPABASE_URL = 'https://wgnskednopbfngvjmviq.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P';

    if (isBot) {
        try {
            // 1. Fetch Invitation
            const queryUrl = `${SUPABASE_URL}/rest/v1/invitations?code=eq.${code}&select=role,metadata`;
            const dbRes = await fetch(queryUrl, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });

            const data = await dbRes.json();
            const invite = data && data.length > 0 ? data[0] : null;

            if (!invite) {
                return new Response('Invitation Not Found', { status: 404 });
            }

            const meta = invite.metadata || {};
            let title = 'You\'re Invited - Liquid Arts';
            let description = 'You have received an exclusive invitation to join Liquid Arts.';
            let image = 'https://liquid-arts.vercel.app/assets/logo_vertical.png';

            // 2. Fetch Bar Info if Owner
            if (invite.role === 'owner' && meta.bar_id) {
                const barRes = await fetch(`${SUPABASE_URL}/rest/v1/bars?id=eq.${meta.bar_id}&select=title,image`, {
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
                });
                const barData = await barRes.json();
                const bar = barData && barData.length > 0 ? barData[0] : null;

                if (bar) {
                    title = `Invitation to Manage ${bar.title}`;
                    description = `Hi ${meta.invitee_name || 'there'}, you are invited to manage ${bar.title} on Liquid Arts.`;
                    if (bar.image) image = bar.image;
                }
            } else if (invite.role === 'talent') {
                title = `Invitation to Join Liquid Arts`;
                description = `Hi ${meta.display_name || 'there'}, you are invited to join Liquid Arts as a Talent.`;
            }

            // 3. Construct HTML
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
                <meta property="og:image" content="${image}">
                
                <meta name="twitter:card" content="summary_large_image">
                <meta name="twitter:title" content="${title}">
                <meta name="twitter:description" content="${description}">
                <meta name="twitter:image" content="${image}">
            </head>
            <body>
                <h1>${title}</h1>
                <p>${description}</p>
                <img src="${image}" alt="Preview">
            </body>
            </html>
            `;

            return new Response(html, {
                headers: { 'content-type': 'text/html;charset=UTF-8' },
            });

        } catch (err) {
            console.error(err);
            return new Response('Error generating preview', { status: 500 });
        }
    }

    // --- HUMAN LOGIC ---
    // Fetch and serve invite.html, preserving query params
    // Note: We need to pass the "code" param to the client-side app so it can render.
    // The current URL /invite/CODE is rewritten to /api/share_invite?code=CODE.
    // If we proxy /invite.html, the browser sees /invite/CODE.
    // Client-side JS reads window.location.search or pathname?
    // invite.js currently reads `new URLSearchParams(window.location.search).get('code')`.
    // But /invite/CODE doesn't have ?code=... in the browser URL bar! 
    // It is /invite/CODE.

    // PROBLEM: `invite.js` needs to be updated to support reading code from Path as well!
    // OR we redirect to /invite.html?code=CODE.
    // Redirect is safer for consistency with existing JS logic.

    // Let's redirect humans to the classic URL format to ensure JS works.
    // --- HUMAN LOGIC ---
    // Rewrite (Proxy) to invite.html so functionality works but URL remains clean
    try {
        const appUrl = new URL('/invite.html', request.url);
        const appRes = await fetch(appUrl);

        return new Response(appRes.body, {
            status: appRes.status,
            headers: appRes.headers
        });
    } catch (err) {
        return new Response('Error loading app: ' + err.message, { status: 500 });
    }
}
