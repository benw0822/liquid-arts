// --- Supabase Configuration ---
const SUPABASE_URL = 'https://wgnskednopbfngvjmviq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- DOM Elements ---
const titleInput = document.getElementById('article-title');
const excerptInput = document.getElementById('article-excerpt');
const tagsInput = document.getElementById('article-tags');
const categoryInput = document.getElementById('article-category');
const authorInput = document.getElementById('article-author');
const coverInput = document.getElementById('cover-file');
const coverPreview = document.getElementById('cover-preview');
// const barContainer = document.getElementById('bar-select-container'); // Removed
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const publishToggle = document.getElementById('publish-toggle');

// New Elements
const loadingOverlay = document.getElementById('loading-overlay');
const tocContainer = document.getElementById('toc-container');

// Related Bars Elements
const selectedBarsContainer = document.getElementById('selected-bars-container');
const barResultsContainer = document.getElementById('bar-results-container');
const barSearchInput = document.getElementById('bar-search');
const selectedCountLabel = document.getElementById('selected-count');

let quill;
let currentArticleId = null;
let currentCoverUrl = '';
let pendingImageUrl = ''; // Store URL while waiting for caption
let sessionUploadedPaths = []; // Track images uploaded in this session
let initialImagePaths = []; // Track images present at load time

// Related Bars State
let allBars = [];
let selectedBarIds = new Set();

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    initQuill();

    // Auto-resize Title Textarea
    titleInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    // Trigger once on load (after value is set)
    setTimeout(() => {
        titleInput.style.height = 'auto';
        titleInput.style.height = (titleInput.scrollHeight) + 'px';
    }, 500);

    // Check URL params for ID
    const urlParams = new URLSearchParams(window.location.search);
    currentArticleId = urlParams.get('id');

    // Load all bars for selection
    const { data: bars } = await supabase.from('bars').select('id, title, name_en');
    allBars = bars || [];
    renderAvailableBars();
    renderSelectedBars();

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

    // Toggle Label Logic
    publishToggle.addEventListener('change', () => {
        const label = publishToggle.parentElement.querySelector('.label-text');
        label.textContent = publishToggle.checked ? 'Published' : 'Draft';
        label.style.color = publishToggle.checked ? '#4cd964' : '#666';
    });
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

// --- Custom Image Blot (Figure + Caption) ---
const BlockEmbed = Quill.import('blots/block/embed');

class ImageFigure extends BlockEmbed {
    static create(value) {
        const node = super.create();

        const img = document.createElement('img');
        img.setAttribute('src', value.url);
        img.setAttribute('alt', value.caption || '');

        const caption = document.createElement('figcaption');
        caption.innerText = value.caption || '';
        // caption.setAttribute('contenteditable', 'true'); // Removed to prevent accidental deletion
        caption.style.cursor = 'pointer';
        caption.title = 'Click to edit caption';

        node.appendChild(img);
        node.appendChild(caption);

        return node;
    }

    static value(node) {
        const img = node.querySelector('img');
        const caption = node.querySelector('figcaption');
        return {
            url: img.getAttribute('src'),
            caption: caption ? caption.innerText : ''
        };
    }
}

ImageFigure.blotName = 'imageFigure';
ImageFigure.tagName = 'figure';
ImageFigure.className = 'article-figure';

Quill.register(ImageFigure, true);

// --- Instagram Embed Blot ---
class InstagramEmbed extends BlockEmbed {
    static create(url) {
        const node = super.create();
        const iframe = document.createElement('iframe');
        iframe.setAttribute('src', url);
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowtransparency', 'true');
        iframe.setAttribute('scrolling', 'no');
        iframe.style.width = '100%';
        iframe.style.maxWidth = '540px'; // Standard IG width
        iframe.style.height = '600px'; // Default height, user might need to adjust or we use JS to resize
        iframe.style.display = 'block';
        iframe.style.margin = '20px auto';
        node.appendChild(iframe);
        return node;
    }

    static value(node) {
        return node.querySelector('iframe').getAttribute('src');
    }
}
InstagramEmbed.blotName = 'instagram';
InstagramEmbed.tagName = 'div';
InstagramEmbed.className = 'instagram-embed';

Quill.register(InstagramEmbed, true);

// --- Quill Setup ---
function initQuill() {
    let modules = {
        toolbar: {
            container: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                [{ 'align': '' }, { 'align': 'center' }, { 'align': 'right' }, { 'align': 'justify' }], // Expanded Alignment
                [{ 'color': [] }, { 'background': [] }],
                ['link', 'image', 'video', 'instagram'], // Add Instagram button
                ['clean']
            ],
            handlers: {
                image: imageHandler,
                instagram: instagramHandler,
                video: videoHandler
            }
        },
        imageResize: {
            displaySize: true
        }
    };

    quill = new Quill('#editor-container', {
        theme: 'snow',
        placeholder: 'Write your story here...',
        modules: modules
    });

    // --- Add Instagram Icon ---
    const instagramBtn = document.querySelector('.ql-instagram');
    if (instagramBtn) {
        instagramBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>';
        instagramBtn.style.padding = '5px';
    }

    // --- Add YouTube Icon (Video) ---
    const videoBtn = document.querySelector('.ql-video');
    if (videoBtn) {
        videoBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>';
        videoBtn.style.padding = '5px';
        // videoBtn.style.color = '#FF0000'; // Removed for monochrome style
    }

    // --- Caption Click-to-Edit Logic ---
    const editorContainer = document.getElementById('editor-container');
    editorContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'FIGCAPTION' && e.target.parentElement.classList.contains('article-figure')) {
            const currentCaption = e.target.innerText;
            const newCaption = prompt('Edit caption:', currentCaption);
            if (newCaption !== null) {
                e.target.innerText = newCaption;
                // Also update the alt text of the image for consistency
                const img = e.target.parentElement.querySelector('img');
                if (img) img.setAttribute('alt', newCaption);
            }
        }
    });
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

                // 1. Insert Image with Caption
                const caption = prompt('Enter a caption for this image (optional):');

                const range = quill.getSelection(true);
                quill.insertEmbed(range.index, 'imageFigure', {
                    url: url,
                    caption: caption
                });

                // Move cursor after insertion
                quill.setSelection(range.index + 1);

            } catch (err) {
                loadingOverlay.style.display = 'none';
                alert('Image upload failed: ' + err.message);
            }
        }
        document.body.removeChild(input);
    };
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

    // Track this upload
    sessionUploadedPaths.push(fileName);

    return publicUrl;
}

// --- Instagram Handler ---
function instagramHandler() {
    let url = prompt('Enter Instagram Post URL:');
    if (url) {
        // Convert to embed URL if needed
        // Standard URL: https://www.instagram.com/p/CODE/
        // Embed URL: https://www.instagram.com/p/CODE/embed

        // Remove query params
        url = url.split('?')[0];

        // Ensure it ends with /embed
        if (!url.endsWith('/embed') && !url.endsWith('/embed/')) {
            if (!url.endsWith('/')) url += '/';
            url += 'embed';
        }

        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'instagram', url);
        quill.setSelection(range.index + 1);
    }
}


// --- Video Handler & Modal ---
const videoModal = document.getElementById('video-modal');
const videoUrlInput = document.getElementById('video-url-input');
const videoCancelBtn = document.getElementById('video-cancel-btn');
const videoInsertBtn = document.getElementById('video-insert-btn');

function videoHandler() {
    console.log('Video handler triggered');

    // Re-query elements to be safe
    const modal = document.getElementById('video-modal');
    const input = document.getElementById('video-url-input');

    if (!modal || !input) {
        console.error('Video modal elements not found!');
        return;
    }

    // Save current selection range to restore later
    const range = quill.getSelection();
    if (range) {
        quill.dataset.rangeIndex = range.index;
    }

    input.value = '';
    modal.style.display = 'flex';
    input.focus();
}

videoCancelBtn.addEventListener('click', () => {
    videoModal.style.display = 'none';
});

videoInsertBtn.addEventListener('click', () => {
    const url = videoUrlInput.value.trim();
    if (url) {
        const index = parseInt(quill.dataset.rangeIndex || 0);
        quill.insertEmbed(index, 'video', url);
        quill.setSelection(index + 1);
    }
    videoModal.style.display = 'none';
});

// --- Image Cleanup Helpers ---
function getPathFromUrl(url) {
    if (!url) return null;
    // URL format: .../storage/v1/object/public/articles/folder/filename
    // We want: folder/filename
    const marker = '/articles/';
    const index = url.indexOf(marker);
    if (index === -1) return null;
    return url.substring(index + marker.length);
}

async function cleanupImages(pathsToDelete) {
    if (!pathsToDelete || pathsToDelete.length === 0) return;

    console.log('Cleaning up images:', pathsToDelete);
    const { data, error } = await supabase.storage
        .from('articles')
        .remove(pathsToDelete);

    if (error) console.error('Cleanup error:', error);
    else console.log('Cleanup successful:', data);
}

// --- Cover Image & Cropping ---
const cropModal = document.getElementById('crop-modal');
const cropImage = document.getElementById('crop-image');
const cropSaveBtn = document.getElementById('crop-save-btn');
const cropCancelBtn = document.getElementById('crop-cancel-btn');
let cropper = null;
let currentFile = null;

coverInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        currentFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            // Check dimensions and upscale if needed
            const img = new Image();
            img.onload = () => {
                let src = img.src;

                // Auto-Upscale Logic
                const minWidth = 1200;
                if (img.width < minWidth) {
                    const canvas = document.createElement('canvas');
                    const scale = minWidth / img.width;
                    canvas.width = minWidth;
                    canvas.height = img.height * scale;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    src = canvas.toDataURL('image/jpeg', 0.9); // High quality upscale
                    console.log(`Auto-upscaled image from ${img.width}px to ${minWidth}px width.`);
                }

                // Open Modal
                cropImage.src = src;
                cropModal.style.display = 'flex';

                // Init Cropper
                if (cropper) cropper.destroy();
                cropper = new Cropper(cropImage, {
                    aspectRatio: 16 / 9,
                    viewMode: 1,
                    autoCropArea: 1,
                });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again if cancelled
    coverInput.value = '';
});

cropCancelBtn.addEventListener('click', () => {
    cropModal.style.display = 'none';
    if (cropper) cropper.destroy();
    cropper = null;
});

cropSaveBtn.addEventListener('click', async () => {
    if (!cropper) return;

    // Get cropped canvas
    // We request a high resolution canvas
    const canvas = cropper.getCroppedCanvas({
        width: 1200, // Force output width (or at least 1200)
        minWidth: 1200,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
    });

    canvas.toBlob(async (blob) => {
        if (!blob) {
            alert('Crop failed');
            return;
        }

        // Create a new File object from the blob
        const fileName = currentFile ? currentFile.name : 'cover.jpg';
        const croppedFile = new File([blob], fileName, { type: 'image/jpeg' });

        try {
            loadingOverlay.style.display = 'flex';
            cropModal.style.display = 'none';

            // Upload
            currentCoverUrl = await uploadImage(croppedFile, 'covers');

            // Update Preview
            coverPreview.style.backgroundImage = `url('${currentCoverUrl}')`;
            coverPreview.textContent = '';

            loadingOverlay.style.display = 'none';
        } catch (err) {
            loadingOverlay.style.display = 'none';
            alert('Upload failed: ' + err.message);
            // Show modal again if failed? Or just close.
        } finally {
            if (cropper) cropper.destroy();
            cropper = null;
        }
    }, 'image/jpeg', 0.9);
});

// --- Related Bars Logic ---
function renderSelectedBars() {
    selectedCountLabel.textContent = selectedBarIds.size;

    if (selectedBarIds.size === 0) {
        selectedBarsContainer.innerHTML = '<div style="padding: 10px; color: #999; font-style: italic;">No bars selected</div>';
        return;
    }

    selectedBarsContainer.innerHTML = '';
    selectedBarIds.forEach(id => {
        const bar = allBars.find(b => b.id === id);
        if (!bar) return;

        const div = document.createElement('div');
        div.className = 'bar-item selected-item';
        div.innerHTML = `
            <span>${bar.name_en || bar.title}</span>
            <span class="action-icon">&times;</span>
        `;
        div.onclick = () => {
            selectedBarIds.delete(id);
            renderSelectedBars();
            renderAvailableBars(barSearchInput.value);
        };
        selectedBarsContainer.appendChild(div);
    });
}

function renderAvailableBars(searchTerm = '') {
    const lowerTerm = searchTerm.toLowerCase();

    // Filter: Match name AND not already selected
    const filtered = allBars.filter(bar => {
        const name = (bar.name_en || bar.title || '').toLowerCase();
        return !selectedBarIds.has(bar.id) && name.includes(lowerTerm);
    });

    if (filtered.length === 0) {
        barResultsContainer.innerHTML = '<div style="padding: 10px; color: #999;">No matching bars found</div>';
        return;
    }

    barResultsContainer.innerHTML = '';
    filtered.forEach(bar => {
        const div = document.createElement('div');
        div.className = 'bar-item';
        div.innerHTML = `
            <span>${bar.name_en || bar.title}</span>
            <span class="action-icon">+</span>
        `;
        div.onclick = () => {
            selectedBarIds.add(bar.id);
            renderSelectedBars();
            renderAvailableBars(barSearchInput.value);
            barSearchInput.value = ''; // Clear search after adding? Optional. Let's keep it for now.
            barSearchInput.focus();
        };
        barResultsContainer.appendChild(div);
    });
}

// Search Listener
barSearchInput.addEventListener('input', (e) => {
    renderAvailableBars(e.target.value);
});


async function loadArticle(id) {
    const { data: article, error } = await supabase.from('articles').select('*').eq('id', id).single();
    if (error) {
        alert('Error loading article');
        return;
    }

    titleInput.value = article.title;
    excerptInput.value = article.excerpt || '';
    tagsInput.value = (article.tags || []).join(', ');
    categoryInput.value = article.category || '';
    authorInput.value = article.author_name || '';

    if (article.cover_image) {
        currentCoverUrl = article.cover_image;
        coverPreview.style.backgroundImage = `url('${article.cover_image}')`;
        coverPreview.textContent = '';
    }

    // Set Status
    if (article.status === 'published') {
        publishToggle.checked = true;
        publishToggle.parentElement.querySelector('.label-text').textContent = 'Published';
        publishToggle.parentElement.querySelector('.label-text').style.color = '#4cd964';
    } else {
        publishToggle.checked = false;
        publishToggle.parentElement.querySelector('.label-text').textContent = 'Draft';
    }

    quill.root.innerHTML = article.content || '';

    // Load Related Bars
    const { data: related } = await supabase.from('article_bars').select('bar_id').eq('article_id', id);
    if (related) {
        selectedBarIds = new Set(related.map(r => r.bar_id));
        renderSelectedBars();
        renderAvailableBars(); // Re-render available to exclude selected
    }

    // Track Initial Images
    initialImagePaths = [];
    if (article.cover_image) {
        const path = getPathFromUrl(article.cover_image);
        if (path) initialImagePaths.push(path);
    }

    // Parse content for images
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = article.content || '';
    tempDiv.querySelectorAll('img').forEach(img => {
        const path = getPathFromUrl(img.src);
        if (path) initialImagePaths.push(path);
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
            category: categoryInput.value,
            author_name: authorInput.value,
            tags,
            content,
            cover_image: currentCoverUrl,
            status: publishToggle.checked ? 'published' : 'draft',
            updated_at: new Date().toISOString()
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

        // 3. Save Related Bars
        // First, delete existing
        await supabase.from('article_bars').delete().eq('article_id', articleId);

        // Then insert new
        if (selectedBarIds.size > 0) {
            const barInserts = Array.from(selectedBarIds).map(barId => ({
                article_id: articleId,
                bar_id: barId
            }));
            const { error: barsError } = await supabase.from('article_bars').insert(barInserts);
            if (barsError) console.error('Error saving related bars:', barsError);
        }

        // --- Image Cleanup Logic (On Save) ---
        // 1. Identify all images currently in use
        const finalPaths = new Set();

        if (currentCoverUrl) {
            const path = getPathFromUrl(currentCoverUrl);
            if (path) finalPaths.add(path);
        }

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        tempDiv.querySelectorAll('img').forEach(img => {
            const path = getPathFromUrl(img.src);
            if (path) finalPaths.add(path);
        });

        // 2. Find paths to delete
        // Delete from session uploads if not in final
        const sessionToDelete = sessionUploadedPaths.filter(p => !finalPaths.has(p));
        // Delete from initial if not in final
        const initialToDelete = initialImagePaths.filter(p => !finalPaths.has(p));

        const allToDelete = [...new Set([...sessionToDelete, ...initialToDelete])];

        if (allToDelete.length > 0) {
            // Don't await this to speed up UI, or await if critical
            // Better to await to ensure it happens before redirect
            await cleanupImages(allToDelete);
        }

        alert('Saved successfully!');
        window.location.href = 'admin.html';

    } catch (err) {
        alert('Error: ' + err.message);
        saveBtn.textContent = 'Save Story';
        saveBtn.disabled = false;
    }
});

cancelBtn.addEventListener('click', async () => {
    if (confirm('Discard changes? This will delete any images uploaded in this session.')) {
        if (sessionUploadedPaths.length > 0) {
            loadingOverlay.style.display = 'flex';
            loadingOverlay.querySelector('div:last-child').textContent = 'Cleaning up...';
            await cleanupImages(sessionUploadedPaths);
        }
        window.location.href = 'admin.html';
    }
});
