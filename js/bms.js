// --- Supabase Configuration ---
const SUPABASE_URL = 'https://wgnskednopbfngvjmviq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- DOM Elements ---
const titleInput = document.getElementById('bar-title');
const vibeInput = document.getElementById('bar-vibe');
const descriptionInput = document.getElementById('bar-description');

const addressInput = document.getElementById('bar-address');
const latInput = document.getElementById('bar-lat');
const lngInput = document.getElementById('bar-lng');
const mapPreview = document.getElementById('map-preview');

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
let currentFile = null;
let galleryImages = [];
let signatures = [];
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
            slots.push(`${days.join(',')}: ${start}-${end}`);
        }
    });
    // Format: "Mon,Tue: 20:00-02:00; Sat,Sun: 20:00-04:00"
    return slots.join('; ');
}

function parseHours(hoursStr) {
    // Basic parsing logic
    if (!hoursStr) return;
    const parts = hoursStr.split(';');
    parts.forEach(part => {
        const [daysPart, timePart] = part.split(':').map(s => s.trim());
        if (daysPart && timePart) {
            const days = daysPart.split(',').map(d => d.trim());
            const [start, end] = timePart.split('-').map(t => t.trim());
            addHoursSlot({ days, start, end });
        }
    });
}

// --- Load Bar Data ---
async function loadBar(id) {
    showLoading(true);
    try {
        const { data: bar, error } = await supabase.from('bars').select('*').eq('id', id).single();
        if (error) throw error;

        if (bar) {
            titleInput.value = bar.title || '';
            vibeInput.value = bar.vibe || '';
            descriptionInput.value = bar.description || '';

            // Location is now inferred from address on save, 
            // but we might want to show it? No, user said "don't fill it".
            // We just load the address.
            addressInput.value = bar.address || '';
            updateMapPreview(bar.address);
            latInput.value = bar.lat || '';
            lngInput.value = bar.lng || '';
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
            loadGallery(id);
            // Load Signatures
            loadSignatures(id);
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
    // Note: If inference fails, locationStr is empty. 
    // We might want to fallback to just the address or leave it empty.
    // For now, we trust the inference or let it be empty (frontend will just show address if location missing? or we need location for cards).
    // If empty, let's try to just use the first part of the address as a fallback?
    // Or just warn? 
    // Let's just save what we have.

    const hoursStr = serializeHours();

    const barData = {
        title: titleInput.value,
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
    const { error } = await supabase.from('bar_images').delete().eq('id', imageId);
    if (!error) {
        galleryImages = galleryImages.filter(img => img.id !== imageId);
        renderGallery();
    } else {
        alert('Failed to delete image');
    }
    showLoading(false);
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

                    const canvas = window.cropper.getCroppedCanvas({ width: 800, height: 1000 });
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
            const desc = document.getElementById('sig-description').value;
            const review = document.getElementById('sig-review').value;

            if (!name) {
                alert('Name is required');
                return;
            }

            const sigData = {
                bar_id: currentBarId,
                name: name,
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
    const sigDescInput = document.getElementById('sig-description');
    const sigReviewInput = document.getElementById('sig-review');
    const btnDeleteSig = document.getElementById('btn-delete-sig');

    if (sig) {
        sigModalTitle.textContent = 'Edit Signature';
        sigIdInput.value = sig.id;
        sigNameInput.value = sig.name;
        sigDescInput.value = sig.description || '';
        sigReviewInput.value = sig.review || '';
        currentSigImageUrl = sig.image_url || '';
        btnDeleteSig.style.display = 'block';
    } else {
        sigModalTitle.textContent = 'Add Signature';
        sigIdInput.value = '';
        sigNameInput.value = '';
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
