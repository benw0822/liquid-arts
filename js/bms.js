// --- Supabase Configuration ---
const SUPABASE_URL = 'https://wgnskednopbfngvjmviq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- DOM Elements ---
const titleInput = document.getElementById('bar-title');
const locationInput = document.getElementById('bar-location');
const vibeInput = document.getElementById('bar-vibe');
const descriptionInput = document.getElementById('bar-description');
const ownerInput = document.getElementById('bar-owner');
const bartenderInput = document.getElementById('bar-bartender');
const hoursInput = document.getElementById('bar-hours');
const phoneInput = document.getElementById('bar-phone');
const menuInput = document.getElementById('bar-menu');
const mapInput = document.getElementById('bar-map');
const priceInput = document.getElementById('bar-price');
const instagramInput = document.getElementById('bar-instagram');
const facebookInput = document.getElementById('bar-facebook');
const websiteInput = document.getElementById('bar-website');

const coverInput = document.getElementById('cover-file');
const coverPreview = document.getElementById('cover-preview');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const userEmailSpan = document.getElementById('user-email');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

let currentBarId = null;
let currentCoverUrl = '';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();

    // Check URL params for ID (Admin editing specific bar)
    const urlParams = new URLSearchParams(window.location.search);
    const paramId = urlParams.get('id');

    if (paramId) {
        currentBarId = paramId;
        await loadBar(currentBarId);
    } else {
        // If no ID, check if user is an owner and load their bar
        await loadOwnerBar();
    }
});

// --- Auth Check ---
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'admin.html';
        return;
    }
    userEmailSpan.textContent = session.user.email;
}

// --- Load Bar Data ---
async function loadOwnerBar() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Find bar owned by this user
    // Note: This assumes a 'owner_id' column exists in bars table or a separate relation.
    // Since we haven't strictly defined 'owner_id' in bars yet (we did roles), 
    // for now we might need to rely on the Admin passing an ID or a temporary mapping.
    // BUT, for this task, let's assume the user is an Admin editing ANY bar, 
    // or we'll fetch the first bar if they are an owner (placeholder logic).

    // For now, if no ID provided, we'll just alert or show empty state if creating new.
    // But BMS is usually for editing existing.
    // Let's default to ID=1 for testing if nothing else.
    if (!currentBarId) {
        // Try to find if they are an owner of a specific bar (future proofing)
        // For now, just warn if no ID.
        // alert('No bar specified. Creating new or please select from Admin Dashboard.');
    }
}

async function loadBar(id) {
    showLoading(true);
    try {
        const { data: bar, error } = await supabase.from('bars').select('*').eq('id', id).single();
        if (error) throw error;

        if (bar) {
            titleInput.value = bar.title || '';
            locationInput.value = bar.location || '';
            vibeInput.value = bar.vibe || '';
            descriptionInput.value = bar.description || '';
            ownerInput.value = bar.owner_name || '';
            bartenderInput.value = bar.bartender_name || '';
            hoursInput.value = bar.opening_hours || '';
            phoneInput.value = bar.phone || '';
            menuInput.value = bar.menu_url || '';
            mapInput.value = bar.google_map_url || '';
            priceInput.value = bar.price || 2;
            instagramInput.value = bar.instagram_url || '';
            facebookInput.value = bar.facebook_url || '';
            websiteInput.value = bar.website_url || '';

            if (bar.image) {
                currentCoverUrl = bar.image;
                coverPreview.style.backgroundImage = `url('${bar.image}')`;
                coverPreview.innerHTML = '';
            }
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

    const barData = {
        title: titleInput.value,
        location: locationInput.value,
        vibe: vibeInput.value,
        description: descriptionInput.value,
        owner_name: ownerInput.value,
        bartender_name: bartenderInput.value,
        opening_hours: hoursInput.value,
        phone: phoneInput.value,
        menu_url: menuInput.value,
        google_map_url: mapInput.value,
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

// --- Image Upload ---
coverInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showLoading(true, 'Uploading Image...');
    try {
        const url = await uploadImage(file, 'bars'); // Assuming 'bars' bucket exists or use 'covers'
        currentCoverUrl = url;
        coverPreview.style.backgroundImage = `url('${url}')`;
        coverPreview.innerHTML = '';
        updateStatus('Image Uploaded', 'success');
    } catch (err) {
        console.error('Upload failed:', err);
        alert('Upload failed: ' + err.message);
    } finally {
        showLoading(false);
    }
});

async function uploadImage(file, bucket = 'covers') {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
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
