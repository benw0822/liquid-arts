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
let galleryImages = []; // Array of { id, image_url, caption }

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
                updateCoverUI();
            } else {
                updateCoverUI();
            }

            // Load Gallery
            loadGallery(id);
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

// Add Gallery Image
btnAddGallery.addEventListener('click', () => {
    galleryInput.click();
});

galleryInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    if (!currentBarId) {
        alert('Please save the bar first before adding gallery images.');
        return;
    }

    showLoading(true, `Uploading ${files.length} images...`);

    for (const file of files) {
        try {
            const url = await uploadImage(file, 'covers');
            // Insert into DB
            const { data, error } = await supabase.from('bar_images').insert([{
                bar_id: currentBarId,
                image_url: url,
                display_order: galleryImages.length + 1
            }]).select();

            if (data) {
                galleryImages.push(data[0]);
            }
        } catch (err) {
            console.error('Gallery upload error:', err);
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
