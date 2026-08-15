#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // WebKitGTK 2.52 can abort in its DMABUF renderer on Intel/Wayland.
        // Keep compositing enabled, but use the safer renderer path.
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        std::env::set_var("GIO_USE_PROXY_RESOLVER", "dummy");
        std::env::set_var("NO_PROXY", "localhost,127.0.0.1,::1");
    }

    openvibe_lib::run();
}
