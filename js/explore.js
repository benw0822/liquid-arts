
// State for Infinite Scroll
window.exploreState = {
    content: [],
    currentIndex: 0,
    pageSize: 15,
    isLoading: false,
    hasMore: true
};

document.addEventListener('DOMContentLoaded', async () => {
    await initExplore();
    window.addEventListener('scroll', handleInfiniteScroll);
});

async function initExplore() {
    await window.initAuthAndSaved();
    const grid = document.getElementById('explore-feed');
    if (!grid) return;

    grid.innerHTML = '<p style="text-align: center; color: #888; font-family: var(--font-main); width: 100%;">Curating your experience...</p>';

    try {
        // 1. Fetch Bars (Fetch 40 candidates)
        const { data: barsData, error: barsError } = await window.supabaseClient
            .from('bars')
            .select('*')
            .order('created_at', { ascending: false }) // or random logic if possible
            .limit(40);

        // 2. Fetch Hops (Fetch 60 latest)
        const { data: hopsData, error: hopsError } = await window.supabaseClient
            .from('hoppings')
            .select('*, bars(id, title)')
            .eq('is_public', true)
            .eq('is_deleted', false) // Soft Delete Check
            .order('hopped_at', { ascending: false })
            .limit(60);

        // 3. Fetch Articles (Fetch 20 latest)
        const { data: articlesData, error: articlesError } = await window.supabaseClient
            .from('articles')
            .select('*')
            .eq('status', 'published')
            .order('published_at', { ascending: false })
            .limit(20);

        if (barsError || hopsError || articlesError) {
            console.error('Explore fetch error', barsError, hopsError, articlesError);
        }

        // --- Pre-fetch Metadata for Hops (Users, Comments, Cheers) ---
        let usersMap = {};
        let commentsMap = {};
        let cheersMap = {};

        if (hopsData && hopsData.length > 0) {
            const userIds = [...new Set(hopsData.map(h => h.user_id).filter(Boolean))];
            if (userIds.length > 0) {
                const { data: users } = await window.supabaseClient.from('users').select('*').in('id', userIds);
                users?.forEach(u => usersMap[u.id] = u);
            }

            const hopIds = hopsData.map(h => h.id);
            // Comments
            const { data: comments } = await window.supabaseClient
                .from('hopping_comments')
                .select('id, hopping_id, content, created_at, user:users(name, hopper_nickname, hopper_image_url)')
                .in('hopping_id', hopIds)
                .order('created_at', { ascending: false });

            comments?.forEach(c => {
                if (!commentsMap[c.hopping_id]) commentsMap[c.hopping_id] = [];
                // Store top 5
                if (commentsMap[c.hopping_id].length < 5) {
                    commentsMap[c.hopping_id].push(c);
                }
            });

            // Cheers
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

        // --- Mix Content ---
        window.exploreState.content = [];

        // Bars (Shuffle and pick)
        if (barsData) {
            // Pre-fetch cities logic moved to render time or lazy load? 
            // Better to fetch now for simplicity, or createBarCard handles it?
            // createBarCard takes 'city'. Logic says check coordinates.
            // We'll run coordinate check for ALL bars? might be slow.
            // Let's do it lazy or just mix them.
            // Actually original code did `await Promise.all`.
            // Let's keep it but only for the ones we actually use?
            // For now, let's just mix them raw and fetch city inside createBarCard if needed?
            // But createBarCard is synchronous string builder.
            // We'll pre-fetch for ALL 40 bars? It's okay.
            await Promise.all(barsData.map(async (bar) => {
                if (bar.lat && bar.lng && window.fetchCityFromCoordsGlobal) {
                    bar.cityDisplay = await window.fetchCityFromCoordsGlobal(bar.lat, bar.lng);
                }
            }));
            barsData.forEach(bar => window.exploreState.content.push({ type: 'bar', data: bar }));
        }

        if (hopsData) {
            hopsData.forEach(hop => {
                // Enrich hop data immediately to avoid map lookups during render
                hop._user = usersMap[hop.user_id];
                hop._comments = commentsMap[hop.id] || [];
                hop._cheers = cheersMap[hop.id] || { count: 0, isCheered: false };
                window.exploreState.content.push({ type: 'hop', data: hop });
            });
        }

        if (articlesData) {
            articlesData.forEach(article => window.exploreState.content.push({ type: 'article', data: article }));
        }

        // Shuffle
        window.exploreState.content.sort(() => 0.5 - Math.random());

        // Clear Grid & Render First Batch
        grid.innerHTML = '';
        renderNextBatch();

    } catch (e) {
        console.error('Explore Init Error', e);
        grid.innerHTML = '<p style="text-align: center; color: #ef4444;">Something went wrong.</p>';
    }
}

function renderNextBatch() {
    const grid = document.getElementById('explore-feed');
    const state = window.exploreState;
    if (!state.hasMore || state.isLoading) return;

    state.isLoading = true;
    const nextItems = state.content.slice(state.currentIndex, state.currentIndex + state.pageSize);

    if (nextItems.length === 0) {
        state.hasMore = false;
        state.isLoading = false;
        // Optional: Show "End of content"
        return;
    }

    // Render HTML
    const html = nextItems.map(item => {
        if (item.type === 'bar') {
            return window.createBarCard(item.data, item.data.cityDisplay);
        } else if (item.type === 'hop') {
            return window.createHopCard(item.data, item.data._user, item.data._comments, item.data.bars, item.data._cheers);
        } else if (item.type === 'article') {
            return window.createArticleCard(item.data);
        }
        return '';
    }).join('');

    // Append (Using insertAdjacentHTML to not break existing DOM/Events)
    // Actually, simple innerHTML += breaks listeners on existing elements.
    // Must use insertAdjacentHTML 'beforeend'.
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html; // Temp container to parse

    // We cannot just append wrapper because we need column layout children direct in grid.
    // CSS Columns works on direct children.
    // So we append the HTML string directly?
    grid.insertAdjacentHTML('beforeend', html);

    // Initializations for new items (Maps, Badges)
    nextItems.forEach(item => {
        if (item.type === 'bar') {
            setTimeout(() => {
                if (item.data.lat && item.data.lng && window.initCardMapGlobal) {
                    window.initCardMapGlobal(item.data.id, item.data.lat, item.data.lng, item.data.title, false);
                }
                if (window.renderHoppingBadge) {
                    window.renderHoppingBadge(item.data.id);
                }
            }, 500);
        }
    });

    state.currentIndex += state.pageSize;
    state.isLoading = false;
}

function handleInfiniteScroll() {
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight >= scrollHeight - 300) {
        renderNextBatch();
    }
}
