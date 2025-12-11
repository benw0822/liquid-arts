// js/talent_front.js

document.addEventListener('DOMContentLoaded', () => {
    fetchRandomTalent();
});

async function fetchRandomTalent() {
    // 1. Fetch all talents (assuming number is small enough for client-side random)
    // If scaled, we would use a random ID or RPC.
    const { data: talents, error } = await window.supabaseClient
        .from('talents')
        .select('*');

    if (error) {
        console.error('Error fetching talents:', error);
        return;
    }

    if (!talents || talents.length === 0) return;

    // 2. Pick Random
    const randomTalent = talents[Math.floor(Math.random() * talents.length)];

    // 3. Render
    renderTalentShowcase(randomTalent);
}

function renderTalentShowcase(talent) {
    const imgEl = document.getElementById('featured-talent-img');
    const quoteEl = document.getElementById('featured-talent-quote-en');
    const descEl = document.getElementById('featured-talent-desc'); // User asked for Quote, but there is also 'description'. 
    // Layout has H2 (Quote) and P (Desc). The user request said "Quote...". 
    // I will put 'quote' in H2. And maybe 'description' in P.

    const nameEl = document.getElementById('featured-talent-name');
    const roleEl = document.getElementById('featured-talent-role');

    if (imgEl && talent.image_url) imgEl.src = talent.image_url;

    if (quoteEl) quoteEl.textContent = talent.quote ? `"${talent.quote}"` : '"Creativity in every sip."';
    if (descEl) descEl.textContent = talent.description || '';

    if (nameEl) nameEl.textContent = talent.display_name || 'Anonymous Talent';

    // Bar Roles Formatting
    if (roleEl && talent.bar_roles && talent.bar_roles.length > 0) {
        // Take first role
        const primary = talent.bar_roles[0];
        // Ensure we have name. If only ID is present (legacy data?), we might show Role only or fetch.
        // Assuming we saved 'bar_name' as per recent editor update.
        // Format: "Role, Bar Name" or "Bar Name | Role"
        // UI Mockup had: "Head Bartender, The Midnight Hour"

        let roleText = primary.role || 'Bartender';
        let barText = primary.bar_name || 'Liquid Arts';

        roleEl.textContent = `${barText} ${roleText}`; // Changed order to match "MO BAR Bartender"

        // If it's a link, set href
        if (roleEl.tagName === 'A') {
            // Assuming we might have a link somewhere, if not, default to bars.html or search
            // For now, let's link to bars.html as a specific bar link might not be in the 'talent' object yet without join.
            // If the user needs specific bar link, we need to check if we have it. 
            // Ideally `primary.bar_id` -> `bars.html?id=...`
            if (primary.bar_id) {
                roleEl.href = `bar-details.html?id=${primary.bar_id}`;
            } else {
                roleEl.href = 'bars.html';
            }
        }
    } else {
        if (roleEl) roleEl.textContent = 'Guest Bartender';
    }
}
