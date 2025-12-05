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
        { id: 1, title: "Midnight Mixology", location: "Taipei, Xinyi", vibe: "Speakeasy", image: "assets/gallery_1.png", lat: 25.0330, lng: 121.5654, price: 2, rating: 4.8 },
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
    window.initMap = async () => {
        const bars = await fetchBars();
        // Default to Taipei/Asia view if no user location
        const map = L.map('map').setView([25.0330, 121.5654], 4);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        bars.forEach(bar => {
            if (bar.lat && bar.lng) {
                const marker = L.marker([bar.lat, bar.lng]).addTo(map);
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
        if (bar.website_url) socialHtml += `<a href="${bar.website_url}" target="_blank" style="color:white;">Website</a>`;

        // --- Gallery ---
        let galleryHtml = '';
        if (bar.bar_images && bar.bar_images.length > 0) {
            const sortedImages = bar.bar_images.sort((a, b) => a.display_order - b.display_order);
            galleryHtml = `
                <div class="section-header" style="margin-top: 3rem;">
                    <h3 class="section-title">Gallery</h3>
                </div>
                <div class="magazine-grid" style="grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));">
                    ${sortedImages.map(img => `
                        <div class="grid-item" style="grid-column: span 1;">
                            <img src="${img.image_url}" alt="${img.caption || ''}" style="width:100%; height:200px; object-fit:cover; border-radius:4px;">
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // --- Related Articles ---
        let articlesHtml = '';
        if (bar.bar_articles && bar.bar_articles.length > 0) {
            articlesHtml = `
                <div class="section-header" style="margin-top: 3rem;">
                    <h3 class="section-title">Related Stories</h3>
                </div>
                <div class="magazine-grid">
                    ${bar.bar_articles.map(ba => createArticleCard(ba.article)).join('')}
                </div>
            `;
        }

        container.innerHTML = `
            <div class="detail-header" style="background-image: url('${bar.image}');">
                <div class="container detail-title-block">
                    <h1 style="font-size: 3rem; margin-bottom: 0.5rem;">${bar.title}</h1>
                    <p style="font-size: 1.2rem; opacity: 0.9;">${bar.location} • ${bar.vibe}</p>
                    <div style="margin-top: 1rem;">
                        ${socialHtml}
                    </div>
                </div>
            </div>
            <div class="container detail-grid">
                <div class="main-info">
                    <div class="info-block">
                        <span class="info-label">About</span>
                        <p style="line-height: 1.6;">
                            Experience the finest mixology at ${bar.title}. Known for its ${bar.vibe} atmosphere, 
                            this spot in ${bar.location} offers a curated selection of cocktails and spirits.
                        </p>
                        ${bar.tags ? `<p style="margin-top:1rem; color:var(--text-secondary);">Tags: ${bar.tags.join(', ')}</p>` : ''}
                    </div>
                    <div class="info-block">
                        <span class="info-label">Menu</span>
                        <p>Signature Cocktails • Seasonal Specials • Bar Bites</p>
                        <button class="btn btn-secondary" style="margin-top: 10px;">View Full Menu</button>
                    </div>
                    ${galleryHtml}
                    ${articlesHtml}
                </div>
                <div class="sidebar-info">
                    <div class="info-block">
                        <span class="info-label">Details</span>
                        <p><strong>Rating:</strong> ${bar.rating} / 5.0 (${bar.rating_count || 0} reviews)</p>
                        <p><strong>Price:</strong> ${'$'.repeat(bar.price_level || bar.price || 2)}</p>
                        <p><strong>Open:</strong> ${bar.opening_hours ? 'See Google Maps' : '18:00 - 02:00'}</p>
                        ${bar.phone ? `<p><strong>Phone:</strong> ${bar.phone}</p>` : ''}
                    </div>
                    <div class="info-block">
                        <span class="info-label">Location</span>
                        <p>${bar.address_en || bar.location}</p>
                        <div style="margin-top: 10px;">
                            ${bar.google_map_url ?
                `<a href="${bar.google_map_url}" target="_blank" class="btn" style="width:100%; text-align:center;">Open in Google Maps</a>` :
                `<div style="height: 150px; background: #222; display: flex; align-items: center; justify-content: center; color: #666;">Map Unavailable</div>`
            }
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

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
        const tagsHtml = (article.tags || []).map(t => `<span style="background:#eee; padding:2px 8px; border-radius:4px; font-size:0.8rem; margin-right:5px;">${t}</span>`).join('');

        container.innerHTML = `
            <div style="text-align: center; max-width: 800px; margin: 0 auto 3rem auto;">
                <h1 style="font-size: 3rem; margin-bottom: 1rem; line-height: 1.2;">${article.title}</h1>
                ${article.excerpt ? `<p style="font-size: 1.2rem; color: #666; margin-bottom: 1.5rem; font-family: var(--font-display); font-style: italic;">${article.excerpt}</p>` : ''}
                <div style="color: #888; display: flex; flex-direction: column; align-items: center; gap: 5px; font-family: var(--font-main);">
                    <span style="font-size: 0.9rem; letter-spacing: 0.05em; text-transform: uppercase;">${dateStr}</span>
                    ${article.author_name ? `<span style="font-size: 1.1rem; color: #333; font-weight: 500;">by ${article.author_name}</span>` : ''}
                </div>
            </div>
            
            ${article.cover_image ? `<img src="${article.cover_image}" style="width: 100%; max-height: 600px; object-fit: cover; border-radius: 8px; margin-bottom: 3rem;">` : ''}
            
            <div style="margin-bottom: 2rem; text-align: center;">
                ${tagsHtml}
            </div>

            <div class="article-body" style="font-size: 1.1rem; line-height: 1.8;">
                ${article.content || '<p>No content.</p>'}
            </div>
        `;
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
