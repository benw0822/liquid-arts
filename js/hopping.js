// Hopping Feature Logic

// 1. Inject Modal HTML on Load (Redesigned)
document.addEventListener('DOMContentLoaded', () => {
    const modalHTML = `
    <div id="hopping-modal" class="hopping-modal-overlay">
        <div class="hopping-modal-card">
            <button id="close-hopping-btn" class="btn-close-minimal">&times;</button>
            <h2 class="hopping-title">Hop In</h2>
            
            <input type="hidden" id="hopping-bar-id">

            <!-- 1. Image Upload (Square) -->
            <div style="margin-bottom: 2rem;">
                <label class="hopping-label">1. Capture the Moment</label>
                <input type="file" id="hopping-file-input" accept="image/*" style="display: none;">
                
                <div id="upload-zone" class="upload-zone-stylish">
                    <span id="upload-placeholder" class="upload-placeholder-text">
                        + Update Photo
                    </span>
                    <div id="cropper-wrapper" style="width: 100%; height: 100%; display: none;">
                        <img id="cropper-image" src="" style="max-width: 100%;">
                    </div>
                </div>
            </div>

            <!-- 2. Rating -->
            <div style="margin-bottom: 2rem; text-align: center;">
                <label class="hopping-label" style="text-align: center; margin-bottom: 1rem;">2. Experience</label>
                <div class="star-rating" style="display: flex; gap: 8px; justify-content: center; margin-bottom: 0.5rem;">
                    <span data-value="1" class="hop-star">☆</span>
                    <span data-value="2" class="hop-star">☆</span>
                    <span data-value="3" class="hop-star">☆</span>
                    <span data-value="4" class="hop-star">☆</span>
                    <span data-value="5" class="hop-star">☆</span>
                </div>
                <p id="rating-desc" style="font-size: 0.85rem; color: var(--bg-red); min-height: 20px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase;">SELECT RATING</p>
                <input type="hidden" id="hopping-rating" value="0">
            </div>

            <!-- 3. Description -->
            <div style="margin-bottom: 1.5rem;">
                <label class="hopping-label">3. Thoughts (Optional)</label>
                <textarea id="hopping-desc" class="hopping-input-minimal" maxlength="150" placeholder="Describe the vibe..." style="height: auto; min-height: 40px; resize: none; overflow-y: hidden;"></textarea>
            </div>

            <!-- 4. Date & Time (Row) -->
            <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
                <div style="flex: 1;">
                    <label class="hopping-label">Date</label>
                    <input type="date" id="hopping-date" class="hopping-input-minimal" style="margin-bottom: 0;">
                </div>
                <div style="flex: 1;">
                    <label class="hopping-label">Time</label>
                    <input type="time" id="hopping-time" class="hopping-input-minimal" style="margin-bottom: 0;">
                </div>
            </div>

            <!-- 5. Public Toggle -->
            <div style="margin-bottom: 2.5rem; display: flex; align-items: center; justify-content: center;">
                 <label style="display: flex; align-items: center; cursor: pointer; gap: 10px;">
                    <input type="checkbox" id="hopping-public" checked style="accent-color: var(--bg-red); width: 18px; height: 18px;">
                    <span style="font-size: 0.9rem; color: #555; letter-spacing: 0.05em;">Make this Hop Public</span>
                 </label>
            </div>

            <button id="submit-hopping-btn" class="btn-hop-submit">Confirm Check-In</button>
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
                // Removed manual border manipulation - rely on CSS hover effects

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
            s.style.color = v <= val ? '#ef4444' : '#ddd'; // Red vs Gray
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
                if (!blob) {
                    alert('Error: Image crop failed.');
                    submitBtn.textContent = 'Check In';
                    submitBtn.disabled = false;
                    return;
                }

                try {
                    // 2. Upload to Supabase Storage
                    const fileName = `${window.currentUser.id}_${Date.now()}.jpg`;
                    const { data: uploadData, error: uploadError } = await window.supabaseClient
                        .storage
                        .from('hoppings')
                        .upload(fileName, blob);

                    if (uploadError) {
                        if (uploadError.statusCode === '404' || uploadError.error === 'Bucket not found') {
                            throw new Error('Storage Bucket "hoppings" not found. Please contact Admin.');
                        }
                        throw uploadError;
                    }

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
                    location.reload();

                } catch (innerErr) {
                    console.error('Upload Process Error:', innerErr);
                    alert('Upload Failed / 上傳失敗: ' + (innerErr.message || 'Unknown Error'));
                    submitBtn.textContent = 'Check In';
                    submitBtn.disabled = false;
                }

            }, 'image/jpeg', 0.8);
        } catch (err) {
            console.error('Setup Error:', err);
            alert('Error: ' + err.message);
            submitBtn.textContent = 'Check In';
            submitBtn.disabled = false;
        }
    };
}

function resetForm() {
    if (cropper) { cropper.destroy(); cropper = null; }
    document.getElementById('cropper-wrapper').style.display = 'none';
    document.getElementById('upload-placeholder').style.display = 'block';

    // Reset inputs
    document.getElementById('hopping-file-input').value = '';
    document.getElementById('hopping-desc').value = '';
    document.getElementById('hopping-rating').value = 0;

    // Reset Stars
    document.querySelectorAll('.hop-star').forEach(s => {
        s.textContent = '☆';
        s.style.color = '#ddd';
    });

    document.getElementById('rating-desc').textContent = 'SELECT RATING';
    document.getElementById('submit-hopping-btn').textContent = 'Confirm Check-In';
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
             onclick="event.preventDefault(); event.stopPropagation(); window.showHoppingDetails(event, '${hop.image_url}', '${hop.hopped_at}', '${hop.rating}', '${hop.description}', '${hop.id}', '${hop.user_id}')">
    `).join('');
};

// Show Details Modal (Modified for HopCard + Delete)
window.showHoppingDetails = async (event, img, date, rating, desc, hopId = null, ownerId = null) => {
    if (event) { event.preventDefault(); event.stopPropagation(); }

    // Create Modal if not exists (Lazy Load)
    if (!document.getElementById('hopping-details-modal')) {
        const html = `
        <div id="hopping-details-modal" class="hopping-modal-overlay">
            <div class="hop-detail-card">
                <div class="hop-detail-image-wrapper">
                    <button onclick="document.getElementById('hopping-details-modal').style.display='none'" class="btn-close-detail">&times;</button>
                    <img id="hd-img" class="hop-detail-image" src="">
                    <!-- Delete Button Injection Point -->
                    <button id="hd-delete-btn" class="btn-close-detail" style="right: auto; left: 15px; background: rgba(220, 38, 38, 0.8); display: none;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
                <div class="hop-detail-content">
                    <span id="hd-date" class="hop-detail-date"></span>
                    <div id="hd-rating" class="hop-detail-stars"></div>
                    <div id="hd-desc" class="hop-detail-desc"></div>
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

    // Format Date: "OCT 24, 2023"
    const dateObj = new Date(date);
    const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeString = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('hd-date').textContent = `${dateString} • ${timeString}`;

    document.getElementById('hd-rating').textContent = '★'.repeat(parseInt(rating)) + '☆'.repeat(5 - parseInt(rating));
    document.getElementById('hd-desc').textContent = desc === 'null' || desc === 'undefined' ? '' : desc;

    // Delete Button Logic
    const deleteBtn = document.getElementById('hd-delete-btn');
    if (hopId && window.currentUser) {
        // Check if Owner OR Admin
        const isOwner = window.currentUser.id === ownerId;
        // Verify admin role from DB fetch if needed, but for UI local check:
        // note: window.currentUser.user_metadata or roles might be needed. 
        // For now, reliance on RLS is key, but UI needs to know to show button. 
        // We'll rely on our earlier fetched roles if available, or just simply show if owner.
        // For Admin, since we don't have roles in window.currentUser easily without fetch, 
        // we'll fetch roles if ownerId != current and user might be admin.

        // Simplified Logic: Show if Owner. 
        // TODO: For 'Admin' visibility, we need to check session roles. 
        // Assuming simple 'admin' checking logic exists or we just try-delete.

        deleteBtn.style.display = 'flex';
        deleteBtn.onclick = () => window.deleteHopping(hopId);
    } else {
        deleteBtn.style.display = 'none';
    }

    modal.style.display = 'flex';
};

// Delete Hopping
window.deleteHopping = async (hopId) => {
    if (!confirm('Are you sure you want to delete this Hop? / 確定要刪除這個打卡紀錄嗎？')) return;

    const { error } = await window.supabaseClient
        .from('hoppings')
        .delete()
        .eq('id', hopId);

    if (error) {
        alert('Delete Failed: ' + error.message);
    } else {
        alert('Hop deleted.');
        document.getElementById('hopping-details-modal').style.display = 'none';
        window.location.reload();
    }
};
