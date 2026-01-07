import json
import urllib.request
import urllib.parse
from datetime import datetime

# Configuration
SUPABASE_URL = 'https://auth.liquidarts.bar'
SUPABASE_KEY = 'sb_publishable_gcmYleFIGmwsLSKofS__Qg_62EXoP6P'
BASE_URL = 'https://www.liquidarts.bar'

STATIC_PAGES = [
    '',
    '/index.html',
    '/explore.html',
    '/bars.html',
    '/map.html',
    '/journal.html',
    '/events.html'
]

def fetch_data(table, query_params):
    """Fetch data from Supabase via REST API"""
    url = f"{SUPABASE_URL}/rest/v1/{table}?{urllib.parse.urlencode(query_params)}"
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}'
    }
    
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            return json.load(response)
    except Exception as e:
        print(f"Error fetching {table}: {e}")
        return []

def generate_sitemap():
    print("Generating sitemap...")
    urls = []
    
    # 1. Static Pages
    print(f"Adding {len(STATIC_PAGES)} static pages...")
    current_date = datetime.now().strftime('%Y-%m-%d')
    for page in STATIC_PAGES:
        priority = '1.0' if page in ['', '/index.html'] else '0.8'
        urls.append({
            'loc': f"{BASE_URL}{page}" if page.startswith('/') else f"{BASE_URL}/{page}",
            'lastmod': current_date,
            'changefreq': 'daily',
            'priority': priority
        })

    # 2. Bars
    print("Fetching Bars...")
    # Fetch slug, id, updated_at (if available, using created_at as fallback)
    bars = fetch_data('bars', {'select': 'id,slug,created_at,is_published', 'is_published': 'eq.true'})
    print(f"Found {len(bars)} bars.")
    
    for bar in bars:
        # Prefer slug if available
        if bar.get('slug'):
            loc = f"{BASE_URL}/{bar['slug']}"
        else:
            loc = f"{BASE_URL}/bar.html?id={bar['id']}"
            
        urls.append({
            'loc': loc,
            'lastmod': bar.get('created_at', current_date)[:10], # Take YYYY-MM-DD
            'changefreq': 'weekly',
            'priority': '0.9'
        })

    # 3. Articles
    print("Fetching Articles...")
    articles = fetch_data('articles', {'select': 'id,slug,published_at,status', 'status': 'eq.published'})
    print(f"Found {len(articles)} articles.")
    
    for article in articles:
        if article.get('slug'):
            loc = f"{BASE_URL}/article/{article['slug']}"
        else:
            loc = f"{BASE_URL}/journal-details.html?id={article['id']}"
            
        urls.append({
            'loc': loc,
            'lastmod': article.get('published_at', current_date)[:10] if article.get('published_at') else current_date,
            'changefreq': 'weekly',
            'priority': '0.7'
        })

    # Generate XML
    xml_content = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml_content += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    
    for url in urls:
        xml_content += '    <url>\n'
        xml_content += f"        <loc>{url['loc']}</loc>\n"
        xml_content += f"        <lastmod>{url['lastmod']}</lastmod>\n"
        xml_content += f"        <changefreq>{url['changefreq']}</changefreq>\n"
        xml_content += f"        <priority>{url['priority']}</priority>\n"
        xml_content += '    </url>\n'
    
    xml_content += '</urlset>'
    
    with open('sitemap.xml', 'w') as f:
        f.write(xml_content)
        
    print(f"Successfully generated sitemap.xml with {len(urls)} URLs.")

if __name__ == "__main__":
    generate_sitemap()
