#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("GIO_USE_PROXY_RESOLVER", "dummy");
        std::env::set_var("NO_PROXY", "localhost,127.0.0.1,::1");
    }

    openvibe_lib::run();
}
