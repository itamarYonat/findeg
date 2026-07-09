"""Tiny wrapper around python -m http.server that honors a PORT env var (falls
back to 8358) - lets the Claude Code preview tool's autoPort fallback actually
work when 8358 is taken, instead of silently binding to the wrong port."""
import os
from http.server import test, SimpleHTTPRequestHandler

port = int(os.environ.get("PORT", "8358"))
test(HandlerClass=SimpleHTTPRequestHandler, port=port, bind="127.0.0.1")
