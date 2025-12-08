document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const passwordInput = document.getElementById('admin-password');

    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const supabaseUrlInput = document.getElementById('supabase-url');
    const supabaseKeyInput = document.getElementById('supabase-key');

    const addBarBtn = document.getElementById('add-bar-btn');
    const barModal = document.getElementById('bar-modal');
    const closeBarBtn = document.getElementById('close-bar-btn');
    const saveBarBtn = document.getElementById('save-bar-btn');
    const barList = document.getElementById('bar-list');

    // State
    let supabase = null;
    let bars = [];

    // --- Auth Logic ---
    async function checkLogin() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            await verifyRole(session.user.id);
        }
    }

    async function verifyRole(userId) {
        const { data: user, error } = await supabase
            .from('users')
            .select('roles')
            .eq('id', userId)
            .single();

        const roles = user ? (user.roles || []) : [];

        // Allow access if admin, editor, or barOwner
        if (roles.includes('admin') || roles.includes('editor') || roles.includes('barOwner')) {
            showDashboard(roles);
        } else {
            console.warn('Access Denied');
            alert('Access Denied: You do not have permission to access the dashboard.');
            await supabase.auth.signOut();
            loginSection.style.display = 'block';
            dashboardSection.style.display = 'none';
        }
    }

    function showDashboard(roles) {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';

        // Show/Hide buttons based on roles
        const isAdmin = roles.includes('admin');
        const isEditor = roles.includes('editor');
        const isOwner = roles.includes('barOwner');

        // Manage Users: Admin only
        if (!isAdmin) {
            document.getElementById('manage-users-btn').style.display = 'none';
            document.getElementById('settings-btn').style.display = 'none';
        }

        // Manage Articles: Admin or Editor
        if (!isAdmin && !isEditor) {
            document.getElementById('manage-articles-btn').style.display = 'none';
        }

        // Manage Bars: Admin or Owner
        // (For now, we keep "Add Bar" visible but maybe restrict logic later if needed)
        if (!isAdmin && !isOwner) {
            document.getElementById('add-bar-btn').style.display = 'none';
            // Also might want to hide "Manage Bars" if they have 0 bars and can't add?
            // But let's assume they can see the list or at least their own bars.
        }

        // Load default view
        if (isAdmin || isOwner) {
            loadBars(); // Default
        } else if (isEditor) {
            // If only editor, switch to articles view automatically
            document.getElementById('manage-articles-btn').click();
        }
    }

    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('admin-email').value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            alert('Please enter both email and password');
            return;
        }

        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            await verifyRole(data.user.id);

        } catch (err) {
            console.error('Login Error:', err);

            let msg = 'Login Failed: ' + err.message;

            // Map common Supabase errors to user-friendly messages
            if (err.message.includes('Invalid login credentials')) {
                msg = '登入失敗：帳號或密碼錯誤 (Invalid login credentials)';
            } else if (err.message.includes('Email not confirmed')) {
                msg = '登入失敗：信箱尚未驗證，請檢查您的收件匣 (Email not confirmed)';
            } else if (err.message.includes('User not found')) {
                // Note: Supabase often returns "Invalid login credentials" for this too for security
                msg = '登入失敗：找不到此使用者 (User not found)';
            }

            alert(msg);
        } finally {
            loginBtn.textContent = 'Login';
            loginBtn.disabled = false;
        }
    });

    // --- Google Login Logic ---
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.href // Redirect back to this page
                }
            });
            if (error) {
                console.error('Google Login Error:', error);
                alert('Google Login Failed: ' + error.message);
            }
        });
    }

    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        location.reload();
    });



    // --- Supabase Settings ---
    const SUPABASE_URL = 'https://wgnskednopbfngvjmviq.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P';

    // Init immediately for Auth to work
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    // Pre-fill settings inputs just in case
    supabaseUrlInput.value = SUPABASE_URL;
    supabaseKeyInput.value = SUPABASE_KEY;

    function initSupabase() {
        // Kept for settings modal re-init if needed
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }

    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('active');
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('active');
    });

    saveSettingsBtn.addEventListener('click', () => {
        // We allow updating if needed, but default is hardcoded
        const url = supabaseUrlInput.value.trim();
        const key = supabaseKeyInput.value.trim();

        if (url && key) {
            supabase = window.supabase.createClient(url, key);
            settingsModal.classList.remove('active');
            alert('Database Connected!');
            loadBars();
        }
    });

    // --- CRUD Logic ---
    async function loadBars() {
        barList.innerHTML = '<p style="color: #888;">Loading...</p>';

        if (supabase) {
            // Fetch from DB
            const { data, error } = await supabase.from('bars').select('*');

            if (error) {
                console.error('DB Error:', error);

                // Check if table is missing (Postgres error 42P01)
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    barList.innerHTML = `
                        <div style="text-align: center; padding: 20px; color: #ff4444;">
                            <p><strong>Table "bars" not found!</strong></p>
                            <p style="font-size: 0.9em; color: #ccc; margin-top: 10px;">
                                You need to create the table in Supabase.<br>
                                Go to Table Editor -> Create New Table -> Name it "bars".
                            </p>
                        </div>
                    `;
                } else {
                    barList.innerHTML = `<p style="color: #ff4444;">Error: ${error.message}</p>`;
                }
                return;
            }

            bars = data;
            renderBars();
            return;
        }

        // Fallback / Local Data
        // In a real app, we might not want to show local data in admin if DB is expected
        // But for this demo, we show "No Database Connected" if supabase is null
        if (!supabase) {
            barList.innerHTML = `
                <div style="text-align: center; padding: 20px; border: 1px dashed #444; border-radius: 8px;">
                    <p>No Database Connected.</p>
                    <p style="font-size: 0.9em; color: #888;">Click "Database Settings" to connect Supabase.</p>
                </div>
            `;
        }
    }

    function renderBars() {
        if (bars.length === 0) {
            barList.innerHTML = '<p style="color: #888;">No bars found.</p>';
            return;
        }

        barList.innerHTML = bars.map(bar => {
            const thumbStyle = bar.image ? `background-image: url('${bar.image}')` : 'background-color: #eee;';
            const isPublished = bar.is_published !== false; // Default true if undefined
            const statusColor = isPublished ? '#4cd964' : '#666';
            const statusText = isPublished ? 'Published' : 'Hidden';

            return `
            <div class="article-item">
                <div class="article-thumb" style="${thumbStyle}"></div>
                
                <div class="article-info">
                    <h4>${bar.title}</h4>
                    <div class="article-meta">
                        <span>${bar.location || 'No Location'}</span>
                        ${bar.vibe ? `<span>• ${bar.vibe}</span>` : ''}
                    </div>
                </div>

                <div class="article-status">
                    <label class="status-toggle" onclick="toggleBarStatus('${bar.id}', ${isPublished})">
                        <input type="checkbox" ${isPublished ? 'checked' : ''}>
                        <span class="status-slider"></span>
                        <span class="status-label" style="color: ${statusColor}">${statusText}</span>
                    </label>
                </div>

                <div class="article-actions">
                    <a href="bar-details.html?id=${bar.id}" target="_blank" class="btn" style="padding: 5px 10px; font-size: 0.8em; margin-right: 5px; background-color: #666; border-color: #666; text-decoration: none; color: white;">View</a>
                    <button onclick="editBar('${bar.id}')" class="btn" style="padding: 5px 10px; font-size: 0.8em; margin-right: 5px;">Edit</button>
                    <button onclick="deleteBar('${bar.id}')" class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.8em; color: #ff4444; border-color: #ff4444;">Delete</button>
                </div>
            </div>
        `}).join('');
    }

    window.editBar = (id) => {
        window.location.href = `bms.html?id=${id}`;
    };

    window.toggleBarStatus = async (id, currentStatus) => {
        const newStatus = !currentStatus;

        if (supabase) {
            const { error } = await supabase
                .from('bars')
                .update({ is_published: newStatus })
                .eq('id', id);

            if (error) {
                alert('Error updating status: ' + error.message);
            } else {
                loadBars();
            }
        }
    };

    // Expose delete function to window
    window.deleteBar = async (id) => {
        if (!confirm('Are you sure? This will delete the bar and all related data.')) return;

        if (supabase) {
            const { error } = await supabase.from('bars').delete().eq('id', id);
            if (!error) {
                loadBars();
            } else {
                alert('Error deleting: ' + error.message);
            }
        }
    };

    // Add Bar
    addBarBtn.addEventListener('click', () => {
        // Redirect to Bar Management System (New Mode)
        window.location.href = 'bms.html';
    });

    closeBarBtn.addEventListener('click', () => {
        barModal.classList.remove('active');
    });

    saveBarBtn.addEventListener('click', async () => {
        const title = document.getElementById('bar-title').value;
        const location = document.getElementById('bar-location').value;
        const vibe = document.getElementById('bar-vibe').value;
        const image = document.getElementById('bar-image').value;

        if (supabase) {
            const { error } = await supabase.from('bars').insert([
                { title, location, vibe, image, rating: 5.0 }
            ]);

            if (!error) {
                barModal.classList.remove('active');
                loadBars();
                // Reset form
                document.getElementById('bar-title').value = '';
                document.getElementById('bar-location').value = '';
                document.getElementById('bar-vibe').value = '';
            } else {
                alert('Error saving: ' + error.message);
            }
        } else {
            alert('Please connect database first!');
        }
    });

    // --- View Toggling ---
    const manageUsersBtn = document.getElementById('manage-users-btn');
    const usersSection = document.getElementById('users-section');
    // We need to split dashboard into "Bars Section" and "Users Section" visually
    // But for now, let's just toggle visibility of the lists
    const barListSection = document.getElementById('bar-list').parentElement; // The section containing bar list

    manageUsersBtn.addEventListener('click', () => {
        if (usersSection.style.display === 'none') {
            usersSection.style.display = 'block';
            articlesSection.style.display = 'none'; // Hide Articles
            document.getElementById('bar-list').style.display = 'none';
            document.querySelector('#dashboard-section h2').textContent = 'Manage Users';
            loadUsers();
        } else {
            // Toggle back to bars (default)
            usersSection.style.display = 'none';
            articlesSection.style.display = 'none';
            document.getElementById('bar-list').style.display = 'grid';
            document.querySelector('#dashboard-section h2').textContent = 'Manage Bars';
        }
    });

    // --- User Management Logic ---
    const userList = document.getElementById('user-list');
    const addUserBtn = document.getElementById('add-user-btn');
    const userModal = document.getElementById('user-modal');
    const closeUserBtn = document.getElementById('close-user-btn');
    const saveUserBtn = document.getElementById('save-user-btn');
    const userBarSelect = document.getElementById('user-bar-select');

    let allBarsCache = [];

    async function loadUsers() {
        userList.innerHTML = '<tr><td colspan="4" style="padding: 1rem; text-align: center;">Loading...</td></tr>';

        if (!supabase) return;

        // Fetch Users
        const { data: users, error } = await supabase
            .from('users')
            .select(`
                *,
                bars:bars(id, title, name_en, name_zh)
            `)
            .order('created_at', { ascending: false });

        // Fetch All Bars for Dropdown
        const { data: bars } = await supabase.from('bars').select('id, title, name_en');
        allBarsCache = bars || [];

        if (error) {
            console.error('Error loading users:', error);
            userList.innerHTML = `<tr><td colspan="4" style="padding: 1rem; text-align: center; color: #ff4444;">Error: ${error.message}</td></tr>`;
            return;
        }

        renderUsers(users);
    }

    function renderUsers(users) {
        userList.innerHTML = users.map(user => {
            const currentBarId = user.bars && user.bars.length > 0 ? user.bars[0].id : '';
            const roles = user.roles || [];

            // Generate Bar Options
            const barOptions = `<option value="">- No Bar -</option>` +
                allBarsCache.map(b =>
                    `<option value="${b.id}" ${b.id === currentBarId ? 'selected' : ''}>${b.name_en || b.title}</option>`
                ).join('');

            // Generate Role Checkboxes
            const isReader = roles.includes('reader'); // Keep reader logic if needed, or just ignore
            const isAdmin = roles.includes('admin');
            const isEditor = roles.includes('editor');
            const isOwner = roles.includes('barOwner');

            return `
                <tr style="border-bottom: 1px solid #333;" id="row-${user.id}">
                    <td style="padding: 1rem;">
                        ${user.email}
                        <div style="font-size: 0.8em; color: #666;">${user.name || ''}</div>
                    </td>
                    <td style="padding: 1rem;">
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <label><input type="checkbox" class="inline-role" data-role="admin" ${isAdmin ? 'checked' : ''}> Admin</label>
                            <label><input type="checkbox" class="inline-role" data-role="editor" ${isEditor ? 'checked' : ''}> Editor</label>
                            <label><input type="checkbox" class="inline-role" data-role="barOwner" ${isOwner ? 'checked' : ''}> Owner</label>
                        </div>
                    </td>
                    <td style="padding: 1rem;">
                        <select class="search-input inline-bar-select" style="padding: 5px; width: 100%;">
                            ${barOptions}
                        </select>
                    </td>
                    <td style="padding: 1rem; text-align: right;">
                        <button onclick="saveUserInline('${user.id}')" class="btn" style="padding: 5px 10px; font-size: 0.8em; margin-bottom: 5px;">Save</button>
                        <button onclick="deleteUser('${user.id}')" class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.8em; color: #ff4444; border-color: #ff4444;">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.saveUserInline = async (userId) => {
        const row = document.getElementById(`row-${userId}`);
        const roleChecks = row.querySelectorAll('.inline-role');
        const barSelect = row.querySelector('.inline-bar-select');
        const saveBtn = row.querySelector('button'); // First button is Save

        const newRoles = [];
        roleChecks.forEach(cb => {
            if (cb.checked) newRoles.push(cb.dataset.role);
        });
        if (newRoles.length === 0) newRoles.push('reader'); // Default

        const newBarId = barSelect.value;

        saveBtn.textContent = '...';
        saveBtn.disabled = true;

        try {
            // 1. Update Roles
            const { error: userError } = await supabase
                .from('users')
                .update({ roles: newRoles })
                .eq('id', userId);
            if (userError) throw userError;

            // 2. Update Bar Link
            // First, remove any existing ownership for this user (optional, depends on logic)
            // For now, we assume 1 bar per owner for simplicity in this UI

            // If we want to support multiple bars, this UI (single select) is limiting.
            // But based on "Linked Bar" column, it implies single link display.
            // Let's stick to the previous logic: Update the BAR's owner_user_id.

            // A. If user had a bar, unset it?
            // This is tricky. If we change the dropdown, we want the NEW bar to be owned by this user.
            // What about the OLD bar? It should probably be unset.
            // But we don't know the old bar easily here without fetching.
            // Let's just set the NEW bar's owner.

            if (newBarId) {
                // Set new bar owner
                const { error: barError } = await supabase
                    .from('bars')
                    .update({ owner_user_id: userId })
                    .eq('id', newBarId);
                if (barError) throw barError;
            }

            // Note: If user deselected a bar (set to None), we should find the bar they owned and unset it.
            // This requires a bit more logic. For now, let's assume adding/switching.
            // To handle "None", we'd need to know which bar they currently own.

            alert('Updated!');
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            saveBtn.textContent = 'Save';
            saveBtn.disabled = false;
        }
    };

    // Add User
    addUserBtn.addEventListener('click', async () => {
        if (!supabase) { alert('Connect DB first'); return; }

        // Load bars for dropdown
        const { data: bars } = await supabase.from('bars').select('id, title, name_en');
        userBarSelect.innerHTML = '<option value="">None</option>' +
            (bars || []).map(b => `<option value="${b.id}">${b.name_en || b.title}</option>`).join('');

        document.getElementById('user-modal-title').textContent = 'Add User';
        document.getElementById('user-id').value = '';
        document.getElementById('user-email').value = '';
        document.getElementById('user-password').value = '';

        // Reset Checkboxes (Default to Reader)
        document.querySelectorAll('.role-checkbox').forEach(cb => cb.checked = false);
        document.querySelector('.role-checkbox[value="reader"]').checked = true;

        userModal.classList.add('active');
    });

    closeUserBtn.addEventListener('click', () => {
        userModal.classList.remove('active');
    });

    saveUserBtn.addEventListener('click', async () => {
        const id = document.getElementById('user-id').value;
        const email = document.getElementById('user-email').value;
        const password = document.getElementById('user-password').value;

        // Get selected roles
        const roles = Array.from(document.querySelectorAll('.role-checkbox:checked')).map(cb => cb.value);
        if (roles.length === 0) roles.push('reader'); // Default

        const barId = document.getElementById('user-bar-select').value;

        saveUserBtn.textContent = 'Saving...';
        saveUserBtn.disabled = true;

        try {
            let userId = id;

            if (!id) {
                // Create New User
                if (!password) throw new Error('Password required for new user');
                const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
                if (authError) throw authError;
                if (!authData.user) throw new Error('User creation failed');
                userId = authData.user.id;

                // Create Profile
                const { error: profileError } = await supabase.from('users').insert([
                    { id: userId, email, roles, name: email.split('@')[0] }
                ]);
                if (profileError) throw profileError;

            } else {
                // Update Existing User
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ roles, email })
                    .eq('id', id);
                if (updateError) throw updateError;
            }

            // Link Bar (Update bars table)
            if (barId) {
                const { error: linkError } = await supabase
                    .from('bars')
                    .update({ owner_user_id: userId })
                    .eq('id', barId);
                if (linkError) throw linkError;
            }

            alert('User Saved!');
            userModal.classList.remove('active');
            loadUsers();

        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            saveUserBtn.textContent = 'Save';
            saveUserBtn.disabled = false;
        }
    });

    // Expose Edit/Delete
    window.editUser = async (id) => {
        const { data: user } = await supabase.from('users').select('*').eq('id', id).single();
        if (!user) return;

        // Load bars
        const { data: bars } = await supabase.from('bars').select('id, title, name_en');
        userBarSelect.innerHTML = '<option value="">None</option>' +
            (bars || []).map(b => `<option value="${b.id}">${b.name_en || b.title}</option>`).join('');

        const { data: ownedBar } = await supabase.from('bars').select('id').eq('owner_user_id', id).maybeSingle();

        document.getElementById('user-modal-title').textContent = 'Edit User';
        document.getElementById('user-id').value = user.id;
        document.getElementById('user-email').value = user.email;
        document.getElementById('user-password').value = '';

        // Set Checkboxes
        document.querySelectorAll('.role-checkbox').forEach(cb => {
            cb.checked = (user.roles || []).includes(cb.value);
        });

        document.getElementById('user-bar-select').value = ownedBar ? ownedBar.id : '';

        userModal.classList.add('active');
    };

    window.deleteUser = async (id) => {
        if (!confirm('Are you sure? This will remove the user from the database (but not Supabase Auth).')) return;

        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else loadUsers();
    };

    // --- Article Management Logic (CMS) ---
    const manageArticlesBtn = document.getElementById('manage-articles-btn');
    const articlesSection = document.getElementById('articles-section');
    const articleList = document.getElementById('article-list');
    const addArticleBtn = document.getElementById('add-article-btn');

    manageArticlesBtn.addEventListener('click', () => {
        // Hide others
        barListSection.style.display = 'none';
        usersSection.style.display = 'none';

        articlesSection.style.display = 'block';
        document.querySelector('#dashboard-section h2').textContent = 'Manage Stories';
        loadArticles();
    });

    // For now, let's implement the logic.

    async function loadArticles() {
        articleList.innerHTML = '<p style="color: #888;">Loading stories...</p>';

        if (!supabase) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const userId = session.user.id;

        // Check if user is admin
        const { data: user } = await supabase.from('users').select('roles').eq('id', userId).single();
        const isAdmin = user && user.roles && user.roles.includes('admin');

        let query = supabase
            .from('articles')
            .select('*')
            .order('published_at', { ascending: false });

        // If not admin, only show own articles
        if (!isAdmin) {
            query = query.eq('author_id', userId);
        }

        const { data: articles, error } = await query;

        if (error) {
            articleList.innerHTML = `<p style="color: #ff4444;">Error: ${error.message}</p>`;
            return;
        }

        if (articles.length === 0) {
            articleList.innerHTML = '<p style="color: #888;">No stories found.</p>';
            return;
        }

        articleList.innerHTML = articles.map(article => {
            const thumbStyle = article.cover_image ? `background-image: url('${article.cover_image}')` : '';
            const tagsHtml = (article.tags || []).map(t => `<span class="tag-badge">${t}</span>`).join('');
            const isPublished = article.status === 'published';
            const statusColor = isPublished ? '#4cd964' : '#666';
            const statusText = isPublished ? 'Published' : 'Draft';

            return `
            <div class="article-item">
                <div class="article-thumb" style="${thumbStyle}"></div>
                
                <div class="article-info">
                    <h4>${article.title}</h4>
                    <div class="article-meta">
                        <span>${new Date(article.published_at || article.created_at).toLocaleDateString()}</span>
                        ${article.updated_at ? `<span style="color: #999; font-size: 0.9em;">(Updated: ${new Date(article.updated_at).toLocaleDateString()})</span>` : ''}
                        ${article.author_name ? `<span>by ${article.author_name}</span>` : ''}
                        ${tagsHtml}
                    </div>
                </div>

                <div class="article-status">
                    <label class="status-toggle" onclick="toggleArticleStatus('${article.id}', '${article.status}')">
                        <input type="checkbox" ${isPublished ? 'checked' : ''}>
                        <span class="status-slider"></span>
                        <span class="status-label" style="color: ${statusColor}">${statusText}</span>
                    </label>
                </div>

                <div class="article-actions">
                    <button onclick="viewArticle('${article.id}')" class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.8em; margin-right: 5px;">View</button>
                    <button onclick="editArticle('${article.id}')" class="btn" style="padding: 5px 10px; font-size: 0.8em; margin-right: 5px;">Edit</button>
                    <button onclick="deleteArticle('${article.id}')" class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.8em; color: #ff4444; border-color: #ff4444;">Delete</button>
                </div>
            </div>
        `}).join('');
    }

    if (addArticleBtn) {
        addArticleBtn.addEventListener('click', () => {
            console.log('Add Story clicked, redirecting to cms.html');
            window.location.href = 'cms.html';
        });
    } else {
        console.error('Add Article Button not found!');
    }

    window.viewArticle = (id) => {
        window.location.href = `journal-details.html?id=${id}`;
    };

    window.editArticle = (id) => {
        window.location.href = `cms.html?id=${id}`;
    };

    window.toggleArticleStatus = async (id, currentStatus) => {
        // Prevent event bubbling if needed, but here we clicked the label
        // Actually, the checkbox change event is better, but onclick on label works for simple toggle logic
        // Let's use a more robust approach: find the checkbox and toggle it
        // But since we re-render, let's just do the update

        const newStatus = currentStatus === 'published' ? 'draft' : 'published';

        // Optimistic UI update (optional, but we re-render anyway)

        const { error } = await supabase
            .from('articles')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) {
            alert('Error updating status: ' + error.message);
        } else {
            loadArticles(); // Reload to reflect changes
        }
    };

    window.deleteArticle = async (id) => {
        if (!confirm('Are you sure?')) return;
        const { error } = await supabase.from('articles').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else loadArticles();
    };

    // Manage Bars Button
    const manageBarsBtn = document.getElementById('manage-bars-btn');
    if (manageBarsBtn) {
        manageBarsBtn.addEventListener('click', () => {
            usersSection.style.display = 'none';
            articlesSection.style.display = 'none';
            barListSection.style.display = 'grid';
            document.querySelector('#dashboard-section h2').textContent = 'Manage Bars';
            loadBars();
        });
    }

    // Start Auth Check
    checkLogin();
});
