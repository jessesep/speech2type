#!/bin/bash
# Build the focus-checker Swift binary
cd "$(dirname "$0")"
swiftc -O -o bin/focus-checker swift/focus-checker.swift
echo "Built focus-checker"
./bin/focus-checker
