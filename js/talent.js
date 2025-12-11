
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

        // 4. Render Bars (Locations) && Roles
        if (barsGrid) {
            barsGrid.innerHTML = '';
            // Check bar_roles JSONB
            if (talent.bar_roles && talent.bar_roles.length > 0) {
                // Extract unique bar IDs
                const barIds = [...new Set(talent.bar_roles.map(r => r.bar_id).filter(id => id))];

                // Render Roles in Hero
                // Roles will be rendered after fetching bars to ensure correct names


                if (barIds.length > 0) {
                    // Fetch real bar data for cards
                    const { data: bars, error: barError } = await window.supabaseClient
                        .from('bars')
                        .select('*')
                        .in('id', barIds);

                    if (!barError && bars) {
                        // Render Roles in Hero (Moved here to use fresh Bar Titles)
                        const rolesList = document.getElementById('talent-roles-list');
                        if (rolesList) {
                            rolesList.innerHTML = talent.bar_roles.map(r => {
                                const rName = r.role || 'Bartender';
                                // Find matching bar in fetched data
                                const foundBar = bars.find(b => b.id == r.bar_id);
                                const bName = foundBar ? foundBar.title : (r.bar_name || 'Liquid Arts');

                                return `<div class="talent-role-item"><span style="color: var(--bg-red); text-transform: uppercase; font-size: 0.8rem;">${rName}</span><br>${bName}</div>`;
                            }).join('');
                        }

                        // Pre-calculate cities for cards
                        const barsWithCities = await Promise.all(bars.map(async (bar) => {
                            let city = bar.location;
                            if (bar.lat && bar.lng && window.fetchCityFromCoordsGlobal) {
                                const resolved = await window.fetchCityFromCoordsGlobal(bar.lat, bar.lng);
                                if (resolved) city = resolved;
                            }
                            return { ...bar, cityDisplay: city };
                        }));

                        // Render Cards
                        barsGrid.innerHTML = barsWithCities.map(bar => {
                            // Reusing createBarCard without Role in card
                            return window.createBarCard ? window.createBarCard(bar, bar.cityDisplay) : '';
                        }).join('');

                        // Initialize Maps for cards
                        barsWithCities.forEach(bar => {
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

        // 7. Render Hops (New Section)
        const hopsGrid = document.getElementById('talent-hops-grid');
        if (hopsGrid && talent.user_id) {
            console.log('[Talent] Fetching Hops for User ID:', talent.user_id);

            const { data: hops, error: hopsError } = await window.supabaseClient
                .from('hoppings')
                .select('*')
                .eq('user_id', talent.user_id)
                .eq('is_public', true) // Only show public hops
                .order('hopped_at', { ascending: false });

            if (hopsError) {
                console.error('[Talent] Error fetching hops:', hopsError);
                hopsGrid.innerHTML = '<p style="color:red">Error loading hops.</p>';
            } else {
                console.log('[Talent] Hops found:', hops ? hops.length : 0);

                if (hops && hops.length > 0) {
                    hopsGrid.innerHTML = hops.map(hop => {
                        // Simple Square Card
                        const dateStr = new Date(hop.hopped_at).toLocaleDateString();
                        return `
                        <div class="talent-hop-card" onclick="window.showHoppingDetails(event, '${hop.image_url}', '${hop.hopped_at}', '${hop.rating}', '${(hop.description || '').replace(/'/g, "\\'")}', '${hop.id}', '${hop.user_id}')">
                            <img src="${hop.image_url}" class="talent-hop-img" loading="lazy">
                            <div class="talent-hop-overlay">
                                <div class="talent-hop-rating">${'★'.repeat(hop.rating)}</div>
                                <div class="talent-hop-date">${dateStr}</div>
                            </div>
                        </div>
                     `;
                    }).join('');
                } else {
                    if (hopsGrid.parentElement) hopsGrid.parentElement.style.display = 'none'; // Hide section if no hops
                }
            }
        }


    } catch (err) {
        console.error('Talent Page Error:', err);
    }
};
