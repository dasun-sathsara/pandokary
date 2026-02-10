GOOS := $(shell go env GOOS)
EXE :=
MKDIR_BIN := mkdir -p bin
RM_ASSETS := rm -rf bin/assets
COPY_ASSETS := cp -r assets bin/

# Windows PowerShell-friendly overrides
ifeq ($(GOOS),windows)
EXE := .exe
MKDIR_BIN := powershell -NoProfile -Command "New-Item -ItemType Directory -Force 'bin' | Out-Null"
RM_ASSETS := powershell -NoProfile -Command "if (Test-Path 'bin/assets') { Remove-Item -Recurse -Force 'bin/assets' }"
COPY_ASSETS := powershell -NoProfile -Command "Copy-Item -Recurse -Force -Path 'assets' -Destination 'bin'"
endif

BIN := bin/pdy$(EXE)

.PHONY: build

build:
	$(MKDIR_BIN)
	go build -o $(BIN) ./cmd/pdy
	$(RM_ASSETS)
	$(COPY_ASSETS)
