document.addEventListener('DOMContentLoaded', async () => {
    await initExplore();
});

async function initExplore() {
    const grid = document.getElementById('explore-feed');
    if (!grid) return;

    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888; font-family: var(--font-main);">Curating your experience...</p>';

    try {
        // 1. Fetch Bars (Random 6)
        // Note: Supabase doesn't have native random(). We'll fetch a batch and shuffle client-side or sort by something.
        const { data: barsData, error: barsError } = await window.supabaseClient
            .from('bars')
            .select('*')
            .limit(20); // Fetch more to shuffle

        // 2. Fetch Hops (Latest 10)
        const { data: hopsData, error: hopsError } = await window.supabaseClient
            .from('hoppings')
            .select('*, bars(id, title)')
            .eq('is_public', true)
            .order('hopped_at', { ascending: false })
            .limit(10);

        // Fetch Hop Users
        let usersMap = {};
        let commentsMap = {};
        if (hopsData && hopsData.length > 0) {
            const userIds = [...new Set(hopsData.map(h => h.user_id).filter(Boolean))];
            if (userIds.length > 0) {
                const { data: users } = await window.supabaseClient.from('users').select('*').in('id', userIds);
                users?.forEach(u => usersMap[u.id] = u);
            }
            // Fetch Comments
            const hopIds = hopsData.map(h => h.id);
            const { data: comments } = await window.supabaseClient
                .from('hopping_comments')
                .select('hopping_id, content, user:users(name, hopper_nickname, hopper_image_url)')
                .in('hopping_id', hopIds)
                .order('created_at', { ascending: false });

            comments?.forEach(c => {
                if (!commentsMap[c.hopping_id]) commentsMap[c.hopping_id] = c;
            });
        }

        // 3. Fetch Articles (Latest 5)
        const { data: articlesData, error: articlesError } = await window.supabaseClient
            .from('articles')
            .select('*')
            .eq('status', 'published')
            .order('published_at', { ascending: false })
            .limit(5);

        if (barsError || hopsError || articlesError) {
            console.error('Explore fetch error', barsError, hopsError, articlesError);
        }

        // 4. Mix Content
        let mixedContent = [];

        // Add Bars (Pick 6 random)
        if (barsData) {
            const shuffledBars = barsData.sort(() => 0.5 - Math.random()).slice(0, 6);
            shuffledBars.forEach(bar => mixedContent.push({ type: 'bar', data: bar }));
        }

        // Add Hops
        if (hopsData) {
            hopsData.forEach(hop => mixedContent.push({ type: 'hop', data: hop }));
        }

        // Add Articles
        if (articlesData) {
            articlesData.forEach(article => mixedContent.push({ type: 'article', data: article }));
        }

        // Shuffle Everything
        mixedContent.sort(() => 0.5 - Math.random());

        // Render
        if (mixedContent.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888;">No content found.</p>';
            return;
        }

        grid.innerHTML = mixedContent.map(item => {
            if (item.type === 'bar') {
                return window.createBarCard(item.data);
            } else if (item.type === 'hop') {
                return window.createHopCard(item.data, usersMap[item.data.user_id], commentsMap[item.data.id]);
            } else if (item.type === 'article') {
                return window.createArticleCard(item.data);
            }
            return '';
        }).join('');

        // Initialize maps for bars
        mixedContent.forEach(item => {
            if (item.type === 'bar' && item.data.lat && item.data.lng) {
                // Determine title and saved status (mock saved status for now or pass false)
                setTimeout(() => {
                    if (window.initCardMapGlobal) {
                        window.initCardMapGlobal(item.data.id, item.data.lat, item.data.lng, item.data.title, false);
                    }
                }, 500);
            }
        });

    } catch (e) {
        console.error('Explore Init Error', e);
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ef4444;">Something went wrong.</p>';
    }
}
