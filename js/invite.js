document.addEventListener('DOMContentLoaded', async () => {

    // --- Config ---
    const SUPABASE_URL = 'https://wgnskednopbfngvjmviq.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P'; // Public Key
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // --- DOM Elements ---
    const cardContent = document.getElementById('card-content');
    const errorCard = document.getElementById('error-card');
    const bgImage = document.getElementById('bg-image');

    const displayRole = document.getElementById('display-role');
    const displayBarName = document.getElementById('display-barname');
    const acceptBtn = document.getElementById('accept-btn');
    const btnText = acceptBtn.querySelector('.btn-text');
    const btnLoader = document.getElementById('btn-loader');
    const errorMsg = document.getElementById('error-msg');

    // --- Logic ---

    // 1. Get Code
    const params = new URLSearchParams(window.location.search);
    let code = params.get('code');

    // Support Clean URL (/invite/CODE)
    if (!code) {
        const pathParts = window.location.pathname.split('/');
        // Usually /invite/CODE, so last part
        if (pathParts.length > 0) {
            code = pathParts[pathParts.length - 1];
        }
    }

    if (!code || code === 'invite.html') {
        showError('Missing Invitation Code');
        return;
    }

    // 2. Fetch Invitation Metadata (Public Read)
    // Note: RLS must allow 'select' on invitations for public
    let invitationData = null;

    try {
        const { data, error } = await supabase
            .from('invitations')
            .select('role, metadata, is_used, expires_at')
            .eq('code', code)
            .single();

        if (error || !data) throw new Error('Invitation not found');
        if (data.is_used) throw new Error('Invitation already used');

        invitationData = data;
        renderInvitation(data);

    } catch (err) {
        console.error(err);
        showError(err.message === 'Invitation already used' ? 'This invitation has already been used.' : 'Invalid or expired invitation link.');
        return;
    }

    // --- Render ---
    async function renderInvitation(data) {
        const metadata = data.metadata || {};

        // Dynamic Title (Greeting)
        const greetingEl = document.getElementById('invite-greeting');
        const subtextEl = document.getElementById('invite-subtext');

        if (metadata.invitee_name) {
            greetingEl.textContent = `Hi ${metadata.invitee_name},`;
        } else if (metadata.display_name && data.role === 'talent') {
            greetingEl.textContent = `Hi ${metadata.display_name},`;
        } else {
            greetingEl.textContent = 'Welcome,';
        }

        // Subtext & Bar Info
        if (data.role === 'owner') {
            subtextEl.textContent = 'You are invited to manage';

            // Bar Info (If available)
            if (metadata.bar_id) {
                // Fetch Bar Image for BG
                const { data: bar } = await supabase.from('bars').select('title, image').eq('id', metadata.bar_id).single();
                if (bar) {
                    if (bar.image) {
                        // Update Inner Card BG
                        document.getElementById('card-bg').src = bar.image;
                        // Optional: Update Body BG for ambience
                        document.getElementById('body-bg').src = bar.image;
                    }
                    displayBarName.textContent = bar.title;
                } else {
                    displayBarName.textContent = metadata.bar_name || 'Liquid Arts';
                }

                // Show "View Bar" Link
                const viewBarBtn = document.getElementById('view-bar-btn');
                viewBarBtn.href = `bar.html?id=${metadata.bar_id}`;
                viewBarBtn.textContent = `View ${bar ? bar.title : 'Bar'}`;
                viewBarBtn.style.display = 'inline-block';

            } else {
                displayBarName.textContent = 'Liquid Arts Platform'; // Generic
            }

        } else if (data.role === 'talent') {
            subtextEl.textContent = 'You are invited to join';
            displayBarName.textContent = 'Liquid Arts Family'; // or specific bar context if talent is linked to bar? 
            if (metadata.title) {
                subtextEl.innerHTML = `You are invited to join as<br><span style="color:#ef4444">${metadata.title}</span>`;
            }
        } else {
            subtextEl.textContent = 'You are invited to join';
            displayBarName.textContent = 'Liquid Arts';
        }

        // --- Dynamic Meta Tags Update (Client-Side) ---
        // Best effort for link previews that support JS, and definitely works for Browser Tab Title
        const invitee = metadata.invitee_name || metadata.display_name || '您';
        const barName = displayBarName.textContent;
        // const action = data.role === 'owner' ? 'manage' : 'join';

        let pageTitle = '';
        let pageDesc = '';

        if (data.role === 'owner') {
            pageTitle = `Liquid Arts 邀請函：${barName}`;
            pageDesc = `${invitee}您好，敬請您共同管理 ${barName}的公開資訊`;
        } else {
            pageTitle = `Liquid Arts 邀請函`;
            pageDesc = `${invitee}您好，誠摯邀請您以調酒師身份加入 Liquid Arts。`;
        }

        document.title = pageTitle;

        // Helper to set meta
        const setMeta = (selector, content) => {
            let el = document.querySelector(selector);
            if (!el) {
                // Create if missing
                el = document.createElement('meta');

                if (selector.startsWith('meta[property')) {
                    el.setAttribute('property', selector.match(/property="([^"]*)"/)[1]);
                } else if (selector.startsWith('meta[name')) {
                    el.setAttribute('name', selector.match(/name="([^"]*)"/)[1]);
                }
                document.head.appendChild(el);
            }
            el.setAttribute('content', content);
        };

        setMeta('meta[property="og:title"]', pageTitle);
        setMeta('meta[property="og:description"]', pageDesc);
        setMeta('meta[name="description"]', pageDesc);
    }

    function showError(msg) {
        cardContent.style.display = 'none';
        errorCard.style.display = 'block';
        errorMsg.textContent = msg;
    }

    // --- Action ---
    acceptBtn.onclick = async () => {
        // Start Auth Flow
        btnText.textContent = 'Connecting...';
        btnLoader.style.display = 'block';
        acceptBtn.disabled = true;

        // 1. Check if already logged in
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            // Already logged in -> Claim
            await claimAndRedirect(session.user.id);
        } else {
            // 2. Not logged in -> Google Login
            // Redirect URL should be back to THIS page with the code?
            // OR we handle the return.
            // When Supabase redirects back, it adds #access_token...
            // We need to persist the 'code' so we can claim it after redirect.

            // Strategy: Redirect to current URL (invite.html?code=...)
            // The Auth State Listener will fire on load if redirected back successfully.

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.href // Come back here
                }
            });

            if (error) {
                alert('Login failed: ' + error.message);
                resetBtn();
            }
        }
    };

    // --- Auth Listener / Post-Login Handler ---
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            // User just logged in (or page loaded with active session)
            // But we only want to auto-claim if the user CLICKED accept or just returned from OAuth.
            // However, for simplicity/frictionless: If they are on this page with a valid code and are logged in, just claim it?
            // Maybe safer to require click? 
            // BUT: If they just came back from Google, they expect it to process.

            // Let's Check: Is the button currently "Processing" (not persistent across reload)? No.
            // So if they return from Google, page reloads.

            // UX Decision: If logged in, show "Confirm Join as [Email]" button? 
            // OR just auto-process? 

            // Let's do Auto-Process with a visual indicator.
            // IF we are in the middle of an "OAuth Callback" (hash present) OR just logged in.

            // Actually, we can just trigger claim.
            console.log('User detected, attempting claim...');
            btnText.textContent = 'Joining...';
            btnLoader.style.display = 'block';
            acceptBtn.disabled = true;

            await claimAndRedirect(session.user.id);
        }
    });

    async function claimAndRedirect(userId) {
        try {
            // Call RPC
            const { data, error } = await supabase.rpc('claim_invitation', { code_input: code });

            if (error) throw error;

            if (!data.success) {
                throw new Error(data.message);
            }

            // Success!
            btnText.textContent = 'Success!';
            // Redirect
            setTimeout(() => {
                if (data.role === 'owner') {
                    // Go to BMS or Profile? BMS seems appropriate if we know the bar ID
                    // data.bar_id might be returned string or number
                    if (data.bar_id) window.location.href = `bms.html?id=${data.bar_id}`; // Redirect to Bar Management
                    else window.location.href = 'profile.html';
                } else {
                    window.location.href = 'profile.html';
                }
            }, 1000);

        } catch (err) {
            console.error(err);
            // If error is "Already used" AND used by THIS user, we should just redirect?
            // But RPC returns success: false message: "Invitation already used"
            // We can't easily check 'used_by' without another query.

            if (err.message === 'Invitation already used') {
                alert('You have already joined! Redirecting...');
                window.location.href = 'profile.html';
            } else {
                alert('Error processing invitation: ' + err.message);
                resetBtn();
            }
        }
    }

    function resetBtn() {
        btnText.textContent = 'Accept & Join';
        btnLoader.style.display = 'none';
        acceptBtn.disabled = false;
    }

});
