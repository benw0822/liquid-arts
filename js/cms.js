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
    let modules = {
        toolbar: {
            container: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                [{ 'color': [] }, { 'background': [] }],
                ['link', 'image', 'video'],
                ['clean']
            ]
        }
    };

    quill = new Quill('#editor-container', {
        theme: 'snow',
        placeholder: 'Write your story here...',
        modules: modules
    });

    // Manually attach image handler to ensure it overrides default
    const toolbar = quill.getModule('toolbar');
    toolbar.addHandler('image', imageHandler);

    // TOC Listener
    quill.on('text-change', () => {
        updateTOC();
    });

    setupImageInteraction();
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
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.style.display = 'none';
    document.body.appendChild(input);

    input.click();

    input.onchange = async () => {
        const file = input.files[0];
        if (file) {
            try {
                loadingOverlay.style.display = 'flex';
                const url = await uploadImage(file, 'content');
                loadingOverlay.style.display = 'none';

                // 1. Insert Image
                let range = quill.getSelection(true);
                if (!range) {
                    range = { index: quill.getLength() };
                }
                quill.insertEmbed(range.index, 'image', url);

                // 2. Open Modal for the new image
                setTimeout(() => {
                    const [leaf] = quill.getLeaf(range.index);
                    if (leaf) {
                        openCaptionModal(leaf);
                    }
                }, 100);

            } catch (err) {
                loadingOverlay.style.display = 'none';
                alert('Image upload failed: ' + err.message);
            }
        }
        document.body.removeChild(input);
    };
}

// Global state for current editing image
let currentImageBlot = null;

function setupImageInteraction() {
    // Simple click listener for images
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
    const imgNode = imageBlot.domNode;

    // 1. Reset Modal Styles
    const modalContent = captionModal.querySelector('.modal-content');
    modalContent.style.position = '';
    modalContent.style.top = '';
    modalContent.style.left = '';
    modalContent.style.transform = '';
    modalContent.style.margin = '';

    // 2. Get Caption / Alt Text
    const altText = imgNode.getAttribute('alt');
    if (altText) {
        captionInput.value = altText;
    } else {
        // Fallback to checking visible caption line
        const nextIndex = quill.getIndex(imageBlot) + 1;
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

const deleteCaptionBtn = document.getElementById('delete-caption-btn');

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

deleteCaptionBtn.addEventListener('click', () => {
    if (currentImageBlot) {
        if (confirm('Are you sure you want to delete this image?')) {
            const index = quill.getIndex(currentImageBlot);
            const nextIndex = index + 1;

            // Check for existing caption to delete it too
            let existingCaptionLine = null;
            if (nextIndex < quill.getLength()) {
                const [line] = quill.getLine(nextIndex);
                const formats = line.formats();
                if (formats.align === 'center' && formats.italic) {
                    existingCaptionLine = line;
                }
            }

            // Delete Caption first if exists (to avoid index shift issues, though Quill handles this well usually)
            if (existingCaptionLine) {
                const lineIndex = quill.getIndex(existingCaptionLine);
                quill.deleteText(lineIndex, existingCaptionLine.length());
            }

            // Delete Image
            quill.deleteText(index, 1);
        }
    }
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
