import glob
import re
import os

files = glob.glob("*.html")

# Regex Setups
navbar_pattern = re.compile(r'<nav class="navbar">[\s\S]*?</nav>', re.DOTALL)
bottom_nav_pattern = re.compile(r'<nav class="bottom-nav">[\s\S]*?</nav>', re.DOTALL)

# Default Auth Button (Mobile & Desktop)
# ... Same as before ...
navbar_new = r'''<nav class="navbar">
        <div class="container nav-content" style="display: flex; align-items: center; justify-content: space-between;">
            <a href="index.html" class="logo">
                <img src="assets/logo_horizontal.png" alt="Liquid Arts" class="logo-img">
            </a>

            <!-- Desktop Nav Links -->
            <div class="nav-links" style="margin-left: 2rem;">
                <a href="bars.html" class="nav-link">Bars</a>
                <a href="map.html" class="nav-link">Map</a>
                <a href="journal.html" class="nav-link">Journal</a>
                <a href="events.html" class="nav-link">Event</a>
                <a href="about.html" class="nav-link">About</a>
                <!-- Cache Buster Utility -->
                <button onclick="clearAppCache()" class="nav-link" style="background:none; border:none; cursor:pointer; color:inherit; display:inline-flex; align-items:center; opacity:0.7;" title="Clear Cache & Reload">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
            </div>

            <!-- Global Auth Button (Mobile & Desktop) -->
            <a href="profile.html" id="global-auth-btn" class="nav-link" aria-label="Profile" style="margin-left: auto; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; color: var(--text-accent);">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
            </a>
        </div>
    </nav>'''

# Bottom Nav - Front Page Newspaper Icon (Image + Text)
bottom_nav_new = r'''<nav class="bottom-nav">
        <a href="bars.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <!-- Triangle Cocktail Glass -->
                <path d="M12 21v-8"></path>
                <path d="M5 4l7 9 7-9H5z"></path>
                <path d="M7 21h10"></path>
            </svg>
            <span>Bars</span>
        </a>
        <a href="map.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>Map</span>
        </a>
        <a href="journal.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <!-- Single Sheet Newspaper with Image and Text -->
                <!-- The Page Frame -->
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"></path>
                <!-- Image Placeholder (Rect) -->
                <rect x="7" y="7" width="10" height="6"></rect>
                <!-- Text Lines -->
                <path d="M7 15h10"></path>
                <path d="M7 18h6"></path>
            </svg>
            <span>Journal</span>
        </a>
        <a href="events.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>Event</span>
        </a>
        <a href="profile.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Pocket</span>
        </a>
    </nav>'''

# Helper to find insertion point
def update_or_insert_bottom_nav(content):
    if '<nav class="bottom-nav">' in content:
        return bottom_nav_pattern.sub(bottom_nav_new, content)
    else:
        if '<footer>' in content:
            return content.replace('<footer>', bottom_nav_new + '\n    <footer>')
        elif '<script src="js/app.js">' in content:
            return content.replace('<script src="js/app.js">', bottom_nav_new + '\n    <script src="js/app.js">')
        elif '</body>' in content:
            return content.replace('</body>', bottom_nav_new + '\n</body>')
        return content

for fpath in files:
    if fpath.endswith("update_navs.py"): continue
    
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = navbar_pattern.sub(navbar_new, content)
    new_content = update_or_insert_bottom_nav(new_content)

    # Nuclear Cache Busting (Force Browser Reload)
    new_content = re.sub(r'href="css/styles\.css.*?"', 'href="css/styles.css?v=force"', new_content)
    new_content = re.sub(r'src="js/app\.js.*?"', 'src="js/app.js?v=force"', new_content)

    if content != new_content:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {fpath}")
