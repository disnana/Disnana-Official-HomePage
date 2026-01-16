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
    # We use a case-sensitive replacement for /_next/
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
                
                # We need to handle possible encoding issues in binary-ish JS/CSS
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    if pattern.search(content):
                        new_content = pattern.sub(replacement, content)
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f"Updated references in: {file_path}")
                except Exception as e:
                    # If utf-8 fails, it might be a binary file or different encoding
                    # For safety in this environment, we just log and skip or try latin-1
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

if __name__ == "__main__":
    fix_next_paths()
    print("Optimization Complete.")
