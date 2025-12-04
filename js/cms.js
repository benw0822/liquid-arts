// --- Supabase Configuration ---
const SUPABASE_URL = 'https://wgnskednopbfngvjmviq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- DOM Elements ---
const titleInput = document.getElementById('article-title');
const excerptInput = document.getElementById('article-excerpt');
const tagsInput = document.getElementById('article-tags');
const authorInput = document.getElementById('article-author');
const coverInput = document.getElementById('cover-file');
const coverPreview = document.getElementById('cover-preview');
const barContainer = document.getElementById('bar-select-container');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');

// New Elements
const loadingOverlay = document.getElementById('loading-overlay');
const captionModal = document.getElementById('caption-modal');
const captionInput = document.getElementById('caption-input');
const confirmCaptionBtn = document.getElementById('confirm-caption-btn');
const skipCaptionBtn = document.getElementById('skip-caption-btn');
const tocContainer = document.getElementById('toc-container');

let quill;
let currentArticleId = null;
let currentCoverUrl = '';
let pendingImageUrl = ''; // Store URL while waiting for caption

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    initQuill();

    // Check URL params for ID
    const urlParams = new URLSearchParams(window.location.search);
    currentArticleId = urlParams.get('id');

    await loadBars();

    if (currentArticleId) {
        await loadArticle(currentArticleId);
    } else {
        // New Article Defaults
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            // Fetch user name for author default
            const { data: user } = await supabase.from('users').select('name').eq('id', session.user.id).single();
            if (user && user.name) authorInput.value = user.name;
        }
    }
});

// --- Auth Check ---
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'admin.html';
        return;
    }

    // Verify Role
    const { data: user } = await supabase.from('users').select('roles').eq('id', session.user.id).single();
    const roles = user ? (user.roles || []) : [];
    if (!roles.includes('admin') && !roles.includes('editor')) {
        alert('Access Denied');
        window.location.href = 'admin.html';
    }
}

// --- Quill Setup ---
function initQuill() {
    quill = new Quill('#editor-container', {
        theme: 'snow',
        placeholder: 'Write your story here...',
        modules: {
            toolbar: {
                container: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'color': [] }, { 'background': [] }],
                    ['link', 'image', 'video'],
                    ['clean']
                ],
                handlers: {
                    image: imageHandler
                }
            }
        }
    });

    // TOC Listener
    quill.on('text-change', () => {
        updateTOC();
    });

    setupImageClickListeners();
}

// --- TOC Logic ---
function updateTOC() {
    const headers = [];
    const delta = quill.getContents();

    // Simple scan for headers
    // Note: Quill stores headers as attributes on the newline character
    // We need to iterate lines to find headers

    // Alternative: Use DOM traversal which is easier for structure
    const editorRoot = quill.root;
    const headerNodes = editorRoot.querySelectorAll('h1, h2, h3');

    if (headerNodes.length === 0) {
        tocContainer.innerHTML = '<div style="color: #999; font-size: 0.9em; font-style: italic;">Headings will appear here...</div>';
        return;
    }

    let html = '';
    headerNodes.forEach((node, index) => {
        const text = node.textContent;
        if (!text) return;

        // Add ID to node for scrolling if not present
        if (!node.id) node.id = `header-${index}`;

        const tagName = node.tagName.toLowerCase();
        html += `<div class="toc-item toc-${tagName}" onclick="scrollToHeader('${node.id}')">${text}</div>`;
    });

    tocContainer.innerHTML = html;
}

window.scrollToHeader = (id) => {
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

// --- Image Handling ---
function imageHandler() {
    // Save current selection range
    const range = quill.getSelection(true);

    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
        const file = input.files[0];
        if (file) {
            try {
                loadingOverlay.style.display = 'flex'; // Show Loading
                const url = await uploadImage(file, 'content');
                loadingOverlay.style.display = 'none'; // Hide Loading

                // 1. Insert Image at the saved index
                // We use the saved range to ensure it goes where the user intended
                quill.insertEmbed(range.index, 'image', url);

                // 2. Force a layout update / wait for render
                setTimeout(() => {
                    // 3. Find the inserted image blot
                    // The image should be at the original index
                    const [leaf] = quill.getLeaf(range.index);

                    if (leaf && leaf.domNode && leaf.domNode.tagName === 'IMG') {
                        // 4. Scroll it into view so the user sees it
                        leaf.domNode.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        // 5. Open Caption Modal
                        openCaptionModal(leaf);
                    } else {
                        console.error('Could not find inserted image blot');
                    }
                }, 100); // Small delay to allow DOM to paint

            } catch (err) {
                loadingOverlay.style.display = 'none';
                alert('Image upload failed: ' + err.message);
            }
        }
    };
}

// Global state for current editing image
let currentImageBlot = null;

// Listen for clicks on images to edit caption
// We need to wait for Quill to be ready, so we add this in initQuill or after
function setupImageClickListeners() {
    quill.root.addEventListener('click', (e) => {
        if (e.target && e.target.tagName === 'IMG') {
            const blot = Quill.find(e.target);
            if (blot) {
                openCaptionModal(blot);
            }
        }
    });
}

function openCaptionModal(imageBlot) {
    currentImageBlot = imageBlot;
    const index = quill.getIndex(imageBlot);

    // 1. Position Modal over Image
    const imgNode = imageBlot.domNode;
    const rect = imgNode.getBoundingClientRect();
    const modalContent = captionModal.querySelector('.modal-content');

    // Reset styles to ensure absolute positioning works
    modalContent.style.position = 'absolute';
    modalContent.style.margin = '0';

    // Calculate center of image
    // We use fixed positioning relative to viewport (since modal wrapper is fixed)
    const top = rect.top + (rect.height / 2);
    const left = rect.left + (rect.width / 2);

    modalContent.style.top = `${top}px`;
    modalContent.style.left = `${left}px`;
    modalContent.style.transform = 'translate(-50%, -50%)';

    // 2. Get Caption / Alt Text
    // Priority: Alt Text > Visible Caption > Empty
    const altText = imgNode.getAttribute('alt');

    if (altText) {
        captionInput.value = altText;
    } else {
        // Fallback to checking visible caption line
        const nextIndex = index + 1;
        if (nextIndex < quill.getLength()) {
            const [line] = quill.getLine(nextIndex);
            const formats = line.formats();
            if (formats.align === 'center' && formats.italic) {
                captionInput.value = line.domNode.textContent;
            } else {
                captionInput.value = '';
            }
        } else {
            captionInput.value = '';
        }
    }

    captionModal.classList.add('active');
}

// Caption Modal Logic
confirmCaptionBtn.addEventListener('click', () => {
    if (currentImageBlot) {
        setCaption(currentImageBlot, captionInput.value);
    }
    captionModal.classList.remove('active');
    currentImageBlot = null;
});

skipCaptionBtn.addEventListener('click', () => {
    captionModal.classList.remove('active');
    currentImageBlot = null;
});

function setCaption(imageBlot, text) {
    const index = quill.getIndex(imageBlot);
    const nextIndex = index + 1;
    const imgNode = imageBlot.domNode;

    // 1. Set SEO Alt Attribute
    if (text) {
        imgNode.setAttribute('alt', text);
    } else {
        imgNode.removeAttribute('alt');
    }

    // 2. Handle Visible Caption
    let existingCaptionLine = null;
    if (nextIndex < quill.getLength()) {
        const [line] = quill.getLine(nextIndex);
        const formats = line.formats();
        if (formats.align === 'center' && formats.italic) {
            existingCaptionLine = line;
        }
    }

    if (text) {
        if (existingCaptionLine) {
            // Update existing
            const lineIndex = quill.getIndex(existingCaptionLine);
            const lineLength = existingCaptionLine.length();
            quill.deleteText(lineIndex, lineLength);
            quill.insertText(lineIndex, text, { 'italic': true });
            quill.formatLine(lineIndex, 1, 'align', 'center');
        } else {
            // Insert new caption
            // We insert a newline then the caption
            quill.insertText(nextIndex, '\n' + text, { 'italic': true });
            quill.formatLine(nextIndex + 1, 1, 'align', 'center');
        }
    } else {
        // Remove caption if empty and exists
        if (existingCaptionLine) {
            const lineIndex = quill.getIndex(existingCaptionLine);
            quill.deleteText(lineIndex, existingCaptionLine.length());
        }
    }
}

// --- Image Upload ---
async function uploadImage(file, folder = 'covers') {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data, error } = await supabase.storage
        .from('articles')
        .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
        .from('articles')
        .getPublicUrl(fileName);

    return publicUrl;
}

// Cover Preview
coverInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            coverPreview.style.backgroundImage = `url('${e.target.result}')`;
            coverPreview.textContent = '';
        };
        reader.readAsDataURL(file);
    }
});

// --- Data Loading ---
async function loadBars() {
    const { data: bars } = await supabase.from('bars').select('id, title, name_en');
    barContainer.innerHTML = (bars || []).map(b => `
        <label style="display: flex; align-items: center; margin-bottom: 8px; cursor: pointer; color: #ddd;">
            <input type="checkbox" value="${b.id}" style="margin-right: 10px;">
            ${b.name_en || b.title}
        </label>
    `).join('');
}

async function loadArticle(id) {
    const { data: article, error } = await supabase.from('articles').select('*').eq('id', id).single();
    if (error) {
        alert('Error loading article');
        return;
    }

    titleInput.value = article.title;
    excerptInput.value = article.excerpt || '';
    tagsInput.value = (article.tags || []).join(', ');
    authorInput.value = article.author_name || '';

    if (article.cover_image) {
        currentCoverUrl = article.cover_image;
        coverPreview.style.backgroundImage = `url('${article.cover_image}')`;
        coverPreview.textContent = '';
    }

    quill.root.innerHTML = article.content || '';

    // Load Relations
    const { data: relations } = await supabase.from('bar_articles').select('bar_id').eq('article_id', id);
    const relatedIds = (relations || []).map(r => r.bar_id);

    // Check boxes
    barContainer.querySelectorAll('input').forEach(cb => {
        if (relatedIds.includes(parseInt(cb.value))) cb.checked = true;
    });
}

// --- Saving ---
saveBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    if (!title) { alert('Title is required'); return; }

    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
        const { data: { session } } = await supabase.auth.getSession();

        // Upload Cover if changed
        const coverFile = coverInput.files[0];
        if (coverFile) {
            currentCoverUrl = await uploadImage(coverFile, 'covers');
        }

        const tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);
        const content = quill.root.innerHTML;

        const articleData = {
            title,
            excerpt: excerptInput.value,
            author_name: authorInput.value,
            tags,
            content,
            cover_image: currentCoverUrl
        };

        let articleId = currentArticleId;

        if (currentArticleId) {
            // Update
            const { error } = await supabase.from('articles').update(articleData).eq('id', currentArticleId);
            if (error) throw error;
        } else {
            // Insert
            articleData.author_id = session.user.id;
            const { data, error } = await supabase.from('articles').insert([articleData]).select();
            if (error) throw error;
            articleId = data[0].id;
        }

        // Update Relations
        const selectedBars = Array.from(barContainer.querySelectorAll('input:checked')).map(cb => cb.value);

        // 1. Delete old
        if (currentArticleId) {
            await supabase.from('bar_articles').delete().eq('article_id', articleId);
        }
        // 2. Insert new
        if (selectedBars.length > 0) {
            const relations = selectedBars.map(bid => ({ bar_id: bid, article_id: articleId }));
            await supabase.from('bar_articles').insert(relations);
        }

        alert('Saved successfully!');
        window.location.href = 'admin.html';

    } catch (err) {
        alert('Error: ' + err.message);
        saveBtn.textContent = 'Save Story';
        saveBtn.disabled = false;
    }
});

cancelBtn.addEventListener('click', () => {
    if (confirm('Discard changes?')) {
        window.location.href = 'admin.html';
    }
});
