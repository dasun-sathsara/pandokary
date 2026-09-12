.PHONY: build test lint vet format install clean

build:
	mkdir -p bin
	go build -o bin/pdy ./cmd/pdy

test:
	go test ./...
	npm test

lint:
	golangci-lint run
	npm run check

vet:
	go vet ./...

format:
	go fmt ./...
	npm run format

install: build
	go install ./cmd/pdy

clean:
	rm -rf bin
