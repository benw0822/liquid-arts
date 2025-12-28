import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const config = {
    runtime: 'edge',
};

export default async function handler(request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');

    // 1. Fetch the base HTML (invite.html)
    // We fetch from the deployment URL or construct it. 
    // Since we are in an Edge Function, we can fetch the static asset from the same origin.
    const baseHtmlUrl = new URL('/invite.html', request.url);
    const htmlRes = await fetch(baseHtmlUrl);
    let html = await htmlRes.text();

    if (!code) {
        return new Response(html, {
            headers: { 'Content-Type': 'text/html' }
        });
    }

    try {
        // 2. Setup Supabase Client
        // Note: Using environment variables or hardcoded public keys if safe (Anon key is safe for public reads if RLS is set)
        // We need to ensure 'invitations' table is readable by public (or we use a Service Role key if we want to be internal only, but invites are public?)
        // The table RLS "Everyone can view invitation by code" allows public select.
        const SUPABASE_URL = 'https://wgnskednopbfngvjmviq.supabase.co';
        const SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P';
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        // 3. Fetch Invitation Data
        const { data: invite, error } = await supabase
            .from('invitations')
            .select('role, metadata')
            .eq('code', code)
            .single();

        if (!invite || error) {
            // Invite not found, just serve raw HTML
            return new Response(html, { headers: { 'Content-Type': 'text/html' } });
        }

        // 4. Determine Metadata
        const metadata = invite.metadata || {};
        let title = "You're Invited to Liquid Arts";
        let description = "Join the premier platform for cocktail culture.";
        let image = `${url.origin}/assets/og_default.jpg`; // Fallback

        if (invite.role === 'owner') {
            const barName = metadata.bar_name || 'a new Bar';
            const invitee = metadata.invitee_name ? `Hi ${metadata.invitee_name}, ` : '';
            title = `${invitee}You are invited to manage ${barName}`;
            description = `Access your Bar Management System on Liquid Arts.`;

            // If we have a bar_id, fetch image? 
            // The metadata usually has minimal info. If we want the bar image, we might need a join or second fetch.
            if (metadata.bar_id) {
                const { data: bar } = await supabase.from('bars').select('image').eq('id', metadata.bar_id).single();
                if (bar && bar.image) image = bar.image;
            }

        } else if (invite.role === 'talent') {
            const displayName = metadata.display_name || 'Talent';
            title = `Invitation for ${displayName}`;
            description = `Join Liquid Arts as a Talent Member.`;
        }

        // 5. Inject Meta Tags
        // We replace existing tags or inject new ones into <head>
        const metaTags = `
            <meta property="og:title" content="${title}">
            <meta property="og:description" content="${description}">
            <meta property="og:image" content="${image}">
            <meta name="twitter:card" content="summary_large_image">
            <meta name="twitter:title" content="${title}">
            <meta name="twitter:description" content="${description}">
            <meta name="twitter:image" content="${image}">
        `;

        // Inject before </head>
        html = html.replace('</head>', `${metaTags}</head>`);

        // Also update <title> if possible
        html = html.replace(/<title>.*<\/title>/, `<title>${title}</title>`);

        return new Response(html, {
            headers: { 'Content-Type': 'text/html' }
        });

    } catch (err) {
        console.error('Serve invite error:', err);
        return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    }
}
