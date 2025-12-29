// Talent Editor Logic

console.log('Talent Editor Loaded');

let talentCropper = null;
let talentBlob = null;
let currentTalentId = null; // If editing existing
let targetUserId = null; // The user we are editing (Self or Other)

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // We wait for profile.js checkAdmin/checkRoles kind of logic to verify eligibility
    // But since this is a separate module, we can expose a function to show the button
    setTimeout(checkTalentEligibility, 1000); // Simple delay check after auth
});

async function checkTalentEligibility() {
    const user = window.currentUser || (window.supabaseClient && (await window.supabaseClient.auth.getSession()).data.session?.user);
    if (!user) return;

    // Fetch Roles
    const { data: userData } = await window.supabaseClient
        .from('users')
        .select('roles')
        .eq('id', user.id)
        .single();

    if (!userData) return;

    const roles = Array.isArray(userData.roles) ? userData.roles : [userData.roles];
    const canEdit = roles.some(r => ['admin', 'editor', 'talent', 'kol'].includes(r));

    if (canEdit) {
        const container = document.getElementById('talent-action-container');
        if (container) container.style.display = 'flex';
    }
}

// --- UI Actions ---

// Modified to accept userId (optional). If null, defaults to current user.
window.openTalentEditor = async (userId = null) => {
    console.log('openTalentEditor called', userId);
    try {
        const modal = document.getElementById('talent-modal');
        if (!modal) {
            alert('Error: Talent Modal not found in DOM');
            return;
        }

        // Ensure Bars Loaded (Non-blocking or safe)
        try {
            await ensureBarsLoaded();
        } catch (barErr) {
            console.warn('Failed to load bars:', barErr);
            // Continue anyway, dropdowns might be empty
        }

        modal.style.display = 'flex';

        if (userId) {
            targetUserId = userId;
        } else {
            // Safe User Fetch
            const user = window.currentUser;
            if (user) {
                targetUserId = user.id;
            } else {
                const { data, error } = await window.supabaseClient.auth.getUser();
                if (error || !data?.user) {
                    console.error('Auth check failed:', error);
                    alert('Please log in to edit profile.');
                    window.closeTalentEditor();
                    return;
                }
                targetUserId = data.user.id;
                window.currentUser = data.user; // Cache it
            }
        }

        if (!targetUserId) {
            alert('User identification failed.');
            window.closeTalentEditor();
            return;
        }

        // Fetch existing data
        await loadTalentData();

    } catch (err) {
        console.error('Fatal error in openTalentEditor:', err);
        alert('System Error: ' + err.message);
    }
};

window.closeTalentEditor = () => {
    const modal = document.getElementById('talent-modal');
    if (modal) modal.style.display = 'none';

    // Cleanup
    if (talentCropper) {
        talentCropper.destroy();
        talentCropper = null;
    }
    talentBlob = null;
};

// --- Data Loading ---
async function loadTalentData() {
    if (!targetUserId) return;

    const { data, error } = await window.supabaseClient
        .from('talents')
        .select('*')
        .eq('user_id', targetUserId) // Use targetUserId
        .maybeSingle();

    if (error) {
        console.error('Error loading talent:', error);
        return;
    }

    if (data) {
        console.log('Loaded Talent Data:', data);
        currentTalentId = data.id;
        document.getElementById('talent-name').value = data.display_name || '';
        document.getElementById('talent-quote').value = data.quote || '';
        document.getElementById('talent-desc').value = data.description || '';

        if (data.image_url) {
            document.getElementById('talent-preview').src = data.image_url;
            document.getElementById('talent-preview').style.display = 'block';
            document.getElementById('talent-upload-placeholder').style.display = 'none';
        } else {
            // Reset Image UI
            document.getElementById('talent-preview').src = '';
            document.getElementById('talent-preview').style.display = 'none';
            document.getElementById('talent-upload-placeholder').style.display = 'block';
        }

        // Lists
        renderList('talent-roles-list', data.bar_roles || [], roleItemTemplate);
        renderList('talent-exp-list', data.experiences || [], expItemTemplate);
        renderList('talent-award-list', data.awards || [], awardItemTemplate);
    } else {
        // New Profile
        currentTalentId = null;
        document.getElementById('talent-name').value = '';
        document.getElementById('talent-quote').value = '';
        document.getElementById('talent-desc').value = '';

        document.getElementById('talent-preview').src = '';
        document.getElementById('talent-preview').style.display = 'none';
        document.getElementById('talent-upload-placeholder').style.display = 'block';

        renderList('talent-roles-list', [], roleItemTemplate);
        renderList('talent-exp-list', [], expItemTemplate);
        renderList('talent-award-list', [], awardItemTemplate);
    }
}

// --- Dynamic Lists Logic ---

// Helper to render lists
function renderList(containerId, items, templateFn) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    items.forEach((item, index) => {
        container.appendChild(createListItem(item, index, templateFn));
    });
}

function createListItem(data, index, templateFn) {
    const div = document.createElement('div');
    // Use .editor-list-item class we defined in profile.html
    div.className = 'editor-list-item';
    div.innerHTML = templateFn(data);

    // Delete Button (Refined)
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '&times;';
    delBtn.style.cssText = 'position: absolute; top: 0px; right: 0px; padding: 5px 10px; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #aaa; transition: color 0.2s; line-height: 1;';
    delBtn.onmouseover = () => delBtn.style.color = '#ff3b30';
    delBtn.onmouseout = () => delBtn.style.color = '#aaa';
    delBtn.onclick = function () { div.remove(); };
    div.appendChild(delBtn);

    // Initialize Search Logic if this item has a bar search container
    const searchContainer = div.querySelector('.bar-search-container');
    if (searchContainer) {
        // Extract initial values if needed, but template usually provided basic HTML value attrs.
        // We just need to attach listeners.
        // We can pass data to setupBarSearch if needed, but easier to just attach.
        // However, setupBarSearch expects initialId passed to set things up? 
        // No, template already rendered value="" in inputs. 
        // We just need to attach listeners. 
        // Let's modify setupBarSearch to read current values if not passed args.
        // OR better: pass the data object to createListItem? We have 'data'.

        // Wait, setupBarSearch logic above: "if (initialId) { hiddenId.value = initialId; ... }"
        // If template already set attributes, we just need to attach events.
        // Check setupBarSearch I just wrote... it DOES expect initial params to populate input. 
        // But template ALREADY populates `input value` and `hidden value`.
        // So setupBarSearch just needs to attach events.
        // Let's verify setupBarSearch again or re-write it to be safer.
        setupBarSearch(searchContainer);
    }

    // Initialize Year Range Logic if this item has a year range container
    const yearContainer = div.querySelector('.year-range-container');
    if (yearContainer) {
        setupYearRange(yearContainer);
    }

    return div;
}

// RESTORED HELPERS for adding blank items
window.addTalentRoleItem = () => {
    const container = document.getElementById('talent-roles-list');
    container.appendChild(createListItem({}, container.children.length, roleItemTemplate));
};
window.addTalentExpItem = () => {
    const container = document.getElementById('talent-exp-list');
    container.appendChild(createListItem({}, container.children.length, expItemTemplate));
};
window.addTalentAwardItem = () => {
    const container = document.getElementById('talent-award-list');
    container.appendChild(createListItem({}, container.children.length, awardItemTemplate));
};


// --- Dropdown Helpers ---
let cachedBars = [];

async function ensureBarsLoaded() {
    if (cachedBars.length > 0) return;
    const { data } = await window.supabaseClient
        .from('bars')
        .select('id, title')
        .order('title');
    if (data) cachedBars = data;
}

// --- Year Range Logic ---
function getYearOptions(selectedYear, includeNow = false) {
    const currentYear = new Date().getFullYear();
    let options = '<option value="">Year</option>';

    if (includeNow) {
        const selNow = (selectedYear === 'Now') ? 'selected' : '';
        options += `<option value="Now" ${selNow}>Now</option>`;
    }

    for (let y = currentYear; y >= 1980; y--) {
        const sel = (selectedYear && (selectedYear == y || selectedYear === String(y))) ? 'selected' : '';
        options += `<option value="${y}" ${sel}>${y}</option>`;
    }
    return options;
}

// --- Year Range Logic ---
function setupYearRange(container) {
    const startSelect = container.querySelector('.year-select-start');
    const endSelect = container.querySelector('.year-select-end');
    const hiddenInput = container.querySelector('.list-input-year');

    function updateCombined() {
        const start = startSelect.value;
        const end = endSelect.value;
        if (start && end) {
            hiddenInput.value = (start === end) ? start : `${start}-${end}`;
        } else if (start) {
            hiddenInput.value = start;
        } else {
            hiddenInput.value = '';
        }
    }

    startSelect.addEventListener('change', updateCombined);
    endSelect.addEventListener('change', updateCombined);
}

function getBarOptions(selectedBarId) {
    let options = '<option value="">Select Bar...</option>';
    cachedBars.forEach(b => {
        const sel = (selectedBarId == b.id) ? 'selected' : '';
        options += `<option value="${b.id}" ${sel}>${b.title}</option>`;
    });
    return options;
}

// --- Searchable Bar Logic ---
function setupBarSearch(container, initialId, initialName) {
    const input = container.querySelector('.list-input-bar-search');
    const hiddenId = container.querySelector('.list-input-bar-id');
    const results = container.querySelector('.search-results-dropdown');

    // Set initial values
    if (initialName) input.value = initialName; // If we have a fallback name
    // Ideally we look up ID -> Title
    if (initialId) {
        hiddenId.value = initialId;
        const match = cachedBars.find(b => b.id == initialId);
        if (match) input.value = match.title;
        else if (initialName) input.value = initialName; // fallback if ID not found but name exists
        else input.value = ''; // ID exists but no match? Rare.
    }

    // Input Handler
    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        // Clear ID on modification to ensure we only save valid selections (or handle custom logic if needed)
        // Check if current input matches the stored ID's title exactly? 
        // For now, if user types, we reset ID unless they re-select. 
        // OR: we allow custom text (no ID). 
        // Let's assume strict selection for "Affiliation" is best, but if they want custom text?
        // Let's clear ID if text changes.
        hiddenId.value = '';

        if (query.length < 1) {
            results.style.display = 'none';
            return;
        }

        const matches = cachedBars.filter(b => b.title.toLowerCase().includes(query));
        if (matches.length > 0) {
            results.innerHTML = matches.map(b =>
                `<div class="search-result-item" data-id="${b.id}" data-title="${b.title}">${b.title}</div>`
            ).join('');
            results.style.display = 'block';

            // Add Click Handlers
            const items = results.querySelectorAll('.search-result-item');
            items.forEach(item => {
                item.addEventListener('click', () => {
                    input.value = item.getAttribute('data-title');
                    hiddenId.value = item.getAttribute('data-id');
                    results.style.display = 'none';
                });
            });
        } else {
            results.style.display = 'none';
        }
    });

    // Close on blur (delayed)
    input.addEventListener('blur', () => {
        setTimeout(() => results.style.display = 'none', 200);
    });

    // Show all on focus? Optional.
    input.addEventListener('focus', () => {
        if (input.value.trim() === '') {
            // Show top 10?
            // results.innerHTML = cachedBars.slice(0, 5).map(...)
        }
    });
}

const roleItemTemplate = (data) => {
    // Legacy support logic same as before to determine initial ID/Name
    let selectedId = data.bar_id;
    let displayName = data.bar_name || '';

    if (!selectedId && displayName && cachedBars.length > 0) {
        const matchById = cachedBars.find(b => b.id == displayName);
        if (matchById) {
            selectedId = matchById.id;
            displayName = matchById.title;
        } else {
            const matchByTitle = cachedBars.find(b => b.title === displayName);
            if (matchByTitle) {
                selectedId = matchByTitle.id;
                displayName = matchByTitle.title;
            }
        }
    }

    // We render markup then init JS after append.
    // We attach data attributes to the container for the init function to read? 
    // Or we just return HTML and rely on `createListItem` to not know about init, 
    // and we handle init by selecting the LAST child appended.

    return `
    <div class="editor-list-grid" style="grid-template-columns: 1fr 1fr;">
        <div class="bar-search-container">
            <input type="text" class="editor-input list-input-bar-search" placeholder="Search Bar..." value="${displayName.replace(/"/g, '&quot;')}" autocomplete="off">
            <input type="hidden" class="list-input-bar-id" value="${selectedId || ''}">
            <div class="search-results-dropdown"></div>
        </div>
        <input type="text" class="editor-input list-input-role" placeholder="Role (e.g. Owner)" value="${data.role || ''}">
    </div>
`};

const expItemTemplate = (data) => {
    // Parse existing year string (e.g. "2018-2020" or "2019")
    let startYear = '';
    let endYear = '';
    if (data.year) {
        if (data.year.includes('-')) {
            [startYear, endYear] = data.year.split('-').map(s => s.trim());
        } else {
            startYear = data.year;
            endYear = data.year; // Default to same if single year? Or leave end blank? 
            // If it's a single year, maybe just set start. 
            // Often "2019" implies "2019". Range "2019-2019" is redundant.
            // Let's set startYear = 2019, endYear = 2019 so it looks consistent?
            // Actually, if it's a range UI, likely user wants to see both.
            endYear = data.year;
        }
    }

    return `
    <div class="editor-list-grid" style="grid-template-columns: 140px 1fr 1fr;">
        <div class="year-range-container" style="display: flex; gap: 2px; align-items: center;">
            <select class="editor-input year-select-start" style="padding: 12px 5px; font-size: 0.85rem; min-width: 60px;">
                 <option value="">Start</option>
                 ${getYearOptions(startYear).replace('<option value="">Year</option>', '')}
            </select>
            <span style="color:#aaa;">-</span>
            <select class="editor-input year-select-end" style="padding: 12px 5px; font-size: 0.85rem; min-width: 60px;">
                 <option value="">End</option>
                 ${getYearOptions(endYear, true).replace('<option value="">Year</option>', '')}
            </select>
            <input type="hidden" class="list-input-year" value="${data.year || ''}">
        </div>
        <input type="text" class="editor-input list-input-unit" placeholder="Unit (Company)" value="${data.unit || ''}">
        <input type="text" class="editor-input list-input-title" placeholder="Title" value="${data.title || ''}">
    </div>
`};

const awardItemTemplate = (data) => `
    <div class="editor-list-grid" style="grid-template-columns: 90px 1fr 1fr;">
        <select class="editor-input list-input-year" style="padding-right: 5px;">
             ${getYearOptions(data.year)}
        </select>
        <input type="text" class="editor-input list-input-name" placeholder="Award Name" value="${data.name || ''}">
        <input type="text" class="editor-input list-input-rank" placeholder="Rank/Title" value="${data.rank || ''}">
    </div>
`;

// --- Scrape Data from DOM ---
function scrapeList(containerId, selectors) {
    const container = document.getElementById(containerId);
    const items = [];
    Array.from(container.children).forEach(div => {
        const item = {};
        // selectors is map: { key: className }
        for (const [key, cls] of Object.entries(selectors)) {
            const input = div.querySelector('.' + cls);
            if (input) item[key] = input.value;
        }
        // Filter empty
        if (Object.values(item).some(v => v && v.trim() !== '')) {
            items.push(item);
        }
    });
    return items;
}

// --- Image Handling ---
window.handleTalentFile = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const cropImg = document.getElementById('talent-crop-img');
            cropImg.src = e.target.result;
            document.getElementById('talent-crop-container').style.display = 'block';

            if (talentCropper) talentCropper.destroy();
            talentCropper = new Cropper(cropImg, {
                aspectRatio: 1, // 1028x1028 is 1:1
                viewMode: 1
            });
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.confirmTalentCrop = () => {
    if (!talentCropper) return;
    talentCropper.getCroppedCanvas({ width: 1028, height: 1028 }).toBlob((blob) => {
        talentBlob = blob;
        const url = URL.createObjectURL(blob);
        const preview = document.getElementById('talent-preview');
        preview.src = url;
        preview.style.display = 'block';
        document.getElementById('talent-upload-placeholder').style.display = 'none';
        document.getElementById('talent-crop-container').style.display = 'none';

        // Clean up cropper
        talentCropper.destroy();
        talentCropper = null;
    });
};

// --- Save ---
window.saveTalentProfile = async () => {
    if (!targetUserId) return alert('No target user selected');

    // 1. Upload Image (if changed)
    let imageUrl = document.getElementById('talent-preview').src;
    // Check if it is a blob URL vs remote URL
    if (talentBlob) {
        const fileName = `talent_${targetUserId}_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await window.supabaseClient
            .storage
            .from('avatars') // Reusing avatars bucket
            .upload(fileName, talentBlob);

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return alert('Image upload failed');
        }

        const { data: { publicUrl } } = window.supabaseClient
            .storage
            .from('avatars')
            .getPublicUrl(fileName);
        imageUrl = publicUrl;
    }

    // 2. Gather Data
    const payload = {
        user_id: targetUserId, // Use targetUserId
        display_name: document.getElementById('talent-name').value,
        quote: document.getElementById('talent-quote').value,
        description: document.getElementById('talent-desc').value,
        image_url: imageUrl,
        bar_roles: scrapeList('talent-roles-list', { bar_id: 'list-input-bar-id', role: 'list-input-role' }),
        experiences: scrapeList('talent-exp-list', { year: 'list-input-year', unit: 'list-input-unit', title: 'list-input-title' }),
        awards: scrapeList('talent-award-list', { year: 'list-input-year', name: 'list-input-name', rank: 'list-input-rank' })
    };

    console.log('Saving Talent Payload:', payload);

    // 3. Upsert
    // Note: If ID exists, we update. But since table is 1-to-1 with user_id, upsert on user_id conflict is also fine if we set constraint.
    // However, our table PK is ID. Let's try upserting by match user_id logic or just use ID if we have it.

    let query = window.supabaseClient.from('talents');

    // We rely on RLS to allow if Admin/Editor or Self
    const { error } = await query.upsert(payload, { onConflict: 'user_id' });

    if (error) {
        console.error('Save error:', error);
        alert('Failed to save profile: ' + error.message);
    } else {
        alert('Talent Profile Saved!');
        window.closeTalentEditor();
    }
};
