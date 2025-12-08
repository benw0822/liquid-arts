import glob
import re
import os

files = glob.glob("*.html")

# Regex Setups
navbar_pattern = re.compile(r'<nav class="navbar">[\s\S]*?</nav>', re.DOTALL)
bottom_nav_pattern = re.compile(r'<nav class="bottom-nav">[\s\S]*?</nav>', re.DOTALL)

# New Icons (Thinner, Wireframe, Cleaner)
# Removing 'stroke-width' inline to let CSS control it (or setting to inherit).
# Actually, setting visual attributes in CSS is cleaner.
# I will use 'stroke-width="1.5"' here or remove it?
# styles.css sets .nav-icon { stroke-width: 1.5; }
# So I will remove it from inline.

# Navbar (Desktop/Mobile Header)
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

# Bottom Nav (Mobile) - Wireframe Style
# Colors controlled by CSS (White -> Black)
bottom_nav_new = r'''<nav class="bottom-nav">
        <a href="bars.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 21h8m-4-12v12m-8-14h16l-5 5v3h-6v-3l-5-5z"></path>
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
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
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

# Insert Helper
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

    if content != new_content:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {fpath}")
