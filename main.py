import os
import socket
import subprocess
import atexit
from http.client import HTTPConnection

NODE_PORT = int(os.environ.get("NODE_INTERNAL_PORT", "3001"))
CHUNK_SIZE = 65536
node_process = None


def _is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", port)) == 0


def _start_node():
    global node_process
    if _is_port_in_use(NODE_PORT):
        return

    env = {**os.environ, "PORT": str(NODE_PORT)}
    cwd = os.path.dirname(os.path.abspath(__file__))

    if os.environ.get("NODE_ENV") == "production":
        cmd = ["node", "dist/index.cjs"]
    else:
        env["NODE_ENV"] = "development"
        cmd = ["npx", "tsx", "server/index.ts"]

    node_process = subprocess.Popen(cmd, env=env, cwd=cwd)


def _stop_node():
    global node_process
    if node_process and node_process.poll() is None:
        node_process.terminate()
        try:
            node_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            node_process.kill()


_start_node()
atexit.register(_stop_node)


def _read_chunked(stream, length):
    if length is None:
        return None
    length = int(length)
    chunks = []
    remaining = length
    while remaining > 0:
        chunk = stream.read(min(remaining, CHUNK_SIZE))
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def app(environ, start_response):
    method = environ["REQUEST_METHOD"]
    path = environ.get("PATH_INFO", "/")
    query = environ.get("QUERY_STRING", "")
    if query:
        path = f"{path}?{query}"

    content_length = environ.get("CONTENT_LENGTH")
    body = _read_chunked(environ["wsgi.input"], content_length) if content_length else None

    headers = {}
    for key, value in environ.items():
        if key.startswith("HTTP_"):
            header_name = key[5:].replace("_", "-")
            if header_name.lower() not in ("host",):
                headers[header_name] = value
    if "CONTENT_TYPE" in environ:
        headers["Content-Type"] = environ["CONTENT_TYPE"]
    if content_length:
        headers["Content-Length"] = content_length
    headers["Host"] = f"localhost:{NODE_PORT}"

    try:
        conn = HTTPConnection("localhost", NODE_PORT, timeout=120)
        conn.request(method, path, body=body, headers=headers)
        resp = conn.getresponse()

        resp_headers = []
        for name, value in resp.getheaders():
            if name.lower() in ("transfer-encoding",):
                continue
            resp_headers.append((name, value))

        response_body = resp.read()
        start_response(f"{resp.status} {resp.reason}", resp_headers)
        conn.close()
        return [response_body]
    except Exception as e:
        start_response("502 Bad Gateway", [("Content-Type", "text/plain")])
        return [f"Node.js server not ready: {str(e)}".encode()]
