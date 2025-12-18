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
    const code = params.get('code');

    if (!code) {
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
        if (metadata.invitee_name) {
            document.getElementById('invite-title').textContent = `Hi, ${metadata.invitee_name}`;
        } else if (metadata.display_name && data.role === 'talent') {
            document.getElementById('invite-title').textContent = `Hi, ${metadata.display_name}`;
        }

        // Bar Info (If available)
        if (metadata.bar_id) {
            // Fetch Bar Image for BG
            const { data: bar } = await supabase.from('bars').select('title, image').eq('id', metadata.bar_id).single();
            if (bar) {
                if (bar.image) {
                    bgImage.src = bar.image;
                    // Preload check? Let browser handle it
                }
                displayBarName.textContent = bar.title;
            } else {
                displayBarName.textContent = metadata.bar_name || 'Liquid Arts';
            }
        } else {
            displayBarName.textContent = 'Liquid Arts Platform'; // Generic
        }

        // Role Text
        if (data.role === 'owner') {
            displayRole.textContent = 'Bar Owner';
        } else if (data.role === 'talent') {
            displayRole.textContent = metadata.title || 'Talent Member';
            if (metadata.title) displayRole.style.fontSize = '1.5rem'; // Adjust if long title
            displayBarName.textContent = 'Liquid Arts Family'; // Or keep it generic
        } else {
            displayRole.textContent = 'Member';
        }
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
                    if (data.bar_id) window.location.href = `admin.html`; // Redirect to Admin/Profile
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
