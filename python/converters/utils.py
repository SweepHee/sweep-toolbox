from pathlib import Path


def unique_path(path: Path) -> Path:
    """파일이 이미 존재하면 (1), (2) ... 를 붙여 충돌 없는 경로를 반환."""
    if not path.exists():
        return path
    stem, suffix, parent = path.stem, path.suffix, path.parent
    counter = 1
    while True:
        candidate = parent / f"{stem} ({counter}){suffix}"
        if not candidate.exists():
            return candidate
        counter += 1
