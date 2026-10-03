"""Add Vortex's missing Czech strings to the vendor's Czech locale module.

Locate the module by its source map, not by an unstable bundled filename.
Fail the build if the vendor output changes instead of patching another locale.
No authentication code, cookies, credentials, or form handlers are modified.
"""

import json
from pathlib import Path
import re
import sys

TRANSLATIONS = {
    "s14e8ac4d377a1a99": "Zadejte ověřovací kód…",
    "sc92a7248dba5f388": "Otevřete ověřovací aplikaci a zadejte jednorázový kód.",
    "sac17f177f884e238": "Zůstat přihlášen na tomto zařízení?",
    "s859b2e00391da380": (
        "Volbou Ano zůstanete v tomto prohlížeči přihlášeni až 90 dní. "
        "Na sdíleném zařízení zvolte Ne. Ruční odhlášení tuto relaci ukončí."
    ),
}
MARKER = "/* Vortex Czech login translations v1 */"


def patch(dist: Path) -> Path:
    candidates = []
    for source_map in dist.rglob("*.js.map"):
        metadata = json.loads(source_map.read_text(encoding="utf-8"))
        sources = [source.replace("\\", "/") for source in metadata.get("sources", [])]
        if any(source.endswith("/locales/cs-CZ.ts") for source in sources):
            candidates.append(source_map.with_suffix(""))
    if len(candidates) != 1:
        raise RuntimeError(f"Expected one Czech locale module, found {len(candidates)}")

    module = candidates[0]
    source = module.read_text(encoding="utf-8")
    if MARKER in source:
        raise RuntimeError("Czech locale has already been patched")
    exports = list(re.finditer(r"\bexport\s*\{\s*([\w$]+)\s+as\s+templates\s*\}\s*;?", source))
    if len(exports) != 1:
        raise RuntimeError("Unsupported Czech locale export; vendor output must be reviewed")
    exported = exports[0]
    additions = json.dumps(TRANSLATIONS, ensure_ascii=False)
    insertion = f"\n{MARKER}\nObject.assign({exported.group(1)}, {additions});\n"
    module.write_text(source[:exported.start()] + insertion + source[exported.start():], encoding="utf-8")
    return module


if __name__ == "__main__":
    print(f"Patched Czech catalog: {patch(Path(sys.argv[1]))}")
