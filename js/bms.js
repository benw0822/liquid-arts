// --- Supabase Configuration ---
const SUPABASE_URL = 'https://wgnskednopbfngvjmviq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- DOM Elements ---
const lngInput = document.getElementById('bar-lng');
const cityInput = document.getElementById('bar-city'); // NEW
const mapPreview = document.getElementById('map-preview');

const titleInput = document.getElementById('bar-title');
const slugInput = document.getElementById('bar-slug'); // NEW
const checkSlugBtn = document.getElementById('btn-check-slug'); // NEW
const slugFeedback = document.getElementById('slug-feedback'); // NEW

const ownerInput = document.getElementById('bar-owner');
const bartenderInput = document.getElementById('bar-bartender');
const phoneInput = document.getElementById('bar-phone');
const hoursContainer = document.getElementById('hours-editor-container');
const btnAddHours = document.getElementById('btn-add-hours');
const hoursInput = document.getElementById('bar-hours'); // Hidden input

const mapInput = document.getElementById('bar-map');
const btnLoadMap = document.getElementById('btn-load-map');

const googleRatingInput = document.getElementById('bar-google-rating');
const googleReviewsInput = document.getElementById('bar-google-reviews');
const editorialRatingInput = document.getElementById('bar-editorial-rating');
const editorialStars = document.getElementById('editorial-rating-stars');
const editorialReviewInput = document.getElementById('bar-editorial-review');

const menuInput = document.getElementById('bar-menu');
const priceInput = document.getElementById('bar-price');
const instagramInput = document.getElementById('bar-instagram');
const facebookInput = document.getElementById('bar-facebook');
const websiteInput = document.getElementById('bar-website');

const coverInput = document.getElementById('cover-file');
const coverPreview = document.getElementById('cover-preview');
const coverActions = document.getElementById('cover-actions');
const btnUploadCover = document.getElementById('btn-upload-cover');
const btnCropCover = document.getElementById('btn-crop-cover');

const galleryInput = document.getElementById('gallery-input');
const galleryGrid = document.getElementById('gallery-grid');
const btnAddGallery = document.getElementById('btn-add-gallery');

const awardsList = document.getElementById('awards-list');
const btnAddAward = document.getElementById('btn-add-award');

const cropModal = document.getElementById('crop-modal');
const cropImage = document.getElementById('crop-image');
const cropSaveBtn = document.getElementById('crop-save-btn');
const cropCancelBtn = document.getElementById('crop-cancel-btn');

const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const userEmailSpan = document.getElementById('user-email');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

let currentBarId = null;
let currentCoverUrl = '';
let originalImageSrc = null;
let cropper = null;
let currentFile = null;
let galleryImages = [];
let signatures = [];
let awards = [];
let currentSigImageUrl = '';

// --- Constants ---
const LOCATIONS = {
    "Taiwan": ["Taipei", "New Taipei", "Taichung", "Tainan", "Kaohsiung"],
    "Hong Kong": ["Central", "Wan Chai", "Causeway Bay", "Tsim Sha Tsui", "Mong Kok"],
    "Japan": ["Tokyo", "Osaka", "Kyoto", "Fukuoka"],
    "Singapore": ["Marina Bay", "Chinatown", "Orchard", "Clarke Quay"],
    "South Korea": ["Seoul", "Busan"],
    "USA": ["New York", "San Francisco", "Los Angeles", "Chicago"],
    "UK": ["London", "Manchester", "Edinburgh"]
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    initMap(); // Initialize Leaflet Map
    initHoursEditor();
    initSlugLogic(); // NEW

    // Check URL params
    const urlParams = new URLSearchParams(window.location.search);
    const paramId = urlParams.get('id');

    if (paramId) {
        currentBarId = paramId;
        await loadBar(currentBarId);
    } else {
        // New Bar: Add one empty hours slot
        addHoursSlot();
    }
});

// --- Slug Logic ---
function initSlugLogic() {
    checkSlugBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const slug = slugInput.value.trim();
        if (!slug) return;
        await checkSlugAvailability(slug);
    });

    slugInput.addEventListener('blur', () => {
        if (slugInput.value.trim()) checkSlugAvailability(slugInput.value.trim());
    });
}

async function checkSlugAvailability(slug) {
    if (!slug) return;
    slugFeedback.textContent = 'Checking...';
    slugFeedback.style.color = '#888';

    // Simple regex check: lowercase, numbers, hyphens only
    const validSlug = /^[a-z0-9-]+$/.test(slug);
    if (!validSlug) {
        slugFeedback.textContent = 'Invalid format. Use lowercase letters, numbers, and hyphens only.';
        slugFeedback.style.color = 'red';
        return false;
    }

    // DB Check
    let query = supabase.from('bars').select('id').eq('slug', slug);
    if (currentBarId) query = query.neq('id', currentBarId); // Exclude self if editing

    const { data, error } = await query;
    if (error) {
        slugFeedback.textContent = 'Error checking availability.';
        return false;
    }

    if (data && data.length > 0) {
        slugFeedback.textContent = 'Slug is already taken.';
        slugFeedback.style.color = 'red';
        return false;
    } else {
        slugFeedback.textContent = 'Slug is available!';
        slugFeedback.style.color = 'green';
        return true;
    }
}

// --- Geocoding Logic (Added to bms.js scope) ---
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

// --- Auth Check ---
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'admin.html';
        return;
    }
    const user = session.user;
    userEmailSpan.textContent = user.email;

    // Fetch User Roles from 'users' table
    const { data: profile } = await supabase
        .from('users')
        .select('roles')
        .eq('id', user.id)
        .single();

    const roles = profile ? (profile.roles || []) : [];
    const isEditor = roles.includes('admin') || roles.includes('editor');

    // Apply Permissions
    const restrictedFields = [
        editorialReviewInput,
        googleRatingInput,
        googleReviewsInput
    ];

    if (isEditor) {
        // Enable Fields
        restrictedFields.forEach(field => {
            field.disabled = false;
            field.style.backgroundColor = '#fff';
        });
        editorialReviewInput.placeholder = "Write your professional review here...";

        // Enable Stars
        editorialStars.style.pointerEvents = 'auto';
        editorialStars.style.opacity = '1';
    } else {
        // Disable Fields
        restrictedFields.forEach(field => {
            field.disabled = true;
            field.style.backgroundColor = '#f5f5f5';
        });
        editorialReviewInput.placeholder = "Only Editors can modify this field.";

        // Disable Stars
        editorialStars.style.pointerEvents = 'none';
        editorialStars.style.opacity = '0.6';
    }
}

// --- Helper: Infer Location ---
function inferLocation(address) {
    if (!address) return '';

    // Simple string matching against LOCATIONS
    for (const [country, cities] of Object.entries(LOCATIONS)) {
        // Check cities first (more specific)
        for (const city of cities) {
            if (address.includes(city)) {
                return `${city}, ${country}`;
            }
        }
        // Check country
        if (address.includes(country)) {
            // If only country found, try to find a city again or just return Country
            return country;
        }
    }
    return ''; // Could not detect
}

// --- Map Logic ---
// Removed: addressInput.addEventListener('change', () => { updateMapPreview(addressInput.value); });

let map;
let marker;

function initMap() {
    // Default to Taipei
    if (map) return;
    map = L.map('map-preview').setView([25.033964, 121.564472], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 20
    }).addTo(map);
}

function updateMapPreview(lat, lng) {
    if (!lat || !lng) return;

    // Use CartoDB Voyager
    const tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    if (!map) {
        map = L.map('map-preview').setView([lat, lng], 15);
        L.tileLayer(tileUrl, {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            maxZoom: 20
        }).addTo(map);
    } else {
        map.setView([lat, lng], 15);
    }

    if (marker) map.removeLayer(marker);

    // Custom Red Circle Icon with Label
    const barTitle = document.getElementById('bar-title').value || 'Bar Location';
    const customIcon = L.divIcon({
        className: 'custom-map-marker',
        html: `
            <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
                <div style="background: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 12px; color: #333; box-shadow: 0 2px 4px rgba(0,0,0,0.2); margin-bottom: 4px; white-space: nowrap;">
                    ${barTitle}
                </div>
                <div style="width: 14px; height: 14px; background: #ef4444; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
            </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
    });

    marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

    // Force map resize
    setTimeout(() => { map.invalidateSize(); }, 200);
}

btnLoadMap.addEventListener('click', (e) => {
    e.preventDefault();
    const url = mapInput.value;
    console.log('Loading Map URL:', url);

    if (!url) {
        alert('Please paste a Google Maps URL first.');
        return;
    }

    // Check for short links
    if (url.includes('goo.gl') || url.includes('maps.app.goo.gl')) {
        alert('Please copy the full URL from the browser address bar (containing /place/ and @coordinates), not the "Share" short link.');
        return;
    }

    // Parse Address & Name
    // Example: .../place/Bar+Name,+Address...
    let parsed = false;
    const placeMatch = url.match(/\/place\/([^/]+)\//);

    if (placeMatch && placeMatch[1]) {
        parsed = true;
        let fullQuery = decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ');
        console.log('Found Query:', fullQuery);

        // Heuristic: Split by first comma
        const firstComma = fullQuery.indexOf(',');

        if (firstComma > -1) {
            titleInput.value = fullQuery.substring(0, firstComma).trim();
            addressInput.value = fullQuery.substring(firstComma + 1).trim();
        } else {
            // No comma found. Assume it's the Place Name.
            titleInput.value = fullQuery;
            // Do NOT set addressInput to the name to avoid "Name in Address" bug.
            alert(`Found Place Name: "${fullQuery}".\nNote: This URL does not contain the full address. Please enter the Address manually.`);
        }
        // Removed: updateMapPreview(fullQuery); // This was an old call that passed a string, not lat/lng
    }

    // Parse Coords
    const coordsMatch = url.match(/@([\d.-]+),([\d.-]+)/);
    if (coordsMatch) {
        const lat = parseFloat(coordsMatch[1]);
        const lng = parseFloat(coordsMatch[2]);
        console.log('Found Coords:', lat, lng);
        latInput.value = lat;
        lngInput.value = lng;
        updateMapPreview(lat, lng); // Call with parsed numbers

        // If we didn't find a place name, at least show the map at these coords
        if (!parsed) {
            parsed = true;
            alert('Could not find Place Name in URL, but updated Map coordinates.');
        }
    }

    if (!parsed) {
        alert('Could not parse URL. Please ensure it is a valid Google Maps full URL (containing /place/ or @coordinates).');
    }
});

// --- Hours Logic ---
let hoursSlots = [];

function initHoursEditor() {
    btnAddHours.addEventListener('click', () => addHoursSlot());
}

function addHoursSlot(data = { days: [], start: "20:00", end: "02:00" }) {
    const div = document.createElement('div');
    div.className = 'hours-slot';
    div.style.marginBottom = '10px';
    div.style.padding = '10px';
    div.style.background = 'white';
    div.style.border = '1px solid #eee';
    div.style.borderRadius = '4px';

    // Days Checkboxes
    const daysDiv = document.createElement('div');
    daysDiv.style.display = 'flex';
    daysDiv.style.gap = '5px';
    daysDiv.style.flexWrap = 'wrap';
    daysDiv.style.marginBottom = '5px';

    DAYS.forEach(day => {
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.fontSize = '0.8rem';
        label.style.cursor = 'pointer';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = day;
        cb.checked = data.days.includes(day);
        cb.style.marginRight = '3px';

        label.appendChild(cb);
        label.appendChild(document.createTextNode(day));
        daysDiv.appendChild(label);
    });

    // Time Inputs
    const timeDiv = document.createElement('div');
    timeDiv.style.display = 'flex';
    timeDiv.style.alignItems = 'center';
    timeDiv.style.gap = '10px';

    const startInput = document.createElement('input');
    startInput.type = 'time';
    startInput.className = 'form-input';
    startInput.style.marginBottom = '0';
    startInput.style.width = 'auto';
    startInput.value = data.start;

    const toSpan = document.createElement('span');
    toSpan.textContent = 'to';

    const endInput = document.createElement('input');
    endInput.type = 'time';
    endInput.className = 'form-input';
    endInput.style.marginBottom = '0';
    endInput.style.width = 'auto';
    endInput.value = data.end;

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Remove';
    delBtn.className = 'secondary-btn';
    delBtn.style.padding = '5px 10px';
    delBtn.style.fontSize = '0.8rem';
    delBtn.style.marginLeft = 'auto';
    delBtn.style.color = 'red';
    delBtn.onclick = () => div.remove();

    timeDiv.appendChild(startInput);
    timeDiv.appendChild(toSpan);
    timeDiv.appendChild(endInput);
    timeDiv.appendChild(delBtn);

    div.appendChild(daysDiv);
    div.appendChild(timeDiv);
    hoursContainer.appendChild(div);
}

function serializeHours() {
    const slots = [];
    hoursContainer.querySelectorAll('.hours-slot').forEach(slot => {
        const days = [];
        slot.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => days.push(cb.value));
        const start = slot.querySelector('input[type="time"]:nth-of-type(1)').value;
        const end = slot.querySelector('input[type="time"]:nth-of-type(2)').value;

        if (days.length > 0 && start && end) {
            // User wants independent storage for each day
            days.forEach(day => {
                slots.push(`${day}: ${start} - ${end}`);
            });
        }
    });

    // Sort by day order
    const dayOrder = { "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6, "Sun": 7 };
    slots.sort((a, b) => {
        const dayA = a.split(':')[0].trim();
        const dayB = b.split(':')[0].trim();
        return (dayOrder[dayA] || 0) - (dayOrder[dayB] || 0);
    });

    return slots.join('; ');
}

function parseHours(hoursStr) {
    if (!hoursStr) return;

    // Normalize
    const cleanStr = hoursStr.trim();

    // Handle "Daily 18:00-02:00" format (no colon)
    if (cleanStr.toLowerCase().startsWith('daily') && !cleanStr.includes(':')) {
        const timePart = cleanStr.replace(/daily/i, '').trim();
        const [start, end] = timePart.split('-').map(t => t.trim());
        addHoursSlot({ days: [...DAYS], start: formatTime(start), end: formatTime(end) });
        return;
    }

    const parts = cleanStr.split(';');
    parts.forEach(part => {
        // Check for "Day-Day: Time" or "Day,Day: Time" or "Day: Time"
        const colonIndex = part.indexOf(':');
        if (colonIndex !== -1) {
            const daysPart = part.substring(0, colonIndex).trim();
            const timePart = part.substring(colonIndex + 1).trim();

            let days = [];

            // Handle Ranges "Mon-Sun", "Mon-Fri"
            if (daysPart.includes('-')) {
                const [startDay, endDay] = daysPart.split('-').map(d => d.trim());
                const startIdx = DAYS.indexOf(startDay);
                const endIdx = DAYS.indexOf(endDay);

                if (startIdx !== -1 && endIdx !== -1) {
                    if (startIdx <= endIdx) {
                        days = DAYS.slice(startIdx, endIdx + 1);
                    } else {
                        days = [...DAYS.slice(startIdx), ...DAYS.slice(0, endIdx + 1)];
                    }
                }
            } else if (daysPart.toLowerCase() === 'daily') {
                days = [...DAYS];
            } else {
                // Comma separated or single day
                days = daysPart.split(',').map(d => d.trim());
            }

            // Parse Time
            let [start, end] = timePart.split('-').map(t => t.trim());
            addHoursSlot({ days, start: formatTime(start), end: formatTime(end) });
        } else {
            // Fallback
            if (part.match(/\d/)) {
                let [start, end] = part.replace(/[a-zA-Z]/g, '').trim().split('-').map(t => t.trim());
                addHoursSlot({ days: [...DAYS], start: formatTime(start), end: formatTime(end) });
            }
        }
    });
}

function formatTime(t) {
    if (!t) return '';
    // Ensure HH:MM format if possible
    return t.trim();
}

// --- Load Bar Data ---
async function loadBar(id) {
    showLoading(true);
    try {
        const { data: bar, error } = await supabase.from('bars').select('*').eq('id', id).single();
        if (error) throw error;

        if (bar) {
            if (bar) {
                titleInput.value = bar.title || '';
                slugInput.value = bar.slug || ''; // NEW
                vibeInput.value = bar.vibe || '';
                descriptionInput.value = bar.description || '';

                // Location is now inferred from address on save, 
                // but we might want to show it? No, user said "don't fill it".
                // We just load the address.
                addressInput.value = bar.address || '';
                latInput.value = bar.lat || '';
                lngInput.value = bar.lng || '';
                cityInput.value = bar.city || ''; // NEW

                if (bar.lat && bar.lng) {
                    updateMapPreview(bar.lat, bar.lng);
                }

                ownerInput.value = bar.owner_name || '';
                bartenderInput.value = bar.bartender_name || '';
                phoneInput.value = bar.phone || '';

                // Hours Parsing
                hoursContainer.innerHTML = ''; // Clear default
                if (bar.opening_hours && bar.opening_hours.includes(':')) {
                    parseHours(bar.opening_hours);
                } else {
                    addHoursSlot();
                }

                menuInput.value = bar.menu_url || '';
                mapInput.value = bar.google_map_url || '';

                googleRatingInput.value = bar.google_rating || '';
                googleReviewsInput.value = bar.google_review_count || '';
                editorialRatingInput.value = bar.editorial_rating || 0;
                editorialReviewInput.value = bar.editorial_review || '';
                updateStars(bar.editorial_rating || 0);

                priceInput.value = bar.price || 2;
                instagramInput.value = bar.instagram_url || '';
                facebookInput.value = bar.facebook_url || '';
                websiteInput.value = bar.website_url || '';

                if (bar.image) {
                    currentCoverUrl = bar.image;
                    updateCoverUI();
                } else {
                    updateCoverUI();
                }

                // Load Gallery
                await loadGallery(id);
                // Load Signatures
                await loadSignatures(id);
                // Load Awards
                await loadAwards(id);
            }
        } catch (err) {
            console.error('Error loading bar:', err);
            alert('Failed to load bar details.');
        } finally {
            showLoading(false);
        }
    }

// --- Save Data ---
saveBtn.addEventListener('click', async () => {
        if (!titleInput.value) {
            alert('Bar Name is required');
            return;
        }

        showLoading(true, 'Saving...');

        // Infer Location from Address
        const locationStr = inferLocation(addressInput.value);

        // Auto-fetch City if coordinates present and city is empty (or force update?)
        // User requested "update based on coordinates". Let's force update if coords changed or enforce check.
        // Ideally await fetchCityFromCoords if lat/lng are set.
        let cityStr = cityInput.value;
        if (latInput.value && lngInput.value) {
            // Always try to fetch fresh city on save to ensure accuracy
            const fetchedCity = await fetchCityFromCoords(latInput.value, lngInput.value);
            if (fetchedCity) cityStr = fetchedCity;
        }

        const hoursStr = serializeHours();

        // Validate Slug if present
        const slugVal = slugInput.value.trim() || null;
        if (slugVal) {
            // Quick regex check before sending
            if (!/^[a-z0-9-]+$/.test(slugVal)) {
                alert("Invalid slug format. Lowercase, numbers, hyphen only.");
                showLoading(false);
                return;
            }
            // Note: Uniqueness check will happen at DB level (constraint) or we rely on checkSlugAvailability
        }

        const barData = {
            title: titleInput.value,
            slug: slugVal, // NEW
            city: cityStr, // NEW
            location: locationStr, // Inferred
            vibe: vibeInput.value,
            description: descriptionInput.value,
            address: addressInput.value,
            lat: latInput.value ? parseFloat(latInput.value) : null,
            lng: lngInput.value ? parseFloat(lngInput.value) : null,
            owner_name: ownerInput.value,
            bartender_name: bartenderInput.value,
            opening_hours: hoursStr,
            phone: phoneInput.value,
            menu_url: menuInput.value,
            google_map_url: mapInput.value,
            google_rating: googleRatingInput.value ? parseFloat(googleRatingInput.value) : null,
            google_review_count: googleReviewsInput.value ? parseInt(googleReviewsInput.value) : null,
            editorial_rating: parseInt(editorialRatingInput.value) || 0,
            editorial_review: editorialReviewInput.value,
            price: parseInt(priceInput.value),
            instagram_url: instagramInput.value,
            facebook_url: facebookInput.value,
            website_url: websiteInput.value,
            image: currentCoverUrl
        };

        try {
            let error;
            if (currentBarId) {
                // Update
                const { error: updateError } = await supabase
                    .from('bars')
                    .update(barData)
                    .eq('id', currentBarId);
                error = updateError;
            } else {
                // Create New
                const { data, error: insertError } = await supabase
                    .from('bars')
                    .insert([barData])
                    .select();
                if (data) currentBarId = data[0].id;
                error = insertError;
            }

            if (error) throw error;

            updateStatus('Saved', 'success');
            alert('Bar details saved successfully!');
        } catch (err) {
            console.error('Error saving bar:', err);
            alert('Error saving: ' + err.message);
            updateStatus('Error', 'error');
        } finally {
            showLoading(false);
        }
    });

    cancelBtn.addEventListener('click', () => {
        window.location.href = 'admin.html';
    });

    // --- Cover Image & Cropping ---

    function updateCoverUI() {
        const placeholder = coverPreview.querySelector('span');
        if (currentCoverUrl) {
            coverPreview.style.backgroundImage = `url('${currentCoverUrl}')`;
            if (placeholder) placeholder.style.display = 'none';
            if (coverActions) coverActions.style.display = 'flex';
        } else {
            coverPreview.style.backgroundImage = 'none';
            if (placeholder) placeholder.style.display = 'block';
            if (coverActions) coverActions.style.display = 'none';
        }
    }

    function openCropper(src) {
        cropImage.src = src;
        if (src.startsWith('http')) {
            cropImage.crossOrigin = 'anonymous';
        } else {
            cropImage.removeAttribute('crossorigin');
        }

        cropModal.style.display = 'flex';

        if (cropper) cropper.destroy();
        cropper = new Cropper(cropImage, {
            aspectRatio: 4 / 5, // Instagram Portrait
            viewMode: 1,
            autoCropArea: 1,
        });
    }

    // Cover Listeners
    if (coverPreview) {
        coverPreview.addEventListener('click', (e) => {
            if (e.target.closest('.cover-actions-overlay')) return;
            if (!currentCoverUrl) coverInput.click();
        });
    }

    if (btnUploadCover) {
        btnUploadCover.addEventListener('click', (e) => {
            e.stopPropagation();
            coverInput.click();
        });
    }

    if (btnCropCover) {
        btnCropCover.addEventListener('click', (e) => {
            e.stopPropagation();
            if (originalImageSrc) {
                openCropper(originalImageSrc);
            } else if (currentCoverUrl) {
                openCropper(currentCoverUrl);
            }
        });
    }

    coverInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            currentFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let src = img.src;
                    // Auto-Upscale (Simple version)
                    if (img.width < 1080) {
                        // Logic similar to CMS can be added here if needed
                    }
                    originalImageSrc = src;
                    openCropper(src);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
        coverInput.value = '';
    });

    cropCancelBtn.addEventListener('click', () => {
        cropModal.style.display = 'none';
        if (cropper) cropper.destroy();
        cropper = null;
    });

    cropSaveBtn.addEventListener('click', async () => {
        if (!cropper) return;

        const canvas = cropper.getCroppedCanvas({
            width: 1080,
            height: 1350,
            minWidth: 1080,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });

        canvas.toBlob(async (blob) => {
            if (!blob) { alert('Crop failed'); return; }

            const fileName = currentFile ? currentFile.name : 'cover.jpg';
            const croppedFile = new File([blob], fileName, { type: 'image/jpeg' });

            try {
                showLoading(true, 'Uploading Cover...');
                cropModal.style.display = 'none';
                currentCoverUrl = await uploadImage(croppedFile, 'covers');
                updateCoverUI();
                showLoading(false);
            } catch (err) {
                showLoading(false);
                alert('Upload failed: ' + err.message);
            } finally {
                if (cropper) cropper.destroy();
                cropper = null;
            }
        }, 'image/jpeg', 0.9);
    });

    // --- Gallery Logic ---

    async function loadGallery(barId) {
        const { data, error } = await supabase
            .from('bar_images')
            .select('*')
            .eq('bar_id', barId)
            .order('display_order', { ascending: true });

        if (data) {
            galleryImages = data;
            renderGallery();
        }
    }

    function renderGallery() {
        galleryGrid.innerHTML = '';
        if (galleryImages.length === 0) {
            galleryGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #999; font-size: 0.9rem; padding: 20px; background: #f9f9f9; border-radius: 4px;">No images yet</div>';
            return;
        }

        galleryImages.forEach(img => {
            const div = document.createElement('div');
            div.style.position = 'relative';
            div.style.aspectRatio = '1';
            div.style.backgroundImage = `url('${img.image_url}')`;
            div.style.backgroundSize = 'cover';
            div.style.backgroundPosition = 'center';
            div.style.borderRadius = '4px';
            div.style.border = '1px solid #ddd';

            const delBtn = document.createElement('button');
            delBtn.innerHTML = '&times;';
            delBtn.style.position = 'absolute';
            delBtn.style.top = '5px';
            delBtn.style.right = '5px';
            delBtn.style.background = 'rgba(0,0,0,0.5)';
            delBtn.style.color = 'white';
            delBtn.style.border = 'none';
            delBtn.style.borderRadius = '50%';
            delBtn.style.width = '20px';
            delBtn.style.height = '20px';
            delBtn.style.cursor = 'pointer';
            delBtn.style.display = 'flex';
            delBtn.style.alignItems = 'center';
            delBtn.style.justifyContent = 'center';

            delBtn.onclick = async (e) => {
                e.stopPropagation();
                if (confirm('Delete this image?')) {
                    await deleteGalleryImage(img.id);
                }
            };

            div.appendChild(delBtn);
            galleryGrid.appendChild(div);
        });
    }

    async function deleteGalleryImage(imageId) {
        showLoading(true, 'Deleting...');

        // Find image to get URL
        const img = galleryImages.find(i => i.id === imageId);
        if (img && img.image_url) {
            await deleteImageFromStorage(img.image_url, 'gallery');
        }

        const { error } = await supabase.from('bar_images').delete().eq('id', imageId);
        if (!error) {
            galleryImages = galleryImages.filter(img => img.id !== imageId);
            renderGallery();
        } else {
            alert('Failed to delete image');
        }
        showLoading(false);
    }

    async function deleteImageFromStorage(publicUrl, bucket) {
        try {
            const urlObj = new URL(publicUrl);
            const pathParts = urlObj.pathname.split('/');
            // Format: .../storage/v1/object/public/[bucket]/[path]
            const bucketIndex = pathParts.indexOf(bucket);
            if (bucketIndex === -1 || bucketIndex === pathParts.length - 1) return;

            const filePath = decodeURIComponent(pathParts.slice(bucketIndex + 1).join('/'));
            console.log('Deleting file from storage:', bucket, filePath);

            const { error } = await supabase.storage.from(bucket).remove([filePath]);
            if (error) console.error('Storage delete error:', error);
        } catch (e) {
            console.error('Error parsing URL for deletion:', e);
        }
    }

    // --- Star Rating Logic ---
    if (editorialStars) {
        const stars = editorialStars.querySelectorAll('span');
        stars.forEach(star => {
            star.addEventListener('click', () => {
                const val = parseInt(star.dataset.value);
                editorialRatingInput.value = val;
                updateStars(val);
            });
        });
    }

    function updateStars(value) {
        const stars = editorialStars.querySelectorAll('span');
        stars.forEach(s => {
            const v = parseInt(s.dataset.value);
            s.style.color = v <= value ? '#FFD700' : '#ccc'; // Gold vs Gray
        });
    }

    // Add Gallery Image
    btnAddGallery.addEventListener('click', () => {
        galleryInput.click();
    });

    galleryInput.addEventListener('change', async (e) => {
        console.log('Gallery Input Change');
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        if (!currentBarId) {
            alert('Please save the bar first before adding gallery images.');
            return;
        }

        if (galleryImages.length + files.length > 50) {
            alert('Gallery cannot exceed 50 images.');
            return;
        }

        showLoading(true, `Uploading ${files.length} images...`);

        for (const file of files) {
            try {
                console.log('Uploading file:', file.name);
                const url = await uploadImage(file, 'gallery');
                console.log('Uploaded URL:', url);

                // Insert into DB
                const { data, error } = await supabase.from('bar_images').insert([{
                    bar_id: currentBarId,
                    image_url: url,
                    display_order: galleryImages.length + 1
                }]).select();

                if (error) {
                    console.error('DB Insert Error:', error);
                    throw error;
                }

                if (data) {
                    console.log('DB Insert Success:', data);
                    galleryImages.push(data[0]);
                }
            } catch (err) {
                console.error('Gallery upload error:', err);
                alert('Error uploading image: ' + err.message);
            }
        }

        renderGallery();
        showLoading(false);
        galleryInput.value = '';
    });

    async function uploadImage(file, bucket = 'covers') {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(filePath, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);

        return publicUrl;
    }

    // --- Helpers ---
    function showLoading(show, text = 'Processing...') {
        loadingOverlay.style.display = show ? 'flex' : 'none';
        document.getElementById('loading-text').textContent = text;
    }

    function updateStatus(text, type) {
        statusText.textContent = text;
        statusDot.style.backgroundColor = type === 'success' ? '#4cd964' : (type === 'error' ? '#ff3b30' : '#ccc');
        setTimeout(() => {
            statusText.textContent = 'Ready';
            statusDot.style.backgroundColor = '#ccc';
        }, 3000);
    }

    // --- Signatures Logic ---
    document.addEventListener('DOMContentLoaded', () => {
        // Re-select elements to ensure they exist within this scope
        const btnAddSignature = document.getElementById('btn-add-signature');
        const sigModal = document.getElementById('signature-modal');
        const btnCancelSig = document.getElementById('btn-cancel-sig');
        const btnUploadSig = document.getElementById('btn-upload-sig');
        const sigImagePreview = document.getElementById('sig-image-preview');
        const sigFileInput = document.getElementById('sig-file-input');
        const btnSaveSig = document.getElementById('btn-save-sig');
        const btnDeleteSig = document.getElementById('btn-delete-sig');

        if (btnAddSignature) {
            btnAddSignature.addEventListener('click', (e) => {
                e.preventDefault();
                if (signatures.length >= 5) {
                    alert('You can only add up to 5 signature cocktails.');
                    return;
                }
                openSigModal();
            });
        }

        if (btnCancelSig) btnCancelSig.addEventListener('click', () => sigModal.style.display = 'none');

        if (btnUploadSig) btnUploadSig.addEventListener('click', () => sigFileInput.click());
        if (sigImagePreview) sigImagePreview.addEventListener('click', () => sigFileInput.click());

        if (sigFileInput) {
            sigFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const cropImage = document.getElementById('crop-image');
                    const cropModal = document.getElementById('crop-modal');
                    const cropSaveBtn = document.getElementById('crop-save-btn');

                    cropImage.src = event.target.result;
                    cropModal.style.display = 'flex';

                    if (window.cropper) window.cropper.destroy();
                    window.cropper = new Cropper(cropImage, {
                        aspectRatio: 4 / 5,
                        viewMode: 1,
                    });

                    cropSaveBtn.onclick = async () => {
                        cropSaveBtn.textContent = 'Uploading...';
                        cropSaveBtn.disabled = true;

                        const canvas = window.cropper.getCroppedCanvas({ width: 1080, height: 1350 });
                        canvas.toBlob(async (blob) => {
                            const fileName = `sig_${Date.now()}.jpg`;
                            const { data, error } = await supabase.storage
                                .from('gallery')
                                .upload(fileName, blob);

                            if (error) {
                                alert('Upload failed: ' + error.message);
                            } else {
                                const { data: { publicUrl } } = supabase.storage.from('gallery').getPublicUrl(fileName);
                                currentSigImageUrl = publicUrl;
                                updateSigImagePreview();
                                cropModal.style.display = 'none';
                            }
                            cropSaveBtn.textContent = 'Crop & Upload';
                            cropSaveBtn.disabled = false;
                        }, 'image/jpeg', 0.8);
                    };
                };
                reader.readAsDataURL(file);
            });
        }

        if (btnSaveSig) {
            btnSaveSig.addEventListener('click', async () => {
                const id = document.getElementById('sig-id').value;
                const name = document.getElementById('sig-name').value;
                const price = document.getElementById('sig-price').value;
                const desc = document.getElementById('sig-description').value;
                const review = document.getElementById('sig-review').value;

                if (!name) {
                    alert('Name is required');
                    return;
                }

                const sigData = {
                    bar_id: currentBarId,
                    name: name,
                    price: price,
                    description: desc,
                    review: review,
                    image_url: currentSigImageUrl
                };

                btnSaveSig.textContent = 'Saving...';
                btnSaveSig.disabled = true;

                let error;
                if (id) {
                    const { error: err } = await supabase.from('signatures').update(sigData).eq('id', id);
                    error = err;
                } else {
                    const { error: err } = await supabase.from('signatures').insert([sigData]);
                    error = err;
                }

                btnSaveSig.textContent = 'Save';
                btnSaveSig.disabled = false;

                if (error) {
                    alert('Error saving: ' + error.message);
                } else {
                    sigModal.style.display = 'none';
                    loadSignatures(currentBarId);
                }
            });
        }

        if (btnDeleteSig) {
            btnDeleteSig.addEventListener('click', async () => {
                if (!confirm('Delete this signature?')) return;
                const id = document.getElementById('sig-id').value;

                // Delete Image from Storage
                const sig = signatures.find(s => s.id == id);
                if (sig && sig.image_url) {
                    await deleteImageFromStorage(sig.image_url, 'gallery');
                }

                const { error } = await supabase.from('signatures').delete().eq('id', id);
                if (error) {
                    alert('Error deleting: ' + error.message);
                } else {
                    sigModal.style.display = 'none';
                    loadSignatures(currentBarId);
                }
            });
        }
    });

    // Global functions for access
    async function loadSignatures(barId) {
        const { data, error } = await supabase
            .from('signatures')
            .select('*')
            .eq('bar_id', barId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error loading signatures:', error);
            return;
        }
        signatures = data || [];
        renderSignatures();
    }

    function renderSignatures() {
        const signaturesGrid = document.getElementById('signatures-grid');
        if (!signaturesGrid) return;

        if (signatures.length === 0) {
            signaturesGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #999; padding: 20px;">No signatures yet</div>';
            return;
        }

        signaturesGrid.innerHTML = signatures.map(sig => `
        <div class="sig-card" onclick="editSignature('${sig.id}')" style="cursor: pointer; border: 1px solid #eee; border-radius: 4px; overflow: hidden; transition: box-shadow 0.2s;">
            <div style="height: 150px; background-image: url('${sig.image_url || 'assets/placeholder.jpg'}'); background-size: cover; background-position: center;"></div>
            <div style="padding: 10px;">
                <div style="font-weight: bold; margin-bottom: 5px;">${sig.name}</div>
                <div style="font-size: 0.8rem; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sig.description || ''}</div>
            </div>
        </div>
    `).join('');
    }

    window.editSignature = (id) => {
        const sig = signatures.find(s => s.id == id);
        if (!sig) return;
        openSigModal(sig);
    };

    function openSigModal(sig = null) {
        const sigModal = document.getElementById('signature-modal');
        const sigModalTitle = document.getElementById('sig-modal-title');
        const sigIdInput = document.getElementById('sig-id');
        const sigNameInput = document.getElementById('sig-name');
        const sigPriceInput = document.getElementById('sig-price');
        const sigDescInput = document.getElementById('sig-description');
        const sigReviewInput = document.getElementById('sig-review');
        const btnDeleteSig = document.getElementById('btn-delete-sig');

        if (sig) {
            sigModalTitle.textContent = 'Edit Signature';
            sigIdInput.value = sig.id;
            sigNameInput.value = sig.name;
            sigPriceInput.value = sig.price || '';
            sigDescInput.value = sig.description || '';
            sigReviewInput.value = sig.review || '';
            currentSigImageUrl = sig.image_url || '';
            btnDeleteSig.style.display = 'block';
        } else {
            sigModalTitle.textContent = 'Add Signature';
            sigIdInput.value = '';
            sigNameInput.value = '';
            sigPriceInput.value = '';
            sigDescInput.value = '';
            sigReviewInput.value = '';
            currentSigImageUrl = '';
            btnDeleteSig.style.display = 'none';
        }

        updateSigImagePreview();
        sigModal.style.display = 'flex';
    }

    function updateSigImagePreview() {
        const sigImagePreview = document.getElementById('sig-image-preview');
        if (currentSigImageUrl) {
            sigImagePreview.style.backgroundImage = `url('${currentSigImageUrl}')`;
            sigImagePreview.innerHTML = '';
        } else {
            sigImagePreview.style.backgroundImage = '';
            sigImagePreview.innerHTML = '<span>Upload</span>';
        }
    }

    // --- Awards Logic ---
    async function loadAwards(barId) {
        const { data, error } = await supabase
            .from('bar_awards')
            .select('*')
            .eq('bar_id', barId)
            .order('year', { ascending: false });

        if (error) {
            console.error('Error loading awards:', error);
            return;
        }

        awards = data || [];
        renderAwards();
    }

    function renderAwards() {
        if (awards.length === 0) {
            awardsList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No awards listed yet</div>';
            return;
        }

        awardsList.innerHTML = awards.map(award => `
        <div class="award-item" style="display: flex; justify-content: space-between; align-items: center; background: #f9f9f9; padding: 10px; border-radius: 4px; border: 1px solid #eee;">
            <div>
                <div style="font-weight: 600; color: #333;">${award.name}</div>
                <div style="font-size: 0.85rem; color: #666;">
                    ${award.rank ? `<span style="color: var(--bg-red); font-weight: bold;">${award.rank}</span>` : ''}
                    ${award.year ? ` • ${award.year}` : ''}
                </div>
            </div>
            <button onclick="deleteAward('${award.id}')" style="background: none; border: none; color: #ff4444; cursor: pointer; font-size: 1.2rem;">&times;</button>
        </div>
    `).join('');
    }

    btnAddAward.addEventListener('click', async () => {
        if (!currentBarId) return alert('Please save the bar first.');

        const name = prompt('Award Name (e.g. Asia\'s 50 Best Bars):');
        if (!name) return;

        const rank = prompt('Rank / Title (e.g. 12, Winner):');
        const year = prompt('Year (e.g. 2024):');

        const { data, error } = await supabase
            .from('bar_awards')
            .insert([{
                bar_id: currentBarId,
                name: name,
                rank: rank,
                year: year ? parseInt(year) : null
            }])
            .select();

        if (error) {
            console.error('Error adding award:', error);
            alert('Failed to add award.');
        } else {
            awards.push(data[0]);
            renderAwards();
        }
    });

    window.deleteAward = async (id) => {
        if (!confirm('Delete this award?')) return;

        const { error } = await supabase
            .from('bar_awards')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting award:', error);
            alert('Failed to delete award.');
        } else {
            awards = awards.filter(a => a.id != id);
            renderAwards();
        }
    };
