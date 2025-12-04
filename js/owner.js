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
                .select('role')
                .eq('id', data.user.id)
                .single();

            if (userError || !userData || userData.role !== 'barOwner') {
                await supabase.auth.signOut();
                throw new Error('Unauthorized: You are not a Bar Owner.');
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
    const actionsEl = document.getElementById('dashboard-actions');
    const noBarMsg = document.getElementById('no-bar-msg');
    const logoutBtn = document.getElementById('logout-btn');

    // Display User Info
    userNameEl.textContent = currentUser.email; // Ideally fetch name from users table

    // Fetch Linked Bar
    try {
        const { data: bar, error } = await supabase
            .from('bars')
            .select('*')
            .eq('owner_user_id', currentUser.id)
            .single();

        if (bar) {
            currentBar = bar;
            barNameEl.textContent = bar.name_en || bar.name_zh || bar.title; // Fallback to title if new schema not fully populated
            actionsEl.style.display = 'grid';

            // Store bar ID for other pages
            sessionStorage.setItem('owner_bar_id', bar.id);
        } else {
            barNameEl.textContent = 'No Bar Linked';
            noBarMsg.style.display = 'block';
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
window.initBarEdit = async () => {
    await checkAuth();
    const barId = getBarId();
    if (!barId) {
        alert('No Bar Linked');
        window.location.href = 'index.html';
        return;
    }

    const form = document.getElementById('bar-form');

    // Load Data
    const { data: bar, error } = await supabase
        .from('bars')
        .select('*')
        .eq('id', barId)
        .single();

    if (bar) {
        // Read-only
        document.getElementById('name_zh').value = bar.name_zh || '';
        document.getElementById('name_en').value = bar.name_en || '';

        // Editable
        document.getElementById('phone').value = bar.phone || '';
        document.getElementById('email').value = bar.email || '';
        document.getElementById('address_zh').value = bar.address_zh || '';
        document.getElementById('address_en').value = bar.address_en || '';
        document.getElementById('website_url').value = bar.website_url || '';
        document.getElementById('instagram_url').value = bar.instagram_url || '';
        document.getElementById('facebook_url').value = bar.facebook_url || '';
        document.getElementById('opening_hours').value = JSON.stringify(bar.opening_hours || {}, null, 2);
    }

    // Save Data
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const updates = {
            phone: document.getElementById('phone').value,
            email: document.getElementById('email').value,
            address_zh: document.getElementById('address_zh').value,
            address_en: document.getElementById('address_en').value,
            website_url: document.getElementById('website_url').value,
            instagram_url: document.getElementById('instagram_url').value,
            facebook_url: document.getElementById('facebook_url').value,
            opening_hours: JSON.parse(document.getElementById('opening_hours').value || '{}')
        };

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
