
// js/admin_awards.js

// Global State
let currentAwards = [];
let currentAwardDetail = null;
let selectedBarForAward = null;

// Initialize when section loaded
window.initAwardsManager = async () => {
    console.log('Initializing Awards Manager...');
    await fetchAwards();
    setupAwardEventListeners();
};

// --- API Calls ---

async function fetchAwards() {
    try {
        const { data, error } = await window.supabaseClient
            .from('awards')
            .select('*, bar_awards(count)')
            .order('year', { ascending: false });

        if (error) throw error;

        currentAwards = data || [];
        renderAwardsList();
        updateStats();
    } catch (err) {
        console.error('Error fetching awards:', err);
        alert('Failed to load awards.');
    }
}

async function fetchAwardWinners(awardId) {
    try {
        const { data, error } = await window.supabaseClient
            .from('bar_awards')
            .select(`
                id,
                rank,
                bars ( id, title, image )
            `)
            .eq('award_id', awardId)
            // Try to sort by rank naturally if numeric, otherwise string
            // For mixed types, client sort is easier
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Enhance sorting
        // If purely numeric, sort numerically. Else string.
        return data.sort((a, b) => {
            const rA = parseInt(a.rank);
            const rB = parseInt(b.rank);
            if (!isNaN(rA) && !isNaN(rB)) return rA - rB;
            return (a.rank || '').localeCompare(b.rank || '');
        });
    } catch (err) {
        console.error('Error winners:', err);
        return [];
    }
}

// --- Rendering ---

function renderAwardsList() {
    const tbody = document.getElementById('awardsTableBody');
    tbody.innerHTML = '';

    currentAwards.forEach(award => {
        const winnerCount = award.bar_awards ? award.bar_awards[0].count : 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${award.year}</td>
            <td style="font-weight: 500;">${award.name}</td>
            <td><span class="badge badge-${award.type === 'ranking' ? 'purple' : 'blue'}">${award.type}</span></td>
            <td>${winnerCount} Winners</td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="openAwardDetail(${award.id})">Manage Winners</button>
                <button class="btn btn-secondary btn-sm" onclick="editAward(${award.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-secondary btn-sm" onclick="deleteAward(${award.id})" style="color:red;"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateStats() {
    document.getElementById('totalAwardsCount').innerText = currentAwards.length;
}

// --- Modals & Actions ---

// 1. Create / Edit Award
window.openCreateAwardModal = () => {
    document.getElementById('awardId').value = '';
    document.getElementById('awardForm').reset();
    document.getElementById('awardModalTitle').innerText = 'Create New Award';
    document.getElementById('awardModal').style.display = 'block';
};

window.editAward = (id) => {
    const award = currentAwards.find(a => a.id === id);
    if (!award) return;

    document.getElementById('awardId').value = award.id;
    document.getElementById('awardName').value = award.name;
    document.getElementById('awardYear').value = award.year;
    document.getElementById('awardType').value = award.type;

    document.getElementById('awardModalTitle').innerText = 'Edit Award';
    document.getElementById('awardModal').style.display = 'block';
};

window.deleteAward = async (id) => {
    if (!confirm('Are you sure? This will remove all winner associations too.')) return;
    try {
        const { error } = await window.supabaseClient.from('awards').delete().eq('id', id);
        if (error) throw error;
        await fetchAwards();
    } catch (err) {
        alert(err.message);
    }
};

// 2. Manage Winners Detail
window.openAwardDetail = async (id) => {
    const award = currentAwards.find(a => a.id === id);
    if (!award) return;

    currentAwardDetail = award;
    document.getElementById('awardDetailTitle').innerText = `Manage: ${award.name} (${award.year})`;
    document.getElementById('awardRankInput').placeholder = award.type === 'ranking' ? 'Rank #' : 'Tier (e.g. 1 Star)';

    // Clear inputs
    document.getElementById('awardBarSearch').value = '';
    selectedBarForAward = null;

    await refreshWinnersTable(id);
    document.getElementById('awardDetailModal').style.display = 'block';
};

async function refreshWinnersTable(awardId) {
    const tbody = document.getElementById('awardWinnersTableBody');
    tbody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';

    const winners = await fetchAwardWinners(awardId);

    tbody.innerHTML = '';
    if (winners.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No winners yet. Add one above.</td></tr>';
        return;
    }

    winners.forEach(w => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:bold;">${w.rank}</td>
            <td>${w.bars ? w.bars.title : 'Unknown Bar'}</td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="removeWinner(${w.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Handlers ---

function setupAwardEventListeners() {
    // Nav Click Listener (In admin.html usually main logic handles this, 
    // but ensure we init when tab clicked if not strictly loaded by cms.js)

    // Create Button
    const createBtn = document.getElementById('createAwardBtn');
    if (createBtn) createBtn.onclick = window.openCreateAwardModal;

    // Award Form Submit
    const awardForm = document.getElementById('awardForm');
    if (awardForm) {
        awardForm.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('awardId').value;
            const name = document.getElementById('awardName').value;
            const year = document.getElementById('awardYear').value;
            const type = document.getElementById('awardType').value;

            const payload = { name, year, type };

            try {
                let error;
                if (id) {
                    ({ error } = await window.supabaseClient.from('awards').update(payload).eq('id', id));
                } else {
                    ({ error } = await window.supabaseClient.from('awards').insert(payload));
                }

                if (error) throw error;

                document.getElementById('awardModal').style.display = 'none';
                await fetchAwards();
            } catch (err) {
                alert('Error saving award: ' + err.message);
            }
        };
    }

    // Bar Search
    const searchInput = document.getElementById('awardBarSearch');
    const resultsDiv = document.getElementById('awardBarSearchResults');

    if (searchInput) {
        searchInput.oninput = async (e) => {
            const term = e.target.value;
            if (term.length < 2) {
                resultsDiv.style.display = 'none';
                return;
            }

            const { data } = await window.supabaseClient
                .from('bars')
                .select('id, title, image')
                .ilike('title', `%${term}%`)
                .limit(5);

            resultsDiv.innerHTML = '';
            if (data && data.length > 0) {
                data.forEach(bar => {
                    const div = document.createElement('div');
                    div.style.padding = '8px';
                    div.style.borderBottom = '1px solid #eee';
                    div.style.cursor = 'pointer';
                    div.innerText = bar.title;
                    div.onclick = () => {
                        selectedBarForAward = bar;
                        searchInput.value = bar.title; // Show name
                        resultsDiv.style.display = 'none';
                    };
                    resultsDiv.appendChild(div);
                });
                resultsDiv.style.display = 'block';
            } else {
                resultsDiv.style.display = 'none';
            }
        };
    }

    // Add Winner Button
    const addWinnerBtn = document.getElementById('addWinnerBtn');
    if (addWinnerBtn) {
        addWinnerBtn.onclick = async () => {
            if (!currentAwardDetail || !selectedBarForAward) {
                alert('Please search and select a bar first.');
                return;
            }
            const rank = document.getElementById('awardRankInput').value;
            if (!rank) {
                alert('Please enter a Rank or Tier.');
                return;
            }

            try {
                const { error } = await window.supabaseClient.from('bar_awards').insert({
                    award_id: currentAwardDetail.id,
                    bar_id: selectedBarForAward.id,
                    rank: rank
                });

                if (error) {
                    if (error.code === '23505') alert('This bar is already added to this award.');
                    else throw error;
                    return;
                }

                // Clear
                document.getElementById('awardBarSearch').value = '';
                document.getElementById('awardRankInput').value = '';
                selectedBarForAward = null;

                // Refresh
                await refreshWinnersTable(currentAwardDetail.id);
                fetchAwards(); // Update count in list
            } catch (err) {
                alert(err.message);
            }
        };
    }

    // Close Modals
    document.querySelectorAll('.close-modal').forEach(span => {
        span.onclick = function () {
            this.closest('.modal').style.display = 'none';
        };
    });
}

window.removeWinner = async (id) => {
    if (!confirm('Remove this bar from the award?')) return;
    try {
        const { error } = await window.supabaseClient.from('bar_awards').delete().eq('id', id);
        if (error) throw error;
        await refreshWinnersTable(currentAwardDetail.id);
        fetchAwards(); // Refresh count
    } catch (err) {
        alert(err.message);
    }
};
