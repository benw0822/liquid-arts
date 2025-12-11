// --- Supabase Configuration (Global) ---
const SUPABASE_URL = 'https://wgnskednopbfngvjmviq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P';
// Attach to window so other scripts (like profile.html) can use it
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// Also keep a local alias for app.js internal use
const supabase = window.supabaseClient;
console.log('Connected to Supabase');

document.addEventListener('DOMContentLoaded', () => {

    // --- Save/Favorite Logic (Supabase) ---
    window.savedBarIds = new Set();
    window.savedArticleIds = new Set();
    window.currentUser = null;

    // 1. Auth & Saved Init (Global)
    window.initAuthAndSaved = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        window.currentUser = session?.user || null;
        window.savedBarIds = new Set();
        window.savedArticleIds = new Set();

        if (window.currentUser) {
            // Fetch Saved Bars
            const { data: bars } = await supabase.from('saved_bars').select('bar_id');
            if (bars) window.savedBarIds = new Set(bars.map(r => r.bar_id));

            // Fetch Saved Articles
            const { data: articles } = await supabase.from('saved_articles').select('article_id');
            if (articles) window.savedArticleIds = new Set(articles.map(r => r.article_id));
        }
    };


    window.toggleSaveBar = async (id, event) => {
        if (event) { event.preventDefault(); event.stopPropagation(); }

        if (!window.currentUser) {
            alert('Please log in to save bars.');
            return;
        }

        const isSaved = window.savedBarIds.has(id);
        const newStatus = !isSaved;

        // Optimistic UI Update
        if (newStatus) window.savedBarIds.add(id);
        else window.savedBarIds.delete(id);

        document.querySelectorAll(`.save-btn-${id}`).forEach(btn => {
            const icon = btn.querySelector('svg');
            icon.setAttribute('fill', newStatus ? '#ef4444' : 'none');
            icon.setAttribute('stroke', newStatus ? '#ef4444' : '#333');
        });

        // DB Update
        if (newStatus) {
            await supabase.from('saved_bars').insert({ user_id: window.currentUser.id, bar_id: id });
        } else {
            await supabase.from('saved_bars').delete().match({ user_id: window.currentUser.id, bar_id: id });
        }
    };

    // Toggle Saved Article
    window.toggleSaveArticle = async (id, event) => {
        if (event) { event.preventDefault(); event.stopPropagation(); }

        if (!window.currentUser) {
            alert('Please log in to save articles.');
            return;
        }

        const isSaved = window.savedArticleIds.has(id);
        const newStatus = !isSaved;

        // Optimistic UI Update
        if (newStatus) window.savedArticleIds.add(id);
        else window.savedArticleIds.delete(id);

        const updateUI = () => {
            document.querySelectorAll(`.save-article-btn-${id}`).forEach(btn => {
                const icon = btn.querySelector('svg');
                const active = window.savedArticleIds.has(id);
                icon.setAttribute('fill', active ? '#ef4444' : 'none');
                icon.setAttribute('stroke', active ? '#ef4444' : '#333');
            });
        };
        updateUI();

        // DB Update
        let error;
        if (newStatus) {
            const { error: err } = await supabase.from('saved_articles').insert({ user_id: window.currentUser.id, article_id: id });
            error = err;
        } else {
            const { error: err } = await supabase.from('saved_articles').delete().match({ user_id: window.currentUser.id, article_id: id });
            error = err;
        }

        if (error) {
            console.error('Save Article Error:', error);
            // Revert
            if (newStatus) window.savedArticleIds.delete(id);
            else window.savedArticleIds.add(id);
            updateUI();

            if (error.code === '42P01') { // Undefined Table
                alert('System Setup Required: Please run saved_articles_migration.sql to create the saved_articles table.');
            } else if (error.code === '23503') { // Foreign Key Violation
                alert('Cannot save this article. It might be local mock data that is not in the database.');
            } else {
                alert('Failed to save article: ' + error.message);
            }
        }
    };

    // --- Local Mock Data (Extended) ---
    const mockBars = [
        {
            id: 1,
            title: "Midnight Mixology",
            location: "Taipei, Xinyi",
            vibe: "Speakeasy",
            image: "assets/gallery_1.png",
            lat: 25.0330,
            lng: 121.5654,
            price: 2,
            rating: 4.8,
            owner_name: "Alex Chen",
            bartender_name: "Sarah Lin",
            opening_hours: "Mon-Sun: 20:00 - 02:00",
            phone: "+886 2 1234 5678",
            menu_url: "#",
            description: "Hidden behind a bookshelf, Midnight Mixology offers an intimate atmosphere with bespoke cocktails inspired by classic literature."
        },
        { id: 2, title: "The Glass Sculptor", location: "Tokyo, Ginza", vibe: "High-End", image: "assets/gallery_2.png", lat: 35.6712, lng: 139.7665, price: 3, rating: 4.9 },
        { id: 3, title: "Urban Nightlife", location: "New York, SoHo", vibe: "Lounge", image: "assets/gallery_3.png", lat: 40.7233, lng: -74.0030, price: 2, rating: 4.7 },
        { id: 4, title: "Signature Pour", location: "London, Shoreditch", vibe: "Craft Cocktails", image: "assets/gallery_1.png", lat: 51.5260, lng: -0.0782, price: 2, rating: 4.6 },
        { id: 5, title: "Amber Glow", location: "Seoul, Hongdae", vibe: "Jazz Bar", image: "assets/gallery_2.png", lat: 37.5575, lng: 126.9245, price: 1, rating: 4.8 },
        { id: 6, title: "Cocktail Geometry", location: "Singapore, Marina", vibe: "Rooftop", image: "assets/gallery_3.png", lat: 1.2834, lng: 103.8607, price: 3, rating: 4.9 }
    ];

    const mockArticles = [
        { id: 1, title: "The Art of Ice", excerpt: "Why clear ice matters in modern mixology.", image: "assets/gallery_1.png", date: "2024-11-20", category: "Education" },
        { id: 2, title: "Tokyo Bar Week 2024", excerpt: "The ultimate gathering of mixologists in Ginza.", image: "assets/gallery_2.png", date: "2024-11-18", category: "Event", event_start: "2024-12-01", event_end: "2024-12-07" },
        { id: 3, title: "Sustainable Sipping", excerpt: "How bars are going zero-waste.", image: "assets/gallery_3.png", date: "2024-11-15", category: "Feature" }
    ];

    // --- Data Fetching ---
    async function fetchBars() {
        try {
            // Fetch bars with their related images and articles
            // Note: Supabase join syntax depends on foreign keys
            const { data, error } = await supabase
                .from('bars')
                .select(`
                    *,
                    bar_images (image_url, caption, display_order),
                    signatures (*),
                    bar_awards (*),
                    article_bars (
                        article:articles (id, title, excerpt, cover_image, published_at, category, start_date, end_date)
                    )
                `);

            if (error) {
                console.error('Error fetching bars:', error);
                // Fallback to empty or simple select if relations fail?
                // For now, return empty to avoid "Fake Data" confusion.
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('Unexpected error fetching bars:', err);
            return [];
        }
    }

    async function fetchArticles() {
        try {
            const { data, error } = await supabase.from('articles').select('*');
            if (error || !data || data.length === 0) return mockArticles;
            return data;
        } catch (err) {
            return mockArticles;
        }
    }

    // --- Page Init Functions ---

    // 1. Home Page
    // (Duplicate initHome Removed)

    // 2. Bar List Page (Explore)
    // (Duplicate initBarList Removed)

    // 3. Bar Details Page
    window.initBarDetails = async () => {
        // Code hidden, handled in previous tasks
    };

    // 4. Map Page
    window.initMap = async () => {
        // Code hidden
    };

    // 5. Articles List
    window.initArticlesList = async () => {
        await initAuthAndSaved();
        const articles = await fetchArticles();
        const grid = document.getElementById('articles-list-grid');
        if (grid) {
            grid.innerHTML = articles.map(article => createArticleCard(article)).join('');
        }
    };

    // 6. Article Details
    window.initArticleDetails = async () => {
        // Code hidden
    };

    // --- Helper Components ---

    // --- Helper Components ---
    // (createBarCard Removed: Replaced by global window.createBarCard)

    async function fetchArticles() {
        try {
            const { data, error } = await supabase.from('articles').select('*');
            if (error || !data || data.length === 0) return mockArticles;
            return data;
        } catch (err) {
            return mockArticles;
        }
    }

    // --- Page Init Functions ---

    // 1. Home Page
    window.initHome = async () => {
        await window.initAuthAndSaved();
        const bars = await fetchBars();
        const articles = await fetchArticles();

        const featuredGrid = document.getElementById('featured-grid');
        const articleGrid = document.getElementById('article-grid');
        const eventGrid = document.getElementById('event-grid');

        if (featuredGrid) {
            // Enrichment: Pre-calculate Cities for featured bars
            // USER REQUEST: Load 6 bars
            let featuredBars = bars.slice(0, 6);
            featuredBars = await Promise.all(featuredBars.map(async (bar) => {
                let city = bar.location;
                if (bar.lat && bar.lng) {
                    const resolved = await fetchCityFromCoordsGlobal(bar.lat, bar.lng);
                    if (resolved) city = resolved;
                }
                return { ...bar, cityDisplay: city };
            }));

            // Use GLOBAL window.createBarCard to ensure 1:1 match with Profile profile.html
            featuredGrid.innerHTML = featuredBars.map(bar => window.createBarCard(bar, bar.cityDisplay)).join('');

            // Init maps for featured bars
            featuredBars.forEach(bar => {
                if (bar.lat && bar.lng) {
                    setTimeout(() => window.initCardMapGlobal(bar.id, bar.lat, bar.lng, bar.title, window.savedBarIds.has(bar.id)), 100);
                }
                // Hopping Badge
                setTimeout(() => { if (window.renderHoppingBadge) window.renderHoppingBadge(bar.id); }, 500);
            });
        }

        // Filter Articles into Events vs Journal
        const eventCategories = ['event', 'activity'];
        const events = articles.filter(a => a.category && eventCategories.includes(a.category.toLowerCase()));
        const journal = articles.filter(a => !a.category || !eventCategories.includes(a.category.toLowerCase()));

        if (articleGrid) {
            // USER REQUEST: Load 6 journal articles (non-events)
            articleGrid.innerHTML = journal.slice(0, 6).map(article => createArticleCard(article)).join('');
        }

        if (eventGrid) {
            // USER REQUEST: Load 3 events
            eventGrid.innerHTML = events.slice(0, 3).map(article => createArticleCard(article)).join('');
        }
    };

    // 2. Bar List Page
    // 2. Bar List Page
    window.initBarList = async () => {
        await initAuthAndSaved(); // Wait for user & saved data
        let bars = await fetchBars();
        const grid = document.getElementById('bars-grid');
        const locationSelect = document.getElementById('filter-city');
        const vibeSelect = document.getElementById('filter-vibe');
        const priceSelect = document.getElementById('filter-price');
        const searchInput = document.getElementById('search-input');

        // Loading state
        if (grid) grid.innerHTML = '<p style="width:100%; text-align:center; color:#888;">Discovering locations...</p>';

        // 1. Pre-calculate Cities from Coords (for Filters & Display)
        bars = await Promise.all(bars.map(async (bar) => {
            let city = bar.location; // Fallback
            if (bar.lat && bar.lng) {
                const resolved = await fetchCityFromCoordsGlobal(bar.lat, bar.lng);
                if (resolved) city = resolved;
            }
            return { ...bar, cityDisplay: city };
        }));

        // 2. Populate Filters (Dynamic)
        if (bars.length > 0) {
            // Collect unique values from resolved cities
            const cities = [...new Set(bars.map(b => b.cityDisplay).filter(Boolean))].sort();
            const vibes = [...new Set(bars.map(b => b.vibe).filter(Boolean))].sort();

            if (locationSelect) {
                locationSelect.innerHTML = '<option value="">All Cities</option>' +
                    cities.map(c => `<option value="${c}">${c}</option>`).join('');
            }
            if (vibeSelect) {
                vibeSelect.innerHTML = '<option value="">All Vibes</option>' +
                    vibes.map(v => `<option value="${v}">${v}</option>`).join('');
            }
        }

        // 3. Render Function (Simplified)
        function render(items) {
            if (!grid) return;
            // Use GLOBAL window.createBarCard
            grid.innerHTML = items.map(bar => window.createBarCard(bar, bar.cityDisplay)).join('');

            // Initialize maps
            items.forEach(bar => {
                if (bar.lat && bar.lng) {
                    setTimeout(() => initCardMapGlobal(bar.id, bar.lat, bar.lng, bar.title, window.savedBarIds.has(bar.id)), 100);
                }
                // Hopping Badge
                setTimeout(() => { if (window.renderHoppingBadge) window.renderHoppingBadge(bar.id); }, 500);
            });
        }

        // 4. Filter Logic
        function filterBars() {
            const term = (searchInput.value || '').toLowerCase();
            const city = locationSelect ? locationSelect.value : '';
            const vibe = vibeSelect ? vibeSelect.value : '';
            const price = priceSelect ? priceSelect.value : '';

            const filtered = bars.filter(bar => {
                const matchSearch = (bar.title || '').toLowerCase().includes(term) || (bar.cityDisplay || '').toLowerCase().includes(term);
                const matchCity = !city || (bar.cityDisplay || '').includes(city); // Check against Resolved City
                const matchVibe = !vibe || bar.vibe === vibe;
                const matchPrice = !price || bar.price == price;
                return matchSearch && matchCity && matchVibe && matchPrice;
            });
            render(filtered);
        }

        if (searchInput) searchInput.addEventListener('input', filterBars);
        if (locationSelect) locationSelect.addEventListener('change', filterBars);
        if (vibeSelect) vibeSelect.addEventListener('change', filterBars);
        if (priceSelect) priceSelect.addEventListener('change', filterBars);

        render(bars);
    };

    // 2.5 Saved Bars Page
    window.initSavedList = async () => {
        await initAuthAndSaved();
        const grid = document.getElementById('bars-grid');

        if (!window.currentUser) {
            grid.innerHTML = '<p style="text-align:center; padding: 2rem;">Please <a href="admin.html">log in</a> to view your saved bars.</p>';
            return;
        }

        if (window.savedBarIds.size === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem;">
                    <h3 style="font-family: var(--font-display); color: #ccc;">No saved bars yet.</h3>
                    <a href="bars.html" class="btn" style="margin-top: 1rem; display: inline-block; background: var(--bg-red); color: white; padding: 10px 20px; border-radius: 30px; text-decoration: none;">Explore Bars</a>
                </div>
            `;
            return;
        }

        const allBars = await fetchBars();
        let savedBars = allBars.filter(b => window.savedBarIds.has(b.id));

        // Pre-calculate cities for saved bars too
        savedBars = await Promise.all(savedBars.map(async (bar) => {
            let city = bar.location;
            if (bar.lat && bar.lng) {
                const resolved = await fetchCityFromCoordsGlobal(bar.lat, bar.lng);
                if (resolved) city = resolved;
            }
            return { ...bar, cityDisplay: city };
        }));

        grid.innerHTML = savedBars.map(bar => createBarCard(bar, bar.cityDisplay)).join('');

        savedBars.forEach(bar => {
            if (bar.lat && bar.lng) setTimeout(() => initCardMapGlobal(bar.id, bar.lat, bar.lng, bar.title, true), 100);
        });
    };
    // 3. Map Page
    // 3. Map Page
    window.initMap = async () => {
        // Ensure auth/saved state
        await window.initAuthAndSaved();

        const allBars = await fetchBars();
        // Default View
        const map = L.map('map', { zoomControl: false }).setView([25.0330, 121.5654], 14);
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Dark Theme Tiles matching Bar Cards
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        let userMarker = null;

        // Custom Locate Control
        const LocateControl = L.Control.extend({
            options: { position: 'bottomright' },
            onAdd: function (map) {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
                container.style.backgroundColor = 'white';
                container.style.width = '30px';
                container.style.height = '30px';
                container.style.cursor = 'pointer';
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.justifyContent = 'center';
                container.title = "Center to my location";

                // Hover effect
                container.onmouseover = () => container.style.backgroundColor = '#f4f4f4';
                container.onmouseout = () => container.style.backgroundColor = 'white';

                container.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#333" viewBox="0 0 16 16">
                         <path d="M8 16a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0-1A7 7 0 1 1 8 2a7 7 0 0 1 0 14zm0-7a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
                    </svg>
                `;

                container.onclick = function (e) {
                    L.DomEvent.stopPropagation(e);
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(position => {
                            const lat = position.coords.latitude;
                            const lng = position.coords.longitude;

                            map.flyTo([lat, lng], 15);

                            if (userMarker) {
                                userMarker.setLatLng([lat, lng]);
                            } else {
                                const userIcon = L.divIcon({
                                    className: 'user-marker-a',
                                    html: `<div style="color: #D4AF37; font-family: 'Playfair Display', serif; font-size: 32px; font-weight: bold; line-height: 1; text-shadow: 0 2px 10px rgba(0,0,0,0.6); transform: translate(-50%, -50%);">A</div>`,
                                    iconSize: [40, 40],
                                    iconAnchor: [20, 20]
                                });
                                userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
                                userMarker.bindPopup('<div style="color:#333; font-weight:bold;">Current Location</div>');
                            }
                        }, () => alert('Unable to retrieve location.'));
                    }
                };
                return container;
            }
        });
        map.addControl(new LocateControl());

        const markersLayer = L.featureGroup().addTo(map);
        let isFilteringSaved = false;

        // Custom Saved Filter Control
        const SavedFilterControl = L.Control.extend({
            options: { position: 'topright' },
            onAdd: function (map) {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
                container.style.backgroundColor = 'white';
                container.style.width = '34px';
                container.style.height = '34px';
                container.style.cursor = 'pointer';
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.justifyContent = 'center';
                container.style.position = 'relative'; // For badge
                container.title = "Show Saved Bars Only";
                container.style.overflow = 'visible'; // Fix for mobile layout clipping/shift
                container.style.boxSizing = 'border-box';

                // Hover effect
                container.onmouseover = () => container.style.backgroundColor = '#f4f4f4';
                container.onmouseout = () => {
                    if (!isFilteringSaved) container.style.backgroundColor = 'white';
                };

                const savedCount = window.savedBarIds ? window.savedBarIds.size : 0;

                container.innerHTML = `
                    <svg id="saved-filter-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="#333" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    <div id="saved-filter-badge" style="position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; font-size: 10px; font-weight: bold; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.3); ${savedCount > 0 ? '' : 'display: none;'}">
                        ${savedCount}
                    </div>
                `;

                container.onclick = function (e) {
                    L.DomEvent.stopPropagation(e);
                    isFilteringSaved = !isFilteringSaved;

                    const icon = container.querySelector('#saved-filter-icon');
                    if (isFilteringSaved) {
                        container.style.backgroundColor = '#FFF0F0'; // Light red bg
                        icon.style.fill = '#ef4444';
                        icon.style.stroke = '#ef4444';
                    } else {
                        container.style.backgroundColor = 'white';
                        icon.style.fill = 'none';
                        icon.style.stroke = '#333';
                    }

                    const barsToRender = isFilteringSaved
                        ? allBars.filter(bar => window.savedBarIds.has(bar.id))
                        : allBars;

                    renderBars(barsToRender);

                    if (markersLayer.getLayers().length > 0) {
                        map.fitBounds(markersLayer.getBounds().pad(0.2));
                    }
                };
                return container;
            }
        });
        map.addControl(new SavedFilterControl());




        // Helper: Haversine Distance (km)
        const getDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        const renderBars = (barsToRender) => {
            markersLayer.clearLayers();
            barsToRender.forEach(bar => {
                if (bar.lat && bar.lng) {
                    const isSaved = window.savedBarIds.has(bar.id);
                    // Custom Marker
                    let iconHtml;
                    if (isSaved) {
                        // Golden Heart with Label
                        iconHtml = `
                            <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); cursor: pointer;">
                                <div style="background: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; color: #333; box-shadow: 0 1px 4px rgba(0,0,0,0.5); margin-bottom: 3px; white-space: nowrap;">
                                    ${bar.title}
                                </div>
                                <div style="display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.6));">
                                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="#FFD700" stroke="white" stroke-width="1.5" viewBox="0 0 16 16" style="overflow: visible;">
                                        <path fill-rule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/>
                                    </svg>
                                </div>
                            </div>
                        `;
                    } else {
                        // Red Dot with Label (Default)
                        iconHtml = `
                            <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); cursor: pointer;">
                                <div style="background: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; color: #333; box-shadow: 0 1px 4px rgba(0,0,0,0.5); margin-bottom: 3px; white-space: nowrap;">
                                    ${bar.title}
                                </div>
                                <div style="width: 14px; height: 14px; background: #ef4444; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);"></div>
                            </div>
                        `;
                    }

                    const customIcon = L.divIcon({
                        className: 'custom-map-marker',
                        html: iconHtml,
                        iconSize: [0, 0],
                        iconAnchor: [0, 0]
                    });

                    const marker = L.marker([bar.lat, bar.lng], { icon: customIcon }).addTo(markersLayer);
                    marker.bindPopup(`
                        <div style="color: #333; text-align: center; min-width: 150px;">
                            <h3 style="margin: 0 0 5px 0; font-family: var(--font-display); font-size: 1.1rem;">${bar.title}</h3>
                            <p style="margin: 0 0 10px 0; font-size: 0.85rem; color: #666;">${bar.location}</p>
                            <a href="bar-details.html?id=${bar.id}" style="display: inline-block; padding: 6px 16px; background: #9c100f; color: white; border-radius: 20px; text-decoration: none; font-size: 0.8rem;">View Details</a>
                        </div>
                    `);
                    // No need to push to markers array anymore
                }
            });
        };

        // Get Location Logic
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;

                // User "Golden A" Marker
                const userIcon = L.divIcon({
                    className: 'user-marker-a',
                    html: `<div style="color: #D4AF37; font-family: 'Playfair Display', serif; font-size: 32px; font-weight: bold; line-height: 1; text-shadow: 0 2px 10px rgba(0,0,0,0.6); transform: translate(-50%, -50%);">A</div>`,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                });
                userMarker = L.marker([userLat, userLng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
                userMarker.bindPopup('<div style="color:#333; font-weight:bold;">Current Location</div>');
                // markers.push(userMarker); // User marker works independently


                // Filter Distances for Zoom (but show ALL bars)
                const barsWithDist = allBars.map(b => {
                    const dist = (b.lat && b.lng) ? getDistance(userLat, userLng, b.lat, b.lng) : Infinity;
                    return { ...b, distance: dist };
                });

                // Render ALL bars
                renderBars(allBars);

                // Find Nearest 3 for Zooming
                const nearestForZoom = barsWithDist
                    .sort((a, b) => a.distance - b.distance)
                    .slice(0, 3); // Top 3

                // Calculate Bounds for User + Nearest 3
                // We need to access the MARKERS corresponding to these bars.
                // Since renderBars pushes to 'markers' array in order of iteration (which was allbars),
                // we can't easily index them by ID unless we find them.
                // Easier: Create temporary LatLngBounds from User + Nearest 3 coords.
                const bounds = L.latLngBounds();
                bounds.extend([userLat, userLng]);
                nearestForZoom.forEach(b => {
                    if (b.lat && b.lng) bounds.extend([b.lat, b.lng]);
                });

                // Fit Bounds
                if (bounds.isValid()) {
                    map.fitBounds(bounds.pad(0.2)); // Pad 0.2
                } else {
                    map.setView([userLat, userLng], 14);
                }

            }, (err) => {
                console.warn('Geolocation denied/error:', err);
                // Fallback: Show All
                renderBars(allBars);
                if (markersLayer.getLayers().length > 0) {
                    map.fitBounds(markersLayer.getBounds().pad(0.1));
                }
            });
        } else {
            // No Geolocation support: Show All
            renderBars(allBars);
            if (markersLayer.getLayers().length > 0) {
                map.fitBounds(markersLayer.getBounds().pad(0.1));
            }
        }
    };
    // --- Helper: Fetch Talents for Bar ---
    window.fetchTalentsForBar = async (barId) => {
        // Query talents where bar_roles JSONB column contains the barId
        // Note: Supabase JSONB filtering syntax
        // stored bar_id is a string (from HTML select)
        const queryTag = [{ bar_id: String(barId) }];

        const { data, error } = await window.supabaseClient
            .from('talents')
            .select('*')
            .contains('bar_roles', JSON.stringify(queryTag));

        if (error) {
            console.warn('Error fetching talents for bar:', error);
            return [];
        }
        return data || [];
    };

    // 4. Bar Details Page
    window.initBarDetails = async () => {
        await initAuthAndSaved();
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        const container = document.getElementById('bar-detail-container');

        if (!id) {
            container.innerHTML = '<p style="text-align:center; margin-top: 50px;">Bar not found.</p>';
            return;
        }

        const bars = await fetchBars();
        const bar = bars.find(b => b.id == id);

        if (!bar) {
            container.innerHTML = '<p style="text-align:center; margin-top: 50px;">Bar not found.</p>';
            return;
        }

        // --- Social Links ---
        const socialLinks = bar.social_links || {};
        let socialHtml = '';
        if (bar.instagram_url) socialHtml += `<a href="${bar.instagram_url}" target="_blank" style="color:white; margin-right:10px;">Instagram</a>`;
        if (bar.facebook_url) socialHtml += `<a href="${bar.facebook_url}" target="_blank" style="color:white; margin-right:10px;">Facebook</a>`;
        if (bar.website_url) socialHtml += `<a href="${bar.website_url}" target="_blank" style="color:white;">Book Now</a>`;

        // --- Gallery ---
        let galleryHtml = '';
        window.currentGalleryImages = []; // Global store
        if (bar.bar_images && bar.bar_images.length > 0) {
            const sortedImages = bar.bar_images.sort((a, b) => a.display_order - b.display_order);
            window.currentGalleryImages = sortedImages.map(img => img.image_url);

            galleryHtml = `
                <div class="content-card">
                    <h3 class="section-title">Gallery</h3>
                    <div class="gallery-grid">
                        ${sortedImages.map((img, index) => `
                            <div class="grid-item" style="grid-column: span 1; margin-bottom: 0;">
                                <img src="${img.image_url}" alt="${img.caption || ''}" 
                                     style="width:100%; height:150px; object-fit:cover; border-radius:4px; cursor: pointer; transition: opacity 0.2s;"
                                     onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1"
                                     onclick="openLightbox(${index})">
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // --- Lightbox Functions ---
        window.currentLightboxIndex = 0;

        window.openLightbox = (index) => {
            const modal = document.getElementById('lightbox-modal');
            const img = document.getElementById('lightbox-img');
            if (window.currentGalleryImages && window.currentGalleryImages[index]) {
                window.currentLightboxIndex = index;
                img.src = window.currentGalleryImages[index];
                modal.style.display = "flex";
            }
        };

        window.changeLightboxImage = (direction) => {
            if (!window.currentGalleryImages || window.currentGalleryImages.length === 0) return;

            let newIndex = window.currentLightboxIndex + direction;
            // Loop functionality
            if (newIndex < 0) newIndex = window.currentGalleryImages.length - 1;
            if (newIndex >= window.currentGalleryImages.length) newIndex = 0;

            window.currentLightboxIndex = newIndex;
            const img = document.getElementById('lightbox-img');
            img.src = window.currentGalleryImages[newIndex];
        };

        window.closeLightbox = () => {
            document.getElementById('lightbox-modal').style.display = "none";
        };

        // --- Related Articles ---
        let articlesHtml = '';
        if (bar.article_bars && bar.article_bars.length > 0) {
            articlesHtml = `
                <div class="content-card">
                    <h3 class="section-title">Journal</h3>
                    <div class="magazine-grid">
                        ${bar.article_bars.map(ba => createArticleCard(ba.article)).join('')}
                    </div>
                </div>
            `;
        }

        // --- Talent Card (New) ---
        let talentCardHtml = '';
        if (window.fetchTalentsForBar) {
            const talents = await window.fetchTalentsForBar(bar.id);
            if (talents && talents.length > 0) {
                // Show the first linked talent
                const talent = talents[0];
                const roleObj = talent.bar_roles.find(r => r.bar_id == bar.id) || {};
                const roleName = roleObj.role || 'Talent';

                // Prepare Lists (Experience & Awards)
                let expSection = '';
                if (talent.experiences && talent.experiences.length > 0) {
                    const sortedExp = talent.experiences.sort((a, b) => b.year - a.year).slice(0, 3);
                    expSection = `
                        <div style="margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 1rem;">
                            <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.85rem; opacity: 0.9; line-height: 1.5; font-family: var(--font-main);">
                                ${sortedExp.map(e => `<li><span style="opacity:0.7">${e.year}</span> ${e.unit}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                }

                let awardSection = '';
                if (talent.awards && talent.awards.length > 0) {
                    const sortedAwd = talent.awards.sort((a, b) => b.year - a.year).slice(0, 3);
                    awardSection = `
                        <div style="margin-top: 1rem;">
                            <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.85rem; opacity: 0.9; line-height: 1.5; font-family: var(--font-main);">
                                ${sortedAwd.map(a => `<li style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><span style="opacity:0.7">🏆</span> ${a.name}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                }

                talentCardHtml = `
                    <div class="grid-item content-card" style="background-color: var(--bg-red); color: white; border: none; margin-bottom: 30px; position: relative; overflow: hidden; padding: 2rem 1rem; text-align: center;">
                        
                        <!-- Image Component -->
                        <div style="position: relative; width: 200px; height: 200px; margin: 1rem auto 1.5rem auto;">
                            <!-- Decorative Offset Circle -->
                            <div style="position: absolute; top: 0; left: -12px; width: 100%; height: 100%; border: 1px solid rgba(255,255,255,0.5); border-radius: 50%; pointer-events: none; z-index: 0;"></div>

                            <!-- Main Image Circle -->
                            <div style="width: 100%; height: 100%; border-radius: 50%; overflow: hidden; position: relative; z-index: 1; box-shadow: 10px 10px 30px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2);">
                                <img src="${talent.image_url || 'assets/default_avatar.png'}" style="width: 100%; height: 100%; object-fit: cover; filter: grayscale(100%) contrast(1.1);">
                            </div>

                            <!-- Curved Text (SVG) -->
                            <svg viewBox="0 0 320 320" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10; pointer-events: none; overflow: visible; transform: scale(1.08);">
                                <path id="curve-${bar.id}" d="M -20,190 A 190,190 0 0,1 190,-20" fill="none" />
                                <text font-family="'Playfair Display', serif" font-size="28" fill="white" letter-spacing="3" text-transform="uppercase">
                                    <textPath href="#curve-${bar.id}" startOffset="25%" text-anchor="middle">TALENT</textPath>
                                </text>
                            </svg>

                            <!-- Overlay Name -->
                            <div style="position: absolute; bottom: -15px; left: 50%; transform: translateX(-50%); width: 220%; text-align: center; font-family: 'Playfair Display', serif; font-size: 1.8rem; line-height: 1; z-index: 20; text-shadow: 0 5px 15px rgba(0,0,0,0.5); pointer-events: none; font-style: italic; white-space: nowrap;">
                                ${talent.display_name}
                            </div>
                        </div>

                        <!-- Content -->
                        <div style="position: relative; z-index: 2;">
                            <div style="margin-bottom: 0.5rem; font-family: var(--font-main); text-transform: uppercase; letter-spacing: 1px; font-size: 0.85rem; font-weight: 600;">
                                ${roleName}
                            </div>

                            <!-- Quote Mark -->
                            <div style="font-family: 'Playfair Display', serif; font-size: 3.5rem; line-height: 1; margin-bottom: -1.5rem; opacity: 1; color: white; position: relative; z-index: 10; display: inline-block; background: var(--bg-red); padding: 0 8px;">
                                “
                            </div>

                            <!-- Separator -->
                            <div style="width: 100%; height: 1px; background: rgba(255,255,255,0.3); margin: 0 auto 1rem auto;"></div>

                            ${talent.quote ? `
                                <h2 style="font-family: 'Playfair Display', serif; font-size: 1.1rem; font-style: italic; margin-bottom: 1rem; font-weight: 400; line-height: 1.5; padding: 0 0.5rem;">
                                    ${talent.quote}
                                </h2>
                            ` : ''}

                            ${expSection}
                            ${awardSection}

                            <div style="width: 100%; height: 1px; background: rgba(255,255,255,0.3); margin: 1.5rem auto 1.5rem auto;"></div>

                            <a href="talent.html?id=${talent.id}" style="display: inline-block; padding: 8px 20px; background: white; color: var(--bg-red); border-radius: 30px; text-decoration: none; font-size: 0.85rem; font-weight: 700; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                View Profile
                            </a>
                        </div>
                    </div>
                `;
            }
        }

        // --- Hopping Card (New) ---
        let hoppingCardHtml = '';
        if (window.fetchRecentHoppings) {
            // Fetch 8 recent hops
            const hops = await window.fetchRecentHoppings(bar.id, 8);
            if (hops && hops.length > 0) {
                // Cache for gallery
                window.barHoppingsCache = window.barHoppingsCache || {};
                window.barHoppingsCache[bar.id] = hops;

                hoppingCardHtml = `
                    <div class="grid-item content-card" style="margin-bottom: 30px; text-align: center;">
                        <h3 class="section-title">HOPS</h3>
                        
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 1.5rem;">
                            ${hops.map(hop => `
                                <div style="aspect-ratio: 1/1; border-radius: 4px; overflow: hidden; cursor: pointer; position: relative;"
                                     onclick="window.openHoppingGallery(event, '${hop.id}', '${bar.id}')">
                                    <img src="${hop.image_url}" style="width: 100%; height: 100%; object-fit: cover;">
                                </div>
                            `).join('')}
                        </div>

                        <button onclick="window.openHoppingModal(${bar.id})" class="btn" style="background-color: var(--bg-red); color: white; border: none; padding: 10px 24px; border-radius: 30px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4); transition: transform 0.2s;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"></path><path d="M12 15v7"></path><path d="M2 3h20L12 15z"></path></svg>
                            HOP HERE !
                        </button>
                    </div>
                    `;
            } else {
                // Empty State
                hoppingCardHtml = `
                    <div class="grid-item content-card" style="margin-bottom: 30px; text-align: center;">
                        <h3 class="section-title">HOPS</h3>
                        <p style="color: #888; margin-bottom: 1.5rem; font-style: italic;">Be the first to Hop here!</p>
                        <button onclick="window.openHoppingModal(${bar.id})" class="btn" style="background-color: var(--bg-red); color: white; border: none; padding: 10px 24px; border-radius: 30px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4); transition: transform 0.2s;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"></path><path d="M12 15v7"></path><path d="M2 3h20L12 15z"></path></svg>
                            HOP HERE !
                        </button>
                    </div>
                    `;
            }
        }

        // --- Editorial Review ---

        // --- Signatures ---
        let signaturesHtml = '';
        if (bar.signatures && bar.signatures.length > 0) {
            const hasMultiple = bar.signatures.length > 1;

            signaturesHtml = `
                    <div class="content-card">
                    <h3 class="section-title">Signature</h3>
                    
                    <div class="signature-carousel-container" style="position: relative; overflow: hidden;">
                        <div class="signature-track" id="sig-track-${bar.id}" style="display: flex; transition: transform 0.3s ease-in-out;">
                            ${bar.signatures.map(sig => `
                                <div class="signature-slide" style="min-width: 100%; box-sizing: border-box; padding: 0 5px;">
                                    <div style="border: 1px solid #eee; border-radius: 8px; overflow: hidden; height: 100%; background: #f9f9f9; display: flex; flex-direction: column;">
                                        <div style="position: relative; width: 100%; padding-top: 125%;"> <!-- 4:5 Aspect Ratio -->
                                            <img src="${sig.image_url || 'assets/placeholder.jpg'}" alt="${sig.name}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;">
                                        </div>
                                        <div style="padding: 15px; flex: 1; display: flex; flex-direction: column;">
                                            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px;">
                                                <h4 style="margin: 0; font-family: var(--font-display); font-size: 1.2rem; color: var(--text-primary);">${sig.name}</h4>
                                                ${sig.price ? `<span style="font-weight: 600; color: var(--bg-red); font-size: 1rem;">${sig.price}</span>` : ''}
                                            </div>
                                            <p style="font-size: 0.9rem; color: #666; margin: 0 0 10px 0; line-height: 1.4; flex: 1;">${sig.description || ''}</p>
                                            ${sig.review ? `<p style="margin-top: auto; font-size: 0.85rem; color: var(--bg-red); font-style: italic; border-top: 1px solid #eee; padding-top: 8px;">"${sig.review}"</p>` : ''}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        ${hasMultiple ? `
                            <button onclick="prevSignature('${bar.id}')" style="position: absolute; top: 50%; left: 0; transform: translateY(-50%); background: none; border: none; cursor: pointer; z-index: 10; color: var(--bg-red);">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </button>
                            <button onclick="nextSignature('${bar.id}')" style="position: absolute; top: 50%; right: 0; transform: translateY(-50%); background: none; border: none; cursor: pointer; z-index: 10; color: var(--bg-red);">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        ` : ''}
                    </div>
                </div >
                    `;

            // Initialize carousel state
            window.carouselStates = window.carouselStates || {};
            window.carouselStates[bar.id] = { index: 0, count: bar.signatures.length };
        }

        if (bar.editorial_review) {
            // --- Masonry Grid Layout (Review Present) ---
            container.innerHTML = `
                    < !--Top Header-- >
                <div class="container" style="margin-top: 100px; margin-bottom: 2rem; text-align: center;">
                    <h1 style="font-size: 3.5rem; margin-bottom: 0.5rem; color: var(--text-primary); line-height: 1.2;">${bar.title}</h1>
                    <p style="font-size: 1.2rem; color: #666; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <span style="color: var(--bg-red); font-weight: 600; text-transform: uppercase; font-size: 0.9rem;">${bar.vibe}</span>
                        <span id="header-city" style="font-size: 0.9rem; color: #888;"></span>
                    </p>
                </div>

                <div class="container masonry-grid" style="margin-top: 0;">
                    <!-- 1. Hero Image Card -->
                    <div class="grid-item content-card hero-card" style="padding: 0; border: none; overflow: hidden; background: transparent; position: relative; margin-bottom: 30px;">
                        <img id="hero-card-img" src="${bar.image}" alt="${bar.title}" style="width: 100%; height: auto; display: block;">
                         <button class="save-btn-${bar.id}" onclick="toggleSaveBar(${bar.id}, event)" style="position: absolute; top: 20px; right: 20px; z-index: 20; background: white; border: none; border-radius: 50%; width: 44px; height: 44px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${window.savedBarIds.has(bar.id) ? '#ef4444' : 'none'}" stroke="${window.savedBarIds.has(bar.id) ? '#ef4444' : '#333'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                        </button>
                    </div>

                    <!-- Review Card (If present, which it is) -->
                    <div class="grid-item content-card" style="background-color: var(--bg-red); color: white; border: none; margin-bottom: 30px;">
                        <h3 class="section-title" style="color: white; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 15px;">Liquid Arts Review</h3>
                        <p style="font-style: italic; font-size: 1.1rem; line-height: 1.6; margin-bottom: 1.5rem; text-align: center;">"${bar.editorial_review}"</p>
                        ${bar.editorial_rating ? `
                            <div style="text-align: center;">
                                <div style="color: #FFD700; font-size: 1.4rem; margin-bottom: 5px;">${'★'.repeat(bar.editorial_rating)}${'☆'.repeat(5 - bar.editorial_rating)}</div>
                                <div style="font-weight: 600; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px; font-family: var(--font-display);">
                                    ${['', 'Poor', 'Fair', 'Enjoyable', 'Remarkable', 'Masterpiece'][bar.editorial_rating] || ''}
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Talent Card (Red) -->
                    ${talentCardHtml}

                    <!-- 3. About/Info Card -->
                    <div class="grid-item content-card" style="display: flex; flex-direction: column; margin-bottom: 30px;">
                        <h2 class="section-title" style="flex-shrink: 0;">About</h2>
                        <p style="line-height: 1.6; margin-bottom: 1.5rem;">
                            ${bar.description || `Experience the finest mixology at ${bar.title}. Known for its ${bar.vibe} atmosphere, this spot in ${bar.location} offers a curated selection of cocktails and spirits.`}
                        </p>
                         <div style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 20px; justify-content: center;">
                            <div>
                                <span style="font-weight: 600; color: var(--text-primary);">Google Rating:</span> 
                                <span style="display: inline-flex; align-items: center; gap: 4px;">
                                    ${bar.google_rating || bar.rating || 'N/A'} 
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="#FFD700" viewBox="0 0 16 16"><path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/></svg>
                                    <span style="color:#888; font-size:0.9em; margin-left: 4px; display: inline-flex; align-items: center; gap: 2px;">
                                        (${bar.google_review_count || bar.rating_count || 0} <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7Zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.784 6A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216ZM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>)
                                    </span>
                                </span>
                            </div>
                             <div>
                                <span style="font-weight: 600; color: var(--text-primary);">Price:</span> 
                                <span>${'$'.repeat(bar.price_level || bar.price || 2)}</span>
                            </div>
                        </div>
                        ${bar.instagram_url ? `
                            <div style="display: flex; justify-content: center; margin-bottom: 1rem;">
                                <a href="${bar.instagram_url}" target="_blank" class="btn btn-secondary" style="font-size: 0.9rem; padding: 8px 16px; display: flex; align-items: center; gap: 8px;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.927 3.927 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 0 0-.923-1.417A3.911 3.911 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.281.11-.705.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.486-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z"/>
                                    </svg>
                                    Instagram
                                </a>
                            </div>
                        ` : ''}
                        <div style="display: flex; gap: 2rem; margin-bottom: 1rem; justify-content: center;">
                            ${bar.owner_name ? `
                                <div style="text-align: center;">
                                    <span class="info-label" style="font-size: 0.9rem; display: block; text-align: center;">Owner</span>
                                    <p style="font-weight: 600;">${bar.owner_name}</p>
                                </div>
                            ` : ''}
                            ${bar.bartender_name ? `
                                <div style="text-align: center;">
                                    <span class="info-label" style="font-size: 0.9rem; display: block; text-align: center;">Head Bartender</span>
                                    <p style="font-weight: 600;">${bar.bartender_name}</p>
                                </div>
                            ` : ''}
                        </div>
                        ${bar.tags ? `<p style="margin-bottom:1rem; color:var(--text-secondary); text-align: center;">Tags: ${bar.tags.join(', ')}</p>` : ''}
                        
                        <!-- Address & Map in About Card -->
                         <div style="margin-bottom: 0; margin-top: auto;">
                            <span class="info-label" style="font-size: 0.9rem; display: block; text-align: center;">Address</span>
                            <p style="margin-bottom: 1rem; text-align: center; font-weight: bold;">${bar.address || bar.address_en || bar.location}</p>
                            <div id="detail-map" style="height: 150px; width: 100%; border-radius: 8px; margin-bottom: 1rem; z-index: 1;"></div>
                            ${bar.google_map_url ? `<a href="${bar.google_map_url}" target="_blank" class="btn" style="width:100%; text-align:center; background-color: var(--bg-red); color: white; border: none;">Open in Google Maps</a>` : ''}
                        </div>
                    </div>

                    <!-- 4. Awards (Optional) -->
                    ${bar.bar_awards && bar.bar_awards.length > 0 ? `
                        <div class="grid-item content-card" style="margin-bottom: 30px;">
                            <h3 class="section-title" style="border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 15px;">Awards</h3>
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                ${bar.bar_awards.sort((a, b) => (b.year || 0) - (a.year || 0)).map(award => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; font-weight: 700; color: #333;">
                                        <div style="display: flex; align-items: center;">
                                            <span style="margin-right: 10px;">${award.year || ''}</span>
                                            <span>${award.name}</span>
                                        </div>
                                        <span>${award.rank ? `<span style="color: var(--bg-red);">${award.rank}</span>` : ''}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- 5. Opening Hours -->
                    <div class="grid-item content-card" style="margin-bottom: 30px;">
                        <h3 class="section-title">Opening Hours</h3>
                        <div style="margin-bottom: 1.5rem;">${formatOpeningHours(bar.opening_hours || 'Mon-Sun: 18:00 - 02:00')}</div>
                        ${bar.phone ? `<p style="text-align: center; margin-bottom: 1.5rem;"><strong>Phone:</strong> ${bar.phone}</p>` : ''}
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
                            ${bar.facebook_url ? `<a href="${bar.facebook_url}" target="_blank" class="btn btn-secondary" style="font-size: 0.9rem; padding: 8px 16px;">Facebook</a>` : ''}
                            ${bar.website_url ? `<a href="${bar.website_url}" target="_blank" class="btn btn-primary" style="font-size: 0.9rem; padding: 8px 16px;">Book Now</a>` : ''}
                        </div>
                    </div>

                    <!-- 4. Hopping Card -->
                    ${hoppingCardHtml}
                    <!-- 6. Awards (If any) -->
                    ${bar.bar_awards && bar.bar_awards.length > 0 ? `
                        <div class="grid-item content-card" style="margin-bottom: 30px;">
                            <h3 class="section-title" style="border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 15px;">Awards</h3>
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                ${bar.bar_awards.sort((a, b) => (b.year || 0) - (a.year || 0)).map(award => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; font-weight: 700; color: #333;">
                                        <div style="display: flex; align-items: center;">
                                            <span style="margin-right: 10px;">${award.year || ''}</span>
                                            <span>${award.name}</span>
                                        </div>
                                        <span>${award.rank ? `<span style="color: var(--bg-red);">${award.rank}</span>` : ''}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- 7. Opening Hours -->
                    <!-- Was 6. Hopping Card (New) -->
                    <!-- Was 6. Signatures (If any, wrap as grid item) -->
                    ${articlesHtml ? `<div class="grid-item" style="width:100%; margin-bottom:30px;">${articlesHtml}</div>` : ''}

                    <!-- 8. Gallery (If any) -->
                    ${galleryHtml ? `<div class="grid-item" style="width:100%; margin-bottom:30px;">${galleryHtml}</div>` : ''}

                </div>
                `;
        } else {
            // --- Default 2-Column Grid Layout (No Review) ---
            container.innerHTML = `
                    < !--Top Header(Title & Vibe)-- >
                <div class="container" style="margin-top: 100px; margin-bottom: 2rem; text-align: center;">
                    <h1 style="font-size: 3.5rem; margin-bottom: 0.5rem; color: var(--text-primary); line-height: 1.2;">${bar.title}</h1>
                    <p style="font-size: 1.2rem; color: #666; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <span style="color: var(--bg-red); font-weight: 600; text-transform: uppercase; font-size: 0.9rem;">${bar.vibe}</span>
                        <span id="header-city" style="font-size: 0.9rem; color: #888;"></span>
                    </p>
                </div>

                <div class="container detail-grid" style="margin-top: 0;">
                    
                    <!-- Left Column -->
                    <div class="left-column">
                        <!-- Hero Card (Image Only) -->
                        <div class="content-card hero-card" style="padding: 0; border: none; overflow: hidden; background: transparent; position: relative;">
                            <img id="hero-card-img" src="${bar.image}" alt="${bar.title}" style="width: 100%; height: auto; display: block;">
                            
                            <button class="save-btn-${bar.id}" onclick="toggleSaveBar(${bar.id}, event)" style="position: absolute; top: 20px; right: 20px; z-index: 20; background: white; border: none; border-radius: 50%; width: 44px; height: 44px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${window.savedBarIds.has(bar.id) ? '#ef4444' : 'none'}" stroke="${window.savedBarIds.has(bar.id) ? '#ef4444' : '#333'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                            </button>
                        </div>

                         <!-- Talent Card (Red) -->
                        ${talentCardHtml}

                        <div id="about-card" class="content-card" style="display: flex; flex-direction: column;">
                            <h2 class="section-title" style="flex-shrink: 0;">About</h2>
                            <p style="line-height: 1.6; margin-bottom: 1.5rem;">
                                ${bar.description || `Experience the finest mixology at ${bar.title}. Known for its ${bar.vibe} atmosphere, this spot in ${bar.location} offers a curated selection of cocktails and spirits.`}
                            </p>

                            <div style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 20px; justify-content: center;">
                                <div>
                                    <span style="font-weight: 600; color: var(--text-primary);">Google Rating:</span> 
                                    <span style="display: inline-flex; align-items: center; gap: 4px;">
                                        ${bar.google_rating || bar.rating || 'N/A'} 
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="#FFD700" viewBox="0 0 16 16">
                                            <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
                                        </svg>
                                        <span style="color:#888; font-size:0.9em; margin-left: 4px; display: inline-flex; align-items: center; gap: 2px;">
                                            (${bar.google_review_count || bar.rating_count || 0} 
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                                <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7Zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.784 6A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216ZM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>
                                            </svg>)
                                        </span>
                                    </span>
                                </div>
                                <div>
                                    <span style="font-weight: 600; color: var(--text-primary);">Price:</span> 
                                    <span>${'$'.repeat(bar.price_level || bar.price || 2)}</span>
                                </div>
                            </div>

                            ${bar.instagram_url ? `
                                <div style="display: flex; justify-content: center; margin-bottom: 1rem;">
                                    <a href="${bar.instagram_url}" target="_blank" class="btn btn-secondary" style="font-size: 0.9rem; padding: 8px 16px; display: flex; align-items: center; gap: 8px;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.927 3.927 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 0 0-.923-1.417A3.911 3.911 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.281.11-.705.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.486-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z"/>
                                    </svg>
                                    Instagram
                                </a>
                            </div>
                        ` : ''}
    
                            <div style="display: flex; gap: 2rem; margin-bottom: 1rem; justify-content: center;">
                                ${bar.owner_name ? `
                                    <div style="text-align: center;">
                                        <span class="info-label" style="font-size: 0.9rem; display: block; text-align: center;">Owner</span>
                                        <p style="font-weight: 600;">${bar.owner_name}</p>
                                    </div>
                                ` : ''}
                                ${bar.bartender_name ? `
                                    <div style="text-align: center;">
                                        <span class="info-label" style="font-size: 0.9rem; display: block; text-align: center;">Head Bartender</span>
                                        <p style="font-weight: 600;">${bar.bartender_name}</p>
                                    </div>
                                ` : ''}
                            </div>
    
                            ${bar.tags ? `<p style="margin-bottom:1rem; color:var(--text-secondary); text-align: center;">Tags: ${bar.tags.join(', ')}</p>` : ''}
    
                            <div style="margin-bottom: 0; margin-top: auto;">
                                <span class="info-label" style="font-size: 0.9rem; display: block; text-align: center;">Address</span>
                                <p style="margin-bottom: 1rem; text-align: center; font-weight: bold;">${bar.address || bar.address_en || bar.location}</p>
                                
                                <div id="detail-map" style="height: 150px; width: 100%; border-radius: 8px; margin-bottom: 1rem; z-index: 1;"></div>
                                
                                ${bar.google_map_url ?
                    `<a href="${bar.google_map_url}" target="_blank" class="btn" style="width:100%; text-align:center; background-color: var(--bg-red); color: white; border: none;">Open in Google Maps</a>` :
                    `<div style="height: 50px; background: #eee; display: flex; align-items: center; justify-content: center; color: #666; border-radius: 4px;">Map Link Unavailable</div>`
                }
                            </div>
                        </div>
                    </div>
    
                    <!-- Right Column -->
                    <div class="right-column">
                        <!-- Editorial Review Card -->
                        ${bar.editorial_review ? `
                            <div class="content-card" style="background-color: var(--bg-red); color: white; border: none;">
                                <h3 class="section-title" style="color: white; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 15px;">Liquid Arts Review</h3>
                                <p style="font-style: italic; font-size: 1.1rem; line-height: 1.6; margin-bottom: 1.5rem; text-align: center;">"${bar.editorial_review}"</p>
                                ${bar.editorial_rating ? `
                                    <div style="text-align: center;">
                                        <div style="color: #FFD700; font-size: 1.4rem; margin-bottom: 5px;">${'★'.repeat(bar.editorial_rating)}${'☆'.repeat(5 - bar.editorial_rating)}</div>
                                        <div style="font-weight: 600; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px; font-family: var(--font-display);">
                                            ${['', 'Poor', 'Fair', 'Enjoyable', 'Remarkable', 'Masterpiece'][bar.editorial_rating] || ''}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
    
                        ${hoppingCardHtml}
    
                        ${bar.bar_awards && bar.bar_awards.length > 0 ? `
                            <div class="content-card">
                                <h3 class="section-title" style="border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 15px;">Awards</h3>
                                <div style="display: flex; flex-direction: column; gap: 12px;">
                                    ${bar.bar_awards.sort((a, b) => (b.year || 0) - (a.year || 0)).map(award => `
                                        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; font-weight: 700; color: #333;">
                                            <div style="display: flex; align-items: center;">
                                                <span style="margin-right: 10px;">${award.year || ''}</span>
                                                <span>${award.name}</span>
                                            </div>
                                            <span>
                                                ${award.rank ? `<span style="color: var(--bg-red);">${award.rank}</span>` : ''}
                                            </span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
    
                        <div class="content-card">
                            <h3 class="section-title">Opening Hours</h3>
                            
                            <div style="margin-bottom: 1.5rem;">
                                ${formatOpeningHours(bar.opening_hours || 'Mon-Sun: 18:00 - 02:00')}
                            </div>
    
                            ${bar.phone ? `<p style="text-align: center; margin-bottom: 1.5rem;"><strong>Phone:</strong> ${bar.phone}</p>` : ''}
                            
                            <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
                                ${bar.facebook_url ? `<a href="${bar.facebook_url}" target="_blank" class="btn btn-secondary" style="font-size: 0.9rem; padding: 8px 16px;">Facebook</a>` : ''}
                                ${bar.website_url ? `<a href="${bar.website_url}" target="_blank" class="btn btn-primary" style="font-size: 0.9rem; padding: 8px 16px;">Book Now</a>` : ''}
                            </div>
                            </div>
                        </div>

                        <!-- Hopping Card (Already rendered) -->
    
                        ${signaturesHtml}
                        
                        ${articlesHtml}
                        ${galleryHtml}
                    </div>
                </div >
                    `;
        }


        // Async City Fetch
        if (bar.lat && bar.lng) {
            fetchCityFromCoords(bar.lat, bar.lng).then(city => {
                if (city) {
                    const citySpan = document.getElementById('header-city');
                    if (citySpan) citySpan.textContent = `• ${city} `;
                }
            });
        }

        if (bar.lat && bar.lng) {
            setTimeout(() => {
                const map = L.map('detail-map').setView([bar.lat, bar.lng], 15);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap &copy; CARTO'
                }).addTo(map);

                const customIcon = L.divIcon({
                    className: 'custom-div-icon',
                    html: `< div style = "width: 24px; height: 24px; background: #ef4444; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);" ></div > `,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });

                L.marker([bar.lat, bar.lng], { icon: customIcon })
                    .addTo(map)
                    .bindTooltip(bar.title, {
                        permanent: true,
                        direction: 'top',
                        className: 'map-label',
                        offset: [0, -12]
                    });
            }, 100);
        }

        // Initialize Swiper for signatures carousel
        if (bar.signatures && bar.signatures.length > 0) {
            setTimeout(() => {
                new Swiper('.signatures-carousel', {
                    slidesPerView: 1,
                    spaceBetween: 15,
                    loop: true,
                    pagination: {
                        el: '.swiper-pagination',
                        clickable: true,
                    },
                    navigation: {
                        nextEl: '.swiper-button-next',
                        prevEl: '.swiper-button-prev',
                    },
                    breakpoints: {
                        640: {
                            slidesPerView: 2,
                            spaceBetween: 20,
                        },
                        768: {
                            slidesPerView: 2,
                            spaceBetween: 20,
                        },
                        1024: {
                            slidesPerView: 3,
                            spaceBetween: 20,
                        },
                    }
                });
            }, 200); // Small delay to ensure DOM is ready
        }
    };

    // Helper: Reverse Geocoding
    async function fetchCityFromCoords(lat, lng) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`);
            const data = await response.json();
            if (data.address) {
                // Try city, then town, then village, then county
                return data.address.city || data.address.town || data.address.village || data.address.county || '';
            }
            return '';
        } catch (e) {
            console.error('City fetch error:', e);
            return '';
        }
    }

    // Helper: Format Opening Hours
    function formatOpeningHours(hoursStr) {
        if (!hoursStr) return '<div style="text-align:center;">Hours not available</div>';

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        // Normalize: remove extra spaces
        let cleanHours = hoursStr.trim();

        // Helper to generate the table
        function generateHoursTable(hoursMap) {
            let html = '<table style="width: 100%; max-width: 300px; margin: 0 auto; border-collapse: collapse;">';
            for (let i = 0; i < 7; i++) {
                const time = hoursMap[i];
                const opacity = time ? '1' : '0.4';
                const weight = time ? '500' : 'normal';
                const displayTime = time || 'Closed';

                // Highlight Sat (5) and Sun (6)
                const dayColor = (i === 5 || i === 6) ? '#ef4444' : '#333';

                html += `
                    <tr style="border-bottom: 1px solid #f5f5f5;">
                        <td style="padding: 8px 0; text-align: left; color: ${dayColor}; font-weight: ${weight}; opacity: ${opacity}; width: 40%;">${days[i]}</td>
                        <td style="padding: 8px 0; text-align: right; color: #333; opacity: ${opacity}; width: 60%;">${displayTime}</td>
                    </tr>
                `;
            }
            html += '</table>';
            return html;
        }

        // 1. Check for Semicolon Separated List (New Format)
        if (cleanHours.includes(';') || (cleanHours.includes(':') && cleanHours.match(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/i))) {
            const hoursMap = {}; // 0..6 -> time string

            const parts = cleanHours.split(';');
            parts.forEach(part => {
                const colonIndex = part.indexOf(':');
                if (colonIndex !== -1) {
                    const dayPart = part.substring(0, colonIndex).trim();
                    const timePart = part.substring(colonIndex + 1).trim();

                    if (dayPart && timePart) {
                        // Handle ranges or commas if present (though new format is likely single day)
                        let currentDays = [];

                        if (dayPart.includes('-')) {
                            // Range
                            const [start, end] = dayPart.split('-').map(d => d.trim());
                            const sIdx = shortDays.findIndex(sd => sd.toLowerCase() === start.substring(0, 3).toLowerCase());
                            const eIdx = shortDays.findIndex(sd => sd.toLowerCase() === end.substring(0, 3).toLowerCase());
                            if (sIdx !== -1 && eIdx !== -1) {
                                if (sIdx <= eIdx) {
                                    for (let i = sIdx; i <= eIdx; i++) currentDays.push(i);
                                } else {
                                    for (let i = sIdx; i < 7; i++) currentDays.push(i);
                                    for (let i = 0; i <= eIdx; i++) currentDays.push(i);
                                }
                            }
                        } else if (dayPart.includes(',')) {
                            // Comma
                            dayPart.split(',').forEach(d => {
                                const idx = shortDays.findIndex(sd => sd.toLowerCase() === d.trim().substring(0, 3).toLowerCase());
                                if (idx !== -1) currentDays.push(idx);
                            });
                        } else {
                            // Single
                            const idx = shortDays.findIndex(sd => sd.toLowerCase() === dayPart.substring(0, 3).toLowerCase());
                            if (idx !== -1) currentDays.push(idx);
                        }

                        currentDays.forEach(dIdx => {
                            hoursMap[dIdx] = timePart;
                        });
                    }
                }
            });
            return generateHoursTable(hoursMap);
        }

        // 2. Check for "Daily"
        if (cleanHours.toLowerCase().includes('daily') || cleanHours.toLowerCase().includes('everyday')) {
            const time = cleanHours.replace(/daily|everyday/gi, '').replace(/[:\s]+/, '').trim();
            const map = {};
            for (let i = 0; i < 7; i++) map[i] = time;
            return generateHoursTable(map);
        }

        // 3. Fallback: If it contains digits (likely a time), assume daily
        if (cleanHours.match(/\d/)) {
            const map = {};
            for (let i = 0; i < 7; i++) map[i] = cleanHours;
            return generateHoursTable(map);
        }

        return `<div style="text-align:center;">${hoursStr.replace(/\n/g, '<br>')}</div>`;
    }

    // 5. Articles List
    window.initArticlesList = async () => {
        await initAuthAndSaved();
        const articles = await fetchArticles();
        const grid = document.getElementById('articles-list-grid');
        if (grid) {
            grid.innerHTML = articles.map(article => createArticleCard(article)).join('');
        }
    };

    // 6. Article Details
    window.initArticleDetails = async () => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        const container = document.getElementById('article-content');

        if (!id) {
            container.innerHTML = '<p>Article not found.</p>';
            return;
        }

        const { data: article, error } = await supabase
            .from('articles')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !article) {
            container.innerHTML = '<p>Article not found.</p>';
            return;
        }

        let dateDisplayHtml = `<span style="font-size: 0.9rem; letter-spacing: 0.05em; text-transform: uppercase;">${new Date(article.published_at || article.created_at).toLocaleDateString()}</span>`;

        // If Event, show duration with special styling
        if ((article.category === 'Event' || article.category === '活動情報') && article.start_date && article.end_date) {
            const formatDate = (iso) => {
                const d = new Date(iso);
                return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
            };
            const durationStr = `${formatDate(article.start_date)} - ${formatDate(article.end_date)}`;
            dateDisplayHtml = `<span style="font-size: 1.1rem; letter-spacing: 0.05em; color: var(--bg-red); font-weight: bold;">活動期間：${durationStr}</span>`;
        }

        const tagsHtml = (article.tags || []).map(t => `<span style="background:var(--bg-red); color:white; padding:4px 12px; border-radius:20px; font-size:0.85rem; margin-right:8px; display:inline-block;">#${t}</span>`).join('');

        // Category Logic
        const categoryMap = {
            'Event': '活動情報', 'Review': '直擊體驗', 'Feature': '專題報導', 'Interview': '職人專訪',
            '活動情報': 'Event', '直擊體驗': 'Review', '專題報導': 'Feature', '職人專訪': 'Interview'
        };

        let engCat = 'Article';
        let chiCat = '';

        if (article.category) {
            if (['Event', 'Review', 'Feature', 'Interview'].includes(article.category)) {
                engCat = article.category;
                chiCat = categoryMap[engCat];
            } else if (categoryMap[article.category]) {
                engCat = categoryMap[article.category];
                chiCat = article.category;
            } else {
                engCat = article.category;
                chiCat = '';
            }
        }

        container.innerHTML = `
            <div style="text-align: center; max-width: 800px; margin: 0 auto 3rem auto;">
                <div style="margin-bottom: 2rem;">
                    <h2 style="font-family: var(--font-display); font-size: 3rem; color: #1b1b1b; margin: 0; line-height: 1; text-transform: uppercase; letter-spacing: 0.05em;">${engCat}</h2>
                    <span style="font-size: 1rem; display: block; margin-top: 15px; color: var(--bg-red); font-weight: 500; letter-spacing: 0.2em;">${chiCat}</span>
                </div>
                
                <h1 style="font-size: 3rem; margin-bottom: 1rem; line-height: 1.2;">${article.title}</h1>
                ${article.excerpt ? `<p style="font-size: 1.2rem; color: #666; margin-bottom: 1.5rem; font-family: var(--font-display); font-style: italic;">${article.excerpt}</p>` : ''}
                <div style="color: #888; display: flex; flex-direction: column; align-items: center; gap: 5px; font-family: var(--font-main);">
                ${dateDisplayHtml}
                ${article.author_name ? `<span style="font-size: 1.1rem; color: #333; font-weight: 500;">by ${article.author_name}</span>` : ''}
            </div>
            </div>
            
            ${article.cover_image ? `
                <figure style="margin: 0 0 2rem 0; text-align: center;">
                    <img src="${article.cover_image}" alt="${article.image_caption || article.title}" style="width: 100%; max-height: 600px; object-fit: cover; border-radius: 8px;">
                    ${article.image_caption ? `<figcaption style="margin-top: 0.5rem; color: #666; font-size: 0.9rem; font-style: italic; font-family: var(--font-main);">${article.image_caption}</figcaption>` : ''}
                </figure>
            ` : ''}
            
            <div class="article-body" style="font-size: 1.1rem; line-height: 1.8;">
                ${article.content || '<p>No content.</p>'}
            </div>

            <div style="margin-top: 3rem; margin-bottom: 2rem; text-align: center;">
                ${tagsHtml}
            </div>
        `;

        // --- TOC Generation ---
        // Find the placeholder inserted by Quill (class: toc-embed-container)
        const tocPlaceholder = container.querySelector('.toc-embed-container');
        if (tocPlaceholder) {
            const headers = container.querySelectorAll('.article-body h2, .article-body h3');

            if (headers.length > 0) {
                const tocDiv = document.createElement('div');
                tocDiv.className = 'article-toc';
                tocDiv.innerHTML = '<h3>目錄</h3><ul></ul>';
                const ul = tocDiv.querySelector('ul');

                headers.forEach((header, index) => {
                    // Ensure ID for linking
                    if (!header.id) header.id = `section-${index}`;

                    const li = document.createElement('li');
                    li.className = `toc-item-${header.tagName.toLowerCase()}`;

                    const a = document.createElement('a');
                    a.href = `#${header.id}`;
                    a.textContent = header.textContent;

                    // Smooth scroll
                    a.onclick = (e) => {
                        e.preventDefault();
                        header.scrollIntoView({ behavior: 'smooth' });
                    };

                    li.appendChild(a);
                    ul.appendChild(li);
                });

                tocPlaceholder.replaceWith(tocDiv);
            } else {
                // No headers found, remove placeholder
                tocPlaceholder.remove();
            }
        }
    };

    // --- Helper Functions ---

    // Expose for Profile usage
    window.initCardMapGlobal = function (id, lat, lng, title, isSaved = false) {
        if (typeof L === 'undefined') return;
        const elId = `card-map-${id}`;
        const el = document.getElementById(elId);
        if (!el) return;
        if (el.classList.contains('leaflet-container')) return;

        try {
            const map = L.map(elId, { zoomControl: false, scrollWheelZoom: false, dragging: false, doubleClickZoom: false, touchZoom: false }).setView([lat, lng], 15);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19 }).addTo(map);

            // Custom Marker: Golden Heart (Saved) vs Red Dot (Default)
            let markerHtml;
            if (isSaved) {
                // Golden Heart
                markerHtml = `
                    <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
                        <div style="background: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; color: #333; box-shadow: 0 1px 2px rgba(0,0,0,0.15); margin-bottom: 3px; white-space: nowrap;">
                            ${title || ''}
                        </div>
                        <div style="display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
                             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="#FFD700" stroke="white" stroke-width="1.5" viewBox="0 0 16 16" style="overflow: visible;">
                                <path fill-rule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/>
                            </svg>
                        </div>
                    </div>
                `;
            } else {
                // Red Dot
                markerHtml = `
                    <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
                        <div style="background: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; color: #333; box-shadow: 0 1px 2px rgba(0,0,0,0.15); margin-bottom: 3px; white-space: nowrap;">
                            ${title || ''}
                        </div>
                        <div style="width: 14px; height: 14px; background: #ef4444; border: 2px solid white; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.2);"></div>
                    </div>
                `;
            }

            const customIcon = L.divIcon({
                className: 'custom-map-marker',
                html: markerHtml,
                iconSize: [0, 0],
                iconAnchor: [0, 0]
            });

            L.marker([lat, lng], { icon: customIcon }).addTo(map);
        } catch (e) { console.warn('Map init error', e); }
    };

    // --- Helper: Reverse Geocoding (Global) ---
    window.fetchCityFromCoordsGlobal = async function (lat, lng) {
        if (!lat || !lng) return '';
        try {
            const key = `city_${lat}_${lng}`;
            const cached = localStorage.getItem(key);
            if (cached) return cached;

            // Rate limit mitigation: random delay 10-100ms
            await new Promise(r => setTimeout(r, Math.random() * 100));

            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`);
            const data = await response.json();
            if (data.address) {
                const city = data.address.city || data.address.town || data.address.village || data.address.county || '';
                localStorage.setItem(key, city);
                return city;
            }
        } catch (e) { console.error('City fetch error', e); }
        return '';
    };

    // Expose for Profile Page reuse
    window.createBarCard = function (bar, city = null) {
        const displayCity = city || bar.location || '';
        const description = bar.description || `Experience the finest mixology at ${bar.title}. Known for its ${bar.vibe} atmosphere, this spot in ${bar.location} offers a curated selection of cocktails and spirits.`;
        const rating = bar.google_rating || bar.rating || 'N/A';
        const reviewCount = bar.google_review_count || bar.rating_count || 0;
        const price = '$'.repeat(bar.price || bar.price_level || 2);
        const address = bar.address || bar.address_en || bar.location;
        const mapUrl = bar.google_map_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

        const isSaved = window.savedBarIds.has(bar.id);

        return `
        <div class="art-card grid-item" style="position: relative; display: flex; flex-direction: column; height: 100%; margin-bottom: 3rem; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); max-width: 380px; margin-left: auto; margin-right: auto;">
             <!-- Save Button -->
             <button class="save-btn-${bar.id}" onclick="toggleSaveBar(${bar.id}, event)" style="position: absolute; top: 15px; right: 15px; z-index: 20; background: white; border: none; border-radius: 50%; width: 36px; height: 36px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? '#ef4444' : 'none'}" stroke="${isSaved ? '#ef4444' : '#333'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
             </button>

             <!-- Hopping Interaction Wrapper (Top Left) -->
             <div style="position: absolute; top: 15px; left: 15px; z-index: 30; display: flex; align-items: center; gap: 12px; pointer-events: auto;">
                 <!-- Hop Button -->
                 <button onclick="event.preventDefault(); event.stopPropagation(); window.openHoppingModal(${bar.id})" style="background: rgba(255,255,255,0.95); border: none; border-radius: 20px; padding: 6px 14px; font-size: 0.85rem; font-weight: 700; color: #333; box-shadow: 0 4px 10px rgba(0,0,0,0.15); cursor: pointer; display: flex; align-items: center; gap: 6px; transition: transform 0.2s;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"></path><path d="M12 15v7"></path><path d="M2 3h20L12 15z"></path></svg> Hop
                 </button>
                 
                 <!-- Badges Row -->
                 <div id="hop-badge-${bar.id}" style="display: flex; align-items: center; padding-left: 5px;"></div>
             </div>

             <!-- Main Link Wrapper -->
            <a href="bar-details.html?id=${bar.id}" style="text-decoration: none; display: block; flex-grow: 1; display: flex; flex-direction: column;">
                <div style="width: 100%; border-bottom: 1px solid #f0f0f0; position: relative;">
                    <img src="${bar.image}" alt="${bar.title}" style="width: 100%; height: auto; display: block; transition: transform 0.5s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                </div>
                <div style="text-align: center; padding: 1.5rem 1rem 0.5rem 1rem;">
                    <h3 style="font-family: var(--font-display); font-size: 1.8rem; margin: 0 0 0.5rem 0; color: #1b1b1b;">
                        ${bar.title}
                    </h3>
                    <p style="font-family: var(--font-main); font-size: 1rem; color: #888; margin: 0;">
                        ${bar.vibe ? `<span style="color: var(--bg-red); font-weight: 600;">${bar.vibe}</span> • ` : ''}${displayCity}
                    </p>
                </div>
            </a>
            
            <div class="card-content" style="padding: 0 1.5rem 1.5rem 1.5rem; text-align: center; flex: 1; display: flex; flex-direction: column;">

                ${bar.editorial_review ? `
                    <div style="margin-bottom: 1.2rem; padding: 15px; background: var(--bg-red); color: white; border-radius: 12px; text-align: center;">
                         <h4 style="margin: 0 0 5px 0; font-family: var(--font-display); font-size: 1rem; letter-spacing: 0.05em; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 5px; display: inline-block;">Liquid Arts Review</h4>
                         <p style="font-size: 0.9rem; font-style: italic; margin: 10px 0; line-height: 1.5;">"${bar.editorial_review}"</p>
                         ${bar.editorial_rating ? `
                            <div style="margin-top: 5px;">
                                <div style="color: #FFD700; font-size: 1rem; margin-bottom: 2px;">${'★'.repeat(bar.editorial_rating)}${'☆'.repeat(5 - bar.editorial_rating)}</div>
                                <div style="font-weight: 600; font-size: 0.8rem; text-transform: uppercase;">${['', 'Poor', 'Fair', 'Enjoyable', 'Remarkable', 'Masterpiece'][bar.editorial_rating] || ''}</div>
                            </div>
                         ` : ''}
                    </div>
                ` : ''}

                 <!-- Description -->
                <p style="font-size: 0.95rem; color: #555; line-height: 1.6; margin-bottom: 1rem; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden;">
                    ${description}
                </p>

                <!-- Explore Button -->
                <div style="display: flex; justify-content: center; margin-bottom: 1.2rem;">
                    <a href="bar-details.html?id=${bar.id}" class="btn" style="padding: 6px 20px; font-size: 0.9rem; border-radius: 20px; border: none; color: white; background: var(--bg-red); transition: all 0.3s; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Explore</a>
                </div>

                 <!-- Rating & Price -->
                <div style="margin-bottom: 1.2rem; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.8rem;">
                    <span style="font-weight: 600; color: #666;">Google Rating:</span>
                    <strong style="color: #333;">${rating}</strong>
                    <span style="color:#888;">|</span>
                    <span style="font-weight: 600; color: #666;">Price:</span>
                    <strong style="color: #333;">${price}</strong>
                </div>

                <!-- Address -->
                <p style="font-size: 0.85rem; color: #666; margin-bottom: 0.5rem;">
                    ${address}
                </p>
                
                <!-- Mini Map (Re-positioned: Below Address) -->
                <div id="card-map-${bar.id}" class="card-map" style="height: 120px; width: 100%; border-top-left-radius: 4px; border-top-right-radius: 4px; border-bottom-left-radius: 0; border-bottom-right-radius: 0; margin-bottom: 0; z-index: 1;"></div>

                <!-- Button Wrapper (Bottom Anchored) -->
                <div style="margin-top: 0;">
                    <a href="${mapUrl}" target="_blank" class="btn" style="display: flex; justify-content: center; align-items: center; gap: 8px; width: 100%; background-color: var(--bg-red); color: white; padding: 8px 0; border-top-left-radius: 0; border-top-right-radius: 0; border-bottom-left-radius: 4px; border-bottom-right-radius: 4px; text-decoration: none; transition: background 0.3s; margin-top: 0;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M14.082 2.182a.5.5 0 0 1 .103.557L8.528 15.467a.5.5 0 0 1-.917-.007L5.57 10.694.803 8.652a.5.5 0 0 1-.006-.916l12.728-5.657a.5.5 0 0 1 .556.103z"/></svg>
                        <span style="font-size: 0.9rem; font-weight: 600;">Google Map</span>
                    </a>
                </div>
            </div>
        </div>
        `;
    };

    // Expose for Profile Page
    window.createArticleCard = function (article) {
        // Handle both mock data (image, date) and real data (cover_image, published_at)
        const imgUrl = article.cover_image || article.image || 'assets/placeholder.jpg';

        // Date Logic
        let dateDisplay;
        if (article.category && (article.category.toLowerCase() === 'event' || article.category.toLowerCase() === 'activity')) {
            // Event: Red Bold Date Range
            const start = new Date(article.start_date).toLocaleDateString();
            const end = article.end_date ? new Date(article.end_date).toLocaleDateString() : 'TBD';
            dateDisplay = `<span style="color: var(--bg-red); font-weight: 700;">${start} - ${end}</span>`;
        } else {
            // Standard Date
            const dateStr = new Date(article.published_at || article.created_at || article.date).toLocaleDateString();
            dateDisplay = `<span style="color: #888;">${dateStr}</span>`;
        }

        // Category Label
        const categoryMap = {
            'Event': '活動情報', 'Review': '直擊體驗', 'Feature': '專題報導', 'Interview': '職人專訪',
            '活動情報': 'Event', '直擊體驗': 'Review', '專題報導': 'Feature', '職人專訪': 'Interview'
        };

        const displayCategory = categoryMap[article.category] || article.category;
        const categoryLabel = displayCategory ? `<span style="display:inline-block; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--bg-red); border: 1px solid var(--bg-red); padding: 2px 8px; border-radius: 4px; margin-bottom: 6px;">${displayCategory}</span>` : '';

        // Check saved state
        const isSaved = window.savedArticleIds ? window.savedArticleIds.has(article.id) : false;

        return `
        <div class="art-card grid-item" style="position: relative; display: flex; flex-direction: column; background: #fff; color: #333; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); margin-bottom: 2rem; max-width: 380px; margin-left: auto; margin-right: auto;">
             <!-- Save Button -->
             <button class="save-article-btn-${article.id}" onclick="toggleSaveArticle(${article.id}, event)" style="position: absolute; top: 15px; right: 15px; z-index: 20; background: white; border: none; border-radius: 50%; width: 36px; height: 36px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? '#ef4444' : 'none'}" stroke="${isSaved ? '#ef4444' : '#333'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
             </button>

            <a href="journal-details.html?id=${article.id}" style="text-decoration: none; color: inherit; display: block;">
                <img src="${imgUrl}" alt="${article.title}" class="art-card-image" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 0;">
                <div style="padding: 1.5rem;">
                    <div style="display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 0.5rem;">
                        ${categoryLabel}
                        <div class="art-card-meta" style="font-size: 0.85rem;">${dateDisplay}</div>
                    </div>
                    <h3 class="art-card-title" style="font-size: 1.4rem; margin: 0 0 0.5rem 0; font-family: var(--font-display);">${article.title}</h3>
                    <p class="serif-caption" style="font-size: 1rem; margin: 0; color: #555; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${article.excerpt || ''}</p>
                </div>
            </a>
        </div>
    `;
    }

    // --- Auth Logic (Member) ---
    const loginBtn = document.getElementById('login-btn');
    // const userMenu = document.getElementById('user-menu'); // Removed, replaced by global-auth-btn
    // const userAvatar = document.getElementById('user-avatar'); // Removed, replaced by global-auth-btn

    async function signInWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/profile.html'
            }
        });
        if (error) console.error('Error logging in:', error.message);
    }

    // Login Button Listener Removed (Let <a> tag navigate to profile.html)
    // if (loginBtn) {
    //    loginBtn.addEventListener('click', signInWithGoogle);
    // }

    // Check Auth State
    supabase.auth.onAuthStateChange((event, session) => {
        // Global Auth Button Logic (Mobile & Desktop)
        const authBtn = document.getElementById('global-auth-btn');
        const navMyLink = document.getElementById('nav-my-link'); // Legacy check
        const loginBtn = document.getElementById('login-btn'); // Legacy check
        const logoutBtn = document.getElementById('logout-btn');

        if (session) {
            const avatar = session.user.user_metadata.avatar_url || 'assets/logo_vertical.png';

            if (authBtn) {
                authBtn.innerHTML = `<img src="${avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-color);">`;
            }

            // Legacy Fallbacks (if navbar not updated yet)
            if (loginBtn) loginBtn.style.display = 'none';
            if (navMyLink) {
                navMyLink.style.display = 'inline-flex'; // Or keep hidden if we rely on authBtn
                // If navMyLink is visible, update it too
                navMyLink.innerHTML = `<img src="${avatar}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;"> <span>My</span>`;
            }
            if (logoutBtn) logoutBtn.style.display = 'inline-block';

        } else {
            // Logged Out
            if (authBtn) {
                // Reset to Icon
                authBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
            }
            if (loginBtn) loginBtn.style.display = 'inline-block'; // Or 'flex'
            if (navMyLink) navMyLink.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'none';
        }

        // Bottom Nav Highlight Logic
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        const bottomNavItems = document.querySelectorAll('.bottom-nav .nav-item');
        bottomNavItems.forEach(item => {
            if (item.getAttribute('href') === currentPath) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    });

    // --- Auto Init based on URL ---
    const path = window.location.pathname;
    if (path.endsWith('index.html') || path === '/') window.initHome();
});

// --- Signature Carousel Logic ---
window.updateCarousel = (barId) => {
    const state = window.carouselStates[barId];
    const track = document.getElementById(`sig-track-${barId}`);
    if (track && state) {
        track.style.transform = `translateX(-${state.index * 100}%)`;
    }
};

window.prevSignature = (barId) => {
    const state = window.carouselStates[barId];
    if (state) {
        state.index = (state.index - 1 + state.count) % state.count;
        updateCarousel(barId);
    }
};

window.nextSignature = (barId) => {
    const state = window.carouselStates[barId];
    if (state) {
        state.index = (state.index + 1) % state.count;
        updateCarousel(barId);
    }
};


