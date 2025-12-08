document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const SUPABASE_URL = 'https://wgnskednopbfngvjmviq.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // --- Elements ---
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const googleLoginBtn = document.getElementById('google-login-btn');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // Dashboard Elements
    const barList = document.getElementById('bar-list');
    const articleList = document.getElementById('article-list');
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
                    { id: user.id, email: user.email, roles: ['reader'] }
                ]);
                if (!insertError) {
                    profile = { roles: ['reader'] }; // Assume reader default
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

        loadBars();
        loadArticles(user, roles);
    }

    // --- Data Loading ---

    async function loadBars() {
        barList.innerHTML = '<p style="color:#888">Loading bars...</p>';

        const { data: bars, error } = await supabase
            .from('bars')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            barList.innerHTML = `<p style="color:red">Error: ${error.message}</p>`;
            return;
        }

        if (!bars || bars.length === 0) {
            barList.innerHTML = '<p>No bars found.</p>';
            return;
        }

        barList.innerHTML = bars.map(bar => `
            <div class="article-item" style="display: flex; gap: 1rem; margin-bottom: 1.5rem; background: #fff; padding: 1rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-decoration: none; color: inherit;">
                <div style="width: 80px; height: 80px; background-image: url('${bar.image || ''}'); background-size: cover; background-position: center; border-radius: 8px; flex-shrink: 0; background-color: #eee;"></div>
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 5px 0; font-size: 1.1rem;">${bar.title}</h4>
                    <p style="margin: 0 0 10px 0; font-size: 0.85rem; color: #666;">${bar.location || 'No location'}</p>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="editBar('${bar.id}')" class="btn btn-sm" style="padding: 4px 10px; font-size: 0.8rem; background: #eee;">Edit</button>
                        <button onclick="deleteBar('${bar.id}')" class="btn btn-sm" style="padding: 4px 10px; font-size: 0.8rem; color: #ff3b30; background: transparent; border: 1px solid #ff3b30;">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async function loadArticles(user, roles) {
        articleList.innerHTML = '<p style="color:#888">Loading articles...</p>';

        let query = supabase.from('articles').select('*').order('published_at', { ascending: false });

        // Editors only see their own? Or all? Usually Editors see all. 
        // Let's assume Admin/Editor sees all for now based on requirements.

        const { data: articles, error } = await query;

        if (error) {
            articleList.innerHTML = `<p style="color:red">Error: ${error.message}</p>`;
            return;
        }

        if (!articles || articles.length === 0) {
            articleList.innerHTML = '<p>No articles found.</p>';
            return;
        }

        articleList.innerHTML = articles.map(art => `
            <div class="article-item" style="display: flex; gap: 1rem; margin-bottom: 1.5rem; background: #fff; padding: 1rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-decoration: none; color: inherit;">
                <div style="width: 80px; height: 80px; background-image: url('${art.cover_image || ''}'); background-size: cover; background-position: center; border-radius: 8px; flex-shrink: 0; background-color: #eee;"></div>
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 5px 0; font-size: 1.1rem;">${art.title}</h4>
                    <p style="margin: 0 0 10px 0; font-size: 0.85rem; color: #666;">
                        ${art.status === 'published' ? '<span style="color:#34c759">● Published</span>' : '<span style="color:#ff9500">○ Draft</span>'}
                    </p>
                    <div style="display: flex; gap: 8px;">
                         <button onclick="editArticle('${art.id}')" class="btn btn-sm" style="padding: 4px 10px; font-size: 0.8rem; background: #eee;">Edit</button>
                         <button onclick="deleteArticle('${art.id}')" class="btn btn-sm" style="padding: 4px 10px; font-size: 0.8rem; color: #ff3b30; background: transparent; border: 1px solid #ff3b30;">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

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
    addBarBtn.addEventListener('click', () => {
        window.location.href = 'bms.html';
    });

    addJournalBtn.addEventListener('click', () => {
        window.location.href = 'cms.html';
    });

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
