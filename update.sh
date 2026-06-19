#!/bin/bash
set -e

cd "$(dirname "$0")"

git pull

cd server
go get -u
go mod tidy
go build -o caretaker .
