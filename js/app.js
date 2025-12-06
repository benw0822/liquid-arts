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
                <div class="section-header" style="margin-top: 2rem; margin-bottom: 1rem;">
                    <h3 class="section-title">Gallery</h3>
                </div>
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
                <div class="section-header" style="margin-top: 3rem;">
                    <h3 class="section-title">Related Stories</h3>
                </div>
                <div class="magazine-grid">
                    ${bar.bar_articles.map(ba => createArticleCard(ba.article)).join('')}
                </div>
            `;
        }

        // --- Editorial Review ---
        let editorialHtml = '';
        if (bar.editorial_review) {
            editorialHtml = `
                <div class="content-card" style="border-left: 4px solid var(--bg-red);">
                    <span class="info-label" style="color: var(--bg-red);">Editor's Review</span>
                    <p style="font-style: italic; color: #444; font-size: 1.1rem; line-height: 1.6;">"${bar.editorial_review}"</p>
                    ${bar.editorial_rating ? `<div style="margin-top: 10px; color: #FFD700; font-size: 1.2rem;">${'★'.repeat(bar.editorial_rating)}${'☆'.repeat(5 - bar.editorial_rating)}</div>` : ''}
                </div>
            `;
        }

        // --- Signatures ---
        let signaturesHtml = '';
        if (bar.signatures && bar.signatures.length > 0) {
            signaturesHtml = `
                <div class="content-card">
                    <h3 class="section-title" style="margin-bottom: 1.5rem;">Signature Cocktails</h3>
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
                <p style="font-size: 1.2rem; color: #666; letter-spacing: 0.05em;">
                    <span style="color: var(--bg-red); font-weight: 600; text-transform: uppercase;">${bar.vibe}</span>
                    ${bar.location}
                </p>
            </div>

            <div class="container detail-grid" style="margin-top: 0;">
                
                <!-- Hero Card (Image Only) -->
                <div class="content-card hero-card" style="padding: 0; border: none; overflow: hidden; background: transparent;">
                    <img id="hero-card-img" src="${bar.image}" alt="${bar.title}" style="width: 100%; height: auto; display: block;" onload="syncAboutCardHeight()">
                </div>

                <!-- Editorial Review Card (Restored) -->
                ${bar.editorial_review ? `
                    <div class="content-card" style="border-left: 4px solid var(--bg-red);">
                        <span class="info-label" style="color: var(--bg-red);">Editor's Review</span>
                        <p style="font-style: italic; color: #444; font-size: 1.1rem; line-height: 1.6; margin-bottom: 0.5rem;">"${bar.editorial_review}"</p>
                        ${bar.editorial_rating ? `<div style="color: #FFD700; font-size: 1.2rem;">${'★'.repeat(bar.editorial_rating)}${'☆'.repeat(5 - bar.editorial_rating)}</div>` : ''}
                    </div>
                ` : ''}

                <div id="about-card" class="content-card" style="display: flex; flex-direction: column;">
                    <h2 style="text-align: center; font-size: 1.5rem; margin-bottom: 1.5rem; font-family: var(--font-display); flex-shrink: 0;">About</h2>
                    
                    <div id="about-description-scroll" class="scrollable-content" style="flex: 1; overflow-y: auto; margin-bottom: 1.5rem; padding-right: 5px;">
                        <p style="line-height: 1.6; margin: 0;">
                            ${bar.description || `Experience the finest mixology at ${bar.title}. Known for its ${bar.vibe} atmosphere, this spot in ${bar.location} offers a curated selection of cocktails and spirits.`}
                        </p>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <span style="font-weight: 600; color: var(--text-primary);">Google Rating:</span> 
                        <span>${bar.rating} / 5.0 <span style="color:#888; font-size:0.9em;">(${bar.rating_count || 0} reviews)</span></span>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <span class="info-label" style="font-size: 0.9rem;">Address</span>
                        <p style="margin-bottom: 1rem;">${bar.address || bar.address_en || bar.location}</p>
                        
                        <div id="detail-map" style="height: 250px; width: 100%; border-radius: 8px; margin-bottom: 1rem; z-index: 1;"></div>
                        
                        ${bar.google_map_url ?
                `<a href="${bar.google_map_url}" target="_blank" class="btn" style="width:100%; text-align:center; background-color: var(--bg-red); color: white; border: none;">Open in Google Maps</a>` :
                `<div style="height: 50px; background: #eee; display: flex; align-items: center; justify-content: center; color: #666; border-radius: 4px;">Map Link Unavailable</div>`
            }
                    </div>
                    
                    <div style="display: flex; gap: 2rem; margin-bottom: 1.5rem;">
                        ${bar.owner_name ? `
                            <div>
                                <span class="info-label" style="font-size: 0.9rem;">Owner</span>
                                <p style="font-weight: 600;">${bar.owner_name}</p>
                            </div>
                        ` : ''}
                        ${bar.bartender_name ? `
                            <div>
                                <span class="info-label" style="font-size: 0.9rem;">Head Bartender</span>
                                <p style="font-weight: 600;">${bar.bartender_name}</p>
                            </div>
                        ` : ''}
                    </div>

                    ${bar.tags ? `<p style="margin-top:1rem; color:var(--text-secondary);">Tags: ${bar.tags.join(', ')}</p>` : ''}
                </div>

                <div class="content-card">
                    <span class="info-label">Details</span>
                    <p><strong>Price:</strong> ${'$'.repeat(bar.price_level || bar.price || 2)}</p>
                    <p><strong>Open:</strong> ${bar.opening_hours || '18:00 - 02:00'}</p>
                    ${bar.phone ? `<p><strong>Phone:</strong> ${bar.phone}</p>` : ''}
                    
                    <div style="margin-top: 1rem;">
                        <span class="info-label" style="font-size: 0.9rem;">Social</span>
                        <div style="display: flex; gap: 10px; margin-top: 5px;">
                            ${bar.instagram_url ? `<a href="${bar.instagram_url}" target="_blank" style="color: var(--text-primary); text-decoration: underline;">Instagram</a>` : ''}
                            ${bar.facebook_url ? `<a href="${bar.facebook_url}" target="_blank" style="color: var(--text-primary); text-decoration: underline;">Facebook</a>` : ''}
                            ${bar.website_url ? `<a href="${bar.website_url}" target="_blank" style="color: var(--text-primary); text-decoration: underline;">Book Now</a>` : ''}
                        </div>
                    </div>
                </div>

                <div class="content-card">
                    <span class="info-label">Menu</span>
                    <p>Signature Cocktails • Seasonal Specials • Bar Bites</p>
                    ${bar.menu_url ?
                `<a href="${bar.menu_url}" target="_blank" class="btn btn-secondary" style="margin-top: 10px; display: inline-block;">View Full Menu</a>` :
                `<button class="btn btn-secondary" style="margin-top: 10px;" disabled>Menu Coming Soon</button>`
            }
                </div>

                ${signaturesHtml}
                
                ${galleryHtml ? `<div class="content-card">${galleryHtml}</div>` : ''}
                ${articlesHtml ? `<div class="content-card">${articlesHtml}</div>` : ''}
            </div>
        `;

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

// --- Sync Height Logic ---
window.syncAboutCardHeight = () => {
    const heroImg = document.getElementById('hero-card-img');
    const aboutCard = document.getElementById('about-card');
    
    if (heroImg && aboutCard && window.innerWidth > 768) {
        // Only sync on desktop where they are side-by-side
        const height = heroImg.offsetHeight;
        if (height > 0) {
            aboutCard.style.maxHeight = height + 'px';
            // Ensure min-height is reasonable if image is too small
            aboutCard.style.minHeight = Math.min(height, 400) + 'px'; 
        }
    } else if (aboutCard) {
        // Reset on mobile
        aboutCard.style.maxHeight = 'none';
        aboutCard.style.minHeight = 'auto';
    }
};

window.addEventListener('resize', window.syncAboutCardHeight);
// Also call it after a slight delay to ensure rendering
setTimeout(window.syncAboutCardHeight, 500);
