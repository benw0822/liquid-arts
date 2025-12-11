
// js/talent.js
window.initTalentPage = async () => {
    // 1. Get Talent ID from URL
    const params = new URLSearchParams(window.location.search);
    const talentId = params.get('id');

    const container = document.querySelector('.talent-hero');
    const nameEl = document.getElementById('talent-name');
    const quoteEl = document.getElementById('talent-quote');
    const descEl = document.getElementById('talent-desc');
    const imgEl = document.getElementById('talent-img');

    const barsGrid = document.getElementById('talent-bars-grid');
    const expList = document.getElementById('talent-experience-list');
    const awardsList = document.getElementById('talent-awards-list');

    if (!talentId) {
        if (container) container.innerHTML = '<div class="container" style="text-align: center; padding: 4rem;"><h2>Talent not found.</h2><p>Invalid ID provided.</p><a href="index.html" class="btn">Return Home</a></div>';
        return;
    }

    try {
        // 2. Fetch Talent Data
        const { data: talent, error } = await window.supabaseClient
            .from('talents')
            .select('*')
            .eq('id', talentId)
            .single();

        if (error || !talent) {
            console.error('Error fetching talent:', error);
            if (container) container.innerHTML = '<div class="container" style="text-align: center; padding: 4rem;"><h2>Talent not found.</h2><a href="index.html" class="btn">Return Home</a></div>';
            return;
        }

        // 3. Render Hero
        document.title = `${talent.display_name} - Liquid Arts`;
        if (nameEl) nameEl.textContent = talent.display_name;
        if (quoteEl) quoteEl.textContent = talent.quote || '';
        if (descEl) descEl.textContent = talent.description || '';
        if (imgEl) imgEl.src = talent.image_url || 'assets/placeholder_user.png';

        // 4. Render Bars (Locations)
        if (barsGrid) {
            barsGrid.innerHTML = '';
            // Check bar_roles JSONB
            if (talent.bar_roles && talent.bar_roles.length > 0) {
                // Extract unique bar IDs
                const barIds = [...new Set(talent.bar_roles.map(r => r.bar_id).filter(id => id))];

                if (barIds.length > 0) {
                    // Fetch real bar data for cards
                    const { data: bars, error: barError } = await window.supabaseClient
                        .from('bars')
                        .select('*')
                        .in('id', barIds);

                    if (!barError && bars) {
                        // Pre-calculate cities for cards (Reuse logic from app.js if possible, or fetch simple)
                        // For simplicity, we just use location string or call global helper if available.
                        // Assuming window.createBarCard exists from app.js

                        // We need to fetch cities from coords if we want consistency, but let's stick to base location for speed unless we want to dupe logic.
                        // Ideally, we wait for app.js helpers.

                        // Render Cards
                        barsGrid.innerHTML = bars.map(bar => {
                            // Inject Role into card if we want? Or just show the bar.
                            // Finding the role for this bar
                            const roleObj = talent.bar_roles.find(r => r.bar_id == bar.id);
                            const roleName = roleObj ? (roleObj.role || 'Bartender') : '';

                            // Reusing createBarCard but maybe we want to append the Role?
                            // Let's rely on standard card for consistency.
                            return window.createBarCard ? window.createBarCard(bar, null, roleName) : '';
                        }).join('');

                        // Initialize Maps for cards
                        bars.forEach(bar => {
                            if (bar.lat && bar.lng && window.initCardMapGlobal) {
                                setTimeout(() => window.initCardMapGlobal(bar.id, bar.lat, bar.lng, bar.title, false), 100);
                            }
                        });


                    }
                } else {
                    barsGrid.innerHTML = '<p>No linked locations.</p>';
                }
            } else {
                barsGrid.innerHTML = '<p>No linked locations.</p>';
            }
        }

        // 5. Render Experience
        if (expList) {
            expList.innerHTML = '';
            if (talent.experiences && talent.experiences.length > 0) {
                // Sort by year desc
                const sortedExp = talent.experiences.sort((a, b) => b.year - a.year);

                expList.innerHTML = sortedExp.map(exp => `
                    <li class="timeline-item">
                        <div class="timeline-year">${exp.year || ''}</div>
                        <div class="timeline-title">${exp.title || ''}</div>
                        <div class="timeline-desc">${exp.unit || ''}</div>
                    </li>
                `).join('');
            } else {
                expList.innerHTML = '<li>No experience listed.</li>';
            }
        }

        // 6. Render Awards
        if (awardsList) {
            awardsList.innerHTML = '';
            if (talent.awards && talent.awards.length > 0) {
                const sortedAwards = talent.awards.sort((a, b) => b.year - a.year);

                awardsList.innerHTML = sortedAwards.map(awd => `
                    <li class="timeline-item">
                        <div class="timeline-year">${awd.year || ''}</div>
                        <div class="timeline-title">${awd.rank ? `${awd.rank} - ` : ''}${awd.name || ''}</div>
                    </li>
                `).join('');
            } else {
                awardsList.innerHTML = '<li>No awards listed.</li>';
            }
        }

    } catch (err) {
        console.error('Talent Page Error:', err);
    }
};
