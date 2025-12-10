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
    const modal = document.getElementById('talent-modal');
    if (!modal) return console.error('Talent Modal not found');

    // Ensure Bars Loaded
    await ensureBarsLoaded();

    modal.style.display = 'flex';

    if (userId) {
        targetUserId = userId;
    } else {
        const user = window.currentUser || (await window.supabaseClient.auth.getUser()).data.user;
        targetUserId = user ? user.id : null;
    }

    if (!targetUserId) {
        alert('User not identified');
        return window.closeTalentEditor();
    }

    // Fetch existing data
    await loadTalentData();
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
    div.className = 'talent-list-item';
    div.style.cssText = 'background: #f9f9f9; padding: 10px; border-radius: 6px; position: relative; border: 1px solid #eee;';
    div.innerHTML = templateFn(data);

    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '&times;';
    delBtn.style.cssText = 'position: absolute; top: 5px; right: 5px; background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #999;';
    delBtn.onclick = function () { div.remove(); };
    div.appendChild(delBtn);

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

function getYearOptions(selectedYear) {
    const currentYear = new Date().getFullYear();
    let options = '<option value="">Year</option>';
    for (let y = currentYear; y >= 1980; y--) {
        const sel = (selectedYear && parseInt(selectedYear) === y) ? 'selected' : '';
        options += `<option value="${y}" ${sel}>${y}</option>`;
    }
    return options;
}

function getBarOptions(selectedBarId) {
    let options = '<option value="">Select Bar...</option>';
    cachedBars.forEach(b => {
        // If saved data stores ID, match by ID. If stores Name, we might need logic change.
        // For robustness, let's store ID if possible, or Name if that's what backend expects.
        // Implementation Plan said: bar_roles: JSONB: [{ bar_id, role_name }]
        // So we should verify if data used bar_name or bar_id previously. 
        // Previous template used "bar_name". Let's migrate to using ID primarily, or Name if custom?
        // User request: "Select from existing bars".
        // Let's use ID as value, Title as text.

        // However, existing scrape logic used 'bar_name' key. Let's switch to 'bar_id' or keep 'bar_name' but fill with title?
        // Ideally we store { bar_id, bar_name, role }.
        // Let's assume we store ID in value. 

        const sel = (selectedBarId === b.id) ? 'selected' : '';
        options += `<option value="${b.id}" ${sel}>${b.title}</option>`;
    });
    return options;
}


// Templates - Now functions that return HTML string with options injected
const roleItemTemplate = (data) => `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <select class="hopping-input-minimal list-input-bar-id" style="margin:0; font-size: 0.9rem;">
            ${getBarOptions(data.bar_id)}
        </select>
        <input type="text" class="hopping-input-minimal list-input-role" placeholder="Role (e.g. Owner)" value="${data.role || ''}" style="margin:0; font-size: 0.9rem;">
        <!-- Hidden input for bar Name if needed for display fallback, though ID is better -->
    </div>
`;

const expItemTemplate = (data) => `
    <div style="display: grid; grid-template-columns: 80px 1fr 1fr; gap: 8px;">
        <select class="hopping-input-minimal list-input-year" style="margin:0; font-size: 0.9rem; padding-right:0;">
             ${getYearOptions(data.year)}
        </select>
        <input type="text" class="hopping-input-minimal list-input-unit" placeholder="Unit (Company)" value="${data.unit || ''}" style="margin:0; font-size: 0.9rem;">
        <input type="text" class="hopping-input-minimal list-input-title" placeholder="Title" value="${data.title || ''}" style="margin:0; font-size: 0.9rem;">
    </div>
`;

const awardItemTemplate = (data) => `
    <div style="display: grid; grid-template-columns: 80px 1fr 1fr; gap: 8px;">
        <select class="hopping-input-minimal list-input-year" style="margin:0; font-size: 0.9rem; padding-right:0;">
             ${getYearOptions(data.year)}
        </select>
        <input type="text" class="hopping-input-minimal list-input-name" placeholder="Award Name" value="${data.name || ''}" style="margin:0; font-size: 0.9rem;">
        <input type="text" class="hopping-input-minimal list-input-rank" placeholder="Rank/Title" value="${data.rank || ''}" style="margin:0; font-size: 0.9rem;">
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
        bar_roles: scrapeList('talent-roles-list', { bar_name: 'list-input-bar', role: 'list-input-role' }),
        experiences: scrapeList('talent-exp-list', { year: 'list-input-year', unit: 'list-input-unit', title: 'list-input-title' }),
        awards: scrapeList('talent-award-list', { year: 'list-input-year', name: 'list-input-name', rank: 'list-input-rank' })
    };

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
