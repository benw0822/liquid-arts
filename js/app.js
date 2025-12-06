// --- Supabase Configuration (Global) ---
const SUPABASE_URL = 'https://wgnskednopbfngvjmviq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P';
// Attach to window so other scripts (like profile.html) can use it
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// Also keep a local alias for app.js internal use
const supabase = window.supabaseClient;
console.log('Connected to Supabase');

document.addEventListener('DOMContentLoaded', () => {

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
        { id: 1, title: "The Art of Ice", excerpt: "Why clear ice matters in modern mixology.", image: "assets/gallery_1.png", date: "2024-11-20" },
        { id: 2, title: "Tokyo's Hidden Gems", excerpt: "Exploring the best speakeasies in Ginza.", image: "assets/gallery_2.png", date: "2024-11-18" },
        { id: 3, title: "Sustainable Sipping", excerpt: "How bars are going zero-waste.", image: "assets/gallery_3.png", date: "2024-11-15" }
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
                    bar_articles (
                        article:articles (id, title, excerpt, cover_image, published_at)
                    )
                `);

            if (error || !data || data.length === 0) return mockBars;
            return data;
        } catch (err) {
            console.error('Error fetching bars:', err);
            return mockBars;
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
    window.initHome = async () => {
        const bars = await fetchBars();
        const articles = await fetchArticles();

        const featuredGrid = document.getElementById('featured-grid');
        const articleGrid = document.getElementById('article-grid');

        if (featuredGrid) {
            featuredGrid.innerHTML = bars.slice(0, 3).map(bar => createBarCard(bar)).join('');
        }
        if (articleGrid) {
            articleGrid.innerHTML = articles.slice(0, 3).map(article => createArticleCard(article)).join('');
        }
    };

    // 2. Bar List Page
    window.initBarList = async () => {
        const bars = await fetchBars();
        const grid = document.getElementById('bars-grid');
        const searchInput = document.getElementById('search-input');
        const filterCity = document.getElementById('filter-city');
        const filterVibe = document.getElementById('filter-vibe');
        const filterPrice = document.getElementById('filter-price');

        function render(items) {
            grid.innerHTML = items.map(bar => createBarCard(bar)).join('');
        }

        function filterBars() {
            const term = searchInput.value.toLowerCase();
            const city = filterCity.value;
            const vibe = filterVibe.value;
            const price = filterPrice.value;

            const filtered = bars.filter(bar => {
                const matchSearch = bar.title.toLowerCase().includes(term) || bar.location.toLowerCase().includes(term);
                const matchCity = !city || bar.location.includes(city);
                const matchVibe = !vibe || bar.vibe === vibe;
                const matchPrice = !price || bar.price == price; // Loose equality for string/number
                return matchSearch && matchCity && matchVibe && matchPrice;
            });
            render(filtered);
        }

        searchInput.addEventListener('input', filterBars);
        filterCity.addEventListener('change', filterBars);
        filterVibe.addEventListener('change', filterBars);
        filterPrice.addEventListener('change', filterBars);

        render(bars);
    };

    // 3. Map Page
    // 3. Map Page
    window.initMap = async () => {
        const bars = await fetchBars();
        // Default to Taipei/Asia view if no user location
        const map = L.map('map').setView([25.0330, 121.5654], 14);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 20
        }).addTo(map);

        bars.forEach(bar => {
            if (bar.lat && bar.lng) {
                // Custom Red Circle Icon with Label
                const customIcon = L.divIcon({
                    className: 'custom-map-marker',
                    html: `
                        <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
                            <div style="background: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 12px; color: #333; box-shadow: 0 2px 4px rgba(0,0,0,0.2); margin-bottom: 4px; white-space: nowrap;">
                                ${bar.title}
                            </div>
                            <div style="width: 14px; height: 14px; background: #ef4444; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
                        </div>
                    `,
                    iconSize: [0, 0],
                    iconAnchor: [0, 0]
                });

                const marker = L.marker([bar.lat, bar.lng], { icon: customIcon }).addTo(map);
                marker.bindPopup(`
                    <div style="color: #333; text-align: center;">
                        <h3 style="margin: 0 0 5px 0;">${bar.title}</h3>
                        <p style="margin: 0;">${bar.location}</p>
                        <a href="bar-details.html?id=${bar.id}" style="color: #b91c1c; font-weight: bold;">View Details</a>
                    </div>
                `);
            }
        });
    };

    // 4. Bar Details Page
    window.initBarDetails = async () => {
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
        if (bar.bar_images && bar.bar_images.length > 0) {
            const sortedImages = bar.bar_images.sort((a, b) => a.display_order - b.display_order);
            galleryHtml = `
                <div class="content-card">
                    <h3 class="section-title" style="text-align: center; font-size: 1.5rem; margin-bottom: 1.5rem; font-family: var(--font-display);">Gallery</h3>
                    <div class="magazine-grid" style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">
                        ${sortedImages.map(img => `
                            <div class="grid-item" style="grid-column: span 1; margin-bottom: 0;">
                                <img src="${img.image_url}" alt="${img.caption || ''}" 
                                     style="width:100%; height:150px; object-fit:cover; border-radius:4px; cursor: pointer; transition: opacity 0.2s;"
                                     onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1"
                                     onclick="openLightbox('${img.image_url}')">
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // --- Lightbox Functions ---
        window.openLightbox = (src) => {
            const modal = document.getElementById('lightbox-modal');
            const img = document.getElementById('lightbox-img');
            modal.style.display = "flex";
            img.src = src;
        };

        window.closeLightbox = () => {
            document.getElementById('lightbox-modal').style.display = "none";
        };

        // --- Related Articles ---
        let articlesHtml = '';
        if (bar.bar_articles && bar.bar_articles.length > 0) {
            articlesHtml = `
                <div class="content-card">
                    <h3 class="section-title" style="text-align: center; font-size: 1.5rem; margin-bottom: 1.5rem; font-family: var(--font-display);">Related Stories</h3>
                    <div class="magazine-grid">
                        ${bar.bar_articles.map(ba => createArticleCard(ba.article)).join('')}
                    </div>
                </div>
            `;
        }

        // --- Editorial Review --- (Merged into HTML structure below)

        // --- Signatures ---
        let signaturesHtml = '';
        if (bar.signatures && bar.signatures.length > 0) {
            signaturesHtml = `
                <div class="content-card">
                    <h3 class="section-title" style="text-align: center; font-size: 1.5rem; margin-bottom: 1.5rem; font-family: var(--font-display);">Signature Cocktails</h3>
                    <div class="signatures-grid">
                        ${bar.signatures.map(sig => `
                            <div class="grid-item" style="margin-bottom: 0;">
                                <div style="border: 1px solid #eee; border-radius: 8px; overflow: hidden; height: 100%; background: #f9f9f9; transition: transform 0.2s;">
                                    <img src="${sig.image_url || 'assets/placeholder.jpg'}" alt="${sig.name}" style="width:100%; aspect-ratio: 4/5; object-fit:cover;">
                                    <div style="padding: 15px;">
                                        <h4 style="margin: 0 0 5px 0; font-family: var(--font-display); font-size: 1.1rem; color: var(--text-primary);">${sig.name}</h4>
                                        <p style="font-size: 0.85rem; color: #666; margin: 0; line-height: 1.4;">${sig.description || ''}</p>
                                        ${sig.review ? `<p style="margin-top: 8px; font-size: 0.8rem; color: var(--bg-red); font-style: italic;">"${sig.review}"</p>` : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <!-- Top Header (Title & Vibe) -->
            <div class="container" style="margin-top: 100px; margin-bottom: 2rem; text-align: center;">
                <h1 style="font-size: 3.5rem; margin-bottom: 0.5rem; color: var(--text-primary); line-height: 1.2;">${bar.title}</h1>
                <p style="font-size: 1.2rem; color: #666; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <span style="color: var(--bg-red); font-weight: 600; text-transform: uppercase; font-size: 0.9rem;">${bar.vibe}</span>
                    <span id="header-city" style="font-size: 0.9rem; color: #888;"></span>
                </p>
            </div>

            <div class="container detail-grid" style="margin-top: 0; display: flex; gap: 15px; align-items: flex-start;">
                
                <!-- Left Column -->
                <div class="left-column" style="flex: 1; min-width: 0;">
                    <!-- Hero Card (Image Only) -->
                    <div class="content-card hero-card" style="padding: 0; border: none; overflow: hidden; background: transparent;">
                        <img id="hero-card-img" src="${bar.image}" alt="${bar.title}" style="width: 100%; height: auto; display: block;">
                    </div>

                    <div id="about-card" class="content-card" style="display: flex; flex-direction: column;">
                        <h2 style="text-align: center; font-size: 1.5rem; margin-bottom: 1.5rem; font-family: var(--font-display); flex-shrink: 0;">About</h2>
                        
                        <p style="line-height: 1.6; margin-bottom: 1.5rem;">
                            ${bar.description || `Experience the finest mixology at ${bar.title}. Known for its ${bar.vibe} atmosphere, this spot in ${bar.location} offers a curated selection of cocktails and spirits.`}
                        </p>

                        <div style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 20px; justify-content: center;">
                            <div>
                                <span style="font-weight: 600; color: var(--text-primary);">Google Rating:</span> 
                                <span>${bar.google_rating || bar.rating || 'N/A'} / 5.0 <span style="color:#888; font-size:0.9em;">(${bar.google_review_count || bar.rating_count || 0} reviews)</span></span>
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
                            <p style="margin-bottom: 1rem; text-align: center;">${bar.address || bar.address_en || bar.location}</p>
                            
                            <div id="detail-map" style="height: 150px; width: 100%; border-radius: 8px; margin-bottom: 1rem; z-index: 1;"></div>
                            
                            ${bar.google_map_url ?
                `<a href="${bar.google_map_url}" target="_blank" class="btn" style="width:100%; text-align:center; background-color: var(--bg-red); color: white; border: none;">Open in Google Maps</a>` :
                `<div style="height: 50px; background: #eee; display: flex; align-items: center; justify-content: center; color: #666; border-radius: 4px;">Map Link Unavailable</div>`
            }
                        </div>
                    </div>
                </div>

                <!-- Right Column -->
                <div class="right-column" style="flex: 1; min-width: 0;">
                    <!-- Editorial Review Card -->
                    ${bar.editorial_review ? `
                        <div class="content-card" style="background-color: var(--bg-red); color: white; border: none;">
                            <h3 class="section-title" style="text-align: center; font-size: 1.5rem; margin-bottom: 1.5rem; font-family: var(--font-display); color: white; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px;">Liquid Arts Review</h3>
                            <p style="font-style: italic; font-size: 1.1rem; line-height: 1.6; margin-bottom: 1rem; text-align: center;">"${bar.editorial_review}"</p>
                            ${bar.editorial_rating ? `
                                <div style="text-align: center;">
                                    <div style="color: #FFD700; font-size: 1.4rem; margin-bottom: 5px;">${'★'.repeat(bar.editorial_rating)}${'☆'.repeat(5 - bar.editorial_rating)}</div>
                                    <div style="font-weight: 600; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px;">
                                        ${['', 'Poor', 'Fair', 'Enjoyable', 'Remarkable', 'Masterpiece'][bar.editorial_rating] || ''}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}

                    ${bar.bar_awards && bar.bar_awards.length > 0 ? `
                        <div class="content-card">
                            <h3 class="section-title" style="text-align: center; font-size: 1.5rem; margin-bottom: 1.5rem; font-family: var(--font-display);">Awards</h3>
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                ${bar.bar_awards.sort((a, b) => (b.year || 0) - (a.year || 0)).map(award => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                                        <span style="font-weight: 600; color: #333;">${award.name}</span>
                                        <span style="color: #666; font-size: 0.9rem;">
                                            ${award.rank ? `<span style="color: var(--bg-red); font-weight: bold; margin-right: 5px;">${award.rank}</span>` : ''}
                                            ${award.year || ''}
                                        </span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <div class="content-card">
                        <h3 class="section-title" style="text-align: center; font-size: 1.5rem; margin-bottom: 1.5rem; font-family: var(--font-display);">Opening Hours</h3>
                        
                        <div style="margin-bottom: 1.5rem;">
                            ${formatOpeningHours(bar.opening_hours || 'Mon-Sun: 18:00 - 02:00')}
                        </div>

                        ${bar.phone ? `<p style="text-align: center; margin-bottom: 1.5rem;"><strong>Phone:</strong> ${bar.phone}</p>` : ''}
                        
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
                            ${bar.facebook_url ? `<a href="${bar.facebook_url}" target="_blank" class="btn btn-secondary" style="font-size: 0.9rem; padding: 8px 16px;">Facebook</a>` : ''}
                            ${bar.website_url ? `<a href="${bar.website_url}" target="_blank" class="btn btn-primary" style="font-size: 0.9rem; padding: 8px 16px;">Book Now</a>` : ''}
                        </div>
                    </div>

                    ${signaturesHtml}
                    
                    ${galleryHtml}
                    ${articlesHtml}
                </div>
            </div>
        `;

        // Async City Fetch
        if (bar.lat && bar.lng) {
            fetchCityFromCoords(bar.lat, bar.lng).then(city => {
                if (city) {
                    const citySpan = document.getElementById('header-city');
                    if (citySpan) citySpan.textContent = `• ${city}`;
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
                    html: `<div style="width: 24px; height: 24px; background: #ef4444; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
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
    };

    // Helper: Reverse Geocoding
    async function fetchCityFromCoords(lat, lng) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`);
            const data = await response.json();
            return data.address.city || data.address.town || data.address.village || data.address.county || '';
        } catch (e) {
            console.error('Geocoding error:', e);
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

                html += `
                    <tr style="border-bottom: 1px solid #f5f5f5;">
                        <td style="padding: 8px 0; text-align: left; color: #333; font-weight: ${weight}; opacity: ${opacity}; width: 40%;">${days[i]}</td>
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
                const [dayPart, timePart] = part.split(':').map(s => s.trim());
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
        const articles = await fetchArticles();
        const grid = document.getElementById('articles-list-grid');
        grid.innerHTML = articles.map(article => createArticleCard(article)).join('');
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

        const dateStr = new Date(article.published_at || article.created_at).toLocaleDateString();
        const tagsHtml = (article.tags || []).map(t => `<span style="background:var(--bg-red); color:white; padding:4px 12px; border-radius:20px; font-size:0.85rem; margin-right:8px; display:inline-block;">#${t}</span>`).join('');

        container.innerHTML = `
            <div style="text-align: center; max-width: 800px; margin: 0 auto 3rem auto;">
                ${article.category ? `<span class="article-category-badge">${article.category}</span>` : ''}
                <h1 style="font-size: 3rem; margin-bottom: 1rem; line-height: 1.2;">${article.title}</h1>
                ${article.excerpt ? `<p style="font-size: 1.2rem; color: #666; margin-bottom: 1.5rem; font-family: var(--font-display); font-style: italic;">${article.excerpt}</p>` : ''}
                <div style="color: #888; display: flex; flex-direction: column; align-items: center; gap: 5px; font-family: var(--font-main);">
                    <span style="font-size: 0.9rem; letter-spacing: 0.05em; text-transform: uppercase;">${dateStr}</span>
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
    function createBarCard(bar) {
        return `
            <a href="bar-details.html?id=${bar.id}" class="art-card grid-item">
                <img src="${bar.image}" alt="${bar.title}" class="art-card-image" loading="lazy">
                <h3 class="art-card-title">${bar.title}</h3>
                <div class="art-card-meta">
                    <span>${bar.location}</span> • <span class="text-red">${bar.vibe}</span>
                </div>
            </a>
        `;
    }

    function createArticleCard(article) {
        // Handle both mock data (image, date) and real data (cover_image, published_at)
        const imgUrl = article.cover_image || article.image || 'assets/placeholder.jpg';
        const dateStr = new Date(article.published_at || article.created_at || article.date).toLocaleDateString();

        return `
            <a href="article-details.html?id=${article.id}" class="art-card grid-item">
                <img src="${imgUrl}" alt="${article.title}" class="art-card-image" style="height: 200px; object-fit: cover;">
                <div class="art-card-meta" style="margin-bottom: 0.5rem;">${dateStr}</div>
                <h3 class="art-card-title" style="font-size: 1.5rem;">${article.title}</h3>
                <p class="serif-caption" style="font-size: 1rem; margin-top: 0.5rem; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${article.excerpt || ''}</p>
            </a>
        `;
    }

    // --- Auth Logic (Member) ---
    const loginBtn = document.getElementById('login-btn');
    const userMenu = document.getElementById('user-menu');
    const userAvatar = document.getElementById('user-avatar');

    async function signInWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/profile.html'
            }
        });
        if (error) console.error('Error logging in:', error.message);
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', signInWithGoogle);
    }

    // Check Auth State
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (userMenu) {
                userMenu.style.display = 'inline-block';
                // Optional: Fetch profile to get name/avatar if needed
                // For now just show "Profile" link
            }
        } else {
            if (loginBtn) loginBtn.style.display = 'inline-block';
            if (userMenu) userMenu.style.display = 'none';
        }
    });

    // --- Auto Init based on URL ---
    const path = window.location.pathname;
    if (path.endsWith('index.html') || path === '/') window.initHome();
});


