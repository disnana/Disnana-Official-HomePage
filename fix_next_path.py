import os
import re

def fix_next_paths():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    old_dir = os.path.join(root_dir, "_next")
    new_dir = os.path.join(root_dir, "next_assets")

    # 1. Rename _next directory to next_assets
    if os.path.exists(old_dir):
        if os.path.exists(new_dir):
            print(f"Directory {new_dir} already exists. Skipping rename.")
        else:
            os.rename(old_dir, new_dir)
            print(f"Renamed {old_dir} to {new_dir}")
    else:
        print(f"Directory {old_dir} not found. (Maybe already renamed?)")

    # 2. Update references in HTML, TXT, JS, JSON, and CSS files
    pattern = re.compile(r'/_next/')
    replacement = '/next_assets/'

    # Extensions to check
    target_extensions = ('.html', '.txt', '.js', '.json', '.css')

    print(f"Scanning for references in {target_extensions}...")

    for root, dirs, files in os.walk(root_dir):
        # Skip .git directory
        if '.git' in dirs:
            dirs.remove('.git')
        
        for file in files:
            if file.lower().endswith(target_extensions):
                file_path = os.path.join(root, file)
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    if pattern.search(content):
                        new_content = pattern.sub(replacement, content)
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f"Updated references in: {file_path}")
                except Exception as e:
                    try:
                        with open(file_path, 'r', encoding='latin-1') as f:
                            content = f.read()
                        if pattern.search(content):
                            new_content = pattern.sub(replacement, content)
                            with open(file_path, 'w', encoding='latin-1') as f:
                                f.write(new_content)
                            print(f"Updated references in (latin-1): {file_path}")
                    except Exception as e2:
                        print(f"Could not process {file_path}: {e2}")

    # 3. Fix React loading screen overlay issue
    # The static export has a React loading overlay that doesn't get removed
    # because hydration never completes. We need to add a script to remove it.
    print("\nFixing stuck React loading overlay...")
    
    # Script to inject - removes the React loading overlay after timeout
    fix_script = '''<script>
// Fix: Remove stuck React loading overlay after 3 seconds
setTimeout(function() {
  var overlay = document.querySelector('.fixed.inset-0.z-\\\\[100\\\\]');
  if (overlay) overlay.style.display = 'none';
  var preloader = document.getElementById('preloader');
  if (preloader) preloader.classList.add('fade-out');
}, 3000);
</script>'''
    
    # Find and update HTML files
    for file in os.listdir(root_dir):
        if file.endswith('.html'):
            file_path = os.path.join(root_dir, file)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Check if our fix script is already present
                if 'Fix: Remove stuck React loading overlay' not in content:
                    # Insert our script before </head>
                    if '</head>' in content:
                        new_content = content.replace('</head>', fix_script + '</head>')
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f"Injected overlay fix into: {file_path}")
            except Exception as e:
                print(f"Could not process {file_path}: {e}")

if __name__ == "__main__":
    fix_next_paths()
    print("\nOptimization Complete.")
