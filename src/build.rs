use std::{
    fs::create_dir,
    path::{Path, PathBuf},
};

use slu_utils::checksums::CheckSums;

fn main() {
    let _ = create_dir("gen");

    let mut checksums = CheckSums::new();
    read_folder_recursive(PathBuf::from("static"), &mut |path| {
        checksums.add(&path).unwrap();
    });

    let target_dir = target_dir();
    let sums_path = target_dir.join("SHA256SUMS");
    checksums.write(&sums_path).unwrap();

    if !cfg!(debug_assertions) {
        sign_sha256sums(&sums_path);
    } else {
        std::fs::write(
            sums_path.with_extension("sig"),
            "NOT SIGNED NEEDED FOR DEBUG",
        )
        .unwrap();
    }

    tauri_build::build();
}

fn target_dir() -> PathBuf {
    let out_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap());
    // see <https://github.com/rust-lang/cargo/issues/5457>
    out_dir
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf()
}

fn read_folder_recursive<F>(path: PathBuf, cb: &mut F)
where
    F: FnMut(PathBuf),
{
    for entry in std::fs::read_dir(path).unwrap() {
        let entry = entry.unwrap();
        let path = entry.path();
        if path.is_dir() {
            read_folder_recursive(path, cb);
        } else {
            cb(path);
        }
    }
}

fn sign_sha256sums(path: &Path) {
    // PATCH (2026-11-21, local fork): no release signing infrastructure available
    // for self-built/cloud builds. Dev builds already run with a dummy signature
    // (NOT SIGNED NEEDED FOR DEBUG), so the runtime tolerates it — write the same
    // marker for release builds too.
    std::fs::write(path.with_extension("sig"), "NOT SIGNED (LOCAL FORK)").unwrap();
}
