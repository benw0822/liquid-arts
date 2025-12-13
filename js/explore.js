document.addEventListener('DOMContentLoaded', async () => {
    await initExplore();
});

async function initExplore() {
    await window.initAuthAndSaved();
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
        let cheersMap = {};
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
                .select('id, hopping_id, content, created_at, user:users(name, hopper_nickname, hopper_image_url)')
                .in('hopping_id', hopIds)
                .order('created_at', { ascending: false });

            comments?.forEach(c => {
                if (!commentsMap[c.hopping_id]) commentsMap[c.hopping_id] = [];
                if (commentsMap[c.hopping_id].length < 5) {
                    commentsMap[c.hopping_id].push(c);
                }
            });

            // Fetch Cheers
            const { data: cheersData } = await window.supabaseClient
                .from('hopping_cheers')
                .select('hopping_id, user_id')
                .in('hopping_id', hopIds);

            if (cheersData) {
                const currentUserId = window.currentUser?.id;
                cheersData.forEach(c => {
                    if (!cheersMap[c.hopping_id]) cheersMap[c.hopping_id] = { count: 0, isCheered: false };
                    cheersMap[c.hopping_id].count++;
                    if (currentUserId && c.user_id === currentUserId) {
                        cheersMap[c.hopping_id].isCheered = true;
                    }
                });
            }
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

        // Add Bars (Pick 6 random) - With City Fetch
        if (barsData) {
            // Pre-fetch cities
            await Promise.all(barsData.map(async (bar) => {
                if (bar.lat && bar.lng && window.fetchCityFromCoordsGlobal) {
                    bar.cityDisplay = await window.fetchCityFromCoordsGlobal(bar.lat, bar.lng);
                }
            }));

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
                return window.createBarCard(item.data, item.data.cityDisplay);
            } else if (item.type === 'hop') {
                return window.createHopCard(item.data, usersMap[item.data.user_id], commentsMap[item.data.id] || [], item.data.bars, cheersMap[item.data.id] || { count: 0, isCheered: false });
            } else if (item.type === 'article') {
                return window.createArticleCard(item.data);
            }
            return '';
        }).join('');

        // Initialize maps and badges for bars
        mixedContent.forEach(item => {
            if (item.type === 'bar') {
                setTimeout(() => {
                    // Map
                    if (item.data.lat && item.data.lng && window.initCardMapGlobal) {
                        window.initCardMapGlobal(item.data.id, item.data.lat, item.data.lng, item.data.title, false);
                    }
                    // Hopping Badge
                    if (window.renderHoppingBadge) {
                        window.renderHoppingBadge(item.data.id);
                    }
                }, 500);
            }
        });

    } catch (e) {
        console.error('Explore Init Error', e);
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ef4444;">Something went wrong.</p>';
    }
}
