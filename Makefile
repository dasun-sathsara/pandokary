GOOS := $(shell go env GOOS)
EXE :=
MKDIR_BIN := mkdir -p bin
RM_BIN := rm -rf bin

# Windows PowerShell-friendly overrides
ifeq ($(GOOS),windows)
EXE := .exe
MKDIR_BIN := powershell -NoProfile -Command "New-Item -ItemType Directory -Force 'bin' | Out-Null"
RM_BIN := powershell -NoProfile -Command "if (Test-Path 'bin') { Remove-Item -Recurse -Force 'bin' }"
endif

BIN := bin/pdy$(EXE)

.PHONY: build clean

build:
	$(MKDIR_BIN)
	go build -o $(BIN) ./cmd/pdy

clean:
	$(RM_BIN)
