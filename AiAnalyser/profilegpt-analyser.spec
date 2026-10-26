# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the portable ProfileGPT AI Analyser.

Build (from AiAnalyser/):

    python -m pip install -r requirements-light.txt pyinstaller
    pyinstaller --clean --noconfirm profilegpt-analyser.spec

Output: dist/profilegpt-analyser/ — ships inside the release ZIP as `ai/`.
"""

import sys
from pathlib import Path

from PyInstaller.utils.hooks import (
    collect_data_files,
    collect_submodules,
    copy_metadata,
)

APP_DIR = Path(SPECPATH).resolve()
sys.path.insert(0, str(APP_DIR))

# LangChain/LangGraph resolve a lot of integrations and serializers at runtime.
_hidden_packages = [
    "app",
    "config",
    "langchain_core",
    "langchain_openai",
    "langchain_google_genai",
    "langgraph",
    "pydantic",
    "pydantic_settings",
    "yaml",
    "fastapi",
    "uvicorn",
    "pypdf",
    "docx",
    "httpx",
    "openai",
    "google",
    "tiktoken",
]

hiddenimports: list[str] = [
    "tiktoken_ext.openai_public",
    "tiktoken_ext._tiktoken",
]
for package in _hidden_packages:
    try:
        hiddenimports += collect_submodules(package, on_error="ignore")
    except Exception:  # pragma: no cover - optional package
        pass

datas = [
    (str(APP_DIR / "config" / "models.yaml"), "config"),
]
datas += collect_data_files("docx")

# Packages that read their version via importlib.metadata need their dist-info.
for dist in (
    "fastapi",
    "uvicorn",
    "pydantic",
    "pydantic-settings",
    "python-dotenv",
    "pyyaml",
    "httpx",
    "langchain-core",
    "langchain-openai",
    "langchain-google-genai",
    "langgraph",
    "openai",
    "pypdf",
    "python-docx",
    "tiktoken",
):
    try:
        datas += copy_metadata(dist)
    except Exception:  # pragma: no cover - metadata missing for optional dist
        pass


a = Analysis(
    [str(APP_DIR / "main.py")],
    pathex=[str(APP_DIR)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter",
        "matplotlib",
        "pytest",
        "IPython",
        # The portable sidecar uses light extraction; never bundle Docling's
        # model stack even if it happens to be installed in the build venv.
        "docling",
        "docling_core",
        "torch",
        "torchvision",
        "transformers",
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="profilegpt-analyser",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="profilegpt-analyser",
)
