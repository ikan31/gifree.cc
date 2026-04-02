.PHONY: all build-wasm wasm-exec web dev clean fmt lint

S3_FRONTEND_BUCKET ?= gifree.cc

GOROOT := $(shell go env GOROOT)

# Copy the wasm_exec.js glue that matches the installed Go version
wasm-exec:
	cp $(GOROOT)/lib/wasm/wasm_exec.js web/public/wasm_exec.js

# Build the Go WASM binary
build-wasm:
	GOOS=js GOARCH=wasm go build -ldflags="-s -w" -trimpath -o web/public/gifree.wasm ./cmd/wasm

# Build the React frontend (WASM must already be in web/public/)
web: build-wasm wasm-exec
	cd web && npm install && npm run build

# Local development: build WASM then start Vite
dev: build-wasm wasm-exec
	cd web && npm run dev

# Deploy frontend to S3
deploy: web
	aws s3 sync web/dist/ s3://$(S3_FRONTEND_BUCKET)/ --delete

# Format all Go code
fmt:
	golangci-lint fmt
	golines --max-len=100 -w .

# Lint all Go code
lint:
	golangci-lint cache clean
	golangci-lint run ./gif/...
	GOOS=js GOARCH=wasm golangci-lint run ./cmd/wasm/...

clean:
	rm -f web/public/gifree.wasm web/public/wasm_exec.js
	rm -rf web/dist/ web/node_modules/
