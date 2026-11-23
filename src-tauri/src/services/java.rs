use regex::Regex;
use std::path::{Path, PathBuf};
use std::process::Command;

pub fn parse_java_major_version(output: &str) -> Option<u32> {
    let re = Regex::new(r#"version\s+"(?:(\d+)\.(\d+)\.|(\d+))"#).ok()?;
    if let Some(caps) = re.captures(output) {
        if let Some(v) = caps.get(3) {
            return v.as_str().parse::<u32>().ok();
        }
        if let (Some(major), Some(minor)) = (caps.get(1), caps.get(2)) {
            let maj = major.as_str().parse::<u32>().ok()?;
            let min = minor.as_str().parse::<u32>().ok()?;
            if maj == 1 {
                return Some(min);
            }
            return Some(maj);
        }
    }
    None
}

pub fn resolve_java_command(custom_path: Option<&str>) -> String {
    if let Some(p) = custom_path {
        let trimmed = p.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        let ext = if cfg!(target_os = "windows") {
            ".exe"
        } else {
            ""
        };
        let candidate = PathBuf::from(java_home)
            .join("bin")
            .join(format!("java{}", ext));
        if candidate.exists() {
            return candidate.to_string_lossy().to_string();
        }
    }

    if cfg!(target_os = "windows") {
        "java.exe".to_string()
    } else {
        "java".to_string()
    }
}

pub fn detect_java_major(java_cmd: &str) -> Option<u32> {
    let output = Command::new(java_cmd).arg("-version").output().ok()?;
    let combined = format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stderr),
        String::from_utf8_lossy(&output.stdout)
    );
    parse_java_major_version(&combined)
}

pub fn collect_common_java_candidates() -> Vec<String> {
    let mut candidates = Vec::new();

    let lookup_cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };
    let exec_name = if cfg!(target_os = "windows") {
        "java.exe"
    } else {
        "java"
    };

    if let Ok(output) = Command::new(lookup_cmd).arg(exec_name).output() {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                let trimmed = line.trim();
                if !trimmed.is_empty() && !candidates.contains(&trimmed.to_string()) {
                    candidates.push(trimmed.to_string());
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let prog_files = vec![
            std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string()),
            std::env::var("ProgramFiles(x86)")
                .unwrap_or_else(|_| "C:\\Program Files (x86)".to_string()),
            std::env::var("LOCALAPPDATA").unwrap_or_else(|_| "".to_string()),
        ];

        for base in prog_files {
            if base.is_empty() {
                continue;
            }
            let base_path = Path::new(&base);
            let search_roots = [
                base_path.join("Java"),
                base_path.join("Eclipse Adoptium"),
                base_path.join("BellSoft"),
                base_path.join("Microsoft"),
                base_path.join("Zulu"),
                base_path.join("Semeru"),
                base_path.join("Programs").join("Eclipse Adoptium"),
            ];

            for root in search_roots {
                if let Ok(entries) = std::fs::read_dir(root) {
                    for entry in entries.flatten() {
                        let java_exe = entry.path().join("bin").join("java.exe");
                        if java_exe.is_file() {
                            let s = java_exe.to_string_lossy().to_string();
                            if !candidates.contains(&s) {
                                candidates.push(s);
                            }
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let mac_roots = [
            PathBuf::from("/Library/Java/JavaVirtualMachines"),
            dirs::home_dir()
                .map(|h| h.join("Library/Java/JavaVirtualMachines"))
                .unwrap_or_default(),
            PathBuf::from("/opt/homebrew/opt"),
            PathBuf::from("/usr/local/opt"),
        ];

        for root in mac_roots {
            if root.exists() {
                if let Ok(entries) = std::fs::read_dir(root) {
                    for entry in entries.flatten() {
                        let java_bin = entry.path().join("Contents/Home/bin/java");
                        if java_bin.is_file() {
                            let s = java_bin.to_string_lossy().to_string();
                            if !candidates.contains(&s) {
                                candidates.push(s);
                            }
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let linux_roots = [
            PathBuf::from("/usr/lib/jvm"),
            PathBuf::from("/usr/java"),
            PathBuf::from("/opt"),
        ];

        for root in linux_roots {
            if root.exists() {
                if let Ok(entries) = std::fs::read_dir(root) {
                    for entry in entries.flatten() {
                        let java_bin = entry.path().join("bin/java");
                        if java_bin.is_file() {
                            let s = java_bin.to_string_lossy().to_string();
                            if !candidates.contains(&s) {
                                candidates.push(s);
                            }
                        }
                    }
                }
            }
        }
    }

    candidates
}

pub fn find_compatible_java(required_major: u32) -> Option<(String, u32)> {
    collect_common_java_candidates()
        .into_iter()
        .filter_map(|path| detect_java_major(&path).map(|major| (path, major)))
        .filter(|(_, major)| *major >= required_major)
        .max_by_key(|(_, major)| *major)
}
