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
        try {
            if (session) {
                verifyAccess(session.user);
            } else {
                showLogin();
            }
        } catch (err) {
            console.error('Auth State Change Error:', err);
            alert('Critical Error in Auth Logic: ' + err.message);
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
        ['dashboard', 'bars', 'articles', 'users'].forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (el) el.style.display = (v === viewName) ? 'block' : 'none';
        });

        // Load Data on Demand
        if (viewName === 'bars') loadBars();
        if (viewName === 'articles') loadArticles();
        if (viewName === 'users') loadUsers();
        if (viewName === 'dashboard') loadDashboardStats();
    };

    // --- Dashboard Stats & latest 5 ---
    async function loadDashboardStats() {
        // 1. Parallel Fetching for Speed
        const [
            { count: barCount },
            { count: talentCount },
            { count: articleCount },
            { count: userCount },
            { data: latestBars },
            { data: latestArticles },
            { data: latestUsers },
            { data: talData }
        ] = await Promise.all([
            supabase.from('bars').select('*', { count: 'exact', head: true }),
            supabase.from('talents').select('*', { count: 'exact', head: true }),
            supabase.from('articles').select('*', { count: 'exact', head: true }),
            supabase.from('users').select('*', { count: 'exact', head: true }),
            // Optimised Selects
            supabase.from('bars').select('*').order('created_at', { ascending: false }).limit(5),
            supabase.from('articles').select('*').order('created_at', { ascending: false }).limit(5),
            supabase.from('users').select('*').order('created_at', { ascending: false }).limit(5),
            supabase.from('talents').select('user_id, display_name')
        ]);

        document.getElementById('stat-bars-count').innerText = barCount || 0;
        document.getElementById('stat-articles-count').innerText = articleCount || 0;
        document.getElementById('stat-users-count').innerText = userCount || 0;

        // Icons
        const iconStyle = "width: 14px; height: 14px; stroke: #666; stroke-width: 2px;";
        const viewIcon = `<svg xmlns="http://www.w3.org/2000/svg" style="${iconStyle}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        const editIcon = `<svg xmlns="http://www.w3.org/2000/svg" style="${iconStyle}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
        const talentIcon = `<svg xmlns="http://www.w3.org/2000/svg" style="${iconStyle}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;


        // 2. Latest 5 Rendering
        // Bars
        if (latestBars) {
            // Render immediately with static data (using fallback location string)
            document.getElementById('latest-bars-list').innerHTML = latestBars.map(b => {
                const scoreVal = b.editorial_rating !== null && b.editorial_rating !== undefined ? b.editorial_rating : (b.liquid_arts_score || null);
                const score = scoreVal !== null ? `<span style="color:var(--bg-red); font-weight:700;">★ ${scoreVal}</span>` : '<span style="color:#999; font-size:0.8rem;">Unrated</span>';

                // Initial city: Use DB string or Unknown
                let initialCity = getCityDisplay(b.location) || 'Unknown City';
                if (initialCity === 'Unknown City' && b.location) initialCity = b.location;

                return `
                <div id="dash-bar-${b.id}" style="display: flex; gap: 10px; background: #fafafa; padding: 10px; border-radius: 6px; border: 1px solid #eee; align-items: center;">
                    <img src="${b.image || ''}" style="width: 50px; height: 50px; object-fit: contain; background: #eee; border-radius: 4px; flex-shrink: 0;" alt="${b.title}">
                    <div style="flex: 1;">
                        <div style="font-weight: 500; line-height: 1.3;">${b.title}</div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                            <span class="city-display" style="font-size: 0.8rem; color: #666;">${initialCity}</span>
                            ${score}
                        </div>
                    </div>
                    <!-- Mini Actions -->
                    <div style="display: flex; gap: 8px;">
                        <button onclick="window.open('bar.html?id=${b.id}', '_blank')" style="border:none; background:none; cursor:pointer;" title="View">${viewIcon}</button>
                        <button onclick="editBar('${b.id}')" style="border:none; background:none; cursor:pointer;" title="Edit">${editIcon}</button>
                    </div>
                </div>`;
            }).join('');

            // Non-blocking Geocoding Update
            (async () => {
                for (const b of latestBars) {
                    if (b.lat && b.lng) {
                        try {
                            const city = await fetchCityFromCoords(b.lat, b.lng);
                            if (city) {
                                const el = document.querySelector(`#dash-bar-${b.id} .city-display`);
                                if (el) el.innerText = city;
                            }
                        } catch (e) {
                            console.warn('Geo fetch failed', e);
                        }
                        await new Promise(r => setTimeout(r, 200));
                    }
                }
            })();
        }

        // Articles
        if (latestArticles) {
            document.getElementById('latest-articles-list').innerHTML = latestArticles.map(a => `
                <div style="display: flex; gap: 10px; background: #fafafa; padding: 10px; border-radius: 6px; border: 1px solid #eee; align-items: center;">
                    <img src="${a.cover_image || ''}" style="width: 50px; height: 50px; object-fit: contain; background: #eee; border-radius: 4px; flex-shrink: 0;" alt="${a.title}">
                    <div style="flex: 1;">
                         <div style="font-weight: 500; line-height: 1.3;">${a.title}</div>
                         <div style="font-size: 0.8rem; color: #666; margin-top: 4px;">By ${a.author_name || 'Admin'}</div>
                    </div>
                     <!-- Mini Actions -->
                    <div style="display: flex; gap: 8px;">
                        <button onclick="window.open('journal-details.html?id=${a.id}', '_blank')" style="border:none; background:none; cursor:pointer;" title="View">${viewIcon}</button>
                        <button onclick="editArticle('${a.id}')" style="border:none; background:none; cursor:pointer;" title="Edit">${editIcon}</button>
                    </div>
                </div>
            `).join('');
        }

        // Users
        if (latestUsers) {
            document.getElementById('latest-users-list').innerHTML = latestUsers.map(u => {
                const talentProfile = talData ? talData.find(t => t.user_id === u.id) : null;
                const isTalentRole = (u.roles || []).some(r => ['talent', 'kol'].includes(r));
                const isTalent = isTalentRole || !!talentProfile;

                const bgStyle = isTalent ? 'background: #fff9c4;' : 'background: #fafafa;';
                const nameDisplay = talentProfile
                    ? `<span style="color:#d97706; font-weight:700;">${talentProfile.display_name}</span>`
                    : (u.hopper_nickname || u.email.split('@')[0]);

                return `
                  <div style="display: flex; gap: 10px; ${bgStyle} padding: 10px; border-radius: 6px; border: 1px solid #eee; align-items: center;">
                      <img src="${u.hopper_image_url || 'https://placehold.co/100x100?text=User'}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 50%; flex-shrink: 0; background:#eee;" alt="User">
                      <div style="flex: 1;">
                          <div style="font-weight: 500; line-height: 1.3;">${nameDisplay}</div>
                          <div style="font-size: 0.8rem; color: #999; word-break: break-all;">${u.email}</div>
                      </div>
                      <!-- Mini Actions -->
                      <div style="display: flex; gap: 8px;">
                            ${isTalent ? `<button onclick="window.openTalentEditor('${u.id}')" style="border:none; background:none; cursor:pointer;" title="Talent Profile">${talentIcon}</button>` : ''}
                            <button onclick="editUser('${u.id}')" style="border:none; background:none; cursor:pointer;" title="Edit User">${editIcon}</button>
                      </div>
                  </div>
             `}).join('');
        }
    }

    // --- Data Loading ---

    async function loadBars() {
        const barListFull = document.getElementById('bar-list-full');
        // barListFull.innerHTML = '<p style="color:#888">Loading bars...</p>'; // Can keep loading state or streaming

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

        // Render immediately with existing data
        barListFull.innerHTML = bars.map(bar => {
            const isPublished = bar.is_published !== false;
            const statusText = isPublished ? 'Published' : 'Hidden';

            // Initial City Display (DB value or placeholder)
            let initialCity = getCityDisplay(bar.location) || 'Unknown City';
            if (initialCity === 'Unknown City' && bar.location) initialCity = bar.location;

            // Score logic
            const scoreVal = bar.editorial_rating !== null && bar.editorial_rating !== undefined ? bar.editorial_rating : (bar.liquid_arts_score !== null && bar.liquid_arts_score !== undefined ? bar.liquid_arts_score : null);
            const hasScore = scoreVal !== null;

            return `
            <div class="article-item" id="bar-item-${bar.id}" style="display: flex; gap: 1rem; margin-bottom: 1.5rem; background: #fff; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <img src="${bar.image || ''}" style="width: 100px; height: 100px; object-fit: contain; background: #eee; border-radius: 8px; flex-shrink: 0;" alt="${bar.title}">
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between;">
                        <h4 style="margin: 0 0 5px 0; font-size: 1.2rem; font-weight: 600;">${bar.title}</h4>
                         ${hasScore ? `<span style="color:var(--bg-red); font-weight:700;">★ ${scoreVal}</span>` : '<span style="color:#999; font-size:0.8rem;">Unrated</span>'}
                    </div>
                    <p class="city-display" style="margin: 0 0 5px 0; color: #555;">${initialCity}</p>
                    
                    <div style="margin-top: 10px; display: flex; align-items: center; gap: 15px;">
                        <!-- Publish Toggle -->
                        <label class="status-toggle" onclick="toggleBarStatus('${bar.id}', ${isPublished})">
                            <input type="checkbox" ${isPublished ? 'checked' : ''}>
                            <span class="status-slider"></span>
                            <span class="status-label" style="color: ${isPublished ? '#ff3b30' : '#888'}">${statusText}</span>
                        </label>

                        <div style="margin-left: auto; display: flex; gap: 8px;">
                            <button onclick="window.open('bar.html?id=${bar.id}', '_blank')" class="btn btn-secondary" title="View Frontend">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                            <button onclick="editBar('${bar.id}')" class="btn" title="Edit Backend">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button onclick="deleteBar('${bar.id}')" class="btn btn-secondary" style="color:red;" title="Delete">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        }).join('');

        // Async Enrichment: Update Cities one by one to avoid rate limits and blocking
        enrichCities(bars);
    }

    async function enrichCities(bars) {
        for (const bar of bars) {
            // Only fetch if we don't have a good city
            const currentDisplay = getCityDisplay(bar.location);
            if ((!currentDisplay || currentDisplay === 'Unknown City') && bar.lat && bar.lng) {
                // Fetch
                const city = await fetchCityFromCoords(bar.lat, bar.lng);
                if (city) {
                    const el = document.querySelector(`#bar-item-${bar.id} .city-display`);
                    if (el) el.textContent = city;
                }
                // Courtesy delay for API
                await new Promise(r => setTimeout(r, 600));
            }
        }
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
                    <button onclick="window.open('journal-details.html?id=${art.id}', '_blank')" class="btn btn-secondary">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                    <button onclick="editArticle('${art.id}')" class="btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button onclick="deleteArticle('${art.id}')" class="btn btn-secondary" style="color:red;">
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>        </div>
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
    const usersSection = document.getElementById('view-users'); // Corrected ID
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
                    if (usersSection) usersSection.style.display = 'block';
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

        const { data: users, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
        const { data: bars } = await supabase.from('bars').select('id, title, owner_user_id');
        const { data: talents } = await supabase.from('talents').select('user_id, display_name');

        if (error) {
            userListFull.innerHTML = `<p style="color:red">Error: ${error.message}</p>`;
            return;
        }

        userListFull.innerHTML = users.map(u => {
            const linkedBar = bars ? bars.find(b => b.owner_user_id === u.id) : null;
            const roleBadges = (u.roles || []).map(r =>
                `<span class="tag-badge" style="background:${getRoleColor(r)}; color:white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">${r}</span>`
            ).join(' ');

            // Talent Logic
            const talentProfile = talents ? talents.find(t => t.user_id === u.id) : null;
            const isTalentRole = (u.roles || []).some(r => ['talent', 'kol'].includes(r)); // Role check
            const isTalent = isTalentRole || !!talentProfile; // Combine checks

            const hopperName = u.hopper_nickname || 'No Hopper Name';
            const hopperImg = u.hopper_image_url || 'https://placehold.co/100x100?text=User';

            // Styling
            const bgStyle = isTalent ? 'background: #fff9c4;' : 'background: #fff;';
            const nameDisplay = talentProfile
                ? `<div style="font-weight:700; font-size:1.05rem; color:#d97706;">${talentProfile.display_name}</div>
                   <div style="font-size:0.85rem; color:#666;">${hopperName} <span style="font-weight:400; color:#888;">(${u.email})</span></div>`
                : `<h4 style="margin: 0 0 5px 0;">${hopperName} <span style="font-weight:400; font-size:0.9rem; color:#888;">(${u.email})</span></h4>`;

            // Icons
            const iconStyle = "width: 14px; height: 14px; stroke-width: 2.5;";
            const editIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
            const hopperIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>`; // Placeholder for hopper
            const talentIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
            const deleteIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

            const btnBase = "display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 100px; font-weight: 500; font-size: 0.8rem; border: 1px solid #eee; background: white; color: #333; cursor: pointer; transition: all 0.2s;";
            const btnHover = "hover: border-color: #9c100f; color: #9c100f;";

            return `
            <div class="article-item" style="display: flex; gap: 1rem; margin-bottom: 1.5rem; ${bgStyle} padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <div style="width: 80px; height: 80px; background: #eee url('${hopperImg}') center/cover; border-radius: 50%; flex-shrink: 0; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);"></div>
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>${nameDisplay}</div>
                        <div style="display:flex; gap:5px;">${roleBadges}</div>
                    </div>
                    <p style="margin: 5px 0 0 0; color: #666; font-size: 0.9rem;">
                        Linked Bar: ${linkedBar ? linkedBar.title : 'None'}
                    </p>
                    
                    <div style="margin-top: 15px; display: flex; gap: 8px;">
                        ${isTalent ? `<button onclick="window.openTalentEditor('${u.id}')" style="${btnBase}" onmouseover="this.style.borderColor='#d97706';this.style.color='#d97706'" onmouseout="this.style.borderColor='#eee';this.style.color='#333'">${talentIcon} Talent</button>` : ''}
                        <button onclick="window.openHopperModal('${u.id}')" style="${btnBase}" onmouseover="this.style.borderColor='#9c100f';this.style.color='#9c100f'" onmouseout="this.style.borderColor='#eee';this.style.color='#333'">${hopperIcon} Hopper</button>
                        <button onclick="editUser('${u.id}')" style="${btnBase}" onmouseover="this.style.borderColor='#9c100f';this.style.color='#9c100f'" onmouseout="this.style.borderColor='#eee';this.style.color='#333'">${editIcon} Edit</button>
                        <button onclick="deleteUser('${u.id}')" style="${btnBase} border-color: rgba(255,0,0,0.1); color: #ef4444;" onmouseover="this.style.borderColor='#ef4444';this.style.background='#fff0f0'" onmouseout="this.style.borderColor='rgba(255,0,0,0.1)';this.style.background='white'">${deleteIcon}</button>
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

    // Reverse Geocoding Helper
    async function fetchCityFromCoords(lat, lng) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`);
            const data = await response.json();
            if (data.address) {
                // Try city, then town, then village, then county
                return data.address.city || data.address.town || data.address.village || data.address.county || '';
            }
            return '';
        } catch (e) {
            console.error('City fetch error:', e);
            return '';
        }
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
    window.deleteArticle = async (id) => {
        if (confirm('Delete this story?')) {
            await supabase.from('articles').delete().eq('id', id);
            loadArticles();
        }
    };

    // --- Invitation Generator Logic ---
    let cachedBarsForInvite = [];

    async function initInvitationGenerator() {
        const roleSelect = document.getElementById('invite-role');
        const barSelect = document.getElementById('invite-bar-select');
        const ownerFields = document.getElementById('invite-owner-fields');
        const talentFields = document.getElementById('invite-talent-fields');

        // Toggle Fields
        roleSelect.onchange = () => {
            if (roleSelect.value === 'owner') {
                ownerFields.style.display = 'block';
                talentFields.style.display = 'none';
            } else if (roleSelect.value === 'talent') {
                ownerFields.style.display = 'none';
                talentFields.style.display = 'block';
            } else {
                ownerFields.style.display = 'none';
                talentFields.style.display = 'none';
            }
        };

        // Load Bars if empty
        if (cachedBarsForInvite.length === 0) {
            const { data, error } = await supabase.from('bars').select('id, title, image');
            if (data) {
                cachedBarsForInvite = data;
                barSelect.innerHTML = '<option value="">-- Select Bar --</option>' +
                    data.map(b => `<option value="${b.id}">${b.title}</option>`).join('');
            }
        }
    }

    document.getElementById('generate-invite-btn').onclick = async () => {
        const role = document.getElementById('invite-role').value;
        const btn = document.getElementById('generate-invite-btn');

        let metadata = {};
        let barId = null;
        let barData = null;

        if (role === 'owner') {
            barId = document.getElementById('invite-bar-select').value;
            if (!barId) { alert('Please select a bar'); return; }
            metadata.bar_id = barId;

            // Find bar data for preview
            barData = cachedBarsForInvite.find(b => b.id == barId);
            if (barData) metadata.bar_name = barData.title;
        }

        if (role === 'talent') {
            const name = document.getElementById('invite-talent-name').value;
            if (name) metadata.display_name = name;
        }

        btn.textContent = 'Generating...';
        btn.disabled = true;

        try {
            // Generate Random Code (e.g. BARNAME-RANDOM)
            const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
            let code = `INV-${randomSuffix}`;
            if (role === 'owner' && barData) {
                // Sanitize bar name for code
                const cleanName = barData.title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
                code = `${cleanName}-${randomSuffix}`;
            }

            // Insert to DB
            const { error } = await supabase.from('invitations').insert([{
                code: code,
                role: role,
                metadata: metadata,
                created_by: (await supabase.auth.getUser()).data.user.id
            }]);

            if (error) throw error;

            // Success: update UI
            const link = `${window.location.origin}/invite.html?code=${code}`;
            const linkText = document.getElementById('invite-link-text');
            linkText.href = link;
            linkText.textContent = link;

            document.getElementById('invite-result').style.display = 'block';
            document.getElementById('invite-empty-state').style.display = 'none';

            // Update Preview Card
            const previewBg = document.getElementById('card-preview-bg');
            const previewName = document.getElementById('card-preview-barname');

            if (role === 'owner' && barData) {
                previewBg.src = barData.image || 'assets/default_bar.jpg';
                previewName.textContent = barData.title;
                previewName.style.display = 'block';
            } else {
                previewBg.src = 'assets/hero_bg.jpg'; // Default Generic
                previewName.textContent = role === 'talent' ? 'Liquid Arts Talent' : 'Welcome';
            }

        } catch (err) {
            console.error(err);
            alert('Error generating invite: ' + err.message);
        } finally {
            btn.textContent = 'GENERATE LINK';
            btn.disabled = false;
        }
    };

});
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

    else alert(error.message);
};
