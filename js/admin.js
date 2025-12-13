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

        barList.innerHTML = bars.map(bar => {
            const isPublished = bar.is_published !== false; // Default true
            const statusText = isPublished ? 'Published' : 'Hidden';

            return `
            <div class="article-item" style="display: flex; gap: 1rem; margin-bottom: 1.5rem; background: #fff; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <div style="width: 100px; height: 100px; background-image: url('${bar.image || ''}'); background-size: cover; background-position: center; border-radius: 8px; flex-shrink: 0; background-color: #eee;"></div>
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 5px 0; font-size: 1.2rem; font-weight: 600;">${bar.title}</h4>
                    <p style="margin: 0 0 5px 0; color: #555;">${bar.location || 'No location'}</p>
                    <p class="meta-text" style="max-height: 40px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${bar.description || 'No description'}</p>
                    
                    <div style="margin-top: 10px; display: flex; align-items: center; gap: 15px;">
                        <!-- Publish Toggle -->
                        <label class="status-toggle" onclick="toggleBarStatus('${bar.id}', ${isPublished})">
                            <input type="checkbox" ${isPublished ? 'checked' : ''}>
                            <span class="status-slider"></span>
                            <span class="status-label" style="color: ${isPublished ? '#ff3b30' : '#888'}">${statusText}</span>
                        </label>

                        <div style="margin-left: auto; display: flex; gap: 8px;">
                            <button onclick="window.open('bar.html?id=${bar.id}', '_blank')" class="btn btn-secondary">View</button>
                            <button onclick="editBar('${bar.id}')" class="btn">Edit</button>
                            <button onclick="deleteBar('${bar.id}')" class="btn btn-secondary">Delete</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    }

    async function loadArticles(user, roles) {
        articleList.innerHTML = '<p style="color:#888">Loading articles...</p>';

        let query = supabase.from('articles').select('*').order('published_at', { ascending: false });
        // Assume Admin sees all

        const { data: articles, error } = await query;

        if (error) {
            articleList.innerHTML = `<p style="color:red">Error: ${error.message}</p>`;
            return;
        }

        if (!articles || articles.length === 0) {
            articleList.innerHTML = '<p>No stories found.</p>';
            return;
        }

        articleList.innerHTML = articles.map(art => {
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
                            <button onclick="window.open('journal-details.html?id=${art.id}', '_blank')" class="btn btn-secondary">View</button>
                            <button onclick="editArticle('${art.id}')" class="btn">Edit</button>
                            <button onclick="deleteArticle('${art.id}')" class="btn btn-secondary">Delete</button>
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
    const usersSection = document.getElementById('users-section');
    const userList = document.getElementById('user-list');
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
        initUserManagement(roles);
    };

    addUserBtn.addEventListener('click', () => {
        openUserModal();
    });

    closeUserBtn.addEventListener('click', () => {
        userModal.classList.remove('active');
    });

    async function loadUsers() {
        userList.innerHTML = '<tr><td colspan="4" style="padding:1rem;">Loading...</td></tr>';

        // Fetch Users and their Linked Bars (if any)
        // Note: 'users' table doesn't strictly have a foreign key to bars in the schema shown, 
        // but 'bars' has 'owner_user_id'.

        const { data: users, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
        // Fetch bars to map owners
        const { data: bars } = await supabase.from('bars').select('id, title, owner_user_id');

        if (error) {
            userList.innerHTML = `<tr><td colspan="4" style="color:red;">Error: ${error.message}</td></tr>`;
            return;
        }

        userList.innerHTML = users.map(u => {
            const linkedBar = bars ? bars.find(b => b.owner_user_id === u.id) : null;
            const roleBadges = (u.roles || []).map(r =>
                `<span class="tag-badge" style="background:${getRoleColor(r)}; color:white;">${r}</span>`
            ).join(' ');

            const isTalent = (u.roles || []).some(r => ['talent', 'kol'].includes(r));

            return `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 1rem;">
                        <div style="font-weight:600;">${u.email || 'No Email'}</div>
                        <div style="font-size:0.8rem; color:#888;">${u.name || ''}</div>
                    </td>
                    <td style="padding: 1rem;">${roleBadges}</td>
                    <td style="padding: 1rem;">${linkedBar ? linkedBar.title : '-'}</td>
                        ${isTalent ? `<button onclick="window.openTalentEditor('${u.id}')" class="btn btn-secondary" style="padding:4px 8px; font-size:0.8rem; margin-right: 5px;">Talent</button>` : ''}
                        <button onclick="window.openHopperModal('${u.id}')" class="btn btn-secondary" style="padding:4px 8px; font-size:0.8rem; margin-right: 5px;">Hopper</button>
                        <button onclick="editUser('${u.id}')" class="btn btn-secondary" style="padding:4px 8px; font-size:0.8rem; margin-right: 5px;">Edit</button>
                        <button onclick="deleteUser('${u.id}')" class="btn btn-secondary" style="padding:4px 8px; font-size:0.8rem; color:red; border-color:red;">Delete</button>
                    </td>
                </tr>
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
