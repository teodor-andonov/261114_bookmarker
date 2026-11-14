#!/usr/bin/env python3
"""Build a static GitHub Pages site, automatically listing dated prototype folders."""
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "dist"
PATTERN = re.compile(r"^(\d{6})_([a-z0-9][a-z0-9-]*)$")

def main():
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir()
    for name in ("index.html", "site.css", "site.js", "manifest.webmanifest", "sw.js"):
        shutil.copy2(ROOT / name, OUTPUT / name)
    shutil.copytree(ROOT / "icons", OUTPUT / "icons")
    (OUTPUT / ".nojekyll").touch()
    projects = []
    for folder in sorted(ROOT.iterdir(), reverse=True):
        match = PATTERN.fullmatch(folder.name)
        if not folder.is_dir() or not match or not (folder / "index.html").is_file():
            continue
        info_path = folder / "prototype.json"
        info = json.loads(info_path.read_text(encoding="utf-8")) if info_path.is_file() else {}
        title = str(info.get("title") or match.group(2).replace("-", " ").title())[:100]
        project = {
            "folder": folder.name,
            "date": match.group(1),
            "title": title,
            "description": str(info.get("description") or "Standalone prototype")[:360],
            "category": str(info.get("category") or "Web app")[:40],
            "status": str(info.get("status") or "Prototype")[:40],
            "monogram": str(info.get("monogram") or title[:2]).upper()[:4],
            "tags": [str(tag)[:45] for tag in info.get("tags", []) if isinstance(tag, str)][:8],
        }
        projects.append(project)
        shutil.copytree(folder, OUTPUT / folder.name, ignore=shutil.ignore_patterns("node_modules", ".git", ".DS_Store", "tests", "__pycache__"))
    (OUTPUT / "catalog.json").write_text(json.dumps({"projects": projects}, indent=2) + "\n", encoding="utf-8")
    print("Built Testlab:", len(projects), "prototype(s)")
    for project in projects:
        print(" -", project["folder"])

if __name__ == "__main__":
    main()
