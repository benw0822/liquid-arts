
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
                    // 7.1 Fetch Full Bar Info (Title + Location for Maps)
                    const barIds = [...new Set(hops.map(h => h.bar_id).filter(id => id))];
                    let barMap = {};
                    if (barIds.length > 0) {
                        const { data: hopBars } = await window.supabaseClient
                            .from('bars')
                            .select('id, title, lat, lng, address, location')
                            .in('id', barIds);
                        if (hopBars) {
                            hopBars.forEach(b => barMap[b.id] = b);
                        }
                    }

                    // 7.2 Store in Global Cache for Gallery
                    const enrichedHops = hops.map(h => ({ ...h, bar: barMap[h.bar_id] || {}, bar_title: (barMap[h.bar_id] || {}).title || '' }));
                    window.talentHoppingsCache = enrichedHops;

                    // 7.3 Render Art-Card Style
                    hopsGrid.innerHTML = enrichedHops.map(hop => {
                        const bar = hop.bar;
                        const dateStr = new Date(hop.hopped_at).toLocaleDateString();
                        const stars = '★'.repeat(parseInt(hop.rating)) + '☆'.repeat(5 - parseInt(hop.rating));
                        const ratingLabels = ['', 'Poor', 'Fair', 'Enjoyable', 'Remarkable', 'Masterpiece'];
                        const ratingText = ratingLabels[parseInt(hop.rating)] || '';

                        // Google Map URL
                        const mapUrl = bar.lat && bar.lng
                            ? `https://www.google.com/maps/search/?api=1&query=${bar.lat},${bar.lng}`
                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bar.address || bar.location || '')}`;

                        return `
                        <div class="art-card" onclick="window.openGenericHoppingGallery(event, '${hop.id}', 'talentHoppingsCache')" style="position: relative; cursor: pointer; display: flex; flex-direction: column; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                             
                             <div style="width: 100%; aspect-ratio: 1/1; overflow: hidden; position: relative; z-index: 1;">
                                <img src="${hop.image_url}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                             </div>
                             
                             <div style="padding: 1.5rem 1rem; text-align: center; background: white; flex: 1; display: flex; flex-direction: column; position: relative; z-index: 2;">
                                <!-- Bar Title -->
                                ${bar.title ? `<div style="margin-bottom: 0.5rem; position: relative; z-index: 30;"><a href="bar-details.html?id=${bar.id}" onclick="event.stopPropagation();" style="text-decoration: none; color: inherit; display: inline-block; padding: 5px;"><h3 style="font-family: var(--font-display); font-size: 1.4rem; margin: 0; color: #1b1b1b; transition: color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#1b1b1b'">${bar.title}</h3></a></div>` : ''}

                                <div style="color: var(--bg-red); font-size: 1.2rem; margin-bottom: 0.2rem; letter-spacing: 2px;">${stars}</div>
                                ${ratingText ? `<div style="font-weight: 600; font-size: 0.8rem; text-transform: uppercase; color: #333; margin-bottom: 0.5rem;">${ratingText}</div>` : ''}

                                <div style="font-family: var(--font-display); font-size: 0.9rem; color: #666; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5rem;">${dateStr}</div>

                                <!-- Description -->
                                ${hop.description ? `<p style="font-size: 0.95rem; color: #555; margin: 0 0 1rem 0; line-height: 1.4; font-style: italic;">"${hop.description}"</p>` : ''}

                                <!-- Mini Map (Dark Theme) -->
                                <div id="talent-hop-map-${hop.id}" class="card-map" style="height: 150px; width: 100%; border-radius: 4px; margin-bottom: 8px;"></div>
                                
                                <!-- Google Map Button -->
                                <div style="margin-top: auto; position: relative; z-index: 30;">
                                    <a href="${mapUrl}" target="_blank" onclick="event.stopPropagation()" class="btn" style="display: flex; justify-content: center; align-items: center; gap: 8px; width: 100%; background-color: var(--bg-red); color: white; padding: 10px 0; border-radius: 4px; text-decoration: none; transition: background 0.3s; margin-top: 0;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M14.082 2.182a.5.5 0 0 1 .103.557L8.528 15.467a.5.5 0 0 1-.917-.007L5.57 10.694.803 8.652a.5.5 0 0 1-.006-.916l12.728-5.657a.5.5 0 0 1 .556.103z"/></svg>
                                        <span style="font-size: 0.9rem; font-weight: 600;">Google Map</span>
                                    </a>
                                </div>
                             </div>
                        </div>`;
                    }).join('');

                    // 7.4 Initialize Maps (Leaflet)
                    setTimeout(() => {
                        enrichedHops.forEach(hop => {
                            const bar = hop.bar;
                            if (bar && bar.lat && bar.lng) {
                                const mapId = `talent-hop-map-${hop.id}`;
                                const el = document.getElementById(mapId);
                                if (el && !el._leaflet_id && window.L) {
                                    const map = L.map(mapId, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false }).setView([bar.lat, bar.lng], 15);
                                    // Use Dark Theme Layer
                                    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19 }).addTo(map);

                                    // Custom Marker
                                    const markerHtml = `
                                        <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
                                            <div style="background: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; color: #333; box-shadow: 0 1px 2px rgba(0,0,0,0.15); margin-bottom: 3px; white-space: nowrap;">
                                                ${bar.title || ''}
                                            </div>
                                            <div style="width: 14px; height: 14px; background: #ef4444; border: 2px solid white; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.2);"></div>
                                        </div>
                                    `;
                                    const customIcon = L.divIcon({ className: 'custom-map-marker', html: markerHtml, iconSize: [0, 0], iconAnchor: [0, 0] });
                                    L.marker([bar.lat, bar.lng], { icon: customIcon }).addTo(map);

                                    el.style.pointerEvents = 'none'; // Static map
                                }
                            } else {
                                // Hide map container if no lat/lng
                                const el = document.getElementById(`talent-hop-map-${hop.id}`);
                                if (el) el.style.display = 'none';
                            }
                        });
                    }, 500);

                } else {
                    if (hopsGrid.parentElement) hopsGrid.parentElement.style.display = 'none'; // Hide section if no hops
                }
            }
        }


    } catch (err) {
        console.error('Talent Page Error:', err);
    }
};
