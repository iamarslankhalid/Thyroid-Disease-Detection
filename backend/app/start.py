"""Start uvicorn on the port the host injected, or 8000 locally.

Render sets PORT. Local Docker and the image HEALTHCHECK leave it unset.
"""

from __future__ import annotations

import os

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=port, proxy_headers=True)
