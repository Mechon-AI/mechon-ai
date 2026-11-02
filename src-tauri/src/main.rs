// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpListener;
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{Manager, State};

struct BackendState {
    child: Mutex<Option<Child>>,
    port: u16,
}

fn get_available_port() -> u16 {
    if let Ok(listener) = TcpListener::bind("127.0.0.1:18420") {
        drop(listener);
        return 18420;
    }
    TcpListener::bind("127.0.0.1:0")
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port())
        .unwrap_or(18420)
}

fn spawn_python_backend(port: u16) -> Option<Child> {
    let python_candidates = [
        "backend/.venv/bin/python",
        "backend/.venv/bin/python3",
        "../backend/.venv/bin/python",
        "/usr/bin/python3",
        "python3",
    ];

    let mut py_binary = "python3";
    for cand in python_candidates {
        if std::path::Path::new(cand).exists() {
            py_binary = cand;
            break;
        }
    }

    println!("[Tauri Shell] Launching managed Python backend using: {}", py_binary);

    let child = Command::new(py_binary)
        .arg("-m")
        .arg("app.main")
        .arg("--port")
        .arg(port.to_string())
        .current_dir(if std::path::Path::new("backend").exists() { "backend" } else { "." })
        .spawn();

    match child {
        Ok(proc) => {
            println!("[Tauri Shell] Python backend spawned successfully with PID: {}", proc.id());
            Some(proc)
        }
        Err(e) => {
            eprintln!("[Tauri Shell] Warning: Could not spawn local Python backend: {}", e);
            None
        }
    }
}

#[tauri::command]
fn get_backend_port(state: State<'_, BackendState>) -> u16 {
    state.port
}

#[tauri::command]
fn open_data_folder() -> Result<(), String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let xdg_data = std::env::var("XDG_DATA_HOME").unwrap_or_else(|_| format!("{}/.local/share", home));
    let path = format!("{}/mechon-ai", xdg_data);
    let _ = Command::new("xdg-open").arg(path).spawn();
    Ok(())
}

fn main() {
    let port = get_available_port();
    let child_proc = spawn_python_backend(port);

    let backend_state = BackendState {
        child: Mutex::new(child_proc),
        port,
    };

    tauri::Builder::default()
        .manage(backend_state)
        .invoke_handler(tauri::generate_handler![
            get_backend_port,
            open_data_folder
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<BackendState>() {
                    if let Ok(mut lock) = state.child.lock() {
                        if let Some(ref mut child) = *lock {
                            println!("[Tauri Shell] Terminating backend subprocess...");
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("Error while running Local AI Dataset Studio");
}
