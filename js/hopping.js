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

// Global Cache for Hopping Data (per bar)
window.barHoppingsCache = {};

// Render Badge Row (Called from app.js)
window.renderHoppingBadge = async (barId) => {
    const data = await window.fetchRecentHoppings(barId);
    if (!data || data.length === 0) return;

    // Cache data for gallery
    window.barHoppingsCache[barId] = data;

    const container = document.getElementById(`hop-badge-${barId}`);
    if (!container) return;

    // Render badges
    container.innerHTML = data.map(hop => `
        <img src="${hop.image_url}" 
             class="hopping-badge-mini" 
             title="${new Date(hop.hopped_at).toLocaleDateString()}"
             onclick="event.preventDefault(); event.stopPropagation(); window.openHoppingGallery(event, '${hop.id}', '${barId}')">
    `).join('');
};

// Helper to generate Card HTML
const generateCardHtml = (img, date, rating, desc, hopId, ownerId) => {
    // Format Date
    const dateObj = new Date(date);
    const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeString = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const ratingStars = '★'.repeat(parseInt(rating)) + '☆'.repeat(5 - parseInt(rating));
    const description = (!desc || desc === 'null' || desc === 'undefined') ? '' : desc;

    return `
    <div class="hop-detail-card" onclick="event.stopPropagation()">
        <div class="hop-detail-image-wrapper">
            <button onclick="window.closeHoppingDetails()" class="btn-close-detail" style="z-index: 60;">&times;</button>
            <img class="hop-detail-image" src="${img}">
            <div style="position: absolute; top: 15px; left: 15px; background: rgba(0,0,0,0.6); color: white; padding: 2px 8px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">
                HOPPING
            </div>
            <button class="hd-delete-btn-dynamic btn-close-detail" data-hop-id="${hopId}" data-owner-id="${ownerId}" style="right: auto; left: 15px; top: auto; bottom: 15px; background: rgba(220, 38, 38, 0.8); display: none; z-index: 60;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        </div>
        <div class="hop-detail-content">
            <div class="hop-detail-stars">${ratingStars}</div>
            <span class="hop-detail-date">${dateString} • ${timeString}</span>
            <div class="hop-detail-desc">${description}</div>
        </div>
    </div>
    `;
};

// Helper to check delete permission (Async update)
const updateDeleteButton = async (btn) => {
    if (!btn || !window.currentUser) return;
    const hopId = btn.getAttribute('data-hop-id');
    const ownerId = btn.getAttribute('data-owner-id');

    let canDelete = window.currentUser.id === ownerId;
    if (!canDelete) {
        try {
            const { data: dbUser } = await window.supabaseClient.from('users').select('roles').eq('id', window.currentUser.id).single();
            if (dbUser && dbUser.roles && dbUser.roles.includes('admin')) canDelete = true;
        } catch (e) { console.warn('Admin check failed:', e); }
    }

    if (canDelete) {
        btn.style.display = 'flex';
        btn.onclick = (e) => { e.stopPropagation(); window.deleteHopping(hopId); };
    }
};

// Open Gallery
// Open Gallery
window.openHoppingGallery = (event, startHopId, barId) => {
    if (event) { event.preventDefault(); event.stopPropagation(); }

    const hops = window.barHoppingsCache[barId];
    if (!hops || hops.length === 0) return;

    let currentIndex = hops.findIndex(h => h.id === startHopId);
    if (currentIndex === -1) currentIndex = 0;

    // Initial Render
    window.showHoppingDetails(null, hops[currentIndex].image_url, hops[currentIndex].hopped_at, hops[currentIndex].rating, hops[currentIndex].description, hops[currentIndex].id, hops[currentIndex].user_id, true);

    // Transition Helper
    const animateTransition = (direction) => {
        const container = document.querySelector('#hopping-details-modal .hop-slide-container');
        if (!container) return;

        const currentCard = container.querySelector('.hop-detail-card:not(.exiting)');
        if (!currentCard) return;

        // Prepare Next Data
        const hop = hops[currentIndex];
        const newCardHtml = generateCardHtml(hop.image_url, hop.hopped_at, hop.rating, hop.description, hop.id, hop.user_id);

        // Insert New Card
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newCardHtml;
        const newCard = tempDiv.firstElementChild;

        // Setup Animation Classes
        if (direction === 'next') {
            currentCard.classList.add('slide-out-to-left', 'exiting');
            newCard.classList.add('slide-in-from-right');
        } else {
            currentCard.classList.add('slide-out-to-right', 'exiting');
            newCard.classList.add('slide-in-from-left');
        }

        container.appendChild(newCard);

        // Update Delete Button for new card
        updateDeleteButton(newCard.querySelector('.hd-delete-btn-dynamic'));

        // Cleanup
        setTimeout(() => {
            if (currentCard && currentCard.parentElement) currentCard.remove();
            newCard.classList.remove('slide-in-from-right', 'slide-in-from-left');
        }, 350); // Match animation duration
    };

    const updateNavigationUI = () => {
        const modal = document.getElementById('hopping-details-modal');
        if (!modal) return;

        let prevBtn = document.getElementById('hd-prev-btn');
        let nextBtn = document.getElementById('hd-next-btn');

        // Styles
        const arrowStyle = 'position: absolute; top: 50%; transform: translateY(-50%); background: transparent; color: #ef4444; border: none; padding: 20px; cursor: pointer; font-size: 2.5rem; z-index: 50; transition: transform 0.2s; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));';

        if (!prevBtn) {
            // Append arrows to Modal Overlay (outside container to stay fixed)
            prevBtn = document.createElement('button');
            prevBtn.id = 'hd-prev-btn';
            prevBtn.innerHTML = '&#10094;';
            prevBtn.style.cssText = arrowStyle + 'left: 0;';
            modal.appendChild(prevBtn);
        }
        if (!nextBtn) {
            nextBtn = document.createElement('button');
            nextBtn.id = 'hd-next-btn';
            nextBtn.innerHTML = '&#10095;';
            nextBtn.style.cssText = arrowStyle + 'right: 0;';
            modal.appendChild(nextBtn);
        }

        prevBtn.style.display = hops.length > 1 ? 'block' : 'none';
        nextBtn.style.display = hops.length > 1 ? 'block' : 'none';

        // Override clicks to animate
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            currentIndex = (currentIndex - 1 + hops.length) % hops.length;
            animateTransition('prev');
        };

        nextBtn.onclick = (e) => {
            e.stopPropagation();
            currentIndex = (currentIndex + 1) % hops.length;
            animateTransition('next');
        };

        // Swipe (Modal Level)
        let touchStartX = 0;
        // let touchStartY = 0; // Not used for now in simplified logic or derived

        modal.ontouchstart = (e) => {
            touchStartX = e.touches[0].clientX;
            // touchStartY = e.touches[0].clientY;
        };

        modal.ontouchmove = (e) => {
            // simplified scroll locking handled elsewhere or by css?
            // Actually re-adding logic
            const x = e.touches[0].clientX;
            const y = e.touches[0].clientY;
            // if horizontal, prevent
            // For now relying on user's previous satisfaction with scroll lock + sensitivity
            // Re-adding the scroll lock logic for safety
            if (Math.abs(x - touchStartX) > 10) {
                if (e.cancelable && e.cancelable) e.preventDefault();
            }
        };

        modal.ontouchend = (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const xDiff = touchEndX - touchStartX;
            if (Math.abs(xDiff) > 50) {
                if (xDiff < 0) { // Next
                    currentIndex = (currentIndex + 1) % hops.length;
                    animateTransition('next');
                } else { // Prev
                    currentIndex = (currentIndex - 1 + hops.length) % hops.length;
                    animateTransition('prev');
                }
            }
        };
    };

    updateNavigationUI();
};

// Show Details Modal (Modified for HopCard + Delete)
window.showHoppingDetails = async (event, img, date, rating, desc, hopId = null, ownerId = null, internal = false) => {
    if (event) { event.preventDefault(); event.stopPropagation(); }

    document.body.style.overflow = 'hidden';

    // Create Modal Structure if missing
    if (!document.getElementById('hopping-details-modal')) {
        const html = `
        <div id="hopping-details-modal" class="hopping-modal-overlay" style="z-index: 9999;">
            <div class="hop-slide-container">
                 <!-- Cards will be injected here -->
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        const modalEl = document.getElementById('hopping-details-modal');
        modalEl.onclick = (e) => {
            if (e.target.id === 'hopping-details-modal' || e.target.classList.contains('hop-slide-container')) window.closeHoppingDetails();
        };
    }

    // Global Close
    window.closeHoppingDetails = () => {
        const m = document.getElementById('hopping-details-modal');
        if (m) m.style.display = 'none';
        document.body.style.overflow = '';
        // Remove arrows to prevent duplication/mess when reopening
        const p = document.getElementById('hd-prev-btn');
        const n = document.getElementById('hd-next-btn');
        if (p) p.remove();
        if (n) n.remove();
    };

    const container = document.querySelector('#hopping-details-modal .hop-slide-container');

    // Generate Card
    const cardHtml = generateCardHtml(img, date, rating, desc, hopId, ownerId);
    container.innerHTML = cardHtml; // Clear previous and set new

    // Init Delete Button logic for this card
    const btn = container.querySelector('.hd-delete-btn-dynamic');
    updateDeleteButton(btn);

    const modal = document.getElementById('hopping-details-modal');
    modal.style.display = 'flex';

    // Clear listeners if single view
    if (!internal) {
        modal.ontouchstart = null;
        modal.ontouchmove = null;
        modal.ontouchend = null;
    }
};

// Helper: Generate Card HTML
function generateCardHtml(img, date, rating, desc, hopId, ownerId) {
    // Format Date
    const d = new Date(date);
    const dateStr = d.toLocaleDateString();

    // Stars
    const stars = '★'.repeat(parseInt(rating)) + '☆'.repeat(5 - parseInt(rating));

    // Escape description to prevent HTML injection
    const safeDesc = desc ? desc.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : '';

    return `
    <div class="hop-detail-card" style="display: flex; flex-direction: column;">
        <button class="btn-close-detail" onclick="window.closeHoppingDetails()">×</button>
        
        <div class="hop-detail-image-wrapper">
             <img src="${img}" class="hop-detail-image">
        </div>
        
        <div class="hop-detail-content" style="flex: 1; display: flex; flex-direction: column; align-items: center;">
             <span class="hop-detail-date">${dateStr}</span>
             <div class="hop-detail-stars">${stars}</div>
             ${safeDesc ? `<p class="hop-detail-desc">${safeDesc}</p>` : ''}
             
             <!-- Delete Button Placeholder -->
             <button class="hd-delete-btn-dynamic" 
                     data-id="${hopId}" 
                     data-owner-id="${ownerId}"
                     style="display: none; margin-top: auto; background: transparent; border: 1px solid #ef4444; color: #ef4444; padding: 8px 20px; border-radius: 20px; cursor: pointer; font-size: 0.9rem; transition: all 0.3s; align-items: center; gap: 8px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Delete Hop
             </button>
        </div>
    </div>
    `;
}

// Helper: Update Delete Button Visibility
function updateDeleteButton(btn) {
    if (!btn || !window.currentUser) return;

    const ownerId = btn.getAttribute('data-owner-id');
    const hopId = btn.getAttribute('data-id');

    // Check if owner
    const isOwner = window.currentUser.id === ownerId;

    // Note: Admin check happens on backend via RLS.
    // For UI, we show it if user is owner.
    // To support Admin UI delete, we'd need to check roles here too, but for now we prioritize Owner.

    if (isOwner) {
        btn.style.display = 'inline-flex';
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.deleteHopping(hopId);
        };
    } else {
        btn.style.display = 'none';
    }
}

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
