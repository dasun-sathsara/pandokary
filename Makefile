.PHONY: build test lint format install clean

build:
	mkdir -p bin
	go build -o bin/pdy ./cmd/pdy

test:
	go test ./...

lint:
	golangci-lint run
	npm run check

format:
	go fmt ./...
	npm run format

install: build
	go install ./cmd/pdy

clean:
	rm -rf bin
