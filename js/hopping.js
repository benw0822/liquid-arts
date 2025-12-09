// Hopping Feature Logic

// 1. Inject Modal HTML on Load
document.addEventListener('DOMContentLoaded', () => {
    const modalHTML = `
    <div id="hopping-modal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; align-items: center; justify-content: center;">
        <div class="modal-content" style="background: white; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; border-radius: 12px; padding: 20px; position: relative; color: #333;">
            <button id="close-hopping-btn" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
            <h2 style="margin-bottom: 20px; font-family: var(--font-display); text-align: center;">Hop In!</h2>
            
            <input type="hidden" id="hopping-bar-id">

            <!-- 1. Image Upload & Crop (Square Zone) -->
            <div style="margin-bottom: 20px; text-align: center;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; text-align: left;">1. Photo (Required)</label>
                <input type="file" id="hopping-file-input" accept="image/*" style="display: none;">
                
                <div id="upload-zone" style="width: 100%; max-width: 300px; aspect-ratio: 1/1; background: #f0f0f0; border: 2px dashed #ccc; border-radius: 8px; margin: 0 auto; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; overflow: hidden;">
                    <span id="upload-placeholder" style="color: #888; font-size: 1.2rem; pointer-events: none;">
                        📷 Click to Upload
                    </span>
                    <div id="cropper-wrapper" style="width: 100%; height: 100%; display: none;">
                        <img id="cropper-image" src="" style="max-width: 100%;">
                    </div>
                </div>
            </div>

            <!-- 2. Rating -->
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">2. Rating</label>
                <div class="star-rating" style="display: flex; gap: 5px; font-size: 1.5rem; cursor: pointer;">
                    <span data-value="1" class="hop-star">☆</span>
                    <span data-value="2" class="hop-star">☆</span>
                    <span data-value="3" class="hop-star">☆</span>
                    <span data-value="4" class="hop-star">☆</span>
                    <span data-value="5" class="hop-star">☆</span>
                </div>
                <p id="rating-desc" style="font-size: 0.9rem; color: #666; margin-top: 5px; min-height: 20px;">Select a rating</p>
                <input type="hidden" id="hopping-rating" value="0">
            </div>

            <!-- 3. Description -->
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">3. Description (Optional)</label>
                <textarea id="hopping-desc" maxlength="150" placeholder="Max 150 chars..." style="width: 100%; height: 80px; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></textarea>
            </div>

            <!-- 4. Date & Time -->
            <div style="margin-bottom: 20px; display: flex; gap: 10px;">
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Date</label>
                    <input type="date" id="hopping-date" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Time</label>
                    <input type="time" id="hopping-time" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
            </div>

            <!-- 5. Public Toggle -->
            <div style="margin-bottom: 20px;">
                 <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="hopping-public" checked style="width: 20px; height: 20px; margin-right: 10px;">
                    <span>Make Public</span>
                 </label>
            </div>

            <button id="submit-hopping-btn" class="btn" style="width: 100%; background: var(--bg-red); color: white; border: none; border-radius: 4px; padding: 12px;">Check In</button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    initHoppingLogic();
});

let cropper = null;

function initHoppingLogic() {
    const modal = document.getElementById('hopping-modal');
    const closeBtn = document.getElementById('close-hopping-btn');
    const fileInput = document.getElementById('hopping-file-input');
    const cropperWrapper = document.getElementById('cropper-wrapper');
    const cropperImage = document.getElementById('cropper-image');
    const stars = document.querySelectorAll('.hop-star');
    const ratingInput = document.getElementById('hopping-rating');
    const ratingDesc = document.getElementById('rating-desc');
    const submitBtn = document.getElementById('submit-hopping-btn');

    // Close Modal
    closeBtn.onclick = () => { modal.style.display = 'none'; resetForm(); };
    window.onclick = (e) => { if (e.target == modal) { modal.style.display = 'none'; resetForm(); } };

    // Image & Cropper Logic
    const uploadZone = document.getElementById('upload-zone');
    const placeholder = document.getElementById('upload-placeholder');

    // Click zone triggers input
    uploadZone.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                cropperImage.src = evt.target.result;
                cropperWrapper.style.display = 'block';
                placeholder.style.display = 'none'; // Hide text
                uploadZone.style.border = 'none'; // Remove dashed border

                if (cropper) cropper.destroy();
                cropper = new Cropper(cropperImage, {
                    aspectRatio: 1, // 1080x1080 square
                    viewMode: 1,
                    autoCropArea: 1,
                    dragMode: 'move',
                    guides: false,
                    center: false,
                    background: false
                });
            };
            reader.readAsDataURL(file);
        }
    };

    // Rating Star Logic
    const ratingTexts = {
        1: "POOR",
        2: "FAIR",
        3: "ENJOYABLE",
        4: "REMARKABLE",
        5: "MASTERPIECE"
    };

    stars.forEach(star => {
        star.onclick = () => {
            const val = parseInt(star.getAttribute('data-value'));
            ratingInput.value = val;
            ratingDesc.textContent = ratingTexts[val];
            updateStars(val);
        };
    });

    function updateStars(val) {
        stars.forEach(s => {
            const v = parseInt(s.getAttribute('data-value'));
            s.textContent = v <= val ? '★' : '☆';
            s.style.color = v <= val ? '#ffd700' : '#ccc'; // Gold vs Gray
        });
    }

    // Submit Logic
    submitBtn.onclick = async () => {
        if (!window.currentUser) { alert('Please login first!'); return; }
        if (!cropper) { alert('Please upload and crop an image.'); return; }
        if (ratingInput.value == 0) { alert('Please select a rating.'); return; }

        submitBtn.textContent = 'Uploading...';
        submitBtn.disabled = true;

        try {
            // 1. Get Crop Blob
            cropper.getCroppedCanvas({ width: 1080, height: 1080 }).toBlob(async (blob) => {
                if (!blob) throw new Error('Image crop failed');

                // 2. Upload to Supabase Storage
                const fileName = `${window.currentUser.id}_${Date.now()}.jpg`;
                const { data: uploadData, error: uploadError } = await window.supabaseClient
                    .storage
                    .from('hoppings')
                    .upload(fileName, blob);

                if (uploadError) throw uploadError;

                const publicUrl = window.supabaseClient.storage.from('hoppings').getPublicUrl(fileName).data.publicUrl;

                // 3. Insert Record
                const record = {
                    user_id: window.currentUser.id,
                    bar_id: document.getElementById('hopping-bar-id').value,
                    image_url: publicUrl,
                    rating: parseInt(ratingInput.value),
                    description: document.getElementById('hopping-desc').value,
                    is_public: document.getElementById('hopping-public').checked,
                    hopped_at: `${document.getElementById('hopping-date').value}T${document.getElementById('hopping-time').value}:00`
                };

                const { error: insertError } = await window.supabaseClient
                    .from('hoppings')
                    .insert([record]);

                if (insertError) throw insertError;

                alert('Hopping Check-In Successful! / 打卡成功！');
                modal.style.display = 'none';
                resetForm();
                location.reload(); // Simple reload to refresh UI

            }, 'image/jpeg', 0.8);
        } catch (err) {
            console.error(err);
            alert('Error / 錯誤: ' + err.message);
            submitBtn.textContent = 'Check In';
            submitBtn.disabled = false;
        }
    };
}

function resetForm() {
    if (cropper) { cropper.destroy(); cropper = null; }
    document.getElementById('cropper-wrapper').style.display = 'none';
    document.getElementById('upload-placeholder').style.display = 'block';
    document.getElementById('upload-zone').style.border = '2px dashed #ccc';
    document.getElementById('hopping-file-input').value = '';
    document.getElementById('hopping-desc').value = '';
    document.getElementById('hopping-rating').value = 0;
    document.querySelectorAll('.hop-star').forEach(s => { s.textContent = '☆'; s.style.color = '#ccc'; });
    document.getElementById('rating-desc').textContent = 'Select a rating';
    document.getElementById('submit-hopping-btn').textContent = 'Check In';
    document.getElementById('submit-hopping-btn').disabled = false;
}

// Global API
window.openHoppingModal = (barId) => {
    if (!window.currentUser) {
        alert('Please login to Hop!');
        return;
    }
    const modal = document.getElementById('hopping-modal');
    document.getElementById('hopping-bar-id').value = barId;

    // Set Default Date/Time
    const now = new Date();
    document.getElementById('hopping-date').value = now.toISOString().split('T')[0];
    // Format Time HH:MM
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('hopping-time').value = `${hh}:${mm}`;

    modal.style.display = 'flex';
};

// Helper: Fetch recent hoppings for a bar (Max 3)
window.fetchRecentHoppings = async (barId) => {
    const { data } = await window.supabaseClient
        .from('hoppings')
        .select('*')
        .eq('bar_id', barId)
        .eq('is_public', true)
        .order('hopped_at', { ascending: false })
        .limit(3);
    return data;
};

// Render Badge Row (Called from app.js)
window.renderHoppingBadge = async (barId) => {
    const data = await window.fetchRecentHoppings(barId);
    if (!data || data.length === 0) return;

    const container = document.getElementById(`hop-badge-${barId}`);
    if (!container) return;

    // Render badges
    container.innerHTML = data.map(hop => `
        <img src="${hop.image_url}" 
             class="hopping-badge-mini" 
             title="${new Date(hop.hopped_at).toLocaleDateString()}"
             onclick="event.preventDefault(); event.stopPropagation(); window.showHoppingDetails(event, '${hop.image_url}', '${hop.hopped_at}', '${hop.rating}', '${hop.description}')">
    `).join('');
};

// Show Details Modal
window.showHoppingDetails = (e, img, date, rating, desc) => {
    e.stopPropagation();

    // Create Modal if not exists (Lazy Load)
    if (!document.getElementById('hopping-details-modal')) {
        const html = `
        <div id="hopping-details-modal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 10000; align-items: center; justify-content: center;">
            <div style="position: relative; max-width: 90%; max-height: 90vh;">
                <button onclick="document.getElementById('hopping-details-modal').style.display='none'" style="position: absolute; top: -40px; right: 0; color: white; background: none; border: none; font-size: 2rem; cursor: pointer;">&times;</button>
                <img id="hd-img" src="" style="max-width: 100%; max-height: 80vh; border-radius: 8px; border: 2px solid white;">
                <div style="background: white; padding: 15px; border-radius: 8px; margin-top: 10px; text-align: center;">
                    <div id="hd-meta" style="color: #666; font-size: 0.9rem; margin-bottom: 5px;"></div>
                    <div id="hd-rating" style="color: #FFD700; font-size: 1.2rem; margin-bottom: 5px;"></div>
                    <div id="hd-desc" style="color: #333; font-size: 1rem;"></div>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        // Close on BG click
        document.getElementById('hopping-details-modal').onclick = (e) => {
            if (e.target.id === 'hopping-details-modal') e.target.style.display = 'none';
        };
    }

    const modal = document.getElementById('hopping-details-modal');
    document.getElementById('hd-img').src = img;
    document.getElementById('hd-meta').textContent = `Hopped on ${new Date(date).toLocaleString()}`;
    document.getElementById('hd-rating').textContent = '★'.repeat(parseInt(rating)) + '☆'.repeat(5 - parseInt(rating));
    document.getElementById('hd-desc').textContent = desc === 'null' || desc === 'undefined' ? '' : desc;

    modal.style.display = 'flex';
};
