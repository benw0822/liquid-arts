import glob
import re
import os

files = glob.glob("*.html")

# Top Nav Replacement (Flexible Regex)
# Match <a href="admin.html" ... >Login</a>, ignoring attributes order/content
# This handles files that already have id="login-btn" or different styles
top_nav_pattern = re.compile(r'<a\s+href="admin\.html"[^>]*class="nav-link"[^>]*>\s*Login\s*</a>', re.IGNORECASE)

top_nav_new = r'''<a href="profile.html" class="nav-link" id="login-btn" aria-label="Login" style="display: flex; align-items: center; color: var(--text-accent);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                </a>'''

# Bottom Nav Pattern (Existing)
bottom_nav_pattern = re.compile(r'<nav class="bottom-nav">[\s\S]*?</nav>', re.DOTALL)

bottom_nav_new = r'''<nav class="bottom-nav">
        <a href="bars.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 21h8m-4-12v12m-8-14h16l-5 5v3h-6v-3l-5-5z"></path>
            </svg>
            <span>Bars</span>
        </a>
        <a href="map.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>Map</span>
        </a>
        <a href="journal.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            <span>Journal</span>
        </a>
        <a href="events.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>Event</span>
        </a>
        <a href="profile.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
        # Insertion Logic (Order of preference)
        # 1. Before Footer
        if '<footer>' in content:
            return content.replace('<footer>', bottom_nav_new + '\n    <footer>')
        # 2. Before JS Scripts
        elif '<script src="js/app.js">' in content:
            return content.replace('<script src="js/app.js">', bottom_nav_new + '\n    <script src="js/app.js">')
        # 3. Before Body End
        elif '</body>' in content:
            return content.replace('</body>', bottom_nav_new + '\n</body>')
        return content

for fpath in files:
    if fpath.endswith("update_navs.py"): continue
    
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = top_nav_pattern.sub(top_nav_new, content)
    new_content = update_or_insert_bottom_nav(new_content)

    if content != new_content:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {fpath}")
