document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('media-grid');

    // Sample Data - Bar Discovery
    const mediaItems = [
        {
            id: 1,
            title: "Midnight Mixology",
            image: "assets/gallery_1.png",
            location: "Taipei, Xinyi",
            vibe: "Speakeasy",
            rating: 4.8
        },
        {
            id: 2,
            title: "The Glass Sculptor",
            image: "assets/gallery_2.png",
            location: "Tokyo, Ginza",
            vibe: "High-End",
            rating: 4.9
        },
        {
            id: 3,
            title: "Urban Nightlife",
            image: "assets/gallery_3.png",
            location: "New York, SoHo",
            vibe: "Lounge",
            rating: 4.7
        },
        {
            id: 4,
            title: "Signature Pour",
            image: "assets/gallery_1.png",
            location: "London, Shoreditch",
            vibe: "Craft Cocktails",
            rating: 4.6
        },
        {
            id: 5,
            title: "Amber Glow",
            image: "assets/gallery_2.png",
            location: "Seoul, Hongdae",
            vibe: "Jazz Bar",
            rating: 4.8
        },
        {
            id: 6,
            title: "Cocktail Geometry",
            image: "assets/gallery_3.png",
            location: "Singapore, Marina",
            vibe: "Rooftop",
            rating: 4.9
        }
    ];

    // Render Grid
    function renderGrid() {
        grid.innerHTML = mediaItems.map(item => `
            <article class="card" data-id="${item.id}">
                <div class="card-image-wrapper">
                    <img src="${item.image}" alt="${item.title}" class="card-image" loading="lazy">
                </div>
                <div class="card-content">
                    <h3 class="card-title">${item.title}</h3>
                    <div class="card-meta">
                        <span>${item.location}</span>
                        <span class="card-tag">${item.vibe}</span>
                    </div>
                </div>
            </article>
        `).join('');
    }

    renderGrid();

    // Lightbox Logic
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
        <span class="lightbox-close">&times;</span>
        <img src="" alt="Full View" class="lightbox-content">
    `;
    document.body.appendChild(lightbox);

    const lightboxImg = lightbox.querySelector('.lightbox-content');
    const closeBtn = lightbox.querySelector('.lightbox-close');

    function openLightbox(imageSrc) {
        lightboxImg.src = imageSrc;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(() => {
            lightboxImg.src = '';
        }, 300); // Clear after transition
    }

    grid.addEventListener('click', (e) => {
        const card = e.target.closest('.card');
        if (card) {
            const img = card.querySelector('.card-image');
            if (img) {
                openLightbox(img.src);
            }
        }
    });

    closeBtn.addEventListener('click', closeLightbox);

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
            closeLightbox();
        }
    });
});
