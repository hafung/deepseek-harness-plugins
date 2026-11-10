"""Build independent plugin ZIPs using only the Python 3 standard library."""

import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def main():
    root = Path(__file__).resolve().parent.parent
    output = root / "dist"
    output.mkdir(exist_ok=True)
    checksums = []

    for directory in sorted((root / "plugins").iterdir()):
        if not (directory / "package.json").is_file():
            continue
        manifest = json.loads((directory / "package.json").read_text(encoding="utf-8"))
        files = {directory / "package.json"}
        for pattern in manifest["files"]:
            matches = {file for file in directory.glob(pattern) if file.is_file()}
            if not matches:
                raise ValueError(f"{directory.name}: no files match {pattern!r}")
            files.update(matches)
        required = {manifest["dsh"]["bundle"]["patch"], manifest["exports"]["."], manifest["exports"]["./client"]}
        if any(directory / filename not in files for filename in required):
            raise ValueError(f"{directory.name}: install entry missing from files")

        archive = output / f"{directory.name}-{manifest['version']}.zip"
        with ZipFile(archive, "w", ZIP_DEFLATED) as bundle:
            for file in sorted(files):
                bundle.write(file, f"{directory.name}/{file.relative_to(directory).as_posix()}")
            bundle.write(root / "LICENSE", f"{directory.name}/LICENSE")
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        checksums.append(f"{digest}  {archive.name}\n")
        print(f"{archive.relative_to(root)} ({len(files) + 1} files)")

    (output / "SHA256SUMS").write_text("".join(checksums), encoding="utf-8")


if __name__ == "__main__":
    main()
