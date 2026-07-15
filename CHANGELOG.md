# Changelog

All notable changes to OpenVibe will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.3.1](https://github.com/nihmadev/OpenVibe/compare/openvibe-v1.3.1...openvibe-v1.3.1) (2026-07-15)


### Features

* add command palette to search popup ([96b374f](https://github.com/nihmadev/OpenVibe/commit/96b374f3721d03b5ecd466429271cdd806fa9319))
* add content search engine with caching, filtering and syntax highlighting ([88d7f6a](https://github.com/nihmadev/OpenVibe/commit/88d7f6a647cf6858e485ccb94f9e8f28dd721380))
* add editor navigation from search results ([31e10e6](https://github.com/nihmadev/OpenVibe/commit/31e10e68a73c76ea2147dac84e91928abdbbde66))
* add Gruvbox Hard, Medium and Soft theme variants ([8531003](https://github.com/nihmadev/OpenVibe/commit/85310039d974bf805bfd42996c5ec161f813603e))
* add keyboard navigation and shortcut bindings to search-in-code panel ([be2d72f](https://github.com/nihmadev/OpenVibe/commit/be2d72fc648a2942a7c91f4ad7e6018fd4b9879e))
* add SearchInCode panel component with virtualized list and tree view ([7cf0446](https://github.com/nihmadev/OpenVibe/commit/7cf044640c9c2eb36823828ae26e1ae5ed39cf04))
* add Tauri IPC commands for content search ([96dfce5](https://github.com/nihmadev/OpenVibe/commit/96dfce5d6513568546819d90b49f6f802f94d529))
* add TypeScript types and tauri bridge for search APIs ([cfb8df9](https://github.com/nihmadev/OpenVibe/commit/cfb8df97169f1db619e788ae10d106dcc08f9fec))
* add user message index for accurate rollback ([140c132](https://github.com/nihmadev/OpenVibe/commit/140c132eff3a68ad96e93d3103c79048642a6d55))
* **agent:** Support project rules loading (.viberules, AGENTS.md, .cursorrules) ([9bba445](https://github.com/nihmadev/OpenVibe/commit/9bba445c2ed5378c10a748a8560d903bbfd4871d))
* **chat:** update chat history UI, streaming markdown, prompt input, and agent tool visualization ([efc6ab5](https://github.com/nihmadev/OpenVibe/commit/efc6ab5a78532b17a87e3370693d0cbcef4b5885))
* **editor:** implement ai fix-it action in monaco editor hover ([a743bbb](https://github.com/nihmadev/OpenVibe/commit/a743bbbc39ac48341b25cbbabe87e106f73e80f2))
* **editor:** improve search, editor components, settings panels, hooks, and Tauri bridge bindings ([b13b668](https://github.com/nihmadev/OpenVibe/commit/b13b6680e508ea7416bfd64cebda1ae8e22fcad5))
* extend custom provider with icon, models URL, headers and parameters ([ea5e288](https://github.com/nihmadev/OpenVibe/commit/ea5e2882a6fcefa540c9a30fb68eecfce0c82c9e))
* **git:** add git workspace crate and integration commands ([39dc55a](https://github.com/nihmadev/OpenVibe/commit/39dc55aa61bf58056c6bfb87eff0b5638274945a))
* **git:** Add history tracking module to git crate ([cdaefb6](https://github.com/nihmadev/OpenVibe/commit/cdaefb62c0f630f7eabe768e20748a052d873276))
* group hotkeys into categories with section headers ([4fddc9f](https://github.com/nihmadev/OpenVibe/commit/4fddc9f7c99618f6df1877be62f5862f30932902))
* integrate search-in-code panel into app layout and titlebar ([d02f395](https://github.com/nihmadev/OpenVibe/commit/d02f3957a65b146c1cc53e83b4d721a394c918cd))
* **mcp:** add titlebar indicator, settings panel and tool execution view ([359d749](https://github.com/nihmadev/OpenVibe/commit/359d749e0e16e8e3b6798fa8c94233075630070f))
* **mcp:** implement mcp server management backend and json-rpc transport ([e722173](https://github.com/nihmadev/OpenVibe/commit/e7221739dbca896ab124303c4a8c86dee81c3c19))
* **mcp:** Redesign MCP settings UI and update Tauri bridge ([1431329](https://github.com/nihmadev/OpenVibe/commit/14313294b1e6559d92050e3340a304d7bbdaae83))
* respect .gitignore rules in file and content search ([007f774](https://github.com/nihmadev/OpenVibe/commit/007f774d3152f6394687a2e0b6385c4f8d3bb4a4))
* **scg2:** Add Semantic Code Graph 2 backend engine ([b4bfeda](https://github.com/nihmadev/OpenVibe/commit/b4bfeda6200705bc7e6c5f4a659be330dec3964e))
* **scg2:** Integrate SCG2 with Tauri IPC and Editor tracker ([4cda0d0](https://github.com/nihmadev/OpenVibe/commit/4cda0d0d6eb53e8d3879e187cdebea6111b293d7))
* **settings:** add Design tab with animation style picker and preview ([5a2a870](https://github.com/nihmadev/OpenVibe/commit/5a2a870153eedb5c4984c7a3e36b706757e984ed))
* **ui:** redesign core layout, titlebar controls, navigation icons, and file tree node ([fa0803a](https://github.com/nihmadev/OpenVibe/commit/fa0803a37115d9e6aeaa28294d09bd33525477bf))


### Bug Fixes

* .md format pretty errors ([6df5225](https://github.com/nihmadev/OpenVibe/commit/6df5225d0ca0c9186a40f031ec565fef73717cab))
* add timeout to sse stream chunk reading to prevent hang ([22bce9a](https://github.com/nihmadev/OpenVibe/commit/22bce9aa46541c39ea16c20848d35e21b05d2c1a))
* cargo clippy error ([4dd2899](https://github.com/nihmadev/OpenVibe/commit/4dd2899919861ccb0fea603a2fb356ac12e6a0f5))
* **ci:** add linux system deps to quality job in workflow ([e34602d](https://github.com/nihmadev/OpenVibe/commit/e34602da37530e526cf2bebe504f14c21481f570))
* **ci:** enable dev branch workflow triggers and add npm token validation ([62c6744](https://github.com/nihmadev/OpenVibe/commit/62c6744e1a62f84b47bbac4a444d16275b7473f5))
* **ci:** update artifact glob patterns for macOS app directory and target bundle paths ([a75e7e6](https://github.com/nihmadev/OpenVibe/commit/a75e7e678fb877d4cbb4b86f535651d7f9deb401))
* clamp settings select dropdown within container bounds ([fc14849](https://github.com/nihmadev/OpenVibe/commit/fc14849397b6d4cec9d16e08dc1c70ab3408ca79))
* connect provider pop-up use custom settings ([de5e4fb](https://github.com/nihmadev/OpenVibe/commit/de5e4fb94874e218e09864bbfc632bd83242a2ae))
* error complils ([6a979f6](https://github.com/nihmadev/OpenVibe/commit/6a979f6b65867ee9f5f0510178d2f3d92130e5c8))
* fix animation in SessionList text unwrap, and added support animations to SearchinCode component ([f4da11b](https://github.com/nihmadev/OpenVibe/commit/f4da11bbeff21af0c440fd6b4182ec9781a4ab5c))
* fix types errors and add sscache to CI/CD ([bff40f0](https://github.com/nihmadev/OpenVibe/commit/bff40f031af60e7f296af61d1e03edde6e4e3e00))
* improve file tree active state indicators ([89cf2a2](https://github.com/nihmadev/OpenVibe/commit/89cf2a24230f37fc3202fd43609c940d8e01083f))
* no files found in public ([040f994](https://github.com/nihmadev/OpenVibe/commit/040f994d003c665f222f24bc2717043f6128cced))
* PreLinter zeroid a file ([b2120e3](https://github.com/nihmadev/OpenVibe/commit/b2120e323fa07c98375d5cb07637b6d2c3572c69))
* resolve Monaco editor import resolution for .js → .ts/.tsx and preload on every file switch ([4b0de1a](https://github.com/nihmadev/OpenVibe/commit/4b0de1a3b7ddfe0a1f6478e5f8d76d69e5174ee3))
* restore missing gear icon svg path in settings ([4dfbca3](https://github.com/nihmadev/OpenVibe/commit/4dfbca34a81e91b25de01f2f87c0c52db11545f6))
* sscache job ([885e25e](https://github.com/nihmadev/OpenVibe/commit/885e25eee9ae3e3ad413749dc713fa912cf77366))
* **terminal:** integrate portable-pty for proper session handling and update UI ([4ae3a6f](https://github.com/nihmadev/OpenVibe/commit/4ae3a6f684bd2845f015c992e2c6fd7afb1ce530))
* **ui:** adjust code block height, padding, copy trimming and context menu checkboxes ([0d82c52](https://github.com/nihmadev/OpenVibe/commit/0d82c529ca59eb36736ee76f340c3f016b16c4b4))
* **ui:** adjust editor panel resizing constraints ([9dfeb0c](https://github.com/nihmadev/OpenVibe/commit/9dfeb0cc1b4ea8073af998a8ce8440967d4c5bfa))
* update monaco typescript paths after deps upgrade ([3224ff0](https://github.com/nihmadev/OpenVibe/commit/3224ff0c82160f6ac26c93df8a20ab89dc0d8e5b))
* **vite:** convert manualChunks object to function for Rolldown compatibility ([7d94978](https://github.com/nihmadev/OpenVibe/commit/7d9497866b4a43c1b2a103d69613cf19814f3de4))


### Performance Improvements

* **agent:** pre-initialize agent instance on app startup when credentials are valid ([fb0663b](https://github.com/nihmadev/OpenVibe/commit/fb0663b36b925766d0347316c3a51c842e408da5))
* **app:** optimize initialization with parallel preloading and background warm-up ([ef5bef6](https://github.com/nihmadev/OpenVibe/commit/ef5bef6900434c28221f810074d4a236d828c3fe))
* **mcp:** optimize npx startup time and add starting status state ([69b7f58](https://github.com/nihmadev/OpenVibe/commit/69b7f586514442cc63fe9242059e03323220ef11))


### Miscellaneous Chores

* force release version 1.3.1 ([fa6f40b](https://github.com/nihmadev/OpenVibe/commit/fa6f40ba1e36c2e5a46ca0a509476e1c7d8ae997))

## [1.3.1](https://github.com/nihmadev/OpenVibe/compare/openvibe-v1.3.1...openvibe-v1.3.1) (2026-07-15)


### Features

* add command palette to search popup ([96b374f](https://github.com/nihmadev/OpenVibe/commit/96b374f3721d03b5ecd466429271cdd806fa9319))
* add content search engine with caching, filtering and syntax highlighting ([88d7f6a](https://github.com/nihmadev/OpenVibe/commit/88d7f6a647cf6858e485ccb94f9e8f28dd721380))
* add editor navigation from search results ([31e10e6](https://github.com/nihmadev/OpenVibe/commit/31e10e68a73c76ea2147dac84e91928abdbbde66))
* add Gruvbox Hard, Medium and Soft theme variants ([8531003](https://github.com/nihmadev/OpenVibe/commit/85310039d974bf805bfd42996c5ec161f813603e))
* add keyboard navigation and shortcut bindings to search-in-code panel ([be2d72f](https://github.com/nihmadev/OpenVibe/commit/be2d72fc648a2942a7c91f4ad7e6018fd4b9879e))
* add SearchInCode panel component with virtualized list and tree view ([7cf0446](https://github.com/nihmadev/OpenVibe/commit/7cf044640c9c2eb36823828ae26e1ae5ed39cf04))
* add Tauri IPC commands for content search ([96dfce5](https://github.com/nihmadev/OpenVibe/commit/96dfce5d6513568546819d90b49f6f802f94d529))
* add TypeScript types and tauri bridge for search APIs ([cfb8df9](https://github.com/nihmadev/OpenVibe/commit/cfb8df97169f1db619e788ae10d106dcc08f9fec))
* add user message index for accurate rollback ([140c132](https://github.com/nihmadev/OpenVibe/commit/140c132eff3a68ad96e93d3103c79048642a6d55))
* **agent:** Support project rules loading (.viberules, AGENTS.md, .cursorrules) ([9bba445](https://github.com/nihmadev/OpenVibe/commit/9bba445c2ed5378c10a748a8560d903bbfd4871d))
* **chat:** update chat history UI, streaming markdown, prompt input, and agent tool visualization ([efc6ab5](https://github.com/nihmadev/OpenVibe/commit/efc6ab5a78532b17a87e3370693d0cbcef4b5885))
* **editor:** implement ai fix-it action in monaco editor hover ([a743bbb](https://github.com/nihmadev/OpenVibe/commit/a743bbbc39ac48341b25cbbabe87e106f73e80f2))
* **editor:** improve search, editor components, settings panels, hooks, and Tauri bridge bindings ([b13b668](https://github.com/nihmadev/OpenVibe/commit/b13b6680e508ea7416bfd64cebda1ae8e22fcad5))
* extend custom provider with icon, models URL, headers and parameters ([ea5e288](https://github.com/nihmadev/OpenVibe/commit/ea5e2882a6fcefa540c9a30fb68eecfce0c82c9e))
* **git:** add git workspace crate and integration commands ([39dc55a](https://github.com/nihmadev/OpenVibe/commit/39dc55aa61bf58056c6bfb87eff0b5638274945a))
* **git:** Add history tracking module to git crate ([cdaefb6](https://github.com/nihmadev/OpenVibe/commit/cdaefb62c0f630f7eabe768e20748a052d873276))
* group hotkeys into categories with section headers ([4fddc9f](https://github.com/nihmadev/OpenVibe/commit/4fddc9f7c99618f6df1877be62f5862f30932902))
* integrate search-in-code panel into app layout and titlebar ([d02f395](https://github.com/nihmadev/OpenVibe/commit/d02f3957a65b146c1cc53e83b4d721a394c918cd))
* **mcp:** add titlebar indicator, settings panel and tool execution view ([359d749](https://github.com/nihmadev/OpenVibe/commit/359d749e0e16e8e3b6798fa8c94233075630070f))
* **mcp:** implement mcp server management backend and json-rpc transport ([e722173](https://github.com/nihmadev/OpenVibe/commit/e7221739dbca896ab124303c4a8c86dee81c3c19))
* **mcp:** Redesign MCP settings UI and update Tauri bridge ([1431329](https://github.com/nihmadev/OpenVibe/commit/14313294b1e6559d92050e3340a304d7bbdaae83))
* respect .gitignore rules in file and content search ([007f774](https://github.com/nihmadev/OpenVibe/commit/007f774d3152f6394687a2e0b6385c4f8d3bb4a4))
* **scg2:** Add Semantic Code Graph 2 backend engine ([b4bfeda](https://github.com/nihmadev/OpenVibe/commit/b4bfeda6200705bc7e6c5f4a659be330dec3964e))
* **scg2:** Integrate SCG2 with Tauri IPC and Editor tracker ([4cda0d0](https://github.com/nihmadev/OpenVibe/commit/4cda0d0d6eb53e8d3879e187cdebea6111b293d7))
* **settings:** add Design tab with animation style picker and preview ([5a2a870](https://github.com/nihmadev/OpenVibe/commit/5a2a870153eedb5c4984c7a3e36b706757e984ed))
* **ui:** redesign core layout, titlebar controls, navigation icons, and file tree node ([fa0803a](https://github.com/nihmadev/OpenVibe/commit/fa0803a37115d9e6aeaa28294d09bd33525477bf))


### Bug Fixes

* .md format pretty errors ([6df5225](https://github.com/nihmadev/OpenVibe/commit/6df5225d0ca0c9186a40f031ec565fef73717cab))
* add timeout to sse stream chunk reading to prevent hang ([22bce9a](https://github.com/nihmadev/OpenVibe/commit/22bce9aa46541c39ea16c20848d35e21b05d2c1a))
* cargo clippy error ([4dd2899](https://github.com/nihmadev/OpenVibe/commit/4dd2899919861ccb0fea603a2fb356ac12e6a0f5))
* **ci:** add linux system deps to quality job in workflow ([e34602d](https://github.com/nihmadev/OpenVibe/commit/e34602da37530e526cf2bebe504f14c21481f570))
* **ci:** enable dev branch workflow triggers and add npm token validation ([62c6744](https://github.com/nihmadev/OpenVibe/commit/62c6744e1a62f84b47bbac4a444d16275b7473f5))
* **ci:** update artifact glob patterns for macOS app directory and target bundle paths ([a75e7e6](https://github.com/nihmadev/OpenVibe/commit/a75e7e678fb877d4cbb4b86f535651d7f9deb401))
* clamp settings select dropdown within container bounds ([fc14849](https://github.com/nihmadev/OpenVibe/commit/fc14849397b6d4cec9d16e08dc1c70ab3408ca79))
* connect provider pop-up use custom settings ([de5e4fb](https://github.com/nihmadev/OpenVibe/commit/de5e4fb94874e218e09864bbfc632bd83242a2ae))
* error complils ([6a979f6](https://github.com/nihmadev/OpenVibe/commit/6a979f6b65867ee9f5f0510178d2f3d92130e5c8))
* fix animation in SessionList text unwrap, and added support animations to SearchinCode component ([f4da11b](https://github.com/nihmadev/OpenVibe/commit/f4da11bbeff21af0c440fd6b4182ec9781a4ab5c))
* fix types errors and add sscache to CI/CD ([bff40f0](https://github.com/nihmadev/OpenVibe/commit/bff40f031af60e7f296af61d1e03edde6e4e3e00))
* improve file tree active state indicators ([89cf2a2](https://github.com/nihmadev/OpenVibe/commit/89cf2a24230f37fc3202fd43609c940d8e01083f))
* no files found in public ([040f994](https://github.com/nihmadev/OpenVibe/commit/040f994d003c665f222f24bc2717043f6128cced))
* PreLinter zeroid a file ([b2120e3](https://github.com/nihmadev/OpenVibe/commit/b2120e323fa07c98375d5cb07637b6d2c3572c69))
* resolve Monaco editor import resolution for .js → .ts/.tsx and preload on every file switch ([4b0de1a](https://github.com/nihmadev/OpenVibe/commit/4b0de1a3b7ddfe0a1f6478e5f8d76d69e5174ee3))
* restore missing gear icon svg path in settings ([4dfbca3](https://github.com/nihmadev/OpenVibe/commit/4dfbca34a81e91b25de01f2f87c0c52db11545f6))
* sscache job ([885e25e](https://github.com/nihmadev/OpenVibe/commit/885e25eee9ae3e3ad413749dc713fa912cf77366))
* **terminal:** integrate portable-pty for proper session handling and update UI ([4ae3a6f](https://github.com/nihmadev/OpenVibe/commit/4ae3a6f684bd2845f015c992e2c6fd7afb1ce530))
* **ui:** adjust code block height, padding, copy trimming and context menu checkboxes ([0d82c52](https://github.com/nihmadev/OpenVibe/commit/0d82c529ca59eb36736ee76f340c3f016b16c4b4))
* **ui:** adjust editor panel resizing constraints ([9dfeb0c](https://github.com/nihmadev/OpenVibe/commit/9dfeb0cc1b4ea8073af998a8ce8440967d4c5bfa))
* update monaco typescript paths after deps upgrade ([3224ff0](https://github.com/nihmadev/OpenVibe/commit/3224ff0c82160f6ac26c93df8a20ab89dc0d8e5b))
* **vite:** convert manualChunks object to function for Rolldown compatibility ([7d94978](https://github.com/nihmadev/OpenVibe/commit/7d9497866b4a43c1b2a103d69613cf19814f3de4))


### Performance Improvements

* **agent:** pre-initialize agent instance on app startup when credentials are valid ([fb0663b](https://github.com/nihmadev/OpenVibe/commit/fb0663b36b925766d0347316c3a51c842e408da5))
* **app:** optimize initialization with parallel preloading and background warm-up ([ef5bef6](https://github.com/nihmadev/OpenVibe/commit/ef5bef6900434c28221f810074d4a236d828c3fe))
* **mcp:** optimize npx startup time and add starting status state ([69b7f58](https://github.com/nihmadev/OpenVibe/commit/69b7f586514442cc63fe9242059e03323220ef11))


### Miscellaneous Chores

* force release version 1.3.1 ([fa6f40b](https://github.com/nihmadev/OpenVibe/commit/fa6f40ba1e36c2e5a46ca0a509476e1c7d8ae997))

## [1.3.1](https://github.com/nihmadev/OpenVibe/compare/openvibe-v1.3.0...openvibe-v1.3.1) (2026-07-15)


### Features

* add command palette to search popup ([96b374f](https://github.com/nihmadev/OpenVibe/commit/96b374f3721d03b5ecd466429271cdd806fa9319))
* add content search engine with caching, filtering and syntax highlighting ([88d7f6a](https://github.com/nihmadev/OpenVibe/commit/88d7f6a647cf6858e485ccb94f9e8f28dd721380))
* add editor navigation from search results ([31e10e6](https://github.com/nihmadev/OpenVibe/commit/31e10e68a73c76ea2147dac84e91928abdbbde66))
* add Gruvbox Hard, Medium and Soft theme variants ([8531003](https://github.com/nihmadev/OpenVibe/commit/85310039d974bf805bfd42996c5ec161f813603e))
* add keyboard navigation and shortcut bindings to search-in-code panel ([be2d72f](https://github.com/nihmadev/OpenVibe/commit/be2d72fc648a2942a7c91f4ad7e6018fd4b9879e))
* add SearchInCode panel component with virtualized list and tree view ([7cf0446](https://github.com/nihmadev/OpenVibe/commit/7cf044640c9c2eb36823828ae26e1ae5ed39cf04))
* add Tauri IPC commands for content search ([96dfce5](https://github.com/nihmadev/OpenVibe/commit/96dfce5d6513568546819d90b49f6f802f94d529))
* add TypeScript types and tauri bridge for search APIs ([cfb8df9](https://github.com/nihmadev/OpenVibe/commit/cfb8df97169f1db619e788ae10d106dcc08f9fec))
* add user message index for accurate rollback ([140c132](https://github.com/nihmadev/OpenVibe/commit/140c132eff3a68ad96e93d3103c79048642a6d55))
* **agent:** Support project rules loading (.viberules, AGENTS.md, .cursorrules) ([9bba445](https://github.com/nihmadev/OpenVibe/commit/9bba445c2ed5378c10a748a8560d903bbfd4871d))
* **chat:** update chat history UI, streaming markdown, prompt input, and agent tool visualization ([efc6ab5](https://github.com/nihmadev/OpenVibe/commit/efc6ab5a78532b17a87e3370693d0cbcef4b5885))
* **editor:** implement ai fix-it action in monaco editor hover ([a743bbb](https://github.com/nihmadev/OpenVibe/commit/a743bbbc39ac48341b25cbbabe87e106f73e80f2))
* **editor:** improve search, editor components, settings panels, hooks, and Tauri bridge bindings ([b13b668](https://github.com/nihmadev/OpenVibe/commit/b13b6680e508ea7416bfd64cebda1ae8e22fcad5))
* extend custom provider with icon, models URL, headers and parameters ([ea5e288](https://github.com/nihmadev/OpenVibe/commit/ea5e2882a6fcefa540c9a30fb68eecfce0c82c9e))
* **git:** add git workspace crate and integration commands ([39dc55a](https://github.com/nihmadev/OpenVibe/commit/39dc55aa61bf58056c6bfb87eff0b5638274945a))
* **git:** Add history tracking module to git crate ([cdaefb6](https://github.com/nihmadev/OpenVibe/commit/cdaefb62c0f630f7eabe768e20748a052d873276))
* group hotkeys into categories with section headers ([4fddc9f](https://github.com/nihmadev/OpenVibe/commit/4fddc9f7c99618f6df1877be62f5862f30932902))
* integrate search-in-code panel into app layout and titlebar ([d02f395](https://github.com/nihmadev/OpenVibe/commit/d02f3957a65b146c1cc53e83b4d721a394c918cd))
* **mcp:** add titlebar indicator, settings panel and tool execution view ([359d749](https://github.com/nihmadev/OpenVibe/commit/359d749e0e16e8e3b6798fa8c94233075630070f))
* **mcp:** implement mcp server management backend and json-rpc transport ([e722173](https://github.com/nihmadev/OpenVibe/commit/e7221739dbca896ab124303c4a8c86dee81c3c19))
* **mcp:** Redesign MCP settings UI and update Tauri bridge ([1431329](https://github.com/nihmadev/OpenVibe/commit/14313294b1e6559d92050e3340a304d7bbdaae83))
* respect .gitignore rules in file and content search ([007f774](https://github.com/nihmadev/OpenVibe/commit/007f774d3152f6394687a2e0b6385c4f8d3bb4a4))
* **scg2:** Add Semantic Code Graph 2 backend engine ([b4bfeda](https://github.com/nihmadev/OpenVibe/commit/b4bfeda6200705bc7e6c5f4a659be330dec3964e))
* **scg2:** Integrate SCG2 with Tauri IPC and Editor tracker ([4cda0d0](https://github.com/nihmadev/OpenVibe/commit/4cda0d0d6eb53e8d3879e187cdebea6111b293d7))
* **settings:** add Design tab with animation style picker and preview ([5a2a870](https://github.com/nihmadev/OpenVibe/commit/5a2a870153eedb5c4984c7a3e36b706757e984ed))
* **ui:** redesign core layout, titlebar controls, navigation icons, and file tree node ([fa0803a](https://github.com/nihmadev/OpenVibe/commit/fa0803a37115d9e6aeaa28294d09bd33525477bf))


### Bug Fixes

* .md format pretty errors ([6df5225](https://github.com/nihmadev/OpenVibe/commit/6df5225d0ca0c9186a40f031ec565fef73717cab))
* add timeout to sse stream chunk reading to prevent hang ([22bce9a](https://github.com/nihmadev/OpenVibe/commit/22bce9aa46541c39ea16c20848d35e21b05d2c1a))
* cargo clippy error ([4dd2899](https://github.com/nihmadev/OpenVibe/commit/4dd2899919861ccb0fea603a2fb356ac12e6a0f5))
* **ci:** add linux system deps to quality job in workflow ([e34602d](https://github.com/nihmadev/OpenVibe/commit/e34602da37530e526cf2bebe504f14c21481f570))
* **ci:** enable dev branch workflow triggers and add npm token validation ([62c6744](https://github.com/nihmadev/OpenVibe/commit/62c6744e1a62f84b47bbac4a444d16275b7473f5))
* **ci:** update artifact glob patterns for macOS app directory and target bundle paths ([a75e7e6](https://github.com/nihmadev/OpenVibe/commit/a75e7e678fb877d4cbb4b86f535651d7f9deb401))
* clamp settings select dropdown within container bounds ([fc14849](https://github.com/nihmadev/OpenVibe/commit/fc14849397b6d4cec9d16e08dc1c70ab3408ca79))
* connect provider pop-up use custom settings ([de5e4fb](https://github.com/nihmadev/OpenVibe/commit/de5e4fb94874e218e09864bbfc632bd83242a2ae))
* error complils ([6a979f6](https://github.com/nihmadev/OpenVibe/commit/6a979f6b65867ee9f5f0510178d2f3d92130e5c8))
* fix animation in SessionList text unwrap, and added support animations to SearchinCode component ([f4da11b](https://github.com/nihmadev/OpenVibe/commit/f4da11bbeff21af0c440fd6b4182ec9781a4ab5c))
* fix types errors and add sscache to CI/CD ([bff40f0](https://github.com/nihmadev/OpenVibe/commit/bff40f031af60e7f296af61d1e03edde6e4e3e00))
* improve file tree active state indicators ([89cf2a2](https://github.com/nihmadev/OpenVibe/commit/89cf2a24230f37fc3202fd43609c940d8e01083f))
* no files found in public ([040f994](https://github.com/nihmadev/OpenVibe/commit/040f994d003c665f222f24bc2717043f6128cced))
* PreLinter zeroid a file ([b2120e3](https://github.com/nihmadev/OpenVibe/commit/b2120e323fa07c98375d5cb07637b6d2c3572c69))
* resolve Monaco editor import resolution for .js → .ts/.tsx and preload on every file switch ([4b0de1a](https://github.com/nihmadev/OpenVibe/commit/4b0de1a3b7ddfe0a1f6478e5f8d76d69e5174ee3))
* restore missing gear icon svg path in settings ([4dfbca3](https://github.com/nihmadev/OpenVibe/commit/4dfbca34a81e91b25de01f2f87c0c52db11545f6))
* sscache job ([885e25e](https://github.com/nihmadev/OpenVibe/commit/885e25eee9ae3e3ad413749dc713fa912cf77366))
* **terminal:** integrate portable-pty for proper session handling and update UI ([4ae3a6f](https://github.com/nihmadev/OpenVibe/commit/4ae3a6f684bd2845f015c992e2c6fd7afb1ce530))
* **ui:** adjust code block height, padding, copy trimming and context menu checkboxes ([0d82c52](https://github.com/nihmadev/OpenVibe/commit/0d82c529ca59eb36736ee76f340c3f016b16c4b4))
* **ui:** adjust editor panel resizing constraints ([9dfeb0c](https://github.com/nihmadev/OpenVibe/commit/9dfeb0cc1b4ea8073af998a8ce8440967d4c5bfa))
* update monaco typescript paths after deps upgrade ([3224ff0](https://github.com/nihmadev/OpenVibe/commit/3224ff0c82160f6ac26c93df8a20ab89dc0d8e5b))
* **vite:** convert manualChunks object to function for Rolldown compatibility ([7d94978](https://github.com/nihmadev/OpenVibe/commit/7d9497866b4a43c1b2a103d69613cf19814f3de4))


### Performance Improvements

* **agent:** pre-initialize agent instance on app startup when credentials are valid ([fb0663b](https://github.com/nihmadev/OpenVibe/commit/fb0663b36b925766d0347316c3a51c842e408da5))
* **app:** optimize initialization with parallel preloading and background warm-up ([ef5bef6](https://github.com/nihmadev/OpenVibe/commit/ef5bef6900434c28221f810074d4a236d828c3fe))
* **mcp:** optimize npx startup time and add starting status state ([69b7f58](https://github.com/nihmadev/OpenVibe/commit/69b7f586514442cc63fe9242059e03323220ef11))


### Miscellaneous Chores

* force release version 1.3.1 ([fa6f40b](https://github.com/nihmadev/OpenVibe/commit/fa6f40ba1e36c2e5a46ca0a509476e1c7d8ae997))

## [1.3.0] - 2026-07-15

### Added

- **Model Context Protocol (MCP) Integration**:
  - Full MCP client backend crate (`crates/mcp`) supporting JSON-RPC transport and local/stdio server management.
  - Dedicated MCP settings management panel (`McpSettingsPanel.tsx`) for adding, editing, enabling/disabling stdio servers, environment variables, and argument lists.
  - Live MCP status dropdown indicator in the titlebar showing active servers, tool counts, and connection states.
  - Interactive tool execution visualization in agent chat trajectory (`AgentToolView.tsx`) with live streaming of arguments, raw outputs, execution timing, and status badges.

- **Fast Search in Code Engine & UI**:
  - Integrated high-performance code content search panel (`SearchInCode.tsx`) featuring a dual view: Virtualized List View (powered by `@tanstack/react-virtual`) and Hierarchical Tree View.
  - Support for multi-threaded file walking (`jwalk`), `.gitignore` filter parsing, match caching, regex search, case-sensitive matching, whole-word matching, and include/exclude glob patterns.
  - Live syntax highlighting of search result snippets with instant click-to-navigate cursor jumping directly in Monaco Editor tabs.
  - Hotkey binding (`Ctrl+Shift+F`) and Command Palette search commands integration.

- **Smart Context Generation 2 (SCG2)**:
  - Integrated SCG2 intelligent code context engine (`crates/scg2`) with lightweight AST symbol extraction (structs, functions, classes, interfaces, traits) across Rust, TS, JS, Python, and Go.
  - Multi-factor context relevance scoring combining file recency decay, active tab focus, cursor position proximity, editor diagnostics, and uncommitted git delta changes.
  - Automated editor activity tracking (`scg2Tracker.ts`) streaming cursor and tab state via Tauri IPC (`scg2_push_event`) to continuously supply relevant context snippets for AI prompt assembly.

- **Git Workspace Crate (`crates/git`)**:
  - Dedicated backend module for git repository state inspection, branch name detection, unstaged/staged file status, diff computation, commit log parsing, and file modification recency analytics.

- **Workspace Custom Rules (.viberules)**:
  - Native loading and prompt injection of project-specific AI coding rules from `.viberules`, `AGENTS.md`, and `.cursorrules` located in the root of open workspace directories.

- **Gruvbox Color Themes**:
  - Added 3 Gruvbox theme variants: **Gruvbox Hard**, **Gruvbox Medium**, and **Gruvbox Soft**.

- **Custom AI Provider Extensions**:
  - Enhanced custom provider configuration with custom SVG icon selection, custom models API list URL, custom JSON headers override, and fine-grained parameter controls (temperature, top_p, penalty).

- **Editor Type Preloading Optimization**:
  - Extracted TypeScript declaration preloader to dedicated `crates/editor` crate, batching workspace `.d.ts` loading into a single fast IPC response.

### Fixed & Improved

- Fixed a critical infinite loop bug in search line syntax highlighter (`syntaxHighlightLine`) when processing empty queries.
- Fixed React hooks linting configuration and prettier format rules for CI quality checks.
- Resolved Rust Clippy strict compiler warnings (`unnecessary_sort_by`, `manual_ok_err`, `needless_borrow`, `manual_strip`, `collapsible_if`, `map_flatten`, `format_in_format_args`) across all 11 workspace crates.
- Configured workspace-level `clippy.toml` with `too-many-arguments-threshold = 12`.
- Refactored SVG icon rendering into a unified, modular icon library component system (`src/components/icons/`).
- Updated translations for MCP controls and code search across all 38 supported UI languages.

## [1.2.0] - 2026-07-11

### Added

- Initial public release
- AI agent with file read/write/edit, terminal execution, code search
- Monaco Editor with tabbed interface
- Real PTY terminal via xterm.js
- SQLite-based chat persistence and project management
- 38 UI languages, 17 themes, 230 file type icons
- 11 built-in AI providers + custom OpenAI-compatible endpoints
- Vector search (fastembed) and regex code search
- Drag-and-drop file management, @-mention file attachment
- Keyboard shortcuts, window zoom, completion sounds
- Cross-platform builds (Windows, macOS, Linux)
- Automated CI/CD pipeline with GitHub Actions
