// Owner Portal Logic

// --- Supabase Config ---
const SUPABASE_URL = 'https://wgnskednopbfngvjmviq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Auth State ---
let currentUser = null;
let currentBar = null;

// --- 1. Login Page Logic ---
window.initLogin = () => {
    const loginBtn = document.getElementById('login-btn');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMsg = document.getElementById('error-msg');

    loginBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        errorMsg.style.display = 'none';
        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            // Check Role
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('roles')
                .eq('id', data.user.id)
                .single();

            if (userError || !userData) {
                await supabase.auth.signOut();
                throw new Error('Unauthorized.');
            }

            // Check if Talent OR if they have ANY bar ownership
            const { count, error: countErr } = await supabase
                .from('bar_owners')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', data.user.id);

            const isOwner = count && count > 0;
            const isTalent = userData.roles && userData.roles.includes('talent');

            if (!isTalent && !isOwner) {
                await supabase.auth.signOut();
                throw new Error('Unauthorized: You are not a registered Bar Owner or Talent.');
            }

            window.location.href = 'index.html';

        } catch (err) {
            errorMsg.textContent = err.message;
            errorMsg.style.display = 'block';
            loginBtn.textContent = 'Login';
            loginBtn.disabled = false;
        }
    });
};

// --- 2. Dashboard Logic (and Shared Auth Check) ---
window.initDashboard = async () => {
    await checkAuth();

    const userNameEl = document.getElementById('user-name');
    const barNameEl = document.getElementById('bar-name');
    const barSelector = document.getElementById('bar-selector');
    const actionsEl = document.getElementById('dashboard-actions');
    const noBarMsg = document.getElementById('no-bar-msg');
    const logoutBtn = document.getElementById('logout-btn');

    // Display User Info
    userNameEl.textContent = currentUser.email;

    // Fetch Linked Bars (ALL)
    try {
        // 1. Get Bar IDs from bar_owners
        const { data: ownerships, error: ownErr } = await supabase
            .from('bar_owners')
            .select('bar_id')
            .eq('user_id', currentUser.id);

        let bars = [];
        if (ownerships && ownerships.length > 0) {
            const barIds = ownerships.map(o => o.bar_id);
            const { data: b, error: bErr } = await supabase
                .from('bars')
                .select('*')
                .in('id', barIds);
            if (b) bars = b;
        }

        if (bars && bars.length > 0) {
            actionsEl.style.display = 'grid';

            // Logic for Multiple Bars
            if (bars.length > 1) {
                barSelector.style.display = 'block';

                // Get stored selection or default to first
                let selectedBarId = sessionStorage.getItem('owner_bar_id');
                // Verify stored ID belongs to user
                if (!selectedBarId || !bars.some(b => b.id == selectedBarId)) {
                    selectedBarId = bars[0].id;
                }

                // Populate Selector
                barSelector.innerHTML = bars.map(b =>
                    `<option value="${b.id}">${b.name_en || b.name_zh || b.title}</option>`
                ).join('');

                barSelector.value = selectedBarId;
                selectedBarId = parseInt(selectedBarId); // Ensure type match if needed

                currentBar = bars.find(b => b.id == selectedBarId);
                barNameEl.textContent = currentBar.name_en || currentBar.name_zh || currentBar.title;
                sessionStorage.setItem('owner_bar_id', currentBar.id);

                // Handle Change
                barSelector.addEventListener('change', (e) => {
                    sessionStorage.setItem('owner_bar_id', e.target.value);
                    window.location.reload();
                });

            } else {
                // Single Bar
                currentBar = bars[0];
                barNameEl.textContent = currentBar.name_en || currentBar.name_zh || currentBar.title;
                sessionStorage.setItem('owner_bar_id', currentBar.id);
            }

        } else {
            barNameEl.textContent = 'No Bar Linked';
            noBarMsg.style.display = 'block';
            sessionStorage.removeItem('owner_bar_id');
        }
    } catch (err) {
        console.error('Error fetching bar:', err);
        barNameEl.textContent = 'Error loading bar info';
    }

    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });
};

// --- Shared: Check Auth ---
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = session.user;
}

// --- Shared: Get Current Bar ID ---
function getBarId() {
    return sessionStorage.getItem('owner_bar_id');
}

// --- 3. Bar Edit Logic ---
// --- 3. Bar Edit Logic ---
window.initBarEdit = async () => {
    await checkAuth();
    const barId = getBarId();
    if (!barId) {
        alert('No Bar Linked');
        window.location.href = 'index.html';
        return;
    }

    // Elements
    const form = document.getElementById('bar-form');
    const coverInput = document.getElementById('cover-file');
    const coverPreview = document.getElementById('cover-preview');
    const galleryInput = document.getElementById('gallery-input');
    const galleryGrid = document.getElementById('gallery-grid');
    const btnAddGallery = document.getElementById('btn-add-gallery');
    // Owner Management Elements
    const ownersList = document.getElementById('owners-list');
    const ownerSearchInput = document.getElementById('owner-search-input');
    const btnOwnerSearch = document.getElementById('btn-owner-search');

    const ownerSearchResults = document.getElementById('owner-search-results');
    // Hours Elements
    const hoursContainer = document.getElementById('hours-editor-container');
    const btnAddHours = document.getElementById('btn-add-hours');
    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    // Globals for this scope
    let currentCoverUrl = '';
    let galleryImages = [];
    let cropper = null;
    let currentFile = null;

    // --- Hours Helper Functions ---
    function addHoursSlot(data = { days: [], start: "20:00", end: "02:00" }) {
        const div = document.createElement('div');
        div.className = 'hours-slot';
        div.style.marginBottom = '10px';
        div.style.padding = '10px';
        div.style.background = '#333';
        div.style.border = '1px solid #555';
        div.style.borderRadius = '4px';

        // Days Config
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
            label.style.color = '#ccc';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = day;
            cb.checked = data.days.includes(day);
            cb.style.marginRight = '3px';

            label.appendChild(cb);
            label.appendChild(document.createTextNode(day));
            daysDiv.appendChild(label);
        });

        // Time Config
        const timeDiv = document.createElement('div');
        timeDiv.style.display = 'flex';
        timeDiv.style.alignItems = 'center';
        timeDiv.style.gap = '10px';

        const startInput = document.createElement('input');
        startInput.type = 'time';
        startInput.className = 'search-input'; // Reuse style
        startInput.style.marginBottom = '0';
        startInput.style.width = 'auto';
        startInput.style.padding = '5px';
        startInput.value = data.start;

        const toSpan = document.createElement('span');
        toSpan.textContent = 'to';
        toSpan.style.color = '#ccc';

        const endInput = document.createElement('input');
        endInput.type = 'time';
        endInput.className = 'search-input';
        endInput.style.marginBottom = '0';
        endInput.style.width = 'auto';
        endInput.style.padding = '5px';
        endInput.value = data.end;

        const delBtn = document.createElement('button');
        delBtn.textContent = 'Remove';
        delBtn.className = 'btn btn-secondary';
        delBtn.style.padding = '5px 10px';
        delBtn.style.fontSize = '0.8rem';
        delBtn.style.marginLeft = 'auto';
        delBtn.style.color = '#ff4444';
        delBtn.style.borderColor = '#ff4444';
        delBtn.type = 'button';
        delBtn.onclick = () => div.remove();

        timeDiv.appendChild(startInput);
        timeDiv.appendChild(toSpan);
        timeDiv.appendChild(endInput);
        timeDiv.appendChild(delBtn);

        div.appendChild(daysDiv);
        div.appendChild(timeDiv);
        hoursContainer.appendChild(div);
    }

    function parseHours(hoursStr) {
        hoursContainer.innerHTML = '';
        if (!hoursStr) {
            addHoursSlot(); return;
        }

        const cleanStr = hoursStr.trim();
        // Handle "Daily 18:00-02:00" format
        if (cleanStr.toLowerCase().startsWith('daily') && !cleanStr.includes(':')) {
            const timePart = cleanStr.replace(/daily/i, '').trim();
            const [start, end] = timePart.split('-').map(t => t.trim());
            addHoursSlot({ days: [...DAYS], start: formatTime(start), end: formatTime(end) });
            return;
        }

        const parts = cleanStr.split(';');
        parts.forEach(part => {
            const colonIndex = part.indexOf(':');
            if (colonIndex !== -1) {
                const daysPart = part.substring(0, colonIndex).trim();
                const timePart = part.substring(colonIndex + 1).trim();
                let days = [];
                if (daysPart.includes('-')) {
                    const [startDay, endDay] = daysPart.split('-').map(d => d.trim());
                    const startIdx = DAYS.indexOf(startDay);
                    const endIdx = DAYS.indexOf(endDay);
                    if (startIdx !== -1 && endIdx !== -1) {
                        if (startIdx <= endIdx) days = DAYS.slice(startIdx, endIdx + 1);
                        else days = [...DAYS.slice(startIdx), ...DAYS.slice(0, endIdx + 1)];
                    }
                } else if (daysPart.toLowerCase() === 'daily') {
                    days = [...DAYS];
                } else {
                    days = daysPart.split(',').map(d => d.trim());
                }
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

    function formatTime(t) { return t ? t.trim() : ''; }

    function serializeHours() {
        const slots = [];
        hoursContainer.querySelectorAll('.hours-slot').forEach(slot => {
            const days = [];
            slot.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => days.push(cb.value));
            const start = slot.querySelector('input[type="time"]:nth-of-type(1)').value;
            const end = slot.querySelector('input[type="time"]:nth-of-type(2)').value;
            if (days.length > 0 && start && end) {
                days.forEach(day => slots.push(`${day}: ${start} - ${end}`));
            }
        });
        const dayOrder = { "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6, "Sun": 7 };
        slots.sort((a, b) => {
            const dayA = a.split(':')[0].trim();
            const dayB = b.split(':')[0].trim();
            return (dayOrder[dayA] || 0) - (dayOrder[dayB] || 0);
        });
        return slots.join('; ');
    }

    btnAddHours.addEventListener('click', () => addHoursSlot());

    // --- Cover Image Logic ---
    function updateCoverUI() {
        const placeholder = coverPreview.querySelector('span');
        if (currentCoverUrl) {
            coverPreview.style.backgroundImage = `url('${currentCoverUrl}')`;
            if (placeholder) placeholder.style.display = 'none';
        } else {
            coverPreview.style.backgroundImage = 'none';
            if (placeholder) placeholder.style.display = 'block';
        }
    }

    coverPreview.addEventListener('click', () => coverInput.click());
    coverInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            openCropper(url);
        }
    });

    function openCropper(src) {
        const cropModal = document.getElementById('crop-modal');
        const cropImage = document.getElementById('crop-image');
        cropImage.src = src;
        cropModal.style.display = 'flex';

        if (cropper) cropper.destroy();
        cropper = new Cropper(cropImage, { aspectRatio: 4 / 5, viewMode: 1, autoCropArea: 1 });
    }

    document.getElementById('crop-cancel-btn').addEventListener('click', () => {
        document.getElementById('crop-modal').style.display = 'none';
        if (cropper) cropper.destroy();
        coverInput.value = '';
    });

    document.getElementById('crop-save-btn').addEventListener('click', () => {
        if (!cropper) return;
        cropper.getCroppedCanvas({ width: 1080, height: 1350 }).toBlob(async (blob) => {
            // Upload immediately
            const fileName = `cover_${barId}_${Date.now()}.jpg`;
            const { data, error } = await supabase.storage.from('bars').upload(fileName, blob);
            if (error) {
                alert('Upload failed: ' + error.message);
                return;
            }
            const { data: { publicUrl } } = supabase.storage.from('bars').getPublicUrl(fileName);
            currentCoverUrl = publicUrl;
            updateCoverUI();
            document.getElementById('crop-modal').style.display = 'none';
            if (cropper) cropper.destroy();
        }, 'image/jpeg', 0.85);
    });

    // --- Gallery Logic ---
    async function loadGallery() {
        galleryGrid.innerHTML = '<div style="color:#888;">Loading...</div>';
        const { data } = await supabase.from('bar_gallery')
            .select('*')
            .eq('bar_id', barId)
            .order('sort_order', { ascending: true });

        galleryImages = data || [];
        renderGallery();
    }

    function renderGallery() {
        if (galleryImages.length === 0) {
            galleryGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#666; padding:20px; background:#222; border-radius:4px;">No images yet.</div>';
            return;
        }
        galleryGrid.innerHTML = galleryImages.map(img => `
            <div style="position: relative; aspect-ratio: 1; border-radius: 4px; overflow: hidden; background: #000;">
                <img src="${img.image_url}" style="width: 100%; height: 100%; object-fit: cover;">
                <button onclick="deleteGalleryImage(${img.id})" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px;">×</button>
            </div>
        `).join('');
    }

    btnAddGallery.addEventListener('click', () => galleryInput.click());
    galleryInput.addEventListener('change', async (e) => {
        if (!e.target.files.length) return;

        // Upload each
        for (let file of e.target.files) {
            const fileName = `gallery_${barId}_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const { error: upErr } = await supabase.storage.from('bars').upload(fileName, file);
            if (upErr) { console.error(upErr); continue; }

            const { data: { publicUrl } } = supabase.storage.from('bars').getPublicUrl(fileName);
            // Add to DB
            await supabase.from('bar_gallery').insert([{ bar_id: barId, image_url: publicUrl }]);
        }
        await loadGallery();
        galleryInput.value = '';
    });

    window.deleteGalleryImage = async (id) => {
        if (!confirm('Delete image?')) return;
        await supabase.from('bar_gallery').delete().eq('id', id);
        await loadGallery();
        // --- Owner Management Logic ---
        async function loadOwnersList() {
            ownersList.innerHTML = '<div style="color:#888;">Loading...</div>';
            const { data: owners } = await supabase
                .from('bar_owners')
                .select('user_id, users(email, hopper_nickname, hopper_image_url)')
                .eq('bar_id', barId);

            if (!owners || owners.length === 0) {
                ownersList.innerHTML = '<div style="color:#888;">No owners found?</div>';
                return;
            }

            ownersList.innerHTML = owners.map(o => {
                const u = o.users;
                const name = u.hopper_nickname || 'Unknown';
                const me = (o.user_id === currentUser.id) ? ' (You)' : '';
                return `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #333; padding: 8px; border-radius: 4px;">
                    <div>
                        <div style="font-weight: 600; color: #eee;">${name}${me}</div>
                        <div style="font-size: 0.8rem; color: #888;">${u.email}</div>
                    </div>
                    ${o.user_id !== currentUser.id ? `<button type="button" onclick="removeOwner('${o.user_id}')" style="background: none; border: 1px solid #555; color: #ff4444; padding: 2px 6px; font-size: 0.75rem; border-radius: 4px; cursor: pointer;">Remove</button>` : ''}
                </div>
            `;
            }).join('');
        }

        if (btnOwnerSearch) {
            btnOwnerSearch.addEventListener('click', async () => {
                const q = ownerSearchInput.value.trim();
                if (!q) return;
                ownerSearchResults.style.display = 'block';
                ownerSearchResults.innerHTML = '<div style="padding:10px;">Searching...</div>';

                const { data: users } = await supabase.from('users')
                    .select('id, email, hopper_nickname')
                    .or(`email.ilike.%${q}%,hopper_nickname.ilike.%${q}%`)
                    .limit(5);

                if (!users || users.length === 0) {
                    ownerSearchResults.innerHTML = '<div style="padding:10px; color:#888;">No users found</div>';
                    return;
                }

                ownerSearchResults.innerHTML = users.map(u => `
                <div onclick="addOwner('${u.id}')" style="padding: 10px; border-bottom: 1px solid #333; cursor: pointer; color: #ddd;">
                    <div>${u.hopper_nickname || 'No Name'}</div>
                    <div style="font-size: 0.8rem; color: #888;">${u.email}</div>
                </div>
             `).join('');
            });
        }

        window.addOwner = async (userId) => {
            const { error } = await supabase.from('bar_owners').insert([{ bar_id: barId, user_id: userId }]);
            if (error) alert(error.message);
            else {
                ownerSearchResults.style.display = 'none';
                ownerSearchInput.value = '';
                loadOwnersList();
            }
        };

        window.removeOwner = async (userId) => {
            if (!confirm('Remove this owner?')) return;
            const { error } = await supabase.from('bar_owners').delete().eq('bar_id', barId).eq('user_id', userId);
            if (error) alert(error.message);
            else loadOwnersList();
        };

        // --- Main Data Load ---
        const { data: bar, error } = await supabase
            .from('bars')
            .select('*')
            .eq('id', barId)
            .single();

        if (bar) {
            // Read-only
            document.getElementById('name_zh').value = bar.name_zh || bar.title || '';
            document.getElementById('name_en').value = bar.name_en || '';

            // Editable
            document.getElementById('phone').value = bar.phone || '';
            document.getElementById('email').value = bar.email || ''; // Public Contact Email
            document.getElementById('address_zh').value = bar.address_zh || bar.address || ''; // Fallback for transition
            document.getElementById('address_en').value = bar.address_en || '';

            document.getElementById('reservation_url').value = bar.menu_url || ''; // Is menu_url used for reservation? Or bar.website_url?
            // Wait, user request said "Reservation Link". BMS has: menu_url, website_url (Reservation used for one of these?)
            // In BMS, "Reservation Link" field maps to 'bar-website'. So let's map it.
            document.getElementById('reservation_url').value = bar.website_url || '';

            document.getElementById('website_url').value = bar.website_url || ''; // Actually, let's keep unique if possible?
            // Note: In BMS, ID 'bar-website' label is 'Reservation Link'. 
            // Let's assume: 
            // reservation_url -> bar.website_url (based on BMS label)
            // website_url -> This might be a new field or just mapped to same if we want to separate?
            // Let's stick to what we have in DB.

            // Re-mapping:
            // BMS: 'bar-menu' -> menu_url
            // BMS: 'bar-website' -> website_url (Labeled "Reservation Link")
            // owner/bar.html has: "Reservation Link", "Website", "Instagram", "Facebook"
            // If we want Separate Website vs Reservation, we might need a new column or reuse 'menu_url' for one.
            // Let's use:
            // Reservation -> website_url
            // Website -> menu_url (Just for now, or assume we don't have separate 'official website' field yet).
            // Actually, let's look at BMS. 
            // BMS Label: Links -> Menu URL (id=bar-menu), Reservation Link (id=bar-website).
            // So:
            document.getElementById('reservation_url').value = bar.website_url || '';
            document.getElementById('website_url').value = bar.menu_url || ''; // Abuse menu_url for Website? Or just leave it blank if no column?
            // Let's use menu_url for Website if user treats it that way. 

            document.getElementById('instagram_url').value = bar.instagram_url || '';
            document.getElementById('facebook_url').value = bar.facebook_url || '';

            // Hours
            if (bar.opening_hours) parseHours(bar.opening_hours);
            else addHoursSlot();

            // Cover
            currentCoverUrl = bar.image;
            updateCoverUI();

            // Gallery
            await loadGallery();

            // Owners
            await loadOwnersList();
        }

        // Save Data
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const updates = {
                phone: document.getElementById('phone').value,
                email: document.getElementById('email').value,
                address_zh: document.getElementById('address_zh').value,
                address_en: document.getElementById('address_en').value,
                // Mapping back:
                website_url: document.getElementById('reservation_url').value, // Reservation
                menu_url: document.getElementById('website_url').value, // Website (using menu_url column)

                instagram_url: document.getElementById('instagram_url').value,
                facebook_url: document.getElementById('facebook_url').value,
                opening_hours: serializeHours(),
                image: currentCoverUrl
            };

            // If we want to support address/lat/lng inference, we might need geocoding here too?
            // For now, assume owner just edits text address.

            const { error } = await supabase
                .from('bars')
                .update(updates)
                .eq('id', barId);

            if (error) {
                alert('Error updating: ' + error.message);
            } else {
                alert('Saved successfully!');
            }
        });


    };

    // --- 4. Menu Manager Logic ---
    window.initMenuManager = async () => {
        await checkAuth();
        const barId = getBarId();
        const list = document.getElementById('menu-list');
        const modal = document.getElementById('menu-modal');
        const form = document.getElementById('menu-form');

        // Load Menus
        async function loadMenus() {
            const { data: menus, error } = await supabase
                .from('menus')
                .select('*')
                .eq('bar_id', barId)
                .order('created_at', { ascending: false });

            if (menus) {
                list.innerHTML = menus.map(menu => `
                <div class="card" style="padding: 1rem;">
                    <img src="${menu.file_url}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 4px; margin-bottom: 1rem;">
                    <h3 style="font-size: 1.1rem;">${menu.title_zh || 'Untitled'}</h3>
                    <p style="color: #888; font-size: 0.9rem;">${menu.title_en || ''}</p>
                    <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                        <button class="btn" onclick="editMenu(${menu.id})" style="padding: 0.5rem; font-size: 0.8rem;">Edit</button>
                        <button class="btn btn-secondary" onclick="deleteMenu(${menu.id})" style="padding: 0.5rem; font-size: 0.8rem; color: #ff4444; border-color: #ff4444;">Delete</button>
                    </div>
                </div>
            `).join('');
            }
        }

        loadMenus();

        // Add/Edit Logic
        document.getElementById('add-menu-btn').addEventListener('click', () => {
            form.reset();
            document.getElementById('menu-id').value = '';
            modal.classList.add('active');
        });

        document.getElementById('close-menu-btn').addEventListener('click', () => {
            modal.classList.remove('active');
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('menu-id').value;
            const data = {
                bar_id: barId,
                title_zh: document.getElementById('menu-title-zh').value,
                title_en: document.getElementById('menu-title-en').value,
                file_url: document.getElementById('menu-file').value,
                description_zh: document.getElementById('menu-desc-zh').value,
                description_en: document.getElementById('menu-desc-en').value
            };

            let error;
            if (id) {
                ({ error } = await supabase.from('menus').update(data).eq('id', id));
            } else {
                ({ error } = await supabase.from('menus').insert([data]));
            }

            if (error) alert(error.message);
            else {
                modal.classList.remove('active');
                loadMenus();
            }
        });

        window.deleteMenu = async (id) => {
            if (confirm('Delete this menu?')) {
                await supabase.from('menus').delete().eq('id', id);
                loadMenus();
            }
        };

        window.editMenu = async (id) => {
            const { data } = await supabase.from('menus').select('*').eq('id', id).single();
            if (data) {
                document.getElementById('menu-id').value = data.id;
                document.getElementById('menu-title-zh').value = data.title_zh;
                document.getElementById('menu-title-en').value = data.title_en;
                document.getElementById('menu-file').value = data.file_url;
                document.getElementById('menu-desc-zh').value = data.description_zh;
                document.getElementById('menu-desc-en').value = data.description_en;
                modal.classList.add('active');
            }
        };
    };

    // --- 5. Event Manager Logic ---
    window.initEventManager = async () => {
        await checkAuth();
        const barId = getBarId();
        const list = document.getElementById('event-list');
        const modal = document.getElementById('event-modal');
        const form = document.getElementById('event-form');

        // Load Events
        async function loadEvents() {
            const { data: events, error } = await supabase
                .from('events')
                .select('*')
                .eq('bar_id', barId)
                .order('start_date_time', { ascending: true });

            if (events) {
                list.innerHTML = events.map(event => `
                <div class="card" style="padding: 1rem;">
                    <img src="${event.cover_image || '../assets/gallery_1.png'}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 4px; margin-bottom: 1rem;">
                    <h3 style="font-size: 1.1rem;">${event.title_zh || 'Untitled'}</h3>
                    <p style="color: var(--accent-color); font-size: 0.9rem;">${new Date(event.start_date_time).toLocaleDateString()}</p>
                    <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                        <button class="btn" onclick="editEvent(${event.id})" style="padding: 0.5rem; font-size: 0.8rem;">Edit</button>
                        <button class="btn btn-secondary" onclick="deleteEvent(${event.id})" style="padding: 0.5rem; font-size: 0.8rem; color: #ff4444; border-color: #ff4444;">Delete</button>
                    </div>
                </div>
            `).join('');
            }
        }

        loadEvents();

        // Add/Edit Logic
        document.getElementById('add-event-btn').addEventListener('click', () => {
            form.reset();
            document.getElementById('event-id').value = '';
            modal.classList.add('active');
        });

        document.getElementById('close-event-btn').addEventListener('click', () => {
            modal.classList.remove('active');
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('event-id').value;
            const data = {
                bar_id: barId,
                title_zh: document.getElementById('event-title-zh').value,
                title_en: document.getElementById('event-title-en').value,
                start_date_time: document.getElementById('event-start').value,
                end_date_time: document.getElementById('event-end').value || null,
                cover_image: document.getElementById('event-image').value,
                booking_url: document.getElementById('event-booking').value,
                description_zh: document.getElementById('event-desc-zh').value,
                description_en: document.getElementById('event-desc-en').value
            };

            let error;
            if (id) {
                ({ error } = await supabase.from('events').update(data).eq('id', id));
            } else {
                ({ error } = await supabase.from('events').insert([data]));
            }

            if (error) alert(error.message);
            else {
                modal.classList.remove('active');
                loadEvents();
            }
        });

        window.deleteEvent = async (id) => {
            if (confirm('Delete this event?')) {
                await supabase.from('events').delete().eq('id', id);
                loadEvents();
            }
        };

        window.editEvent = async (id) => {
            const { data } = await supabase.from('events').select('*').eq('id', id).single();
            if (data) {
                document.getElementById('event-id').value = data.id;
                document.getElementById('event-title-zh').value = data.title_zh;
                document.getElementById('event-title-en').value = data.title_en;
                // Format datetime for input
                document.getElementById('event-start').value = data.start_date_time ? new Date(data.start_date_time).toISOString().slice(0, 16) : '';
                document.getElementById('event-end').value = data.end_date_time ? new Date(data.end_date_time).toISOString().slice(0, 16) : '';
                document.getElementById('event-image').value = data.cover_image;
                document.getElementById('event-booking').value = data.booking_url;
                document.getElementById('event-desc-zh').value = data.description_zh;
                document.getElementById('event-desc-en').value = data.description_en;
                modal.classList.add('active');
            }
        };
    };
