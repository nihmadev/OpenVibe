.PHONY: dev dev:src dev:tauri build build:src build:tauri test lint format typecheck check clean setup api api-run

dev:
	npm run dev:tauri

dev:src:
	npm run dev:src

dev:tauri:
	npm run dev:tauri

build:
	npm run build

build:src:
	npm run build:src

build:tauri:
	npm run build:tauri

test:
	npm run test && cargo test

lint:
	npm run lint && cargo clippy -- -D warnings

format:
	npm run format && cargo fmt

typecheck:
	npm run typecheck

check: typecheck lint format
	npm run audit

clean:
	npm run clean

setup:
	npm run setup

cli:
	cargo build -p openvibe-cli

cli-run:
	cargo run -p openvibe-cli

cli-check:
	cargo check -p openvibe-cli

docker-build:
	docker build -t openvibe-builder .

docker-build-release:
	docker build --target release --output=release .
