// Hopping Feature Logic

// 1. Inject Modal HTML on Load (Redesigned)
document.addEventListener('DOMContentLoaded', () => {
    const modalHTML = `
    <div id="hopping-modal" class="hopping-modal-overlay">
        <div class="hopping-modal-card">
            <button id="close-hopping-btn" class="btn-close-minimal">&times;</button>
            <h2 class="hopping-title" style="font-size: 1.5rem; margin-bottom: 0.5rem;">HOP IN !</h2>
            
            <input type="hidden" id="hopping-bar-id">

            <!-- 1. Image Upload (Square) -->
            <div style="margin-bottom: 0.2rem;">
                <!-- Label removed -->
                <input type="file" id="hopping-file-input" accept="image/*" style="display: none;">
                
                <div id="upload-zone" class="upload-zone-stylish" style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 0.5rem;">
                    <span id="upload-placeholder" class="upload-placeholder-text" style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                        <!-- Camera Icon -->
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                        <span>SNAP & HOP</span>
                    </span>
                    <div id="cropper-wrapper" style="width: 100%; height: 100%; display: none;">
                        <img id="cropper-image" src="" style="max-width: 100%;">
                    </div>
                </div>
            </div>

            <!-- 2. Rating -->
            <!-- 2. Rating -->
            <div style="margin-bottom: 0.2rem; text-align: center;">
                <!-- Label removed -->
                <div class="star-rating" style="display: flex; gap: 8px; justify-content: center; margin-bottom: 0.2rem;">
                    <span data-value="1" class="hop-star">☆</span>
                    <span data-value="2" class="hop-star">☆</span>
                    <span data-value="3" class="hop-star">☆</span>
                    <span data-value="4" class="hop-star">☆</span>
                    <span data-value="5" class="hop-star">☆</span>
                </div>
                <p id="rating-desc" style="font-size: 0.85rem; color: var(--bg-red); min-height: 20px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; margin: 0;">SELECT RATING</p>
                <input type="hidden" id="hopping-rating" value="0">
            </div>

            <!-- 3. Description -->
            <div style="margin-bottom: 0.2rem;">
                <textarea id="hopping-desc" class="hopping-input-minimal" maxlength="150" placeholder="Describe the vibe (optional)..." style="height: auto; min-height: 40px; resize: none; overflow-y: hidden; margin-bottom: 0;"></textarea>
            </div>

            <!-- 4. Date & Time (Row) -->
            <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                <div style="flex: 1;">
                    <input type="date" id="hopping-date" class="hopping-input-minimal" style="margin-bottom: 0; text-align: center;">
                </div>
                <div style="flex: 1;">
                    <input type="time" id="hopping-time" class="hopping-input-minimal" style="margin-bottom: 0; text-align: center;">
                </div>
            </div>

            <!-- Submit Button with Cocktail Icon -->
            <button id="submit-hopping-btn" class="btn-hop-submit" style="background-color: var(--bg-red); color: white; display: flex; align-items: center; justify-content: center; gap: 10px; transition: background-color 0.3s, color 0.3s;">
                 <!-- Cocktail Icon (Martini Glass) -->
                 <svg class="hop-submit-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 22h8"></path>
                    <path d="M12 15v7"></path>
                    <path d="M2 3h20L12 15z"></path>
                    <!-- Liquid Path for Fill Animation -->
                    <path class="cocktail-liquid" d="M4.5 5.5h15l-3.5 4.5h-8z" fill="currentColor" style="transform-origin: bottom; transform: scaleY(0); transition: transform 0.5s; opacity: 0;"></path>
                 </svg>
                 <span class="btn-text">HOP !</span>
            </button>

            <!-- 5. Public Toggle (Moved Below) -->
            <div style="margin-top: 0.5rem; display: flex; align-items: center; justify-content: center;">
                 <label style="display: flex; align-items: center; cursor: pointer; gap: 8px;">
                    <input type="checkbox" id="hopping-public" checked style="accent-color: var(--bg-red); width: 16px; height: 16px;">
                    <span style="font-size: 0.85rem; color: #888; letter-spacing: 0.05em; font-weight: 500;">Public</span>
                 </label>
            </div>
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
        if (!window.currentUser) { alert('Please login to Hop!'); return; }
        if (!cropper) { alert('Please snap a photo!'); return; } // Changed from !cropper to !cropper && !fileInput.files[0]

        // Start Animation
        submitBtn.style.backgroundColor = '#eab308'; // Yellow
        submitBtn.style.color = '#fff';
        submitBtn.classList.add('pouring'); // Triggers CSS animation if added

        // Show Liquid
        const liquid = submitBtn.querySelector('.cocktail-liquid');
        if (liquid) {
            liquid.style.opacity = '1';
            liquid.style.transform = 'scaleY(1)';
        }

        submitBtn.disabled = true;
        const btnTextSpan = submitBtn.querySelector('.btn-text');
        const origText = btnTextSpan.textContent;
        btnTextSpan.textContent = "POURING...";

        try {
            // 1. Get Crop Blob
            cropper.getCroppedCanvas({ width: 1080, height: 1080 }).toBlob(async (blob) => {
                if (!blob) {
                    alert('Error: Image crop failed.');
                    // Reset button state on error
                    submitBtn.style.backgroundColor = ''; // Revert to class default (Red)
                    submitBtn.classList.remove('pouring');
                    if (liquid) { liquid.style.opacity = '0'; liquid.style.transform = 'scaleY(0)'; }
                    submitBtn.disabled = false;
                    btnTextSpan.textContent = origText;
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
                    // Wait a moment for effect
                    setTimeout(() => {
                        modal.style.display = 'none';
                        resetForm();
                        // Reset Button
                        submitBtn.style.backgroundColor = ''; // Revert to class default (Red)
                        submitBtn.classList.remove('pouring');
                        if (liquid) { liquid.style.opacity = '0'; liquid.style.transform = 'scaleY(0)'; }
                        submitBtn.disabled = false;
                        btnTextSpan.textContent = origText;
                        location.reload(); // Reload after successful submission and animation
                    }, 1000);

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
            // Restore Original State on Error
            submitBtn.innerHTML = `
                <svg class="hop-submit-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 22h8"></path>
                    <path d="M12 15v7"></path>
                    <path d="M2 3h20L12 15z"></path>
                    <path class="cocktail-liquid" d="M4.5 5.5h15l-3.5 4.5h-8z" fill="currentColor" style="transform-origin: bottom; transform: scaleY(0); transition: transform 0.5s; opacity: 0;"></path>
                </svg>
                <span class="btn-text">HOP !</span>
            `;
            submitBtn.style.backgroundColor = 'var(--bg-red)';
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

    // Restore Button with Icon
    document.getElementById('submit-hopping-btn').innerHTML = `
        <svg class="hop-submit-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 22h8"></path>
            <path d="M12 15v7"></path>
            <path d="M2 3h20L12 15z"></path>
            <path class="cocktail-liquid" d="M4.5 5.5h15l-3.5 4.5h-8z" fill="currentColor" style="transform-origin: bottom; transform: scaleY(0); transition: transform 0.5s; opacity: 0;"></path>
        </svg>
        <span class="btn-text">HOP !</span>
    `;
    document.getElementById('submit-hopping-btn').style.backgroundColor = 'var(--bg-red)'; // Reset valid color
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
        .limit(5);
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

// Open Gallery
window.openHoppingGallery = (event, startHopId, barId) => {
    if (event) { event.preventDefault(); event.stopPropagation(); }

    const hops = window.barHoppingsCache[barId];
    if (!hops || hops.length === 0) return;

    let currentIndex = hops.findIndex(h => h.id == startHopId); // Use loose equality for String vs Number
    if (currentIndex === -1) currentIndex = 0;

    // Helper to render current index
    const renderCurrent = () => {
        const hop = hops[currentIndex];
        window.showHoppingDetails(null, hop.image_url, hop.hopped_at, hop.rating, hop.description, hop.id, hop.user_id, true); // true = internal call
        updateNavigationUI();
    };

    // Helper to update arrows
    const updateNavigationUI = () => {
        const modal = document.getElementById('hopping-details-modal');
        if (!modal) return;

        let prevBtn = document.getElementById('hd-prev-btn');
        let nextBtn = document.getElementById('hd-next-btn');

        // Create arrows if missing
        if (!prevBtn) {
            const wrapper = modal.querySelector('.hop-detail-image-wrapper');

            // Updated Style: Transparent BG, Red Color
            const arrowStyle = 'position: absolute; top: 50%; transform: translateY(-50%); background: transparent; color: #ef4444; border: none; padding: 20px; cursor: pointer; font-size: 2.5rem; z-index: 50; transition: transform 0.2s; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));';

            prevBtn = document.createElement('button');
            prevBtn.id = 'hd-prev-btn';
            prevBtn.innerHTML = '&#10094;';
            prevBtn.style.cssText = arrowStyle + 'left: 0;';
            wrapper.appendChild(prevBtn);

            nextBtn = document.createElement('button');
            nextBtn.id = 'hd-next-btn';
            nextBtn.innerHTML = '&#10095;';
            nextBtn.style.cssText = arrowStyle + 'right: 0;';
            wrapper.appendChild(nextBtn);
        }

        // Logic
        prevBtn.style.display = hops.length > 1 ? 'block' : 'none';
        nextBtn.style.display = hops.length > 1 ? 'block' : 'none';

        prevBtn.onclick = (e) => {
            e.stopPropagation();
            currentIndex = (currentIndex - 1 + hops.length) % hops.length;
            renderCurrent();
        };

        nextBtn.onclick = (e) => {
            e.stopPropagation();
            currentIndex = (currentIndex + 1) % hops.length;
            renderCurrent();
        };

        // Swipe Logic (Touch) - Full Screen (Modal Level)
        // We attach to the modal container to cover "everything between top/bottom bars"
        // But we must be careful not to block clicks on close buttons or content.

        // Reset listeners (Overwrite properties)
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;

        modal.ontouchstart = (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        };

        modal.ontouchmove = (e) => {
            const x = e.touches[0].clientX;
            const y = e.touches[0].clientY;
            const xDiff = Math.abs(x - touchStartX);
            const yDiff = Math.abs(y - touchStartY);

            // If moving horizontally significantly more than vertically, treat as swipe
            if (xDiff > yDiff && xDiff > 10) {
                if (e.cancelable) e.preventDefault(); // Lock Scroll
            }
        };

        modal.ontouchend = (e) => {
            touchEndX = e.changedTouches[0].clientX;
            const xDiff = touchEndX - touchStartX;

            // Threshold 50px
            if (Math.abs(xDiff) > 50) {
                if (xDiff < 0) { // Swipe Left -> Next
                    currentIndex = (currentIndex + 1) % hops.length;
                } else { // Swipe Right -> Prev
                    currentIndex = (currentIndex - 1 + hops.length) % hops.length;
                }
                renderCurrent();
            }
        };
    };

    renderCurrent();
    // Open Generic Gallery (From any cache source)
    window.openGenericHoppingGallery = (event, startHopId, cacheKey) => {
        if (event) { event.preventDefault(); event.stopPropagation(); }

        const hops = window[cacheKey]; // Access Global Cache dynamically
        if (!hops || hops.length === 0) return;

        let currentIndex = hops.findIndex(h => h.id == startHopId);
        if (currentIndex === -1) currentIndex = 0;

        const renderCurrent = () => {
            const hop = hops[currentIndex];
            // Pass bar info if available in the hop object
            window.showHoppingDetails(null, hop.image_url, hop.hopped_at, hop.rating, hop.description, hop.id, hop.user_id, true, hop.bar_title, hop.bar_id);
            updateGenericNavigationUI();
        };

        const updateGenericNavigationUI = () => {
            const modal = document.getElementById('hopping-details-modal');
            if (!modal) return;

            let prevBtn = document.getElementById('hd-prev-btn');
            let nextBtn = document.getElementById('hd-next-btn');

            // Reuse existing arrow creation logic or ensure they exist
            // (Assuming standard arrow creation is handled inside showHoppingDetails if missing, OR we can copy the logic here)
            // Ideally, showHoppingDetails creates the modal structure, but arrows are added dynamically.
            // Let's ensure they exist here for robustness.

            const wrapper = modal.querySelector('.hop-detail-image-wrapper');
            const arrowStyle = 'position: absolute; top: 50%; transform: translateY(-50%); background: transparent; color: #ef4444; border: none; padding: 20px; cursor: pointer; font-size: 2.5rem; z-index: 50; transition: transform 0.2s; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));';

            if (!prevBtn) {
                prevBtn = document.createElement('button');
                prevBtn.id = 'hd-prev-btn';
                prevBtn.innerHTML = '&#10094;';
                prevBtn.style.cssText = arrowStyle + 'left: 0;';
                wrapper.appendChild(prevBtn);
            }
            if (!nextBtn) {
                nextBtn = document.createElement('button');
                nextBtn.id = 'hd-next-btn';
                nextBtn.innerHTML = '&#10095;';
                nextBtn.style.cssText = arrowStyle + 'right: 0;';
                wrapper.appendChild(nextBtn);
            }

            prevBtn.style.display = hops.length > 1 ? 'block' : 'none';
            nextBtn.style.display = hops.length > 1 ? 'block' : 'none';

            // Rebind events (Generic)
            prevBtn.onclick = (e) => { e.stopPropagation(); currentIndex = (currentIndex - 1 + hops.length) % hops.length; renderCurrent(); };
            nextBtn.onclick = (e) => { e.stopPropagation(); currentIndex = (currentIndex + 1) % hops.length; renderCurrent(); };

            // Touch Swipe Reuse (Simplified)
            let touchStartX = 0;
            modal.ontouchstart = (e) => { touchStartX = e.touches[0].clientX; };
            modal.ontouchend = (e) => {
                if (Math.abs(e.changedTouches[0].clientX - touchStartX) > 50) {
                    if (e.changedTouches[0].clientX < touchStartX) { currentIndex = (currentIndex + 1) % hops.length; } // Next
                    else { currentIndex = (currentIndex - 1 + hops.length) % hops.length; } // Prev
                    renderCurrent();
                }
            };
        };

        renderCurrent();
    };


    // Show Details Modal (Modified for HopCard + Delete)
    window.showHoppingDetails = async (event, img, date, rating, desc, hopId = null, ownerId = null, internal = false, barName = null, barId = null) => {
        if (event) { event.preventDefault(); event.stopPropagation(); }

        // Lock Body Scroll
        document.body.style.overflow = 'hidden';

        // Create Modal if not exists (Lazy Load)
        if (!document.getElementById('hopping-details-modal')) {
            const html = `
        <div id="hopping-details-modal" class="hopping-modal-overlay" style="z-index: 9999;">
            <div class="hop-detail-card" onclick="event.stopPropagation()">
                <div class="hop-detail-image-wrapper">
                    <button onclick="window.closeHoppingDetails()" class="btn-close-detail" style="z-index: 60;">&times;</button>
                    <img id="hd-img" class="hop-detail-image" src="">
                    <!-- Hopping Label -->
                    <div style="position: absolute; top: 15px; left: 15px; background: rgba(0,0,0,0.6); color: white; padding: 2px 8px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">
                        HOPPING
                    </div>
                    
                    <!-- Hopper Profile Injection Point -->
                    <div id="hd-hopper-profile" class="hopper-profile-container" style="display: none;">
                        <img id="hd-hopper-avatar" class="hopper-avatar" src="" alt="Hopper">
                        <span id="hd-hopper-name" class="hopper-name"></span>
                        <span id="hd-hopper-role" class="hopper-role"></span>
                    </div>

                    <!-- Delete Button Injection Point -->
                    <button id="hd-delete-btn" class="btn-close-detail" style="right: auto; left: 15px; top: auto; bottom: 15px; background: rgba(220, 38, 38, 0.8); display: none; z-index: 60;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                    
                    <!-- Bar Name Link (New) -->
                    <a id="hd-bar-link" href="#" class="hd-bar-pill" style="position: absolute; bottom: 15px; right: 15px; background: rgba(0,0,0,0.7); color: white; padding: 4px 12px; border-radius: 20px; text-decoration: none; font-size: 0.8rem; font-weight: 500; display: none; z-index: 55; align-items: center; gap: 4px;">
                        <span>📍</span> <span id="hd-bar-name"></span>
                    </a>

                </div>
                <div class="hop-detail-content">
                    <div id="hd-rating" class="hop-detail-stars"></div>
                    <span id="hd-date" class="hop-detail-date"></span>
                    <div id="hd-desc" class="hop-detail-desc"></div>
                </div>
            </div>
        </div>
        `;
            document.body.insertAdjacentHTML('beforeend', html);

            // Close on BG click
            const modalEl = document.getElementById('hopping-details-modal');
            modalEl.onclick = (e) => {
                if (e.target.id === 'hopping-details-modal') window.closeHoppingDetails();
            };
        }

        // Define Close Function Globally within scope or attached to window
        window.closeHoppingDetails = () => {
            const m = document.getElementById('hopping-details-modal');
            if (m) m.style.display = 'none';
            document.body.style.overflow = ''; // Unlock Scroll
        };

        const modal = document.getElementById('hopping-details-modal');
        document.getElementById('hd-img').src = img;

        // Reset arrows if not internal (single view)
        if (!internal) {
            const prev = document.getElementById('hd-prev-btn');
            const next = document.getElementById('hd-next-btn');
            if (prev) prev.style.display = 'none';
            if (next) next.style.display = 'none';
            modal.ontouchstart = null;
            modal.ontouchmove = null;
            modal.ontouchend = null;
        }

        // Set Bar Link
        const barLink = document.getElementById('hd-bar-link');
        const barNameEl = document.getElementById('hd-bar-name');
        if (barName && barId) {
            barNameEl.textContent = barName;
            barLink.href = `bar-details.html?id=${barId}`;
            barLink.style.display = 'flex';
        } else {
            barLink.style.display = 'none';
        }

        // Format Date: "OCT 24, 2023"
        const dateObj = new Date(date);
        const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeString = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('hd-date').textContent = `${dateString} • ${timeString}`;

        document.getElementById('hd-rating').textContent = '★'.repeat(parseInt(rating)) + '☆'.repeat(5 - parseInt(rating));
        document.getElementById('hd-desc').textContent = (!desc || desc === 'null' || desc === 'undefined') ? '' : desc;

        // Fetch and Display Hopper Profile
        const profileContainer = document.getElementById('hd-hopper-profile');
        const avatarEl = document.getElementById('hd-hopper-avatar');
        const nameEl = document.getElementById('hd-hopper-name');
        const roleEl = document.getElementById('hd-hopper-role');

        // Hide initially
        profileContainer.style.display = 'none';

        // Interaction Buttons Container Injection
        // Check if it exists from previous calls to avoid duplicates if we don't clear innerHTML
        // Note: We are replacing 'hopping-details-modal' inner content fully on lazy load, but reusing if exists.
        // However, the buttons need to be inside specific containers or appended.
        // Let's check if .hop-interactions exists in profileContainer or append it.

        // Actually, simpler to ensure we have the container in the generic HTML template, 
        // BUT since I am editing the template string in a separate chunk (or previous step),
        // and this function runs EVERY time, I should dynamically add/update it here or modify the initial template creation.
        // I will modify the initial template creation block via a separate tool call if needed, 
        // BUT since I am in `showHoppingDetails`, I can check `hd-interactions` existence.

        let interactionContainer = document.getElementById('hd-interactions');
        if (!interactionContainer) {
            interactionContainer = document.createElement('div');
            interactionContainer.id = 'hd-interactions';
            interactionContainer.className = 'hop-interactions';
            // Append to profile container so it sits below name
            profileContainer.appendChild(interactionContainer);
        }
        // Reset Buttons
        interactionContainer.innerHTML = `
        <button id="btn-cheers" class="btn-interaction">
            <svg class="interaction-icon cheers-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <!-- Cocktail Glass Outline -->
                <path d="M8 22h8" class="glass-base"/>
                <path d="M12 11v11" class="glass-stem"/>
                <path d="M5 4h14l-7 7-7-7z" class="glass-bowl-outline"/>
                <!-- Liquid (Triangle shape inside) -->
                <path d="M6 5h12l-6 6-6-6z" class="cheers-liquid" fill="currentColor" stroke="none" />
            </svg>
            <span id="cheers-count">0</span>
        </button>
        <button id="btn-message" class="btn-interaction">
            <svg class="interaction-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        </button>
    `;

        if (ownerId) {
            try {
                const { data: userData, error } = await window.supabaseClient
                    .from('users')
                    .select('name, hopper_nickname, hopper_image_url, roles')
                    .eq('id', ownerId)
                    .single();

                if (userData && !error) {
                    // Determine Name: Hopper Nickname > Name > Anonymous
                    const displayName = userData.hopper_nickname || userData.name || 'Anonymous Hopper';
                    // Determine Avatar: Hopper Image > Default Placeholder
                    const displayAvatar = userData.hopper_image_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(displayName) + '&background=random';

                    nameEl.textContent = displayName;
                    avatarEl.src = displayAvatar;

                    // Determine Role Label
                    let roleLabel = 'Hopper'; // Default
                    if (userData.roles && Array.isArray(userData.roles)) {
                        if (userData.roles.includes('admin')) roleLabel = 'Admin';
                        else if (userData.roles.includes('editor')) roleLabel = 'Editor';
                        else if (userData.roles.includes('talent')) roleLabel = 'Talent';
                        else if (userData.roles.includes('kol')) roleLabel = 'Hoppest';
                        else if (userData.roles.includes('member')) roleLabel = 'Hopper';
                    }

                    if (roleEl) roleEl.textContent = roleLabel;

                    profileContainer.style.display = 'flex'; // Show container
                }
            } catch (err) {
                console.warn('Error fetching hopper profile:', err);
            }
        }

        // Cheers Logic
        const cheersBtn = document.getElementById('btn-cheers');
        const cheersCountEl = document.getElementById('cheers-count');
        const msgBtn = document.getElementById('btn-message');

        if (hopId) {
            // Fetch Cheers Count
            const { count, error: countErr } = await window.supabaseClient
                .from('hopping_cheers')
                .select('*', { count: 'exact', head: true })
                .eq('hopping_id', hopId);

            if (!countErr) cheersCountEl.textContent = count;

            // Check if I cheered
            if (window.currentUser) {
                const { data: myCheer } = await window.supabaseClient
                    .from('hopping_cheers')
                    .select('id')
                    .eq('hopping_id', hopId)
                    .eq('user_id', window.currentUser.id)
                    .single();

                if (myCheer) {
                    cheersBtn.classList.add('active');
                }

                // Click Handler
                cheersBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if (!window.currentUser) { alert('Please login to Cheers!'); return; }

                    // Toggle
                    const isActive = cheersBtn.classList.contains('active');
                    if (isActive) {
                        // Already Cheered - Do Nothing/Alert
                        // alert('You have already cheered!');
                        return;
                    } else {
                        // Add Cheer
                        // Simply adding 'active' class triggers the CSS fill animation
                        const { error } = await window.supabaseClient
                            .from('hopping_cheers')
                            .insert([{ hopping_id: hopId, user_id: window.currentUser.id }]);

                        if (!error) {
                            cheersBtn.classList.add('active');
                            cheersCountEl.textContent = parseInt(cheersCountEl.textContent) + 1;
                        }
                    }
                };
            }
        }

        // Message Logic
        msgBtn.onclick = (e) => {
            e.stopPropagation();
            alert('Messaging feature coming soon! / 訊息功能即將推出！');
        };

        // Delete Button Logic
        const deleteBtn = document.getElementById('hd-delete-btn');
        if (hopId && window.currentUser) {
            let canDelete = window.currentUser.id === ownerId;

            // Check if Admin (Async check)
            if (!canDelete) {
                try {
                    const { data: dbUser } = await window.supabaseClient.from('users').select('roles').eq('id', window.currentUser.id).single();
                    if (dbUser && dbUser.roles && dbUser.roles.includes('admin')) canDelete = true;
                } catch (e) {
                    console.warn('Admin check failed:', e);
                }
            }

            if (canDelete) {
                deleteBtn.style.display = 'flex';
                deleteBtn.onclick = () => window.deleteHopping(hopId);
            } else {
                deleteBtn.style.display = 'none';
            }
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
