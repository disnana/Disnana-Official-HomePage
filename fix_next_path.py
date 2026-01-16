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
        print(f"Directory {old_dir} not found.")

    # 2. Update references in HTML and TXT files
    pattern = re.compile(r'/_next/')
    replacement = '/next_assets/'

    for root, dirs, files in os.walk(root_dir):
        # Skip .git directory
        if '.git' in dirs:
            dirs.remove('.git')
        
        for file in files:
            if file.endswith(('.html', '.txt')):
                file_path = os.path.join(root, file)
                
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                if pattern.search(content):
                    new_content = pattern.sub(replacement, content)
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Updated references in: {file_path}")

if __name__ == "__main__":
    fix_next_paths()
    print("Done.")
