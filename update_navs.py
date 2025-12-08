import glob
import re
import os

files = glob.glob("*.html")

# Pattern: Entire <nav class="navbar"> ... </nav> block
# Regex uses dotall to snatch the whole block
navbar_pattern = re.compile(r'<nav class="navbar">[\s\S]*?</nav>', re.DOTALL)

# New Navbar HTML
# Features:
# 1. Logo
# 2. Global Auth Button (Icon) placed OUTSIDE .nav-links so it's visible on Mobile (since .nav-links is hidden on mobile)
# 3. .nav-links (Desktop Menu)
# Note: style margin-left: auto on Auth Button pushes it to the right.
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

            <!-- Global Auth Button (Visible on Mobile & Desktop) -->
            <a href="profile.html" id="global-auth-btn" class="nav-link" aria-label="Profile" style="margin-left: auto; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; color: var(--text-accent);">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
            </a>
        </div>
    </nav>'''
# Note: 'justify-content: space-between' might conflict with manual margins?
# Ideally:
# Mobile: nav-links hidden. Logo (Left), Auth (Right through margin-left: auto or flex push).
# Desktop: Logo (Left), Nav Links (Left/Center), Auth (Right).

for fpath in files:
    if fpath.endswith("update_navs.py"): continue
    
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = navbar_pattern.sub(navbar_new, content)

    if content != new_content:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated Navbar in {fpath}")
