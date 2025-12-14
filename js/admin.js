document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const SUPABASE_URL = 'https://wgnskednopbfngvjmviq.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.supabaseClient = supabase; // Expose for shared scripts like talent_editor.js

    // --- Elements ---
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const googleLoginBtn = document.getElementById('google-login-btn');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // Dashboard Elements
    const barListFull = document.getElementById('bar-list-full');
    const articleListFull = document.getElementById('article-list-full');
    const addBarBtn = document.getElementById('add-bar-btn');
    const addJournalBtn = document.getElementById('add-journal-btn');

    // --- Auth Logic ---

    // 1. Listen for Auth Changes (Redirects, Logouts)
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            verifyAccess(session.user);
        } else {
            showLogin();
        }
    });

    function showLogin() {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }

    async function verifyAccess(user) {
        try {
            // Fetch User Profile & Roles
            let { data: profile, error } = await supabase
                .from('users')
                .select('roles')
                .eq('id', user.id)
                .single();

            // Auto-Backfill: If profile missing, create it
            if (!profile) {
                console.warn('Profile missing. Backfilling...');
                const { error: insertError } = await supabase.from('users').insert([
                    { id: user.id, email: user.email, roles: ['member'] }
                ]);
                if (!insertError) {
                    profile = { roles: ['member'] }; // Assume reader default
                } else {
                    console.error('Backfill failed:', insertError);
                    alert('Error setting up user profile. Please contact support.');
                    return;
                }
            }

            const roles = profile.roles || [];

            // Check Permissions
            const isAdmin = roles.includes('admin');
            const isEditor = roles.includes('editor');

            if (isAdmin || isEditor) {
                showDashboard(user, roles);
            } else {
                // Not authorized for Admin Panel -> Redirect to Profile
                console.log('User is not admin/editor. Redirecting to profile...');
                window.location.href = 'profile.html';
            }

        } catch (err) {
            console.error('Verification Error:', err);
            alert('Authentication check failed.');
        }
    }

    function showDashboard(user, roles) {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';

        // Initial Load: Dashboard Stats
        switchView('dashboard');
        loadDashboardStats();
    }

    // --- View Navigation ---
    window.switchView = (viewName) => {
        // Toggle Tabs
        document.querySelectorAll('.nav-tab').forEach(btn => {
            btn.style.background = 'transparent';
            btn.style.color = '#fff';
            btn.classList.remove('active-tab');
        });
        const activeBtn = document.getElementById(`nav-${viewName}`);
        if (activeBtn) {
            activeBtn.style.background = '#fff';
            activeBtn.style.color = 'var(--bg-red)';
            activeBtn.classList.add('active-tab');
        }

        // Toggle Views
        ['dashboard', 'bars', 'talents', 'articles', 'users'].forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (el) el.style.display = (v === viewName) ? 'block' : 'none';
        });

        // Load Data on Demand
        if (viewName === 'bars') loadBars();
        if (viewName === 'talents') loadTalents();
        if (viewName === 'articles') loadArticles();
        if (viewName === 'users') loadUsers();
        if (viewName === 'dashboard') loadDashboardStats();
    };

    // --- Dashboard Stats & latest 5 ---
    async function loadDashboardStats() {
        // 1. Counts
        const { count: barCount } = await supabase.from('bars').select('*', { count: 'exact', head: true });
        const { count: talentCount } = await supabase.from('talents').select('*', { count: 'exact', head: true });
        const { count: articleCount } = await supabase.from('articles').select('*', { count: 'exact', head: true });
        const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });

        document.getElementById('stat-bars-count').innerText = barCount || 0;
        document.getElementById('stat-talents-count').innerText = talentCount || 0;
        document.getElementById('stat-articles-count').innerText = articleCount || 0;
        document.getElementById('stat-users-count').innerText = userCount || 0;

        // 2. Latest 5
        // Bars
        // Use select('*') to avoid 400 error if specific columns (like liquid_arts_score) are missing in DB schema
        const { data: latestBars } = await supabase.from('bars').select('*').order('created_at', { ascending: false }).limit(5);
        if (latestBars) {
            document.getElementById('latest-bars-list').innerHTML = latestBars.map(b => {
                // Fix: Use Coordinate-based City Logic
                const city = getCityFromCoords(b.lat, b.lng) || getCityDisplay(b.location);
                const score = b.liquid_arts_score ? `LA Score: ${b.liquid_arts_score}` : 'Unrated';

                return `
                <div class="article-item" style="display: flex; gap: 1rem; padding: 10px; background: #fafafa; border-radius: 6px; border: 1px solid #eee;">
                    <div style="width: 50px; height: 50px; background: #eee url('${b.image || 'assets/gallery_1.png'}') center/cover; border-radius: 4px; flex-shrink: 0;"></div>
                    <div style="flex: 1; overflow: hidden;">
                        <h4 style="margin: 0 0 2px 0; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${b.title}</h4>
                        <div style="font-size: 0.8rem; color: #666; display: flex; align-items: center; gap: 5px;">
                           <span>${city}</span> • <span style="color: var(--bg-red); font-weight: 500;">${score}</span>
                        </div>
                    </div>
                     <div style="display: flex; align-items: center; gap: 5px;">
                        <button onclick="window.open('bar.html?id=${b.id}', '_blank')" style="background:none; border:none; cursor:pointer; font-size: 1.1rem;" title="View Frontend">👁️</button>
                        <button onclick="editBar('${b.id}')" style="background:none; border:none; cursor:pointer; font-size: 1.1rem;" title="Edit Backend">✏️</button>
                    </div>
                </div>
                `;
            }).join('');
        }

        // Talents
        const { data: latestTalents } = await supabase.from('talents').select('id, display_name, image_url, created_at, user_id').order('created_at', { ascending: false }).limit(5);
        if (latestTalents) {
            document.getElementById('latest-talents-list').innerHTML = latestTalents.map(t => `
                <div style="display: flex; gap: 10px; background: #fafafa; padding: 10px; border-radius: 6px; border: 1px solid #eee;">
                    <div style="width: 50px; height: 50px; background: #eee url('${t.image_url || ''}') center/cover; border-radius: 50%; flex-shrink: 0;"></div>
                    <div style="flex: 1;">
                        <div style="font-weight: 500; margin-top: 5px;">${t.display_name}</div>
                        <div style="font-size: 0.8rem; color: #999;">${new Date(t.created_at).toLocaleDateString()}</div>
                    </div>
                     <div style="display: flex; align-items: center; gap: 5px;">
                        <button onclick="window.open('talent.html?id=${t.user_id}', '_blank')" style="background:none; border:none; cursor:pointer; font-size: 1.1rem;" title="View">👁️</button>
                        <button onclick="window.openTalentEditor('${t.user_id}')" style="background:none; border:none; cursor:pointer; font-size: 1.1rem;" title="Edit">✏️</button>
                    </div>
                </div>
            `).join('');
        }

        // Articles
        const { data: latestArts } = await supabase.from('articles').select('id, title, cover_image, author_name, created_at, category').order('created_at', { ascending: false }).limit(5);
        if (latestArts) {
            document.getElementById('latest-articles-list').innerHTML = latestArts.map(a => `
                <div style="display: flex; gap: 10px; background: #fafafa; padding: 10px; border-radius: 6px; border: 1px solid #eee;">
                    <div style="width: 50px; height: 50px; background: #eee url('${a.cover_image || ''}') center/cover; border-radius: 4px; flex-shrink: 0;"></div>
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${a.title}</div>
                        <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 0.8rem; color: #666;">
                            <span>${a.author_name || 'Unknown'}</span>
                            <span style="background: #e0e0e0; padding: 1px 6px; border-radius: 4px; font-size: 0.7rem;">${a.category}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <button onclick="window.open('journal-details.html?id=${a.id}', '_blank')" style="background:none; border:none; cursor:pointer; font-size: 1.1rem;" title="View">👁️</button>
                        <button onclick="editArticle('${a.id}')" style="background:none; border:none; cursor:pointer; font-size: 1.1rem;" title="Edit">✏️</button>
                    </div>
                </div>
            `).join('');
        }

        // Users
        const { data: latestUsers } = await supabase.from('users').select('id, email, hopper_nickname, hopper_image_url, created_at').order('created_at', { ascending: false }).limit(5);
        if (latestUsers) {
            document.getElementById('latest-users-list').innerHTML = latestUsers.map(u => `
                 <div style="display: flex; gap: 10px; background: #fafafa; padding: 10px; border-radius: 6px; border: 1px solid #eee;">
                     <div style="width: 50px; height: 50px; background: #eee url('${u.hopper_image_url || 'https://placehold.co/100x100?text=User'}') center/cover; border-radius: 50%; flex-shrink: 0;"></div>
                     <div style="flex: 1; overflow: hidden;">
                         <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${u.hopper_nickname || u.email.split('@')[0]}</div>
                         <div style="font-size: 0.8rem; color: #999;">${u.email}</div>
                     </div>
                     <div style="display: flex; align-items: center; gap: 5px;">
                        <!-- No public view for generic users usually, but let's add minimal set -->
                        <button onclick="editUser('${u.id}')" style="background:none; border:none; cursor:pointer; font-size: 1.1rem;" title="Edit">✏️</button>
                    </div>
                 </div>
             `).join('');
        }
    }

    // --- Data Loading ---

    async function loadBars() {
        const barListFull = document.getElementById('bar-list-full');
        barListFull.innerHTML = '<p style="color:#888">Loading bars...</p>';

        const { data: bars, error } = await supabase
            .from('bars')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            barListFull.innerHTML = `<p style="color:red">Error: ${error.message}</p>`;
            return;
        }

        if (!bars || bars.length === 0) {
            barListFull.innerHTML = '<p>No bars found.</p>';
            return;
        }

        barListFull.innerHTML = bars.map(bar => {
            const isPublished = bar.is_published !== false; // Default true
            const statusText = isPublished ? 'Published' : 'Hidden';

            return `
            <div class="article-item" style="display: flex; gap: 1rem; margin-bottom: 1.5rem; background: #fff; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <div style="width: 100px; height: 100px; background-image: url('${bar.image || ''}'); background-size: cover; background-position: center; border-radius: 8px; flex-shrink: 0; background-color: #eee;"></div>
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between;">
                        <h4 style="margin: 0 0 5px 0; font-size: 1.2rem; font-weight: 600;">${bar.title}</h4>
                         ${bar.liquid_arts_score ? `<span style="color:var(--bg-red); font-weight:700;">★ ${bar.liquid_arts_score}</span>` : '<span style="color:#999; font-size:0.8rem;">Unrated</span>'}
                    </div>
                    <p style="margin: 0 0 5px 0; color: #555;">${getCityFromCoords(bar.lat, bar.lng) || getCityDisplay(bar.location)}</p>
                    
                    <div style="margin-top: 10px; display: flex; align-items: center; gap: 15px;">
                        <!-- Publish Toggle -->
                        <label class="status-toggle" onclick="toggleBarStatus('${bar.id}', ${isPublished})">
                            <input type="checkbox" ${isPublished ? 'checked' : ''}>
                            <span class="status-slider"></span>
                            <span class="status-label" style="color: ${isPublished ? '#ff3b30' : '#888'}">${statusText}</span>
                        </label>

                        <div style="margin-left: auto; display: flex; gap: 8px;">
                            <button onclick="window.open('bar.html?id=${bar.id}', '_blank')" class="btn btn-secondary" title="View Frontend">👁️</button>
                            <button onclick="editBar('${bar.id}')" class="btn" title="Edit Backend">✏️</button>
                            <button onclick="deleteBar('${bar.id}')" class="btn btn-secondary" style="color:red;" title="Delete">🗑️</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    }

    async function loadArticles(user, roles) {
        const articleListFull = document.getElementById('article-list-full');
        articleListFull.innerHTML = '<p style="color:#888">Loading articles...</p>';

        let query = supabase.from('articles').select('*').order('published_at', { ascending: false });

        const { data: articles, error } = await query;

        if (error) {
            articleListFull.innerHTML = `<p style="color:red">Error: ${error.message}</p>`;
            return;
        }

        if (!articles || articles.length === 0) {
            articleListFull.innerHTML = '<p>No stories found.</p>';
            return;
        }

        articleListFull.innerHTML = articles.map(art => {
            const isPublished = art.status === 'published';
            const statusText = isPublished ? 'Published' : 'Draft';

            // Date Logic: If Event, show range. Else show published date.
            let dateDisplay = '';
            if (art.category === 'Event' && art.start_date) {
                const start = new Date(art.start_date).toLocaleDateString();
                const end = art.end_date ? new Date(art.end_date).toLocaleDateString() : 'TBD';
                dateDisplay = `${start} - ${end}`;
            } else {
                dateDisplay = new Date(art.published_at || art.created_at).toLocaleDateString();
            }

            return `
            <div class="article-item" style="display: flex; gap: 1rem; margin-bottom: 1.5rem; background: #fff; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <div style="width: 100px; height: 100px; background-image: url('${art.cover_image || ''}'); background-size: cover; background-position: center; border-radius: 8px; flex-shrink: 0; background-color: #eee;"></div>
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <h4 style="margin: 0 0 5px 0; font-size: 1.2rem; font-weight: 600;">${art.title}</h4>
                        <span style="font-size: 0.8rem; background: #eee; padding: 2px 8px; border-radius: 4px; color: #555;">${art.category || 'Uncategorized'}</span>
                    </div>
                    
                    <div style="font-size: 0.85rem; color: #666; margin-bottom: 8px;">
                        <span style="font-weight: 600; color: #333;">${dateDisplay}</span> • <span>${art.author_name || 'Unknown Author'}</span>
                    </div>

                    <div style="margin-top: 10px; display: flex; align-items: center; gap: 15px;">
                        <!-- Publish Toggle -->
                        <label class="status-toggle" onclick="toggleArticleStatus('${art.id}', '${art.status}')">
                            <input type="checkbox" ${isPublished ? 'checked' : ''}>
                            <span class="status-slider"></span>
                            <span class="status-label" style="color: ${isPublished ? '#ff3b30' : '#888'}">${statusText}</span>
                        </label>

                         <div style="margin-left: auto; display: flex; gap: 8px;">
                            <button onclick="window.open('journal-details.html?id=${art.id}', '_blank')" class="btn btn-secondary" title="View">👁️</button>
                            <button onclick="editArticle('${art.id}')" class="btn" title="Edit">✏️</button>
                            <button onclick="deleteArticle('${art.id}')" class="btn btn-secondary" title="Delete">🗑️</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    }

    // --- Toggle Logic ---
    window.toggleBarStatus = async (id, currentStatus) => {
        // currentStatus is boolean
        const newStatus = !currentStatus;
        const { error } = await supabase.from('bars').update({ is_published: newStatus }).eq('id', id);
        if (error) alert('Error: ' + error.message);
        else loadBars();
    };

    window.toggleArticleStatus = async (id, currentStatus) => {
        // currentStatus is string 'published'/'draft'
        const newStatus = currentStatus === 'published' ? 'draft' : 'published';
        const { error } = await supabase.from('articles').update({ status: newStatus }).eq('id', id);
        if (error) alert('Error: ' + error.message);
        else loadArticles(null, []); // Reload, args handled by closure access if needed or simple global
        // Note: loadArticles doesn't actually use user/roles in the current impl (admin sees all), so it's safe.
    };

    // --- Actions ---

    // Google Login
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.href }
            });
            if (error) alert('Login Error: ' + error.message);
        });
    }

    // Email Login
    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        if (!email || !password) return alert('Please enter email and password');

        loginBtn.textContent = 'Logging in...';
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            alert('Error: ' + error.message);
            loginBtn.textContent = 'LOGIN';
        }
        // Listener handles success
    });

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.reload();
        });
    }

    // Navigation Buttons
    addBarBtn.addEventListener('click', () => { window.location.href = 'bms.html'; });
    addJournalBtn.addEventListener('click', () => { window.location.href = 'cms.html'; });

    // --- User Management Logic ---
    // const usersSection = document.getElementById('users-section'); // Legacy
    // const userList = document.getElementById('user-list'); // Legacy
    const userModal = document.getElementById('user-modal');
    const addUserBtn = document.getElementById('add-user-btn');
    const saveUserBtn = document.getElementById('save-user-btn');
    const closeUserBtn = document.getElementById('close-user-btn');

    // Show Users Section if Admin // TODO: Add a button/tab to toggle views if needed, for now just load it
    // Actually, we need a way to navigate to "Users". Let's add it to Dashboard if Admin.

    // Function to check and load Users section
    function initUserManagement(roles) {
        if (roles.includes('admin')) {
            // Create "Manage Users" button in Dashboard if not exists
            if (!document.getElementById('manage-users-btn')) {
                const btn = document.createElement('button');
                btn.id = 'manage-users-btn';
                btn.className = 'btn btn-secondary';
                btn.textContent = 'Manage Users';
                btn.style.marginLeft = '10px';
                btn.onclick = () => {
                    document.querySelector('.dash-grid').style.display = 'none';
                    document.getElementById('articles-section').style.display = 'none';
                    usersSection.style.display = 'block';
                    loadUsers();
                };
                // Add to header actions
                document.querySelector('.dash-header > div').appendChild(btn);
            }
        }
    }

    // Hook into showDashboard
    const originalShowDashboard = showDashboard;
    showDashboard = function (user, roles) {
        originalShowDashboard(user, roles);
        // initUserManagement(roles); // Removed legacy logic
    };

    addUserBtn.addEventListener('click', () => {
        openUserModal();
    });

    closeUserBtn.addEventListener('click', () => {
        userModal.classList.remove('active');
    });

    async function loadUsers() {
        const userListFull = document.getElementById('user-list-full');
        userListFull.innerHTML = '<tr><td colspan="4" style="padding:1rem;">Loading...</td></tr>';

        // Fetch Users and their Linked Bars (if any)
        const { data: users, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
        // Fetch bars to map owners
        const { data: bars } = await supabase.from('bars').select('id, title, owner_user_id');

        if (error) {
            userListFull.innerHTML = `<p style="color:red">Error: ${error.message}</p>`;
            return;
        }

        userListFull.innerHTML = users.map(u => {
            const linkedBar = bars ? bars.find(b => b.owner_user_id === u.id) : null;
            const roleBadges = (u.roles || []).map(r =>
                `<span class="tag-badge" style="background:${getRoleColor(r)}; color:white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">${r}</span>`
            ).join(' ');

            const isTalent = (u.roles || []).some(r => ['talent', 'kol'].includes(r));
            const hopperName = u.hopper_nickname || 'No Hopper Name';
            const hopperImg = u.hopper_image_url || 'https://placehold.co/100x100?text=User';

            return `
            <div class="article-item" style="display: flex; gap: 1rem; margin-bottom: 1.5rem; background: #fff; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <div style="width: 80px; height: 80px; background: #eee url('${hopperImg}') center/cover; border-radius: 50%; flex-shrink: 0;"></div>
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between;">
                        <h4 style="margin: 0 0 5px 0;">${hopperName} <span style="font-weight:400; font-size:0.9rem; color:#888;">(${u.email})</span></h4>
                        <div style="display:flex; gap:5px;">${roleBadges}</div>
                    </div>
                    <p style="margin: 0; color: #666; font-size: 0.9rem;">
                        Linked Bar: ${linkedBar ? linkedBar.title : 'None'}
                    </p>
                    
                    <div style="margin-top: 10px; display: flex; gap: 10px;">
                        ${isTalent ? `<button onclick="window.openTalentEditor('${u.id}')" class="btn btn-secondary" style="padding:4px 10px;" title="Edit Talent Profile">🎭 Talent</button>` : ''}
                        <button onclick="window.openHopperModal('${u.id}')" class="btn btn-secondary" style="padding:4px 10px;" title="Edit Hopper Profile">🐇 Hopper</button>
                        <button onclick="editUser('${u.id}')" class="btn btn-secondary" style="padding:4px 10px;" title="Edit User Settings">✏️ Edit</button>
                        <button onclick="deleteUser('${u.id}')" class="btn btn-secondary" style="padding:4px 10px; color:red;" title="Delete User">🗑️</button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    function getRoleColor(role) {
        switch (role) {
            case 'admin': return '#000';
            case 'editor': return '#4caf50';
            case 'talent': return '#9c100f'; // Brand Red
            case 'kol': return '#9c27b0';
            default: return '#999';
        }
    }

    async function openUserModal(userId = null) {
        // Reset Form
        document.getElementById('user-id').value = '';
        document.getElementById('user-email').value = '';
        document.getElementById('user-password').value = '';
        document.querySelectorAll('.role-checkbox').forEach(cb => cb.checked = false);
        window.hopperCropper = null; // Reset cropper global
        document.getElementById('hopper-crop-container').style.display = 'none';

        // Load Bars logic for Multi-Select
        const barContainer = document.getElementById('bar-select-container');
        barContainer.innerHTML = '<p style="color: #999; font-size: 0.9rem;">Loading bars...</p>';

        const { data: allBars } = await supabase.from('bars').select('id, title, owner_user_id').order('title');

        // If editing, find currently owned bars
        let ownedBarIds = new Set();
        if (userId) {
            const { data: userBars } = await supabase.from('bars').select('id').eq('owner_user_id', userId);
            if (userBars) userBars.forEach(b => ownedBarIds.add(b.id));
        }

        if (allBars) {
            barContainer.innerHTML = '';
            if (allBars.length === 0) {
                barContainer.innerHTML = '<p style="color: #999; font-size: 0.9rem;">No bars available.</p>';
            } else {
                allBars.forEach(b => {
                    const isChecked = ownedBarIds.has(b.id);
                    // Show if owned by THIS user, OR if not owned by anyone (available)
                    // But actually, Admin might want to override ownership. 
                    // Let's show ALL bars, but mark if owned by someone else?
                    // For simplicity: Show All.

                    const div = document.createElement('div');
                    div.style.marginBottom = '5px';
                    div.innerHTML = `
                        <label style="display: flex; align-items: center; cursor: pointer; font-size: 0.9rem; color: #333;">
                            <input type="checkbox" class="bar-checkbox" value="${b.id}" ${isChecked ? 'checked' : ''} style="margin-right: 8px;">
                            ${b.title} 
                            ${(b.owner_user_id && b.owner_user_id !== userId) ? '<span style="color:red; font-size:0.8rem; margin-left:5px;">(Owned by other)</span>' : ''}
                        </label>
                    `;
                    barContainer.appendChild(div);
                });
            }
        }

        if (userId) {
            document.getElementById('user-modal-title').textContent = 'Edit User';
            document.getElementById('user-id').value = userId;

            const { data: user, error } = await supabase.from('users').select('*').eq('id', userId).single();
            if (user) {
                document.getElementById('user-email').value = user.email;
                if (user.roles) {
                    user.roles.forEach(r => {
                        const cb = document.querySelector(`.role-checkbox[value="${r}"]`);
                        if (cb) cb.checked = true;
                    });
                }
            }
        } else {
            document.getElementById('user-modal-title').textContent = 'Add User';
        }

        // Enforce 'member' role: Always checked and disabled
        const memberCb = document.querySelector(`.role-checkbox[value="member"]`);
        if (memberCb) {
            memberCb.checked = true;
            memberCb.disabled = true; // User cannot uncheck it
        }

        userModal.classList.add('active');
    }

    // --- Hopper Modal Logic ---
    window.openHopperModal = async (userId) => {
        // Reset
        document.getElementById('hopper-user-id').value = userId;
        document.getElementById('hopper-nickname').value = '';
        document.getElementById('hopper-preview').src = '';
        document.getElementById('hopper-preview').style.display = 'none';
        document.getElementById('hopper-upload-placeholder').style.display = 'block';
        if (window.hopperCropper) { window.hopperCropper.destroy(); window.hopperCropper = null; }
        document.getElementById('hopper-crop-container').style.display = 'none';

        // Fetch
        const { data: user, error } = await supabase.from('users').select('*').eq('id', userId).single();
        if (user) {
            document.getElementById('hopper-nickname').value = user.hopper_nickname || '';
            if (user.hopper_image_url) {
                const img = document.getElementById('hopper-preview');
                img.src = user.hopper_image_url;
                img.style.display = 'block';
                document.getElementById('hopper-upload-placeholder').style.display = 'none';
            }
        } else {
            alert('User not found.');
            return;
        }

        document.getElementById('hopper-modal').classList.add('active');
    };

    document.getElementById('close-hopper-btn').addEventListener('click', () => {
        document.getElementById('hopper-modal').classList.remove('active');
    });

    document.getElementById('save-hopper-btn').addEventListener('click', async () => {
        const btn = document.getElementById('save-hopper-btn');
        const id = document.getElementById('hopper-user-id').value;
        const nickname = document.getElementById('hopper-nickname').value;

        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
            const updates = { hopper_nickname: nickname };

            // Upload Image if changed (window.hopperImageBlob set by cropper confirmation)
            if (window.hopperImageBlob) {
                const fileName = `hopper_${id}_${Date.now()}.jpg`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('hoppings')
                    .upload(fileName, window.hopperImageBlob);

                if (uploadError) {
                    console.error('Upload failed:', uploadError);
                    alert('Image upload failed, but saving text data.');
                } else {
                    const publicUrl = supabase.storage.from('hoppings').getPublicUrl(fileName).data.publicUrl;
                    updates.hopper_image_url = publicUrl;
                }
            }

            const { error } = await supabase.from('users').update(updates).eq('id', id);
            if (error) throw error;

            document.getElementById('hopper-modal').classList.remove('active');
            window.hopperImageBlob = null; // Clear
            alert('Hopper Profile Saved!');
            loadUsers(); // Refresh list to maybe show changes if we decide to show hopper nickname in table
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            btn.textContent = 'Save Hopper';
            btn.disabled = false;
        }
    });

    function getCityDisplay(locationString) {
        if (!locationString) return 'Unknown City';
        if (locationString.includes('Taipei')) return 'Taipei';
        if (locationString.includes('Kaohsiung')) return 'Kaohsiung';
        if (locationString.includes('Taichung')) return 'Taichung';
        if (locationString.includes('Tainan')) return 'Tainan';
        return locationString.split(',')[0].trim();
    }

    // New: Coordinate-based City Logic
    function getCityFromCoords(lat, lng) {
        if (!lat || !lng) return null; // Fallback to getCityDisplay if no coords

        // Simple Haversine-like or distance check to major cities
        const cities = [
            { name: 'Taipei', lat: 25.0330, lng: 121.5654 },
            { name: 'New Taipei', lat: 25.0120, lng: 121.4657 },
            { name: 'Taoyuan', lat: 24.9936, lng: 121.3000 },
            { name: 'Taichung', lat: 24.1477, lng: 120.6736 },
            { name: 'Tainan', lat: 22.9997, lng: 120.2270 },
            { name: 'Kaohsiung', lat: 22.6273, lng: 120.3014 },
            { name: 'Hsinchu', lat: 24.8138, lng: 120.9675 },
            { name: 'Keelung', lat: 25.1276, lng: 121.7392 }
        ];

        let closest = null;
        let minDist = Infinity;

        cities.forEach(c => {
            const dist = Math.sqrt(Math.pow(c.lat - lat, 2) + Math.pow(c.lng - lng, 2));
            if (dist < minDist) {
                minDist = dist;
                closest = c;
            }
        });

        // Threshold: approx 0.3 degrees (~30km)
        if (closest && minDist < 0.3) {
            return closest.name;
        }
        return 'Taiwan'; // Value outside major cities
    }

    async function loadTalents() {
        const listContainer = document.getElementById('talent-list-full');
        listContainer.innerHTML = '<p>Loading talents...</p>';

        const { data: talents, error } = await supabase.from('talents').select('*').order('created_at', { ascending: false });

        if (error) {
            listContainer.innerHTML = `<p style="color:red">Error: ${error.message}</p>`;
            return;
        }

        if (!talents || talents.length === 0) {
            listContainer.innerHTML = '<p>No talents found.</p>';
            return;
        }

        listContainer.innerHTML = talents.map(t => `
            <div class="article-item" style="display: flex; gap: 1rem; margin-bottom: 1.5rem; background: #fff; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <div style="width: 80px; height: 80px; background: #eee url('${t.image_url || ''}') center/cover; border-radius: 50%; flex-shrink: 0;"></div>
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 5px 0;">${t.display_name}</h4>
                    <p style="margin: 0; color: #666; font-size: 0.9rem;">${t.quote || 'No Code'}</p>
                    <div style="margin-top: 10px;">
                        <button onclick="window.open('talent.html?id=${t.user_id}', '_blank')" class="btn btn-secondary" style="padding: 4px 10px;" title="View">👁️</button>
                         <button onclick="window.openTalentEditor('${t.user_id}')" class="btn btn-secondary" style="padding: 4px 10px;" title="Edit">✏️</button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    // --- Hopper Image Logic ---
    window.hopperCropper = null;
    window.hopperImageBlob = null; // Store final blob to upload

    window.handleHopperFile = (input) => {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const cropImg = document.getElementById('hopper-crop-img');
                const cropContainer = document.getElementById('hopper-crop-container');
                cropImg.src = e.target.result;
                cropContainer.style.display = 'block';

                if (window.hopperCropper) window.hopperCropper.destroy();
                window.hopperCropper = new Cropper(cropImg, {
                    aspectRatio: 1,
                    viewMode: 1
                });
            };
            reader.readAsDataURL(input.files[0]);
        }
    };


    window.confirmHopperCrop = () => {
        if (!window.hopperCropper) return;
        window.hopperCropper.getCroppedCanvas({ width: 500, height: 500 }).toBlob((blob) => {
            window.hopperImageBlob = blob;

            // Show preview
            const url = URL.createObjectURL(blob);
            const preview = document.getElementById('hopper-preview');
            preview.src = url;
            preview.style.display = 'block';
            document.getElementById('hopper-upload-placeholder').style.display = 'none';

            // Hide cropper
            document.getElementById('hopper-crop-container').style.display = 'none';
            window.hopperCropper.destroy();
            window.hopperCropper = null;
        }, 'image/jpeg', 0.8);
    };

    window.cancelHopperCrop = () => {
        document.getElementById('hopper-crop-container').style.display = 'none';
        if (window.hopperCropper) {
            window.hopperCropper.destroy();
            window.hopperCropper = null;
        }
        document.getElementById('hopper-file-input').value = ''; // Reset input
    };

    saveUserBtn.onclick = async () => {
        const id = document.getElementById('user-id').value;
        const email = document.getElementById('user-email').value;
        const password = document.getElementById('user-password').value;

        // Multi-Bar Selection
        const selectedBarIds = Array.from(document.querySelectorAll('.bar-checkbox:checked')).map(cb => cb.value);

        // Get selected roles AND ensure 'member' is included
        const rolesSet = new Set(Array.from(document.querySelectorAll('.role-checkbox:checked')).map(cb => cb.value));
        rolesSet.add('member'); // Force member role
        const roles = Array.from(rolesSet);

        saveUserBtn.textContent = 'Saving...';

        try {
            let targetUserId = id;

            if (!id) {
                alert("Creating new users purely client-side logs you out. For this demo, please create user via Supabase Dashboard or Signup page.");
                saveUserBtn.textContent = 'Save';
                return;
            } else {
                // Update User Profile (Roles, Email) - Removed Hopper Logic
                const updates = {
                    roles: roles,
                    email: email
                };

                const { error } = await supabase.from('users').update(updates).eq('id', id);
                if (error) throw error;

                if (password) {
                    alert('Password update only possible by user themselves or Admin API.');
                }
            }

            // Handle Multi-Bar Linking
            // 1. Unlink ALL bars currently owned by this user
            await supabase.from('bars').update({ owner_user_id: null }).eq('owner_user_id', targetUserId);

            // 2. Link SELECTED bars to this user
            if (selectedBarIds.length > 0) {
                // Supabase 'in' filter for batch update?
                // update bars set owner_user_id = targetUserId where id in (selectedBarIds)
                const { error: linkError } = await supabase
                    .from('bars')
                    .update({ owner_user_id: targetUserId })
                    .in('id', selectedBarIds);

                if (linkError) throw linkError;
            }

            userModal.classList.remove('active');
            loadUsers();

        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            saveUserBtn.textContent = 'Save';
        }
    };

    window.editUser = (id) => openUserModal(id);
    window.deleteUser = async (id) => {
        if (confirm('Delete user? This removes them from the public table but Auth account remains.')) {
            await supabase.from('users').delete().eq('id', id);
            loadUsers();
        }
    };


    // --- Global Helpers for Onclick ---
    window.editBar = (id) => { window.location.href = `bms.html?id=${id}`; };
    window.deleteBar = async (id) => {
        if (!confirm('Delete this bar?')) return;
        const { error } = await supabase.from('bars').delete().eq('id', id);
        if (!error) loadBars();
        else alert(error.message);
    };

    window.editArticle = (id) => { window.location.href = `cms.html?id=${id}`; };
    window.deleteArticle = async (id) => {
        if (!confirm('Delete this article?')) return;
        const { error } = await supabase.from('articles').delete().eq('id', id);
        if (!error) loadArticles(); // We need to pass user/roles next time? No, assume state persistent or refetch. 
        // Actually simplest is to just Reload the list. We don't use user/roles in loadArticles query logic for Adming/Editor anyway.
        else alert(error.message);
    };

});
