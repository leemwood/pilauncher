// src-tauri/src/commands/instance/keymap_cmd.rs
use crate::services::instance::binding::InstanceBindingService;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Runtime};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct KeyBind {
    pub name: String,
    pub key: String,
}

#[tauri::command]
pub async fn get_instance_keybindings<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
) -> Result<Vec<KeyBind>, String> {
    let config_path = InstanceBindingService::instance_config_path(&app, &instance_id)?;
    let instance_dir = config_path.parent().ok_or_else(|| "无法获取实例目录".to_string())?;

    let config = InstanceBindingService::load_instance_config(&app, &instance_id)?;
    let mut game_dir = instance_dir.to_path_buf();
    if let Some(tp_path) = &config.third_party_path {
        if !tp_path.is_empty() {
            let tp_buf = PathBuf::from(tp_path);
            if tp_buf.exists() {
                game_dir = tp_buf;
            }
        }
    }

    let options_path = game_dir.join("options.txt");
    if !options_path.exists() {
        return Err("OPTIONS_TXT_NOT_FOUND".to_string());
    }

    let content = fs::read_to_string(&options_path).map_err(|e| format!("读取 options.txt 失败: {}", e))?;
    let mut keybindings = Vec::new();

    for line in content.lines() {
        let line = line.trim();
        if line.starts_with("key_") {
            if let Some(pos) = line.find(':') {
                let name = line[4..pos].to_string();
                let key = line[pos + 1..].to_string();
                keybindings.push(KeyBind { name, key });
            }
        }
    }

    Ok(keybindings)
}

#[tauri::command]
pub async fn save_instance_keybindings<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    keybindings: Vec<KeyBind>,
) -> Result<(), String> {
    let config_path = InstanceBindingService::instance_config_path(&app, &instance_id)?;
    let instance_dir = config_path.parent().ok_or_else(|| "无法获取实例目录".to_string())?;

    let config = InstanceBindingService::load_instance_config(&app, &instance_id)?;
    let mut game_dir = instance_dir.to_path_buf();
    if let Some(tp_path) = &config.third_party_path {
        if !tp_path.is_empty() {
            let tp_buf = PathBuf::from(tp_path);
            if tp_buf.exists() {
                game_dir = tp_buf;
            }
        }
    }

    let options_path = game_dir.join("options.txt");

    let mut lines = Vec::new();
    if options_path.exists() {
        if let Ok(content) = fs::read_to_string(&options_path) {
            lines = content.lines().map(|s| s.to_string()).collect();
        }
    }

    for kb in keybindings {
        let target_prefix = format!("key_{}:", kb.name);
        let target_line = format!("key_{}:{}", kb.name, kb.key);
        let mut found = false;
        for line in &mut lines {
            if line.starts_with(&target_prefix) {
                *line = target_line.clone();
                found = true;
                break;
            }
        }
        if !found {
            lines.push(target_line);
        }
    }

    let new_content = lines.join("\n") + "\n";
    fs::write(&options_path, new_content).map_err(|e| format!("保存 options.txt 失败: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn initialize_default_keybindings<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
) -> Result<(), String> {
    let config_path = InstanceBindingService::instance_config_path(&app, &instance_id)?;
    let instance_dir = config_path.parent().ok_or_else(|| "无法获取实例目录".to_string())?;

    let config = InstanceBindingService::load_instance_config(&app, &instance_id)?;
    let mut game_dir = instance_dir.to_path_buf();
    if let Some(tp_path) = &config.third_party_path {
        if !tp_path.is_empty() {
            let tp_buf = PathBuf::from(tp_path);
            if tp_buf.exists() {
                game_dir = tp_buf;
            }
        }
    }

    if !game_dir.exists() {
        fs::create_dir_all(&game_dir).map_err(|e| format!("创建游戏目录失败: {}", e))?;
    }

    let options_path = game_dir.join("options.txt");

    let defaults = vec![
        "key_key.forward:key.keyboard.w",
        "key_key.left:key.keyboard.a",
        "key_key.back:key.keyboard.s",
        "key_key.right:key.keyboard.d",
        "key_key.jump:key.keyboard.space",
        "key_key.sneak:key.keyboard.left.shift",
        "key_key.sprint:key.keyboard.left.control",
        "key_key.drop:key.keyboard.q",
        "key_key.inventory:key.keyboard.e",
        "key_key.chat:key.keyboard.t",
        "key_key.playerlist:key.keyboard.tab",
        "key_key.screenshot:key.keyboard.f2",
        "key_key.togglePerspective:key.keyboard.f5",
        "key_key.swapHands:key.keyboard.f",
        "key_key.use:key.mouse.right",
        "key_key.attack:key.mouse.left",
        "key_key.pickItem:key.mouse.middle",
        "key_key.fullscreen:key.keyboard.f11",
    ];

    let content = defaults.join("\n") + "\n";
    fs::write(&options_path, content).map_err(|e| format!("初始化 options.txt 失败: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn unique_test_root(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "pilauncher-keymap-test-{}-{}",
            label,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ))
    }

    #[test]
    fn test_parse_keybindings_success() {
        let temp_dir = unique_test_root("parse-success");
        fs::create_dir_all(&temp_dir).unwrap();
        let options_path = temp_dir.join("options.txt");

        let content = "\
graphicsMode:1
ao:2
key_key.forward:key.keyboard.w
key_key.back:key.keyboard.s
key_key.jump:key.keyboard.space
bobView:true
key_key.sneak:42
";
        fs::write(&options_path, content).unwrap();

        // Manual parsing similar to get_instance_keybindings logic
        let parsed_content = fs::read_to_string(&options_path).unwrap();
        let mut keybindings = Vec::new();
        for line in parsed_content.lines() {
            let line = line.trim();
            if line.starts_with("key_") {
                if let Some(pos) = line.find(':') {
                    let name = line[4..pos].to_string();
                    let key = line[pos + 1..].to_string();
                    keybindings.push(KeyBind { name, key });
                }
            }
        }

        assert_eq!(keybindings.len(), 4);
        assert_eq!(keybindings[0], KeyBind { name: "key.forward".to_string(), key: "key.keyboard.w".to_string() });
        assert_eq!(keybindings[1], KeyBind { name: "key.back".to_string(), key: "key.keyboard.s".to_string() });
        assert_eq!(keybindings[2], KeyBind { name: "key.jump".to_string(), key: "key.keyboard.space".to_string() });
        assert_eq!(keybindings[3], KeyBind { name: "key.sneak".to_string(), key: "42".to_string() });

        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_save_keybindings_modifies_existing_and_preserves_others() {
        let temp_dir = unique_test_root("save-modify");
        fs::create_dir_all(&temp_dir).unwrap();
        let options_path = temp_dir.join("options.txt");

        let original_content = "\
graphicsMode:1
ao:2
key_key.forward:key.keyboard.w
key_key.back:key.keyboard.s
bobView:true
";
        fs::write(&options_path, original_content).unwrap();

        // Simulate save_instance_keybindings
        let new_keybinds = vec![
            KeyBind { name: "key.forward".to_string(), key: "key.keyboard.up".to_string() }, // modified
            KeyBind { name: "key.jump".to_string(), key: "key.keyboard.space".to_string() },  // added
        ];

        let mut lines = Vec::new();
        if options_path.exists() {
            let content = fs::read_to_string(&options_path).unwrap();
            lines = content.lines().map(|s| s.to_string()).collect();
        }

        for kb in new_keybinds {
            let target_prefix = format!("key_{}:", kb.name);
            let target_line = format!("key_{}:{}", kb.name, kb.key);
            let mut found = false;
            for line in &mut lines {
                if line.starts_with(&target_prefix) {
                    *line = target_line.clone();
                    found = true;
                    break;
                }
            }
            if !found {
                lines.push(target_line);
            }
        }

        let new_content = lines.join("\n") + "\n";
        fs::write(&options_path, new_content).unwrap();

        // Verify content
        let updated_content = fs::read_to_string(&options_path).unwrap();
        assert!(updated_content.contains("graphicsMode:1"));
        assert!(updated_content.contains("ao:2"));
        assert!(updated_content.contains("bobView:true"));
        assert!(updated_content.contains("key_key.forward:key.keyboard.up"));
        assert!(updated_content.contains("key_key.back:key.keyboard.s"));
        assert!(updated_content.contains("key_key.jump:key.keyboard.space"));

        let _ = fs::remove_dir_all(temp_dir);
    }
}
