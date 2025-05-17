#!/usr/bin/env python3
import http.server
import socketserver
import os
import sys

# Set the directory to serve files from
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    # Set the directory
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    # Add CORS headers to allow the application to make API calls
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept')
        super().end_headers()

if __name__ == "__main__":
    # Try ports in sequence until one works
    ports_to_try = [8000, 8080, 9000, 8888]
    
    for PORT in ports_to_try:
        try:
            with socketserver.TCPServer(("", PORT), Handler) as httpd:
                print(f"Server started at http://localhost:{PORT}")
                print(f"Serving files from: {DIRECTORY}")
                print("Press Ctrl+C to stop the server.")
                
                # Open browser automatically if on macOS
                if sys.platform == 'darwin':
                    os.system(f"open http://localhost:{PORT}")
                
                httpd.serve_forever()
        except OSError as e:
            if e.errno == 48:  # Address already in use
                print(f"Port {PORT} is already in use, trying next port...")
                continue
            else:
                raise
        break
    else:
        print("Could not find an available port. Please close other servers and try again.")
