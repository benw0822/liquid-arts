---
description: Prepare for Netlify deployment (Zip, Open Folder, Open Browser)
---

1. Zip the project files (excluding git and system files)
// turbo
2. Open the project folder and Netlify Drop website
```bash
zip -r liquid_arts_deploy.zip . -x ".git/*" ".DS_Store" ".agent/*"
open .
open https://app.netlify.com/drop
```
