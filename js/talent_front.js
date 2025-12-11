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

    // 2.1 Fetch Linked Bar Names for ALL roles
    if (randomTalent.bar_roles && randomTalent.bar_roles.length > 0) {
        const barIds = randomTalent.bar_roles.map(r => r.bar_id).filter(id => id);

        if (barIds.length > 0) {
            const { data: barsData } = await window.supabaseClient
                .from('bars')
                .select('id, title')
                .in('id', barIds);

            if (barsData) {
                // Map titles back
                randomTalent.bar_roles.forEach(role => {
                    const found = barsData.find(b => b.id == role.bar_id);
                    if (found) role.bar_name = found.title;
                });
            }
        }
    }

    // 3. Render
    renderTalentShowcase(randomTalent);
}

function renderTalentShowcase(talent) {
    const imgEl = document.getElementById('featured-talent-img');
    const quoteEl = document.getElementById('featured-talent-quote-en');
    const descEl = document.getElementById('featured-talent-desc');
    const nameEl = document.getElementById('featured-talent-name');
    const roleEl = document.getElementById('featured-talent-role'); // This should be a container DIV now

    // Link Image and Name to Talent Page
    const talentUrl = `talent.html?id=${talent.id}`;

    if (imgEl && talent.image_url) {
        imgEl.src = talent.image_url;
        // Make image clickable
        imgEl.onclick = () => window.location.href = talentUrl;
        imgEl.style.cursor = 'pointer';
    }

    if (quoteEl) quoteEl.textContent = talent.quote ? `"${talent.quote}"` : '"Creativity in every sip."';
    if (descEl) descEl.textContent = talent.description || '';

    if (nameEl) {
        // Create Link if not already
        nameEl.innerHTML = `<a href="${talentUrl}" style="color: inherit; text-decoration: none;">${talent.display_name || 'Anonymous Talent'}</a>`;
        // Ensure pointer events are enabled for the name container (it was set to none in HTML style)
        nameEl.style.pointerEvents = 'auto';
    }

    // Bar Roles Formatting
    if (roleEl) {
        roleEl.innerHTML = ''; // Clear existing content

        if (talent.bar_roles && talent.bar_roles.length > 0) {
            talent.bar_roles.forEach(role => {
                let roleText = role.role || 'Bartender';
                let barText = role.bar_name || 'Liquid Arts';

                const link = document.createElement('a');
                link.textContent = `${barText} ${roleText}`;

                if (role.bar_id) {
                    link.href = `bar-details.html?id=${role.bar_id}`;
                } else {
                    link.href = 'bars.html';
                }

                // Styles: Centered, blocked, no underline (per user request)
                link.style.cssText = "display: block; font-family: var(--font-main); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.5rem; color: white; text-decoration: none; width: fit-content; margin-left: auto; margin-right: auto;";

                roleEl.appendChild(link);
            });
        } else {
            // Default or guest
            roleEl.textContent = 'Guest Bartender';
            roleEl.style.cssText = "font-family: var(--font-main); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 2px; color: white; margin-bottom: 1rem;";
        }
    }
}
