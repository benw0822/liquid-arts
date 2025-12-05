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
const barContainer = document.getElementById('bar-select-container');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const publishToggle = document.getElementById('publish-toggle');

// New Elements
const loadingOverlay = document.getElementById('loading-overlay');
const tocContainer = document.getElementById('toc-container');

let quill;
let currentArticleId = null;
let currentCoverUrl = '';
let pendingImageUrl = ''; // Store URL while waiting for caption
let sessionUploadedPaths = []; // Track images uploaded in this session
let initialImagePaths = []; // Track images present at load time

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
                const range = quill.getSelection(true);
                quill.insertEmbed(range.index, 'image', url);

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

    // Load Relations
    const { data: relations } = await supabase.from('bar_articles').select('bar_id').eq('article_id', id);
    const relatedIds = (relations || []).map(r => r.bar_id);

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
